// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// config/stock-alert.js — Alerta de stock minimo aos doadores.
// Quando um artigo (agrupado por nome) desce ao/abaixo do stock minimo definido,
// envia um email aos doadores a pedir esse tipo de artigo.
const pool = require('./db');
const { sendMail } = require('./mailer');

// Para nao enviar emails repetidos a cada entrega, guardamos em memoria
// os artigos ja alertados nas ultimas horas.
const alertadosRecentemente = new Map(); // nome -> timestamp
const INTERVALO_MS = 12 * 60 * 60 * 1000; // 12 horas

async function verificarStockMinimo(nomesArtigos) {
  try {
    if (!nomesArtigos || !nomesArtigos.length) return;
    const nomesUnicos = [...new Set(nomesArtigos)];

    for (const nome of nomesUnicos) {
      // Stock total e minimo do artigo (agrupado por nome, somando lotes)
      const [[info]] = await pool.query(
        `SELECT SUM(quantity) AS stock, MAX(min_stock) AS minimo
           FROM products WHERE name = ?`, [nome]
      );
      if (!info || !info.minimo || info.minimo <= 0) continue;       // sem minimo definido
      if (Number(info.stock) > Number(info.minimo)) continue;        // ainda acima do minimo

      // Evitar repeticao recente
      const agora = Date.now();
      const ultimo = alertadosRecentemente.get(nome) || 0;
      if (agora - ultimo < INTERVALO_MS) continue;
      alertadosRecentemente.set(nome, agora);

      // Obter os emails dos doadores ativos
      const [doadores] = await pool.query(
        `SELECT u.name, u.email
           FROM donors d JOIN users u ON u.id = d.user_id
          WHERE u.is_active = TRUE AND u.email IS NOT NULL`
      );

      // Obter os emails dos administradores e tecnicos sociais ativos (aviso de gestao)
      const [gestores] = await pool.query(
        `SELECT name, email FROM users
          WHERE role IN ('admin', 'social_technician') AND is_active = TRUE AND email IS NOT NULL`
      );

      if (!doadores.length && !gestores.length) continue;

      const assunto = `Stock baixo: ${nome}`;

      // Mensagem aos doadores: pedido de doacao
      for (const dn of doadores) {
        const texto = `Olá ${dn.name || ''},\n\n` +
          `O stock do artigo "${nome}" está baixo (atual: ${Number(info.stock)}, mínimo: ${Number(info.minimo)}).\n` +
          `Se puder, agradecíamos uma doação deste tipo de artigo para continuarmos a apoiar as famílias.\n\n` +
          `Obrigado pela sua ajuda.\nInventário Solidário`;
        sendMail({ to: dn.email, subject: 'Pedido de doação: ' + nome + ' (stock baixo)', text: texto }).catch(() => {});
      }

      // Mensagem aos gestores (admin/tecnico): aviso de gestao
      for (const g of gestores) {
        const texto = `Olá ${g.name || ''},\n\n` +
          `Aviso de gestão: o stock do artigo "${nome}" atingiu o nível mínimo ` +
          `(atual: ${Number(info.stock)}, mínimo: ${Number(info.minimo)}).\n` +
          `Os doadores foram notificados, mas convém acompanhar o reabastecimento deste artigo.\n\n` +
          `Inventário Solidário`;
        sendMail({ to: g.email, subject: assunto, text: texto }).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Falha no alerta de stock minimo:', e.message);
  }
}

module.exports = { verificarStockMinimo };
