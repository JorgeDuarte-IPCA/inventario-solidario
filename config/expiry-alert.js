// config/expiry-alert.js — Alerta de artigos "a expirar" aos armazens.
// Verifica os lotes cuja validade esta a aproximar-se (estado "a expirar": faltam
// 30 dias ou menos, mas ainda nao expirou) e envia email ao armazem onde estao.
const pool = require('./db');
const { sendMail } = require('./mailer');

// Evitar emails repetidos: guarda o dia em que cada (armazem) ja foi alertado.
const alertadosHoje = new Map(); // warehouse_id -> 'YYYY-MM-DD'

function hojeISO() { return new Date().toISOString().slice(0, 10); }

async function verificarAExpirar() {
  try {
    // Lotes "a expirar": validade entre hoje e +30 dias (ainda nao passou)
    const [linhas] = await pool.query(`
      SELECT p.id, p.name, p.quantity, p.expiry_date,
             w.id AS warehouse_id, w.name AS warehouse_name, w.email AS warehouse_email
        FROM products p
        JOIN warehouses w ON w.id = p.warehouse_id
       WHERE p.quantity > 0
         AND p.expiry_date IS NOT NULL
         AND p.expiry_date >= CURDATE()
         AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       ORDER BY w.id, p.expiry_date`);

    if (!linhas.length) return { enviados: 0 };

    // Agrupar por armazem
    const porArmazem = new Map();
    for (const l of linhas) {
      if (!porArmazem.has(l.warehouse_id)) porArmazem.set(l.warehouse_id, { nome: l.warehouse_name, email: l.warehouse_email, itens: [] });
      porArmazem.get(l.warehouse_id).itens.push(l);
    }

    // Obter operadores de armazem (recurso, caso o armazem nao tenha email definido)
    const [operadores] = await pool.query(
      "SELECT email FROM users WHERE role = 'warehouse_operator' AND is_active = TRUE AND email IS NOT NULL"
    );
    const emailsOperadores = operadores.map(o => o.email);

    const hoje = hojeISO();
    let enviados = 0;

    for (const [warehouseId, info] of porArmazem) {
      // Nao repetir no mesmo dia
      if (alertadosHoje.get(warehouseId) === hoje) continue;

      // Destinatarios: email do armazem, ou (se nao houver) os operadores
      const destinatarios = info.email ? [info.email] : emailsOperadores;
      if (!destinatarios.length) continue;

      const lista = info.itens
        .map(it => `- ${it.name}: ${it.quantity} unidade(s), validade ${it.expiry_date}`)
        .join('\n');
      const assunto = `Artigos a expirar no ${info.nome}`;
      const texto =
        `Olá,\n\nOs seguintes artigos no armazém "${info.nome}" estão a aproximar-se da validade ` +
        `(30 dias ou menos):\n\n${lista}\n\n` +
        `Por favor, dê prioridade à distribuição destes bens.\n\nInventário Solidário`;

      for (const to of destinatarios) {
        sendMail({ to, subject: assunto, text: texto }).catch(() => {});
      }
      alertadosHoje.set(warehouseId, hoje);
      enviados++;
    }
    return { enviados };
  } catch (e) {
    console.error('Falha no alerta de validade:', e.message);
    return { enviados: 0, erro: e.message };
  }
}

module.exports = { verificarAExpirar };
