// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/transfers.js - Transferencias de stock entre armazens (documento + itens)
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { verificarStockMinimo } = require('../config/stock-alert');

const router = express.Router();

// Listar transferencias (uma linha por documento)
router.get('/', authenticate, authorize('admin', 'warehouse_operator', 'social_technician'), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT t.id, t.code, t.from_warehouse_id, t.to_warehouse_id, t.notes, t.created_by, t.created_at,
           wf.name AS from_name, wt.name AS to_name, u.name AS created_by_name,
           COUNT(ti.id) AS num_itens, COALESCE(SUM(ti.quantity),0) AS total_qty
      FROM stock_transfers t
      JOIN warehouses wf ON wf.id = t.from_warehouse_id
      JOIN warehouses wt ON wt.id = t.to_warehouse_id
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN stock_transfer_items ti ON ti.transfer_id = t.id
     GROUP BY t.id, t.code, t.from_warehouse_id, t.to_warehouse_id, t.notes, t.created_by, t.created_at,
              wf.name, wt.name, u.name
     ORDER BY t.created_at DESC`);
  res.json(rows);
});

// Detalhe de uma transferencia (com itens)
router.get('/:id', authenticate, authorize('admin', 'warehouse_operator', 'social_technician'), async (req, res) => {
  const [[t]] = await pool.query(`
    SELECT t.*, wf.name AS from_name, wt.name AS to_name, u.name AS created_by_name
      FROM stock_transfers t
      JOIN warehouses wf ON wf.id = t.from_warehouse_id
      JOIN warehouses wt ON wt.id = t.to_warehouse_id
      LEFT JOIN users u ON u.id = t.created_by
     WHERE t.id = ?`, [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Transferência não encontrada' });
  const [items] = await pool.query(
    'SELECT * FROM stock_transfer_items WHERE transfer_id = ?', [req.params.id]);
  res.json({ ...t, items });
});

// Criar transferencia de varios artigos (admin e operador de armazem)
router.post('/', authenticate, authorize('admin', 'warehouse_operator'), async (req, res) => {
  let conn;
  try {
    const { from_warehouse_id, to_warehouse_id, notes, items } = req.body;

    if (!from_warehouse_id || !to_warehouse_id)
      return res.status(400).json({ error: 'Indique o armazém de origem e de destino' });
    if (from_warehouse_id == to_warehouse_id)
      return res.status(400).json({ error: 'O destino tem de ser diferente da origem' });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'Adicione pelo menos um artigo' });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Criar o documento de transferencia (cabecalho)
    const code = 'TRF-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000);
    const [cab] = await conn.query(
      `INSERT INTO stock_transfers (code, from_warehouse_id, to_warehouse_id, notes, created_by)
       VALUES (?,?,?,?,?)`,
      [code, from_warehouse_id, to_warehouse_id, notes || null, req.user.id]
    );
    const transferId = cab.insertId;
    const nomesTransferidos = [];

    for (const it of items) {
      const qty = Number(it.quantity);
      if (!it.product_id || !qty || qty <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Quantidade inválida num dos artigos' });
      }

      // Produto de origem (bloqueio)
      const [[prod]] = await conn.query(
        'SELECT id, name, quantity, warehouse_id, location, family_id, `condition`, expiry_date, color_status FROM products WHERE id = ? FOR UPDATE',
        [it.product_id]
      );
      if (!prod) { await conn.rollback(); return res.status(404).json({ error: 'Produto não encontrado' }); }
      if (String(prod.warehouse_id) !== String(from_warehouse_id)) {
        await conn.rollback();
        return res.status(400).json({ error: `O artigo "${prod.name}" não pertence ao armazém de origem` });
      }
      if (prod.quantity < qty) {
        await conn.rollback();
        return res.status(400).json({ error: `Stock insuficiente de "${prod.name}" (disponível: ${prod.quantity})` });
      }

      // Retirar da origem
      await conn.query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [qty, it.product_id]);

      // Somar no destino (ou criar)
      const [[destino]] = await conn.query(
        'SELECT id FROM products WHERE name = ? AND warehouse_id = ? LIMIT 1',
        [prod.name, to_warehouse_id]
      );
      if (destino) {
        await conn.query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [qty, destino.id]);
      } else {
        await conn.query(
          `INSERT INTO products (name, family_id, quantity, warehouse_id, location, \`condition\`, received_at, expiry_date, color_status)
           VALUES (?,?,?,?,?,?,CURDATE(),?,?)`,
          [prod.name, prod.family_id, qty, to_warehouse_id, prod.location, prod.condition, prod.expiry_date, prod.color_status]
        );
      }

      // Item da transferencia
      await conn.query(
        'INSERT INTO stock_transfer_items (transfer_id, product_id, product_name, quantity) VALUES (?,?,?,?)',
        [transferId, it.product_id, prod.name, qty]
      );

      // Movimento de inventario
      await conn.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason) VALUES (?,?,?,?)`,
        [it.product_id, 'out', qty, 'Transferencia ' + code]
      );
      nomesTransferidos.push(prod.name);
    }

    await conn.commit();

    // Apos a transferencia, verificar se algum artigo ficou abaixo do minimo no armazem de ORIGEM
    if (nomesTransferidos.length) {
      const itensVerificar = nomesTransferidos.map(nome => ({ nome, warehouseId: from_warehouse_id }));
      verificarStockMinimo(itensVerificar).catch(() => {});
    }

    res.status(201).json({ ok: true, code });
  } catch (e) {
    if (conn) await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
