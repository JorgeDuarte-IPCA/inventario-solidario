// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/donations.js - MEMBRO 3: Doacoes
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { nearestWarehouse } = require('../config/geo');
const { registar } = require('../config/audit');

const router = express.Router();

// Estado de validade (igual ao de products): verde/amarelo/vermelho
function corPorValidade(expiry_date) {
  if (!expiry_date) return 'green';
  const dias = (new Date(expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
  if (dias < 0) return 'expired';
  if (dias < 30) return 'red';
  if (dias < 90) return 'yellow';
  return 'green';
}

// Listar doacoes (com nome do doador e itens)
router.get('/', authenticate, async (req, res) => {
  // Doadores so veem as suas proprias doacoes
  if (req.user.role === 'donor') {
    const [rows] = await pool.query(`
      SELECT d.*, COALESCE(dn.organization_name, u.name) AS donor_name
        FROM donations d
        JOIN donors dn ON dn.id = d.donor_id
        JOIN users  u  ON u.id  = dn.user_id
       WHERE dn.user_id = ?
       ORDER BY d.created_at DESC`, [req.user.id]);
    return res.json(rows);
  }
  const [rows] = await pool.query(`
    SELECT d.*, COALESCE(dn.organization_name, u.name) AS donor_name
      FROM donations d
      JOIN donors dn ON dn.id = d.donor_id
      JOIN users  u  ON u.id  = dn.user_id
     ORDER BY d.created_at DESC`);
  res.json(rows);
});

// Detalhe de uma doacao com itens
router.get('/:id', authenticate, async (req, res) => {
  const [[donation]] = await pool.query(
    `SELECT d.*, COALESCE(dn.organization_name, u.name) AS donor_name
       FROM donations d
       JOIN donors dn ON dn.id = d.donor_id
       JOIN users u ON u.id = dn.user_id
      WHERE d.id = ?`, [req.params.id]);
  if (!donation) return res.status(404).json({ error: 'Doacao nao encontrada' });
  const [items] = await pool.query(
    `SELECT di.*, p.name AS product_name
       FROM donation_items di JOIN products p ON p.id = di.product_id
      WHERE di.donation_id = ?`, [req.params.id]);
  res.json({ ...donation, items });
});

// Submeter doacao (doador)
router.post('/', authenticate, authorize('donor', 'admin'), async (req, res) => {
  try {
    let { donor_id, expected_delivery_date, warehouse_id, notes, items } = req.body;

    // Se o donor_id nao vier, derivar do utilizador autenticado.
    // Cria o perfil de doador se ainda nao existir.
    if (!donor_id) {
      const [d] = await pool.query('SELECT id FROM donors WHERE user_id = ?', [req.user.id]);
      if (d.length > 0) {
        donor_id = d[0].id;
      } else {
        const [novo] = await pool.query(
          'INSERT INTO donors (user_id, contact_person, type) VALUES (?,?,?)',
          [req.user.id, req.user.name || null, 'individual']
        );
        donor_id = novo.insertId;
      }
    }

    const code = 'DON-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000);
    const [r] = await pool.query(
      `INSERT INTO donations (code, donor_id, status, expected_delivery_date, warehouse_id, notes)
       VALUES (?,?,'pending',?,?,?)`,
      [code, donor_id, expected_delivery_date || null, warehouse_id || null, notes || null]
    );
    if (Array.isArray(items)) {
      for (const it of items) {
        await pool.query(
          `INSERT INTO donation_items (donation_id, product_id, quantity, expiry_date, \`condition\`)
           VALUES (?,?,?,?,?)`,
          [r.insertId, it.product_id, it.quantity, it.expiry_date || null, it.condition || 'good']
        );
      }
    }
    res.status(201).json({ id: r.insertId, code, status: 'pending' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Mudar estado da doacao (admin) - validar / rejeitar / rececionar
router.patch('/:id/status', authenticate, authorize('admin', 'warehouse_operator'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { status } = req.body; // validated | rejected | received | cancelled
    const valid = ['validated', 'rejected', 'received', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Estado invalido' });

    await conn.beginTransaction();

    const received_date = status === 'received' ? new Date().toISOString().slice(0, 10) : null;
    await conn.query('UPDATE donations SET status = ?, received_date = COALESCE(?, received_date) WHERE id = ?',
      [status, received_date, req.params.id]);

    // Ao rececionar, dar entrada dos bens em stock (no armazem escolhido na doacao)
    if (status === 'received') {
      const [[don]] = await conn.query('SELECT warehouse_id, donor_id FROM donations WHERE id = ?', [req.params.id]);
      let destinoWh = don ? don.warehouse_id : null;
      // Se a doacao nao tem armazem escolhido, usar o mais proximo do doador
      if (!destinoWh && don) {
        const [[dador]] = await conn.query('SELECT latitude, longitude FROM donors WHERE id = ?', [don.donor_id]);
        if (dador) destinoWh = await nearestWarehouse(dador.latitude, dador.longitude);
      }
      const [items] = await conn.query('SELECT * FROM donation_items WHERE donation_id = ?', [req.params.id]);
      for (const it of items) {
        // Dados do produto doado (nome, familia, etc.)
        const [[prod]] = await conn.query(
          'SELECT name, family_id, location, `condition`, color_status FROM products WHERE id = ?',
          [it.product_id]
        );
        if (!prod) continue;

        // A validade vem da doacao (lote). Recalcular a cor com base nessa validade.
        const validade = it.expiry_date || null;
        const cor = corPorValidade(validade);
        const cond = it.condition || 'good';
        const whAlvo = destinoWh || null;

        // Procurar lote existente: mesmo nome + armazem + validade + condicao
        let alvoId = null;
        const [[lote]] = await conn.query(
          `SELECT id FROM products
            WHERE name = ? AND warehouse_id <=> ? AND expiry_date <=> ? AND \`condition\` = ? LIMIT 1`,
          [prod.name, whAlvo, validade, cond]
        );
        if (lote) {
          alvoId = lote.id;
        } else {
          const [novo] = await conn.query(
            `INSERT INTO products (name, family_id, quantity, warehouse_id, location, \`condition\`, received_at, expiry_date, color_status)
             VALUES (?,?,0,?,?,?,CURDATE(),?,?)`,
            [prod.name, prod.family_id, whAlvo, prod.location, cond, validade, cor]
          );
          alvoId = novo.insertId;
        }

        await conn.query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [it.quantity, alvoId]);
        await conn.query(
          `INSERT INTO inventory_movements (product_id, type, quantity, reason)
           VALUES (?, 'in', ?, ?)`,
          [alvoId, it.quantity, 'Rececao doacao #' + req.params.id]
        );
      }
    }
    await conn.commit();
    await registar(req, 'transition', 'donation', req.params.id, 'Doação alterada para estado "' + status + '"');
    res.json({ id: Number(req.params.id), status });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    conn.release();
  }
});

module.exports = router;
