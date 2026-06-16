// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/families.js - MEMBRO 2: Familias de produtos
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Listar familias (com contagem de produtos)
router.get('/', authenticate, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT f.*, (SELECT COUNT(*) FROM products p WHERE p.family_id = f.id) AS total_produtos
       FROM families f ORDER BY f.name`
  );
  res.json(rows);
});

// Criar familia (admin)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim())
      return res.status(400).json({ error: 'Nome da familia obrigatorio' });
    const [r] = await pool.query('INSERT INTO families (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ id: r.insertId, name: name.trim() });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Essa familia ja existe' });
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Renomear familia (admin)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    await pool.query('UPDATE families SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    res.json({ id: Number(req.params.id), name: name.trim() });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Essa familia ja existe' });
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Eliminar familia (admin) - produtos ficam sem familia
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  await pool.query('DELETE FROM families WHERE id = ?', [req.params.id]);
  res.json({ deleted: Number(req.params.id) });
});

module.exports = router;
