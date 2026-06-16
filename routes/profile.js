// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/profile.js - Alteracao de dados pessoais com validacao
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { locateAndAssign } = require('../config/geo');

const router = express.Router();

// Aplicar os dados (morada/contactos) a users + perfil (beneficiary/donor) e re-geolocalizar
async function aplicarDados(conn, userId, dados) {
  const { address, postal_code, city, phone } = dados;
  await conn.query(
    'UPDATE users SET address=?, postal_code=?, city=?, phone=? WHERE id=?',
    [address || null, postal_code || null, city || null, phone || null, userId]
  );
  // Geolocalizar e reassociar ao armazem mais proximo
  const moradaCompleta = [address, postal_code, city].filter(Boolean).join(', ');
  let geo = { lat: null, lon: null, warehouseId: null };
  if (moradaCompleta) { try { geo = await locateAndAssign(moradaCompleta); } catch {} }

  // Atualizar a tabela de perfil conforme o papel
  const [[u]] = await conn.query('SELECT role FROM users WHERE id=?', [userId]);
  if (u && u.role === 'beneficiary') {
    await conn.query(
      'UPDATE beneficiaries SET address=?, postal_code=?, city=?, phone=?, latitude=?, longitude=?, warehouse_id=? WHERE user_id=?',
      [address || null, postal_code || null, city || null, phone || null, geo.lat, geo.lon, geo.warehouseId, userId]
    );
  } else if (u && u.role === 'donor') {
    await conn.query(
      'UPDATE donors SET phone=?, address=?, postal_code=?, city=?, latitude=?, longitude=?, warehouse_id=? WHERE user_id=?',
      [phone || null, address || null, postal_code || null, city || null, geo.lat, geo.lon, geo.warehouseId, userId]
    );
  }
}

// O proprio utilizador submete um pedido de alteracao dos seus dados
router.post('/change-request', authenticate, async (req, res) => {
  try {
    const { address, postal_code, city, phone } = req.body;
    // Cancelar pedidos pendentes anteriores (fica so o mais recente)
    await pool.query("UPDATE profile_change_requests SET status='rejected', decided_at=NOW() WHERE user_id=? AND status='pending'", [req.user.id]);
    await pool.query(
      'INSERT INTO profile_change_requests (user_id, address, postal_code, city, phone) VALUES (?,?,?,?,?)',
      [req.user.id, address || null, postal_code || null, city || null, phone || null]
    );
    res.status(201).json({ ok: true, message: 'Pedido de alteração submetido. Aguarda validação.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// O proprio ve se tem um pedido pendente
router.get('/my-change-request', authenticate, async (req, res) => {
  const [[pcr]] = await pool.query(
    "SELECT * FROM profile_change_requests WHERE user_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1",
    [req.user.id]
  );
  res.json(pcr || null);
});

// Admin/tecnico: listar pedidos de alteracao pendentes
router.get('/change-requests', authenticate, authorize('admin', 'social_technician'), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT pcr.*, u.name, u.email, u.role,
           u.address AS atual_address, u.postal_code AS atual_postal, u.city AS atual_city, u.phone AS atual_phone
      FROM profile_change_requests pcr
      JOIN users u ON u.id = pcr.user_id
     WHERE pcr.status='pending'
     ORDER BY pcr.created_at DESC`);
  res.json(rows);
});

// Admin/tecnico: aprovar um pedido (aplica os dados)
router.patch('/change-requests/:id/approve', authenticate, authorize('admin', 'social_technician'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[pcr]] = await conn.query("SELECT * FROM profile_change_requests WHERE id=? AND status='pending'", [req.params.id]);
    if (!pcr) { await conn.rollback(); return res.status(404).json({ error: 'Pedido não encontrado' }); }
    await aplicarDados(conn, pcr.user_id, pcr);
    await conn.query("UPDATE profile_change_requests SET status='approved', decided_at=NOW() WHERE id=?", [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    if (conn) await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    if (conn) conn.release();
  }
});

// Admin/tecnico: rejeitar um pedido
router.patch('/change-requests/:id/reject', authenticate, authorize('admin', 'social_technician'), async (req, res) => {
  await pool.query("UPDATE profile_change_requests SET status='rejected', decided_at=NOW() WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

// Admin/tecnico: editar diretamente um cliente (inclui agregado familiar)
router.put('/client/:userId', authenticate, authorize('admin', 'social_technician'), async (req, res) => {
  let conn;
  try {
    const { name, address, postal_code, city, phone, household_size } = req.body;
    conn = await pool.getConnection();
    await conn.beginTransaction();
    if (name) await conn.query('UPDATE users SET name=? WHERE id=?', [name, req.params.userId]);
    await aplicarDados(conn, req.params.userId, { address, postal_code, city, phone });
    // Agregado familiar: so admin/tecnico (esta rota ja e restrita)
    if (household_size != null) {
      await conn.query('UPDATE beneficiaries SET household_size=? WHERE user_id=?',
        [Number(household_size) || 1, req.params.userId]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    if (conn) await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
