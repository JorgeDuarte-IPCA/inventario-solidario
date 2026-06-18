// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// config/stock-alert.js — Alertas de stock minimo.
// Dois tipos de alerta, verificados ao mesmo tempo (entrega ou transferencia):
//
//  1) POR ARMAZEM: o stock de um artigo num armazem desce ao/abaixo do minimo
//     definido para esse armazem.  Recebem: administradores, tecnicos sociais
//     e o proprio armazem (se tiver email).  NAO recebem os doadores.
//
//  2) GLOBAL: o stock TOTAL do artigo (somando todos os armazens) desce ao/abaixo
//     da SOMA dos minimos de todos os armazens.  Recebem: administradores,
//     tecnicos sociais e os doadores.  NAO recebem os armazens.
const pool = require('./db');
const { sendMail } = require('./mailer');

// Evitar emails repetidos.
const alertadosArmazem = new Map(); // "nome|armazem" -> timestamp
const alertadosGlobal = new Map();  // "nome"         -> timestamp
const INTERVALO_MS = 12 * 60 * 60 * 1000; // 12 horas

// Helpers para obter destinatarios
async function getGestores() {
  const [rows] = await pool.query(
    `SELECT name, email FROM users
      WHERE role IN ('admin', 'social_technician') AND is_active = TRUE AND email IS NOT NULL`
  );
  return rows;
}
async function getDoadores() {
  const [rows] = await pool.query(
    `SELECT u.name, u.email
       FROM donors d JOIN users u ON u.id = d.user_id
      WHERE u.is_active = TRUE AND u.email IS NOT NULL`
  );
  return rows;
}

// itens: lista de { nome, warehouseId }
async function verificarStockMinimo(itens) {
  try {
    if (!itens || !itens.length) return;

    // Conjuntos distintos
    const paresArmazem = new Map(); // "nome|wh" -> {nome, warehouseId}
    const nomes = new Set();
    for (const it of itens) {
      if (!it || !it.nome) continue;
      nomes.add(it.nome);
      if (it.warehouseId) paresArmazem.set(it.nome + '|' + it.warehouseId, { nome: it.nome, warehouseId: it.warehouseId });
    }

    const agora = Date.now();

    // ---------- 1) Alerta POR ARMAZEM ----------
    for (const { nome, warehouseId } of paresArmazem.values()) {
      const [[info]] = await pool.query(
        `SELECT SUM(quantity) AS stock, MAX(min_stock) AS minimo
           FROM products WHERE name = ? AND warehouse_id = ?`,
        [nome, warehouseId]
      );
      if (!info || !info.minimo || info.minimo <= 0) continue;
      if (Number(info.stock) > Number(info.minimo)) continue;

      const chave = nome + '|' + warehouseId;
      if (agora - (alertadosArmazem.get(chave) || 0) < INTERVALO_MS) continue;
      alertadosArmazem.set(chave, agora);

      const [[arm]] = await pool.query('SELECT name, email FROM warehouses WHERE id = ?', [warehouseId]);
      const nomeArmazem = arm ? arm.name : ('armazém #' + warehouseId);
      const stock = Number(info.stock), minimo = Number(info.minimo);
      const assunto = `Stock baixo: ${nome} (${nomeArmazem})`;

      // Administradores e tecnicos sociais
      for (const g of await getGestores()) {
        const texto = `Olá ${g.name || ''},\n\n` +
          `Aviso de gestão: o stock do artigo "${nome}" no ${nomeArmazem} atingiu o nível mínimo ` +
          `(atual: ${stock}, mínimo: ${minimo}).\n` +
          `Convém acompanhar o reabastecimento ou redistribuição deste artigo.\n\nInventário Solidário`;
        sendMail({ to: g.email, subject: assunto, text: texto }).catch(() => {});
      }
      // O proprio armazem
      if (arm && arm.email) {
        const texto = `Aviso de stock baixo no ${nomeArmazem}.\n\n` +
          `O artigo "${nome}" atingiu o nível mínimo neste armazém ` +
          `(atual: ${stock}, mínimo: ${minimo}).\n\nInventário Solidário`;
        sendMail({ to: arm.email, subject: assunto, text: texto }).catch(() => {});
      }
    }

    // ---------- 2) Alerta GLOBAL ----------
    for (const nome of nomes) {
      const [[info]] = await pool.query(
        `SELECT SUM(quantity) AS stock, SUM(min_stock) AS minimo_total
           FROM products WHERE name = ?`,
        [nome]
      );
      if (!info || !info.minimo_total || info.minimo_total <= 0) continue;
      if (Number(info.stock) > Number(info.minimo_total)) continue;

      if (agora - (alertadosGlobal.get(nome) || 0) < INTERVALO_MS) continue;
      alertadosGlobal.set(nome, agora);

      const stock = Number(info.stock), minimo = Number(info.minimo_total);

      // Administradores e tecnicos sociais
      for (const g of await getGestores()) {
        const texto = `Olá ${g.name || ''},\n\n` +
          `Aviso de gestão: o stock TOTAL do artigo "${nome}" está baixo ` +
          `(atual: ${stock}, mínimo global: ${minimo}).\n` +
          `Os doadores foram notificados para reabastecer.\n\nInventário Solidário`;
        sendMail({ to: g.email, subject: `Stock total baixo: ${nome}`, text: texto }).catch(() => {});
      }
      // Doadores
      for (const dn of await getDoadores()) {
        const texto = `Olá ${dn.name || ''},\n\n` +
          `O stock do artigo "${nome}" está baixo (atual: ${stock}, mínimo: ${minimo}).\n` +
          `Se puder, agradecíamos uma doação deste tipo de artigo para continuarmos a apoiar as famílias.\n\n` +
          `Obrigado pela sua ajuda.\nInventário Solidário`;
        sendMail({ to: dn.email, subject: 'Pedido de doação: ' + nome + ' (stock baixo)', text: texto }).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Falha no alerta de stock minimo:', e.message);
  }
}

module.exports = { verificarStockMinimo };
