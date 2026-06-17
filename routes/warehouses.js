// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/warehouses.js - MEMBRO 2: Armazens por distrito
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { geocode } = require('../config/geo');

const router = express.Router();

// Listar armazens (filtro opcional por distrito)
router.get('/', authenticate, async (req, res) => {
  const { district } = req.query;
  let sql = `SELECT w.*, (SELECT COUNT(*) FROM products p WHERE p.warehouse_id = w.id) AS total_produtos
             FROM warehouses w WHERE 1=1`;
  const params = [];
  if (district) { sql += ' AND w.district = ?'; params.push(district); }
  sql += ' ORDER BY w.district, w.name';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

// Armazens do distrito do proprio beneficiario (com contactos)
router.get('/mine', authenticate, async (req, res) => {
  try {
    // Descobrir o distrito do utilizador a partir do armazem associado (beneficiario ou doador)
    const [[perfil]] = await pool.query(`
      SELECT w.district
        FROM beneficiaries b JOIN warehouses w ON w.id = b.warehouse_id
       WHERE b.user_id = ?
       UNION
      SELECT w.district
        FROM donors d JOIN warehouses w ON w.id = d.warehouse_id
       WHERE d.user_id = ?
       LIMIT 1`, [req.user.id, req.user.id]);

    if (!perfil || !perfil.district) {
      // Sem distrito associado: devolve lista vazia (o utilizador ainda nao tem armazem associado)
      return res.json({ district: null, warehouses: [] });
    }
    const [rows] = await pool.query(
      `SELECT id, name, district, address, phone, email FROM warehouses
        WHERE district = ? AND is_active = TRUE ORDER BY name`, [perfil.district]);
    res.json({ district: perfil.district, warehouses: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Lista de distritos distintos (para filtros / dropdowns)
router.get('/districts', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT DISTINCT district FROM warehouses ORDER BY district');
  res.json(rows.map(r => r.district));
});

// Criar armazem (admin)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, district, address, phone, email } = req.body;
    if (!name || !district)
      return res.status(400).json({ error: 'Nome e distrito sao obrigatorios' });
    // Geocodificar a morada (se indicada) para obter coordenadas
    let lat = null, lon = null;
    if (address) {
      try { const g = await geocode(`${address}, ${district}`); if (g) { lat = g.lat; lon = g.lon; } } catch {}
    }
    const [r] = await pool.query(
      'INSERT INTO warehouses (name, district, address, phone, email, latitude, longitude) VALUES (?,?,?,?,?,?,?)',
      [name, district, address || null, phone || null, email || null, lat, lon]
    );
    res.status(201).json({ id: r.insertId, name, district });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Editar armazem (admin) - nome, distrito, morada, telefone
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, district, address, phone, email } = req.body;
    if (!name || !district)
      return res.status(400).json({ error: 'Nome e distrito são obrigatórios' });
    // Re-geocodificar se houver morada (a morada pode ter mudado)
    let lat = null, lon = null;
    if (address) {
      try { const g = await geocode(`${address}, ${district}`); if (g) { lat = g.lat; lon = g.lon; } } catch {}
    }
    await pool.query(
      'UPDATE warehouses SET name=?, district=?, address=?, phone=?, email=?, latitude=?, longitude=? WHERE id=?',
      [name, district, address || null, phone || null, email || null, lat, lon, req.params.id]
    );
    res.json({ id: Number(req.params.id) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Ativar / desativar armazem (admin)
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  const { is_active } = req.body;
  await pool.query('UPDATE warehouses SET is_active = ? WHERE id = ?', [!!is_active, req.params.id]);
  res.json({ id: Number(req.params.id), is_active: !!is_active });
});

// Eliminar armazem (admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  await pool.query('DELETE FROM warehouses WHERE id = ?', [req.params.id]);
  res.json({ deleted: Number(req.params.id) });
});

module.exports = router;
