// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/requests.js - MEMBRO 4: Pedidos e entregas (maquina de estados)
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendMail } = require('../config/mailer');
const { registar } = require('../config/audit');
const { verificarStockMinimo } = require('../config/stock-alert');

const router = express.Router();

// Transicoes permitidas conforme o diagrama de estados
const TRANSICOES = {
  draft:        ['submitted', 'cancelled'],
  submitted:    ['approved', 'rejected', 'cancelled'],
  approved:     ['scheduled', 'on_hold'],
  on_hold:      ['scheduled', 'expired'],
  scheduled:    ['in_delivery', 'cancelled'],
  in_delivery:  ['delivered', 'cancelled'],
  delivered:    [],
  rejected:     [],
  cancelled:    [],
  expired:      []
};

// Listar pedidos
router.get('/', authenticate, async (req, res) => {
  // Carenciados so veem os seus proprios pedidos
  if (req.user.role === 'beneficiary') {
    const [rows] = await pool.query(`
      SELECT r.*, u.name AS beneficiary_name
        FROM requests r
        JOIN beneficiaries b ON b.id = r.beneficiary_id
        JOIN users u ON u.id = b.user_id
       WHERE b.user_id = ?
       ORDER BY r.requested_at DESC`, [req.user.id]);
    return res.json(rows);
  }

  // Operadores de armazem so veem pedidos ja aprovados (para preparar material)
  if (req.user.role === 'warehouse_operator') {
    const [rows] = await pool.query(`
      SELECT r.*, u.name AS beneficiary_name
        FROM requests r
        JOIN beneficiaries b ON b.id = r.beneficiary_id
        JOIN users u ON u.id = b.user_id
       WHERE r.status IN ('approved','scheduled','in_delivery','delivered')
       ORDER BY r.requested_at DESC`);
    return res.json(rows);
  }

  const [rows] = await pool.query(`
    SELECT r.*, u.name AS beneficiary_name
      FROM requests r
      JOIN beneficiaries b ON b.id = r.beneficiary_id
      JOIN users u ON u.id = b.user_id
     ORDER BY r.requested_at DESC`);
  res.json(rows);
});

