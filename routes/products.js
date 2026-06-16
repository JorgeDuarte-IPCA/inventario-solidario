// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/products.js - MEMBRO 2: Gestao de produtos e stock
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { registar } = require('../config/audit');

const router = express.Router();

// Calcula o estado de cor com base na validade (regra simples de exemplo)
function computeColorStatus(expiry_date) {
  if (!expiry_date) return 'green';
  const dias = (new Date(expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
  if (dias < 0) return 'expired';
  if (dias < 30) return 'red';
  if (dias < 90) return 'yellow';
  return 'green';
}

// Listar produtos (com filtros opcionais por familia / cor / armazem)
router.get('/', authenticate, async (req, res) => {
  const { family_id, color, warehouse_id, condition, district, size } = req.query;
  // Estado de validade calculado a partir da data atual (nao do valor guardado),
  // para refletir automaticamente os produtos que passaram a validade.
  const corCalc = `CASE
      WHEN p.expiry_date IS NULL THEN 'green'
      WHEN p.expiry_date < CURDATE() THEN 'expired'
      WHEN DATEDIFF(p.expiry_date, CURDATE()) < 30 THEN 'red'
      WHEN DATEDIFF(p.expiry_date, CURDATE()) < 90 THEN 'yellow'
      ELSE 'green' END`;
  let sql = `SELECT p.*, ${corCalc} AS color_status, f.name AS family_name, w.name AS warehouse_name, w.district AS warehouse_district
             FROM products p
             LEFT JOIN families f ON f.id = p.family_id
             LEFT JOIN warehouses w ON w.id = p.warehouse_id WHERE 1=1`;
  const params = [];
  if (family_id)    { sql += ' AND p.family_id = ?'; params.push(family_id); }
  if (color)        { sql += ` AND ${corCalc} = ?`; params.push(color); }
  if (condition)    { sql += ' AND p.`condition` = ?'; params.push(condition); }
  if (size)         { sql += ' AND p.size = ?'; params.push(size); }
  if (warehouse_id) { sql += ' AND p.warehouse_id = ?'; params.push(warehouse_id); }
  if (district)     { sql += ' AND w.district = ?'; params.push(district); }
  sql += ' ORDER BY p.name';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

// Criar produto (admin / operador)
router.post('/', authenticate, authorize('admin', 'warehouse_operator'), async (req, res) => {
  try {
    const { name, family_id, quantity, warehouse_id, location, condition, received_at, expiry_date, size, min_stock } = req.body;
    if (!name || !name.trim())
      return res.status(400).json({ error: 'O nome do artigo é obrigatório' });
    const color = computeColorStatus(expiry_date);
    const qtd = Number(quantity) || 0;

    // Lotes: se ja existe o mesmo artigo, no mesmo armazem, com a mesma validade -> somar
    const [[existente]] = await pool.query(
      `SELECT id FROM products
        WHERE name = ? AND warehouse_id <=> ? AND expiry_date <=> ?
        LIMIT 1`,
      [name.trim(), warehouse_id || null, expiry_date || null]
    );
    if (existente) {
      await pool.query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [qtd, existente.id]);
      return res.status(200).json({ id: existente.id, name, color_status: color, merged: true });
    }

    const [r] = await pool.query(
      `INSERT INTO products (name, family_id, quantity, warehouse_id, location, \`condition\`, received_at, expiry_date, color_status, size, min_stock)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [name.trim(), family_id || null, qtd, warehouse_id || null, location, condition || 'good',
       received_at || new Date().toISOString().slice(0, 10), expiry_date || null, color, size || null, Number(min_stock) || 0]
    );
    res.status(201).json({ id: r.insertId, name, color_status: color });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Atualizar produto
router.put('/:id', authenticate, authorize('admin', 'warehouse_operator'), async (req, res) => {
  const { name, family_id, quantity, warehouse_id, location, condition, expiry_date, size, min_stock } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: 'O nome do artigo é obrigatório' });
  const color = computeColorStatus(expiry_date);
  // Capturar o estado anterior para o registo de auditoria
  const [[antes]] = await pool.query('SELECT name, quantity FROM products WHERE id = ?', [req.params.id]);
  await pool.query(
    `UPDATE products SET name=?, family_id=?, quantity=?, warehouse_id=?, location=?, \`condition\`=?, expiry_date=?, color_status=?, size=?, min_stock=?
     WHERE id=?`,
    [name.trim(), family_id || null, quantity, warehouse_id || null, location, condition, expiry_date || null, color, size || null, Number(min_stock) || 0, req.params.id]
  );
  // Registar a alteracao (com destaque para a quantidade, se mudou)
  let detalhe = 'Editou o artigo "' + name.trim() + '"';
  if (antes && Number(antes.quantity) !== Number(quantity)) {
    detalhe += ' — quantidade ' + antes.quantity + ' → ' + quantity;
  }
  await registar(req, 'update', 'product', req.params.id, detalhe);
  res.json({ id: Number(req.params.id), color_status: color });
});

// Eliminar produto
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const [[antes]] = await pool.query('SELECT name FROM products WHERE id = ?', [req.params.id]);
  await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  await registar(req, 'delete', 'product', req.params.id, 'Removeu o artigo "' + (antes ? antes.name : req.params.id) + '"');
  res.json({ deleted: Number(req.params.id) });
});

// Descartar stock fora de validade: remove a quantidade e regista o movimento
router.post('/:id/discard', authenticate, authorize('admin', 'warehouse_operator'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[prod]] = await conn.query(
      'SELECT id, name, quantity, expiry_date FROM products WHERE id = ?', [req.params.id]
    );
    if (!prod) return res.status(404).json({ error: 'Produto nao encontrado' });
    // So permite descartar o que esta efetivamente fora de validade
    if (!prod.expiry_date || new Date(prod.expiry_date) >= new Date(new Date().toDateString())) {
      return res.status(400).json({ error: 'Este lote nao esta fora de validade.' });
    }
    const qtd = prod.quantity || 0;
    await conn.beginTransaction();
    await conn.query('UPDATE products SET quantity = 0 WHERE id = ?', [req.params.id]);
    if (qtd > 0) {
      await conn.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason)
         VALUES (?, 'adjust', ?, ?)`,
        [req.params.id, qtd, 'Descarte por fim de validade']
      );
    }
    await conn.commit();
    await registar(req, 'discard', 'product', req.params.id, 'Descartou ' + qtd + ' unidades de "' + prod.name + '" (fora de validade)');
    res.json({ id: Number(req.params.id), discarded: qtd });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
