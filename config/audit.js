// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// config/audit.js — Registo de auditoria de acoes sensiveis.
// Uso: await registar(req, 'update', 'product', id, 'Quantidade 50 -> 20');
const pool = require('./db');

async function registar(req, action, entity, entityId, details) {
  try {
    const user = req && req.user ? req.user : {};
    await pool.query(
      `INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, details)
       VALUES (?,?,?,?,?,?)`,
      [user.id || null, user.name || user.email || 'sistema', action, entity || null,
       entityId != null ? String(entityId) : null, details || null]
    );
  } catch (e) {
    // O log de auditoria nunca deve quebrar a operacao principal.
    console.error('Falha ao registar auditoria:', e.message);
  }
}

module.exports = { registar };