// Detalhe com itens
router.get('/:id', authenticate, async (req, res) => {
  const [[request]] = await pool.query(
    `SELECT r.*, u.name AS beneficiary_name
       FROM requests r
       JOIN beneficiaries b ON b.id = r.beneficiary_id
       JOIN users u ON u.id = b.user_id
      WHERE r.id = ?`, [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Pedido nao encontrado' });
  const [items] = await pool.query(
    `SELECT ri.*, p.name AS product_name, p.quantity AS stock_available,
            w.name AS warehouse_name
       FROM request_items ri
       JOIN products p ON p.id = ri.product_id
       LEFT JOIN warehouses w ON w.id = p.warehouse_id
      WHERE ri.request_id = ?`, [req.params.id]);
  res.json({ ...request, items });
});

// Submeter pedido (carenciado)
router.post('/', authenticate, authorize('beneficiary', 'admin'), async (req, res) => {
  try {
    let { beneficiary_id, priority, notes, items } = req.body;
    // A prioridade e atribuida pelo admin/tecnico na aprovacao;
    // na criacao entra sempre como 'medium' (o beneficiario nao a escolhe).
    if (req.user.role === 'beneficiary') priority = 'medium';
    priority = priority || 'medium';

    // Se o beneficiary_id nao vier, derivar do utilizador autenticado.
    // Cria o perfil de carenciado se ainda nao existir.
    if (!beneficiary_id) {
      const [b] = await pool.query('SELECT id FROM beneficiaries WHERE user_id = ?', [req.user.id]);
      if (b.length > 0) {
        beneficiary_id = b[0].id;
      } else {
        const [novo] = await pool.query(
          'INSERT INTO beneficiaries (user_id, household_size, status) VALUES (?,?,?)',
          [req.user.id, 1, 'active']
        );
        beneficiary_id = novo.insertId;
      }
    }

    // Controlo de frequencia: impedir novo pedido dentro de X dias do anterior.
    // O intervalo (em dias) e configuravel em settings (request_interval_days); 0 = desligado.
    // Nao se aplica a pedidos criados pelo admin.
    if (req.user.role === 'beneficiary') {
      const [[cfg]] = await pool.query(
        "SELECT setting_value FROM settings WHERE setting_key = 'request_interval_days'"
      );
      const intervalo = cfg ? parseInt(cfg.setting_value, 10) : 0;
      if (intervalo && intervalo > 0) {
        const [[ultimo]] = await pool.query(
          `SELECT requested_at,
                  DATEDIFF(CURDATE(), DATE(requested_at)) AS dias_passados,
                  DATE_ADD(DATE(requested_at), INTERVAL ? DAY) AS proxima_data
             FROM requests
            WHERE beneficiary_id = ? AND status NOT IN ('rejected','cancelled')
            ORDER BY requested_at DESC LIMIT 1`,
          [intervalo, beneficiary_id]
        );
        if (ultimo && ultimo.dias_passados < intervalo) {
          const faltam = intervalo - ultimo.dias_passados;
          // Formatar a data (YYYY-MM-DD) a partir do resultado
          let dataStr = '';
          try {
            const d = new Date(ultimo.proxima_data);
            dataStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
          } catch (_) {}
          return res.status(429).json({
            error: `Já efetuou um pedido recentemente. Só poderá fazer um novo pedido ` +
                   (dataStr ? `a partir de ${dataStr}` : `daqui a ${faltam} dia(s)`) +
                   ` (intervalo mínimo de ${intervalo} dias entre pedidos).`
          });
        }
      }
    }

    const code = 'REQ-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000);
    const [r] = await pool.query(
      `INSERT INTO requests (code, beneficiary_id, status, priority, notes)
       VALUES (?,?,'submitted',?,?)`,
      [code, beneficiary_id, priority || 'medium', notes || null]
    );
    if (Array.isArray(items)) {
      for (const it of items) {
        await pool.query(
          `INSERT INTO request_items (request_id, product_id, requested_qty) VALUES (?,?,?)`,
          [r.insertId, it.product_id, it.requested_qty]
        );
      }
    }
    res.status(201).json({ id: r.insertId, code, status: 'submitted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Transicao de estado (valida contra a maquina de estados)
router.patch('/:id/transition', authenticate,
  authorize('admin', 'social_technician', 'warehouse_operator'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { to } = req.body;
    const [[r]] = await conn.query('SELECT status FROM requests WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Pedido nao encontrado' });

    const permitidas = TRANSICOES[r.status] || [];
    if (!permitidas.includes(to))
      return res.status(400).json({ error: `Transicao ${r.status} -> ${to} nao permitida` });

    await conn.beginTransaction();

    // Timestamps consoante o estado
    const campos = {
      under_review: 'validated_at',
      approved: 'decided_at',
      rejected: 'decided_at',
      scheduled: 'scheduled_at',
      delivered: 'delivered_at'
    };
    const setData = campos[to] ? `, ${campos[to]} = NOW()` : '';
    await conn.query(`UPDATE requests SET status = ?${setData} WHERE id = ?`, [to, req.params.id]);

    // Ao aprovar: o admin/tecnico atribui a prioridade e pode ajustar quantidades
    let textoAlteracoes = '';
    if (to === 'approved') {
      const { priority, items: ajustes } = req.body;
      if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
        await conn.query('UPDATE requests SET priority = ? WHERE id = ?', [priority, req.params.id]);
      }
      if (Array.isArray(ajustes) && ajustes.length) {
        const [originais] = await conn.query(
          `SELECT ri.id, ri.requested_qty, p.name AS product_name
             FROM request_items ri JOIN products p ON p.id = ri.product_id
            WHERE ri.request_id = ?`, [req.params.id]);
        const mapa = new Map(originais.map(o => [o.id, o]));
        const linhas = [];
        for (const aj of ajustes) {
          const orig = mapa.get(Number(aj.id));
          if (!orig) continue;
          const qtd = Math.max(0, Number(aj.approved_qty) || 0);
          await conn.query('UPDATE request_items SET approved_qty = ? WHERE id = ?', [qtd, aj.id]);
          if (qtd !== orig.requested_qty) {
            linhas.push(`- ${orig.product_name}: pedido ${orig.requested_qty}, aprovado ${qtd}`);
          }
        }
        if (linhas.length) {
          textoAlteracoes = '\n\nForam feitos os seguintes ajustes às quantidades:\n' + linhas.join('\n');
        }
      }
    }

    // Ao aprovar: tentar reservar stock (saida)
    if (to === 'scheduled') {
      const [items] = await conn.query('SELECT * FROM request_items WHERE request_id = ?', [req.params.id]);
      for (const it of items) {
        const [[p]] = await conn.query('SELECT quantity FROM products WHERE id = ?', [it.product_id]);
        const qty = it.approved_qty != null ? it.approved_qty : it.requested_qty;
        if (p.quantity < qty) {
          await conn.rollback();
          return res.status(409).json({ error: 'Stock insuficiente. Coloque o pedido em on_hold.' });
        }
      }
    }

    // Ao entregar: registar saidas de stock
    let entregues = [];
    if (to === 'delivered') {
      const [items] = await conn.query(
        `SELECT ri.*, p.name AS product_name, p.warehouse_id AS warehouse_id FROM request_items ri
         JOIN products p ON p.id = ri.product_id WHERE ri.request_id = ?`, [req.params.id]);
      for (const it of items) {
        const qty = it.approved_qty != null ? it.approved_qty : it.requested_qty;
        if (qty <= 0) { await conn.query('UPDATE request_items SET fulfilled_qty = 0 WHERE id = ?', [it.id]); continue; }
        await conn.query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [qty, it.product_id]);
        await conn.query('UPDATE request_items SET fulfilled_qty = ? WHERE id = ?', [qty, it.id]);
        await conn.query(
          `INSERT INTO inventory_movements (product_id, request_id, type, quantity, reason)
           VALUES (?,?, 'out', ?, ?)`,
          [it.product_id, req.params.id, qty, 'Entrega pedido #' + req.params.id]
        );
        if (it.product_name && it.warehouse_id) entregues.push({ nome: it.product_name, warehouseId: it.warehouse_id });
      }
    }

    await conn.commit();

    // Após a entrega, verificar se algum artigo desceu ao stock minimo (por armazem) e alertar
    if (to === 'delivered' && entregues.length) {
      verificarStockMinimo(entregues).catch(() => {});
    }

    // Notificar o beneficiario por email nas etapas principais
    const ESTADOS_EMAIL = {
      approved:    { s: 'O seu pedido {code} foi aprovado',
                     t: 'O seu pedido {code} foi aprovado e será agora preparado. Iremos avisá-lo das próximas etapas.' },
      scheduled:   { s: 'O seu pedido {code} foi agendado',
                     t: 'O seu pedido {code} foi agendado para entrega. Será contactado com os detalhes.' },
      in_delivery: { s: 'O seu pedido {code} está a caminho',
                     t: 'O seu pedido {code} está pronto e a caminho. Prepare-se para o receber.' },
      delivered:   { s: 'O seu pedido {code} foi entregue',
                     t: 'O seu pedido {code} foi entregue. Esperamos que tenha ajudado. Obrigado!' },
      rejected:    { s: 'O seu pedido {code} foi rejeitado',
                     t: 'Lamentamos, mas o seu pedido {code} não pôde ser aprovado. Para mais informações, contacte a instituição.' },
      cancelled:   { s: 'O seu pedido {code} foi cancelado',
                     t: 'O seu pedido {code} foi cancelado. Se tiver dúvidas, contacte a instituição.' },
    };
    if (ESTADOS_EMAIL[to]) {
      try {
        const [[info]] = await pool.query(
          `SELECT r.code, u.name, u.email
             FROM requests r
             JOIN beneficiaries b ON b.id = r.beneficiary_id
             JOIN users u ON u.id = b.user_id
            WHERE r.id = ?`, [req.params.id]);
        if (info && info.email) {
          const m = ESTADOS_EMAIL[to];
          const subject = m.s.replace('{code}', info.code);
          const corpo = m.t.replace(/{code}/g, info.code) + (to === 'approved' ? textoAlteracoes : '');
          const text = `Olá ${info.name},\n\n${corpo}\n\nInventário Solidário`;
          await sendMail({ to: info.email, subject, text });
        }
      } catch (mailErr) {
        console.error('Aviso: falha ao notificar beneficiario:', mailErr.message);
      }
    }

    await registar(req, 'transition', 'request', req.params.id, 'Pedido alterado para estado "' + to + '"');
    res.json({ id: Number(req.params.id), status: to });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    conn.release();
  }
});

module.exports = router;
