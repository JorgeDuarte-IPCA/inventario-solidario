// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/settings.js - MEMBRO 1: Configuracoes (SMTP) - so admin
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendTestMail } = require('../config/mailer');

const router = express.Router();

const CHAVES_SMTP = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from',
                     'brevo_api_key', 'brevo_from'];

// GET /api/settings/smtp - obter config atual (a password nao e devolvida)
router.get('/smtp', authenticate, authorize('admin'), async (req, res) => {
  const [rows] = await pool.query(
    "SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'smtp_%' OR setting_key LIKE 'brevo_%'"
  );
  const s = {};
  for (const r of rows) s[r.setting_key] = r.setting_value;
  res.json({
    smtp_host: s.smtp_host || '',
    smtp_port: s.smtp_port || '587',
    smtp_secure: s.smtp_secure || 'false',
    smtp_user: s.smtp_user || '',
    smtp_from: s.smtp_from || '',
    // indica se ha password guardada, sem a revelar
    smtp_pass_set: s.smtp_pass ? true : false,
    // Brevo
    brevo_from: s.brevo_from || '',
    brevo_key_set: s.brevo_api_key ? true : false,
  });
});

// PUT /api/settings/smtp - guardar config
router.put('/smtp', authenticate, authorize('admin'), async (req, res) => {
  try {
    const body = req.body || {};
    for (const chave of CHAVES_SMTP) {
      // Se a password/chave vier vazia, nao a sobrescreve (mantem a existente)
      if (chave === 'smtp_pass' && (body.smtp_pass === undefined || body.smtp_pass === '')) continue;
      if (chave === 'brevo_api_key' && (body.brevo_api_key === undefined || body.brevo_api_key === '')) continue;
      if (body[chave] === undefined) continue;
      await pool.query(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [chave, String(body[chave])]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao guardar configuração' });
  }
});

// POST /api/settings/smtp/test - enviar email de teste
router.post('/smtp/test', authenticate, authorize('admin'), async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Indique um email de destino' });
  const r = await sendTestMail(to);
  if (r.error) return res.status(500).json({ error: 'Falha no envio: ' + r.error });
  if (r.dev) return res.json({ ok: true, dev: true, message: 'SMTP não configurado — email mostrado na consola.' });
  res.json({ ok: true, message: 'Email de teste enviado.' });
});

// Obter o intervalo minimo entre pedidos (controlo de frequencia)
router.get('/request-interval', authenticate, authorize('admin'), async (req, res) => {
  const [[row]] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'request_interval_days'");
  res.json({ days: row ? parseInt(row.setting_value, 10) || 0 : 0 });
});

// Definir o intervalo minimo entre pedidos (0 = desligado)
router.put('/request-interval', authenticate, authorize('admin'), async (req, res) => {
  const days = Math.max(0, parseInt(req.body.days, 10) || 0);
  await pool.query(
    `INSERT INTO settings (setting_key, setting_value) VALUES ('request_interval_days', ?)
     ON DUPLICATE KEY UPDATE setting_value = ?`,
    [String(days), String(days)]
  );
  res.json({ days });
});

module.exports = router;
