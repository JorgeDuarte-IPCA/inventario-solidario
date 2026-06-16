// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/users.js - MEMBRO 1: Gestao de utilizadores (RBAC)
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { locateAndAssign } = require('../config/geo');
const { sendMail } = require('../config/mailer');

const router = express.Router();

// Listar utilizadores internos (admin e tecnico social) - exclui carenciados/doadores
router.get('/', authenticate, authorize('admin', 'social_technician'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.is_approved, u.created_at,
            b.household_size
       FROM users u
       LEFT JOIN beneficiaries b ON b.user_id = u.id
      WHERE u.role IN ('admin','social_technician','warehouse_operator')
      ORDER BY u.is_approved ASC, u.id`
  );
  res.json(rows);
});

// Criar utilizador (admin e tecnico social) - ja aprovado
router.post('/', authenticate, authorize('admin', 'social_technician'), async (req, res) => {
  let conn;
  try {
    const { name, email, password, role, household_size, address, postal_code, city, phone } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'Campos obrigatorios em falta' });

    // Geolocalizar a morada (para carenciados e doadores associarem armazem)
    const moradaCompleta = [address, postal_code, city].filter(Boolean).join(', ');
    let geo = { lat: null, lon: null, warehouseId: null };
    if (moradaCompleta && ['beneficiary', 'donor'].includes(role)) {
      geo = await locateAndAssign(moradaCompleta);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const hash = await bcrypt.hash(password, 10);
    const [r] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, address, postal_code, city, phone, is_approved) VALUES (?,?,?,?,?,?,?,?,TRUE)',
      [name, email, hash, role, address || null, postal_code || null, city || null, phone || null]
    );
    // Carenciado: guardar agregado familiar + morada + geo
    if (role === 'beneficiary') {
      await conn.query(
        `INSERT INTO beneficiaries (user_id, household_size, address, postal_code, city, phone, latitude, longitude, warehouse_id, status)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [r.insertId, Number(household_size) || 1, address || null, postal_code || null, city || null, phone || null, geo.lat, geo.lon, geo.warehouseId, 'active']
      );
    } else if (role === 'donor') {
      await conn.query(
        `INSERT INTO donors (user_id, contact_person, phone, address, postal_code, city, latitude, longitude, warehouse_id, type)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [r.insertId, name, phone || null, address || null, postal_code || null, city || null, geo.lat, geo.lon, geo.warehouseId, 'individual']
      );
    }
    await conn.commit();
    res.status(201).json({ id: r.insertId, name, email, role });
  } catch (e) {
    if (conn) await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Email ja existe' });
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    if (conn) conn.release();
  }
});

// Aprovar / reprovar registo (admin e tecnico social)
router.patch('/:id/approve', authenticate, authorize('admin', 'social_technician'), async (req, res) => {
  const { is_approved } = req.body;
  await pool.query('UPDATE users SET is_approved = ? WHERE id = ?', [!!is_approved, req.params.id]);

  // Avisar o utilizador por email quando a conta e aprovada
  if (is_approved) {
    try {
      const [[u]] = await pool.query('SELECT name, email, role FROM users WHERE id = ?', [req.params.id]);
      if (u && u.email) {
        await sendMail({
          to: u.email,
          subject: 'A sua conta foi aprovada - Inventário Solidário',
          text: `Olá ${u.name},\n\nA sua conta foi aprovada! Já pode iniciar sessão e utilizar a plataforma.\n\n` +
                `Inventário Solidário`,
        });
      }
    } catch (mailErr) {
      console.error('Aviso: falha ao enviar email de aprovacao:', mailErr.message);
    }
  }

  res.json({ id: Number(req.params.id), is_approved: !!is_approved });
});

// Ativar / desativar utilizador (admin)
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  const { is_active } = req.body;
  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [!!is_active, req.params.id]);
  res.json({ id: Number(req.params.id), is_active: !!is_active });
});

// Listar carenciados e doadores (admin e tecnico social), com armazem associado
// Filtro opcional por armazem: /api/users/clients?warehouse_id=3
router.get('/clients', authenticate, authorize('admin', 'social_technician'), async (req, res) => {
  const { warehouse_id, type } = req.query;

  const partes = [];
  const params = [];

  if (!type || type === 'beneficiary') {
    let sql = `SELECT u.id, u.name, u.email, u.is_approved, 'beneficiary' AS profile_type,
                      b.phone, b.address, b.postal_code, b.city, b.household_size, b.warehouse_id,
                      w.name AS warehouse_name, w.district AS warehouse_district
                 FROM beneficiaries b
                 JOIN users u ON u.id = b.user_id
                 LEFT JOIN warehouses w ON w.id = b.warehouse_id
                WHERE 1=1`;
    if (warehouse_id) { sql += ' AND b.warehouse_id = ?'; params.push(warehouse_id); }
    partes.push(sql);
  }
  if (!type || type === 'donor') {
    let sql = `SELECT u.id, u.name, u.email, u.is_approved, 'donor' AS profile_type,
                      d.phone, d.address, d.postal_code, d.city, NULL AS household_size, d.warehouse_id,
                      w.name AS warehouse_name, w.district AS warehouse_district
                 FROM donors d
                 JOIN users u ON u.id = d.user_id
                 LEFT JOIN warehouses w ON w.id = d.warehouse_id
                WHERE 1=1`;
    if (warehouse_id) { sql += ' AND d.warehouse_id = ?'; params.push(warehouse_id); }
    partes.push(sql);
  }

  const [rows] = await pool.query(partes.join(' UNION ALL ') + ' ORDER BY name', params);
  res.json(rows);
});

// Dados do proprio utilizador (inclui morada/contactos)
router.get('/me', authenticate, async (req, res) => {
  const [[u]] = await pool.query(
    'SELECT id, name, email, role, address, postal_code, city, phone FROM users WHERE id=?',
    [req.user.id]
  );
  if (!u) return res.status(404).json({ error: 'Não encontrado' });
  res.json(u);
});

// Alterar a propria senha (qualquer utilizador autenticado)
router.patch('/me/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: 'Indique a senha atual e a nova' });
    if (new_password.length < 6)
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });

    const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'A senha atual está incorreta' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Admin altera a senha de qualquer utilizador
router.patch('/:id/password', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6)
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;
