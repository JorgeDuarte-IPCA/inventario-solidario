// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// config/mailer.js - envio de emails
// Tres modos, por ordem de prioridade:
//   1) API do Brevo (HTTPS, porta 443) - funciona no Render gratuito
//   2) SMTP (nodemailer) - funciona localmente
//   3) Consola (dev) - se nada estiver configurado
// As definicoes vem da tabela `settings` (painel do admin) ou do .env.
const nodemailer = require('nodemailer');
const pool = require('./db');

// Le definicoes guardadas na base de dados (smtp_* e brevo_*)
async function getSettings() {
  try {
    const [rows] = await pool.query(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'smtp_%' OR setting_key LIKE 'brevo_%'"
    );
    const s = {};
    for (const r of rows) s[r.setting_key] = r.setting_value;
    return s;
  } catch (e) {
    return {}; // tabela pode nao existir ainda
  }
}

async function resolveConfig() {
  const db = await getSettings();
  return {
    // Brevo (API)
    brevoKey:  db.brevo_api_key || process.env.BREVO_API_KEY || '',
    brevoFrom: db.brevo_from || process.env.BREVO_FROM || db.smtp_user || process.env.SMTP_USER || '',
    // SMTP
    host:   db.smtp_host   || process.env.SMTP_HOST   || '',
    port:   Number(db.smtp_port || process.env.SMTP_PORT || 587),
    secure: (db.smtp_secure || process.env.SMTP_SECURE) === 'true',
    user:   db.smtp_user   || process.env.SMTP_USER   || '',
    pass:   db.smtp_pass   || process.env.SMTP_PASS   || '',
    from:   db.smtp_from   || process.env.SMTP_FROM   || 'Inventário Solidário <no-reply@caridade.pt>',
  };
}

// Extrai "Nome <email>" -> { name, email }
function parseFrom(from, fallbackEmail) {
  const m = String(from || '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || 'Inventário Solidário', email: m[2] };
  // se "from" e so um email
  if (String(from).includes('@')) return { name: 'Inventário Solidário', email: from };
  return { name: from || 'Inventário Solidário', email: fallbackEmail };
}

// Envio pela API do Brevo (HTTPS)
async function sendViaBrevo(cfg, { to, subject, text, html }) {
  const sender = parseFrom(cfg.brevoFrom, cfg.brevoFrom);
  const body = {
    sender,
    to: [{ email: to }],
    subject,
    textContent: text || undefined,
    htmlContent: html || undefined,
  };
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': cfg.brevoKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const erro = await res.text().catch(() => '');
    throw new Error('Brevo respondeu ' + res.status + ': ' + erro.slice(0, 200));
  }
  return { ok: true, via: 'brevo' };
}

/**
 * Envia um email. Brevo (API) > SMTP > consola.
 */
async function sendMail({ to, subject, text, html }) {
  const cfg = await resolveConfig();

  // 1) Brevo por API (recomendado no Render)
  if (cfg.brevoKey && cfg.brevoFrom) {
    try {
      const r = await sendViaBrevo(cfg, { to, subject, text, html });
      console.log('Email enviado via Brevo para', to);
      return r;
    } catch (e) {
      console.error('Falha ao enviar via Brevo:', e.message);
      return { error: e.message };
    }
  }

  // 2) SMTP
  if (cfg.host) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host, port: cfg.port, secure: cfg.secure,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      });
      const info = await transporter.sendMail({ from: cfg.from, to, subject, text, html });
      console.log('Email enviado via SMTP:', info.messageId);
      return info;
    } catch (e) {
      console.error('Falha ao enviar email (SMTP):', e.message);
      return { error: e.message };
    }
  }

  // 3) Consola (dev)
  console.log('--- EMAIL (modo dev, email nao configurado) ---');
  console.log('Para:', to);
  console.log('Assunto:', subject);
  console.log('Mensagem:', text || html);
  console.log('-----------------------------------------------');
  return { dev: true };
}

async function sendTestMail(to) {
  return sendMail({
    to,
    subject: 'Teste de configuração de email - Inventário Solidário',
    text: 'Se recebeu este email, a configuração de envio está a funcionar corretamente.',
  });
}

module.exports = { sendMail, sendTestMail, resolveConfig };
