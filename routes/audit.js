// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/audit.js — Consulta do registo de auditoria (apenas admin).
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, user_name, action, entity, entity_id, details, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT 300`
  );
  res.json(rows);
});

module.exports = router;
