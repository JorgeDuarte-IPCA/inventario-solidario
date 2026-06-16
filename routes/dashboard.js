// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/dashboard.js - MEMBRO 2: KPIs e indicadores do dashboard
const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard - devolve todos os indicadores num so pedido
router.get('/', authenticate, async (req, res) => {
  try {
    const [[kpis]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM products)                                  AS total_products,
        (SELECT COUNT(*) FROM warehouses WHERE is_active = TRUE)         AS total_warehouses,
        (SELECT COALESCE(SUM(quantity),0) FROM products)                 AS total_stock,
        (SELECT COUNT(*) FROM products WHERE expiry_date IS NOT NULL AND expiry_date >= CURDATE() AND DATEDIFF(expiry_date, CURDATE()) < 30) AS expiring_soon,
        (SELECT COUNT(*) FROM requests WHERE status IN ('submitted','under_review','approved','on_hold','scheduled')) AS pending_requests,
        (SELECT COUNT(*) FROM requests WHERE status IN ('submitted','under_review')) AS requests_to_review,
        (SELECT COUNT(*) FROM requests WHERE status = 'delivered')       AS delivered_requests,
        (SELECT COUNT(*) FROM donations WHERE status = 'pending')        AS pending_donations
    `);

    // Stock por familia (grafico)
    const [byFamily] = await pool.query(
      `SELECT f.id AS family_id, COALESCE(f.name, 'Sem familia') AS family, COALESCE(SUM(p.quantity),0) AS total
         FROM products p LEFT JOIN families f ON f.id = p.family_id
        GROUP BY f.id, f.name ORDER BY total DESC`
    );

    // Pedidos por estado (grafico)
    const [byStatus] = await pool.query(
      `SELECT status, COUNT(*) AS total FROM requests GROUP BY status`
    );

    // Distribuicao de cor de stock (grafico) - recalculada pela data atual
    const [byColor] = await pool.query(
      `SELECT cor AS color_status, COUNT(*) AS total FROM (
         SELECT CASE
           WHEN expiry_date IS NULL THEN 'green'
           WHEN expiry_date < CURDATE() THEN 'expired'
           WHEN DATEDIFF(expiry_date, CURDATE()) < 30 THEN 'red'
           WHEN DATEDIFF(expiry_date, CURDATE()) < 90 THEN 'yellow'
           ELSE 'green' END AS cor
         FROM products
       ) t GROUP BY cor`
    );

    // Stock por distrito (grafico)
    const [byDistrict] = await pool.query(
      `SELECT COALESCE(w.district, 'Sem armazem') AS district, COALESCE(SUM(p.quantity),0) AS total
         FROM products p LEFT JOIN warehouses w ON w.id = p.warehouse_id
        GROUP BY w.district ORDER BY total DESC`
    );

    // Bens doados por mes (doacoes rececionadas) e bens recebidos por mes (pedidos entregues)
    const [doadosMes] = await pool.query(
      `SELECT DATE_FORMAT(received_date, '%Y-%m') AS mes, COUNT(*) AS total
         FROM donations WHERE status = 'received' AND received_date IS NOT NULL
        GROUP BY DATE_FORMAT(received_date, '%Y-%m') ORDER BY DATE_FORMAT(received_date, '%Y-%m')`
    );
    const [recebidosMes] = await pool.query(
      `SELECT DATE_FORMAT(delivered_at, '%Y-%m') AS mes, COUNT(*) AS total
         FROM requests WHERE status = 'delivered' AND delivered_at IS NOT NULL
        GROUP BY DATE_FORMAT(delivered_at, '%Y-%m') ORDER BY DATE_FORMAT(delivered_at, '%Y-%m')`
    );

    // Top de artigos mais pedidos (todas as quantidades pedidas, agrupadas por nome)
    const [topPedidos] = await pool.query(
      `SELECT p.name, SUM(ri.requested_qty) AS total
         FROM request_items ri JOIN products p ON p.id = ri.product_id
        GROUP BY p.name ORDER BY total DESC LIMIT 7`
    );
    // Top de artigos mais doados (itens de doacoes rececionadas, agrupados por nome)
    const [topDoados] = await pool.query(
      `SELECT p.name, SUM(di.quantity) AS total
         FROM donation_items di
         JOIN donations d ON d.id = di.donation_id AND d.status = 'received'
         JOIN products p ON p.id = di.product_id
        GROUP BY p.name ORDER BY total DESC LIMIT 7`
    );

    // Procura vs. Oferta por artigo: total pedido (procura) vs total doado/rececionado (oferta).
    // Ordena pelos artigos com maior defice (procura acima da oferta) primeiro.
    const [demandaOferta] = await pool.query(
      `SELECT nome,
              COALESCE(pedido, 0)  AS procura,
              COALESCE(doado, 0)   AS oferta,
              COALESCE(pedido, 0) - COALESCE(doado, 0) AS defice
         FROM (
           SELECT p.name AS nome,
             (SELECT SUM(ri.requested_qty) FROM request_items ri JOIN products p2 ON p2.id = ri.product_id WHERE p2.name = p.name) AS pedido,
             (SELECT SUM(di.quantity) FROM donation_items di JOIN donations d ON d.id = di.donation_id AND d.status = 'received' JOIN products p3 ON p3.id = di.product_id WHERE p3.name = p.name) AS doado
           FROM products p
           GROUP BY p.name
         ) t
        WHERE COALESCE(pedido,0) > 0 OR COALESCE(doado,0) > 0
        ORDER BY defice DESC, procura DESC
        LIMIT 8`
    );

    res.json({ kpis, byFamily, byStatus, byColor, byDistrict, doadosMes, recebidosMes, topPedidos, topDoados, demandaOferta });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/dashboard/impacto - metricas para o relatorio de impacto
router.get('/impacto', authenticate, async (req, res) => {
  try {
    const [[m]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM donations WHERE status = 'received')                       AS doacoes_recebidas,
        (SELECT COALESCE(SUM(di.quantity),0) FROM donation_items di
           JOIN donations d ON d.id = di.donation_id AND d.status = 'received')           AS itens_doados,
        (SELECT COUNT(*) FROM requests WHERE status = 'delivered')                        AS pedidos_entregues,
        (SELECT COALESCE(SUM(ri.fulfilled_qty),0) FROM request_items ri
           JOIN requests r ON r.id = ri.request_id AND r.status = 'delivered')            AS itens_entregues,
        (SELECT COUNT(DISTINCT r.beneficiary_id) FROM requests r WHERE r.status = 'delivered') AS familias_ajudadas,
        (SELECT COUNT(*) FROM beneficiaries)                                              AS beneficiarios_registados,
        (SELECT COUNT(*) FROM donors)                                                     AS doadores_registados,
        (SELECT COUNT(*) FROM warehouses WHERE is_active = TRUE)                          AS armazens_ativos,
        (SELECT COALESCE(SUM(quantity),0) FROM products)                                  AS stock_atual
    `);

    // Top artigos distribuidos (por nome)
    const [topDistribuidos] = await pool.query(`
      SELECT p.name, SUM(ri.fulfilled_qty) AS total
        FROM request_items ri
        JOIN requests r ON r.id = ri.request_id AND r.status = 'delivered'
        JOIN products p ON p.id = ri.product_id
       GROUP BY p.name ORDER BY total DESC LIMIT 5
    `);

    res.json({ ...m, topDistribuidos, gerado_em: new Date().toISOString() });
  } catch (e) {
    console.error('Erro no relatorio de impacto:', e.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;
