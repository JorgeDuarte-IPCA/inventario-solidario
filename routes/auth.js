// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/auth.js - MEMBRO 1: Autenticacao
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { SECRET } = require('../middleware/auth');
const { locateAndAssign } = require('../config/geo');
const { sendMail } = require('../config/mailer');

const router = express.Router();

// POST /api/auth/register - registo publico (fica pendente de aprovacao)
router.post('/register', async (req, res) => {
  let conn;
  try {
    const { name, email, password, role, household_size, address, postal_code, city, phone } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });

    // So permitir auto-registo como doador ou carenciado
    if (!['donor', 'beneficiary'].includes(role))
      return res.status(400).json({ error: 'Tipo de conta inválido para registo' });

    // Carenciado tem de indicar morada completa e telemovel
    if (role === 'beneficiary' && (!address || !postal_code || !city || !phone))
      return res.status(400).json({ error: 'Morada, código postal, cidade e telemóvel são obrigatórios' });

    // Geolocalizar a morada e encontrar o armazem mais proximo
    const moradaCompleta = [address, postal_code, city].filter(Boolean).join(', ');
    let geo = { lat: null, lon: null, warehouseId: null };
    if (moradaCompleta) geo = await locateAndAssign(moradaCompleta);

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const hash = await bcrypt.hash(password, 10);
    const [r] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, address, postal_code, city, phone, is_approved) VALUES (?,?,?,?,?,?,?,?,FALSE)',
      [name, email, hash, role, address || null, postal_code || null, city || null, phone || null]
    );
    if (role === 'beneficiary') {
      await conn.query(
        `INSERT INTO beneficiaries (user_id, household_size, address, postal_code, city, phone, latitude, longitude, warehouse_id, status)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [r.insertId, Number(household_size) || 1, address, postal_code, city, phone, geo.lat, geo.lon, geo.warehouseId, 'active']
      );
    } else {
      await conn.query(
        `INSERT INTO donors (user_id, contact_person, phone, address, postal_code, city, latitude, longitude, warehouse_id, type)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [r.insertId, name, phone || null, address || null, postal_code || null, city || null, geo.lat, geo.lon, geo.warehouseId, 'individual']
      );
    }
    await conn.commit();

    // Email de confirmacao de registo (beneficiarios e doadores)
    try {
      await sendMail({
        to: email,
        subject: 'Registo recebido - Inventário Solidário',
        text: `Olá ${name},\n\nO seu registo como ${role === 'donor' ? 'doador' : 'beneficiário'} foi recebido ` +
              `com sucesso e está a aguardar aprovação por parte da nossa equipa. ` +
              `Será avisado por email assim que a sua conta for aprovada.\n\n` +
              `Obrigado por se juntar ao Inventário Solidário.`,
      });
    } catch (mailErr) {
      console.error('Aviso: falha ao enviar email de registo:', mailErr.message);
    }

    res.status(201).json({ ok: true, message: 'Registo submetido. Aguarda aprovação.' });
  } catch (e) {
    if (conn) await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Já existe uma conta com esse email' });
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e password obrigatorios' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(401).json({ error: 'Credenciais invalidas' });

    const user = rows[0];
    if (!user.is_active)
      return res.status(403).json({ error: 'Conta desativada' });

    if (!user.is_approved)
      return res.status(403).json({ error: 'A sua conta ainda aguarda aprovação. Tente mais tarde.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais invalidas' });

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/auth/forgot - pedir recuperacao de senha (envia email com link)
router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Indique o email' });

    const [[user]] = await pool.query('SELECT id, name FROM users WHERE email = ?', [email]);

    // Resposta sempre igual (nao revelar se o email existe ou nao)
    const respostaGenerica = { ok: true, message: 'Se o email existir, será enviado um link de recuperação.' };

    if (!user) return res.json(respostaGenerica);

    // Gerar token seguro e guardar com validade de 1 hora
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?,?,?)',
      [user.id, token, expira]
    );

    // Construir o link (usa a origem do pedido)
    const base = `${req.protocol}://${req.get('host')}`;
    const link = `${base}/reset.html?token=${token}`;

    await sendMail({
      to: email,
      subject: 'Recuperação de senha - Inventário Solidário',
      text: `Olá ${user.name},\n\nRecebemos um pedido para redefinir a sua senha. ` +
            `Aceda à ligação seguinte (válida durante 1 hora):\n\n${link}\n\n` +
            `Se não foi você, ignore este email.\n\nInventário Solidário`,
    });

    res.json(respostaGenerica);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/auth/reset - definir nova senha a partir do token
router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });

    const [[pr]] = await pool.query(
      'SELECT id, user_id, expires_at, used FROM password_resets WHERE token = ?',
      [token]
    );
    if (!pr || pr.used) return res.status(400).json({ error: 'Link inválido ou já utilizado' });
    if (new Date(pr.expires_at) < new Date()) return res.status(400).json({ error: 'Link expirado. Peça um novo.' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, pr.user_id]);
    await pool.query('UPDATE password_resets SET used = TRUE WHERE id = ?', [pr.id]);

    res.json({ ok: true, message: 'Senha alterada com sucesso. Já pode entrar.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;
