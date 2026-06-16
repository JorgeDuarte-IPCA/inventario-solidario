// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/inventory.js - MEMBRO 2: Movimentos de stock (auditavel)
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Listar movimentos
router.get('/', authenticate, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.*, p.name AS product_name
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
      ORDER BY m.occurred_at DESC LIMIT 100`
  );
  res.json(rows);
});

// Criar movimento e aplicar ao stock
router.post('/', authenticate, authorize('admin', 'warehouse_operator'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { product_id, type, quantity, reason, source_location, target_location, request_id } = req.body;
    if (!product_id || !type || !quantity)
      return res.status(400).json({ error: 'Dados em falta' });

    await conn.beginTransaction();

    // Regista o movimento
    await conn.query(
      `INSERT INTO inventory_movements (product_id, request_id, type, quantity, reason, source_location, target_location)
       VALUES (?,?,?,?,?,?,?)`,
      [product_id, request_id || null, type, quantity, reason || null, source_location || null, target_location || null]
    );

    // Aplica ao stock
    const delta = (type === 'in') ? quantity : (type === 'out') ? -quantity : 0;
    if (delta !== 0)
      await conn.query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [delta, product_id]);

    await conn.commit();
    res.status(201).json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    conn.release();
  }
});

module.exports = router;
