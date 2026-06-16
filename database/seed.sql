-- Inventario Solidario
-- Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
-- Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

-- ============================================================
-- Dados de exemplo (seed)
-- Password de todos os utilizadores: "password123"
-- (hash bcrypt gerado para demonstracao)
-- ============================================================
USE charity_inventory;
SET NAMES utf8mb4;

-- Hash bcrypt de "password123"
SET @pwd = '$2a$10$UybR6.GwcQR4lSHkm9guAu8Pv0fr.R.mx4IAmCT.Y9V2xAsFtDdKG';

-- ---------- Utilizadores ----------
INSERT INTO users (name, email, password_hash, role, is_approved) VALUES
  ('Admin',             'admin@caridade.pt',     @pwd, 'admin',              TRUE),   -- 1
  ('Maria Silva',       'tecnico@caridade.pt',   @pwd, 'social_technician',  TRUE),   -- 2
  ('Joao Armazem',      'armazem@caridade.pt',   @pwd, 'warehouse_operator', TRUE),   -- 3
  -- Doadores
  ('Continente Doacoes','doador@empresa.pt',     @pwd, 'donor',              TRUE),   -- 4
  ('Padaria Central',   'padaria@lisboa.pt',     @pwd, 'donor',              TRUE),   -- 5
  ('Farmacia Saude',    'farmacia@porto.pt',     @pwd, 'donor',              TRUE),   -- 6
  -- Carenciados
  ('Ana Costa',         'ana@familia.pt',        @pwd, 'beneficiary',        TRUE),   -- 7
  ('Carlos Mendes',     'carlos@familia.pt',     @pwd, 'beneficiary',        TRUE),   -- 8
  ('Sofia Almeida',     'sofia@familia.pt',      @pwd, 'beneficiary',        TRUE),   -- 9
  ('Bruno Ferreira',    'bruno@familia.pt',      @pwd, 'beneficiary',        TRUE),   -- 10
  ('Helena Rocha',      'helena@familia.pt',     @pwd, 'beneficiary',        TRUE),   -- 11
  -- Mais doadores
  ('Talho do Bairro',   'talho@braga.pt',        @pwd, 'donor',              TRUE),   -- 12
  ('Supermercado Pingo','pingo@coimbra.pt',      @pwd, 'donor',              TRUE),   -- 13
  ('Loja de Roupa Moda','moda@porto.pt',         @pwd, 'donor',              TRUE),   -- 14
  -- Mais beneficiarios
  ('Pedro Santos',      'pedro@familia.pt',      @pwd, 'beneficiary',        TRUE),   -- 15
  ('Marta Dias',        'marta@familia.pt',      @pwd, 'beneficiary',        TRUE),   -- 16
  ('Rui Gomes',         'rui@familia.pt',        @pwd, 'beneficiary',        TRUE),   -- 17
  ('Teresa Lima',       'teresa@familia.pt',     @pwd, 'beneficiary',        TRUE);   -- 18

-- ---------- Armazens por distrito (criados primeiro, para associacao) ----------
INSERT INTO warehouses (name, district, address, phone, latitude, longitude) VALUES
  ('Armazem Central Lisboa',  'Lisboa',  'Rua do Armazem 1, Lisboa',       '210000001', 38.7223, -9.1393),  -- 1
  ('Armazem Torres Vedras',   'Lisboa',  'Zona Industrial, Torres Vedras', '261000002', 39.0918, -9.2585),  -- 2
  ('Armazem Porto',           'Porto',   'Rua da Industria 22, Porto',     '220000003', 41.1579, -8.6291),  -- 3
  ('Armazem Braga',           'Braga',   'Parque Empresarial, Braga',      '253000004', 41.5454, -8.4265),  -- 4
  ('Armazem Coimbra',         'Coimbra', 'Av. dos Armazens 5, Coimbra',    '239000005', 40.2033, -8.4103);  -- 5

-- ============================================================
-- DOADORES (com morada, coordenadas e armazem mais proximo)
-- ============================================================
INSERT INTO donors (user_id, organization_name, contact_person, phone, address, postal_code, city, latitude, longitude, warehouse_id, type) VALUES
  (4, 'Continente', 'Rui Pereira',   '912000001', 'Av. da Republica 50',     '1050-196', 'Lisboa', 38.7368, -9.1453, 1, 'company'),
  (5, 'Padaria Central', 'Tiago Nunes', '912000002', 'Rua de Santa Catarina 120', '4000-447', 'Porto', 41.1496, -8.6109, 3, 'company'),
  (6, 'Farmacia Saude', 'Ines Lopes', '912000003', 'Rua do Souto 30',         '4700-328', 'Braga',  41.5503, -8.4265, 4, 'company'),
  (12, 'Talho do Bairro', 'Manuel Sousa', '912000004', 'Rua Nova 45',         '4700-100', 'Braga',  41.5480, -8.4230, 4, 'company'),
  (13, 'Supermercado Pingo', 'Carla Matos', '912000005', 'Av. Fernao Magalhaes 200', '3000-170', 'Coimbra', 40.2080, -8.4200, 5, 'company'),
  (14, 'Loja de Roupa Moda', 'Pedro Vaz', '912000006', 'Rua de Cedofeita 150', '4050-180', 'Porto', 41.1520, -8.6180, 3, 'company');

-- ============================================================
-- CARENCIADOS (com agregado, morada, coordenadas e armazem mais proximo)
-- ============================================================
INSERT INTO beneficiaries (user_id, household_size, vulnerability_score, address, postal_code, city, phone, latitude, longitude, warehouse_id, status) VALUES
  (7,  4, 7, 'Rua das Flores 12',   '2560-300', 'Torres Vedras', '913111111', 39.0918, -9.2585, 2, 'active'),
  (8,  2, 5, 'Av. 5 de Outubro 88', '1050-060', 'Lisboa',        '914222222', 38.7400, -9.1460, 1, 'active'),
  (9,  3, 6, 'Rua da Boavista 200', '4050-110', 'Porto',         '915333333', 41.1530, -8.6300, 3, 'active'),
  (10, 5, 8, 'Rua do Carmo 15',     '3000-100', 'Coimbra',       '916444444', 40.2110, -8.4290, 5, 'active'),
  (11, 1, 4, 'Av. Central 300',     '4710-200', 'Braga',         '917555555', 41.5450, -8.4200, 4, 'active'),
  (15, 3, 6, 'Rua do Comercio 22',  '3000-200', 'Coimbra',       '918666666', 40.2090, -8.4250, 5, 'active'),
  (16, 2, 5, 'Rua Direita 40',      '4700-400', 'Braga',         '919777777', 41.5470, -8.4280, 4, 'active'),
  (17, 6, 9, 'Av. da Liberdade 10', '1250-140', 'Lisboa',        '920888888', 38.7200, -9.1450, 1, 'active'),
  (18, 4, 7, 'Rua dos Clerigos 5',  '4050-110', 'Porto',         '921999999', 41.1460, -8.6140, 3, 'active');

-- ---------- Familias de produtos ----------
INSERT INTO families (name) VALUES
  ('Alimentar'),  -- 1
  ('Higiene'),    -- 2
  ('Vestuário'),  -- 3
  ('Casa'),       -- 4
  ('Bebé'),       -- 5
  ('Médico'),     -- 6
  ('Outro');      -- 7

-- ---------- Produtos (em todos os armazens) ----------
-- IDs 1..6 mantidos para nao quebrar doacoes/pedidos de exemplo
INSERT INTO products (name, family_id, quantity, warehouse_id, location, `condition`, received_at, expiry_date, color_status) VALUES
  -- Armazem 1 (Lisboa Central)
  ('Arroz 1kg',           1, 117, 1, 'A1', 'new', '2026-04-01', '2027-01-01', 'green'),   -- 1
  ('Massa 500g',          1, 34, 1, 'A1', 'new', '2026-03-20', '2026-09-01', 'yellow'),  -- 2
  -- Armazem 2 (Torres Vedras)
  ('Leite UHT 1L',        1,  40, 2, 'A2', 'new', '2026-02-10', '2026-06-15', 'red'),     -- 3
  ('Gel de banho 250ml',  2,  114, 2, 'B1', 'new', '2026-04-15', NULL,         'green'),   -- 4
  -- Armazem 3 (Porto)
  ('Casaco crianca',      3,  55, 3, 'C3', 'good','2026-03-05', NULL,         'green'),   -- 5
  -- Armazem 4 (Braga)
  ('Fraldas T4',          5,  48, 4, 'B2', 'new', '2026-04-10', '2027-04-10', 'green'),   -- 6
  -- + Armazem 1
  ('Feijao enlatado',     1,  50, 1, 'A3', 'new', '2026-04-05', '2027-04-05', 'green'),   -- 7
  ('Champo 400ml',        2,  44, 1, 'B1', 'new', '2026-03-28', NULL,         'green'),   -- 8
  -- + Armazem 2
  ('Atum enlatado',       1,  114, 2, 'A4', 'new', '2026-04-02', '2027-02-01', 'green'),   -- 9
  ('Cobertor solteiro',   4,  37, 2, 'C1', 'good','2026-03-10', NULL,         'green'),   -- 10
  -- + Armazem 3 (Porto)
  ('Calcas adulto',       3,  120, 3, 'C2', 'used','2026-02-20', NULL,         'green'),   -- 11
  ('Bolachas pacote',     1,  112, 3, 'A1', 'new', '2026-03-15', '2026-08-01', 'yellow'),  -- 12
  ('Sabonetes (pack 6)',  2,  100, 3, 'B2', 'new', '2026-04-12', NULL,         'green'),   -- 13
  -- + Armazem 4 (Braga)
  ('Leite em po bebe',    5,  32, 4, 'A2', 'new', '2026-02-05', '2026-06-20', 'red'),     -- 14
  ('Papas infantis',      5,  100, 4, 'A3', 'new', '2026-04-08', '2027-01-10', 'green'),   -- 15
  ('Toalhitas bebe',      2,  72, 4, 'B1', 'new', '2026-04-01', NULL,         'green'),   -- 16
  -- Armazem 5 (Coimbra) - estava vazio
  ('Arroz 1kg',           1, 36, 5, 'A1', 'new', '2026-04-03', '2027-03-01', 'green'),   -- 17
  ('Conservas mistas',    1,  34, 5, 'A2', 'new', '2026-03-22', '2026-10-01', 'green'),   -- 18
  ('Pasta de dentes',     2,  40, 5, 'B1', 'new', '2026-04-09', '2028-04-09', 'green'),   -- 19
  ('Mantas',              4,  45, 5, 'C1', 'good','2026-02-28', NULL,         'green'),   -- 20
  ('Paracetamol 1g',      6,  40, 5, 'D1', 'new', '2026-01-15', '2026-06-10', 'red');     -- 21

-- ---------- Artigos de vestuario/calcado (com tamanho e stock minimo) ----------
INSERT INTO products (name, family_id, quantity, warehouse_id, location, `condition`, received_at, expiry_date, color_status, size, min_stock) VALUES
  ('Casaco de inverno',   3, 12, 1, 'V1', 'good',       '2026-03-05', NULL, 'green', 'M',  5),   -- 22
  ('Casaco de inverno',   3,  8, 1, 'V1', 'good',       '2026-03-05', NULL, 'green', 'L',  5),   -- 23
  ('Casaco de inverno',   3,  3, 1, 'V1', 'used',       '2026-03-05', NULL, 'green', 'XL', 5),   -- 24
  ('Camisola de lã',      3, 20, 2, 'V2', 'new',        '2026-03-10', NULL, 'green', 'S',  6),   -- 25
  ('Camisola de lã',      3, 15, 2, 'V2', 'good',       '2026-03-10', NULL, 'green', 'M',  6),   -- 26
  ('Camisola de lã',      3,  2, 2, 'V2', 'with_defect','2026-03-10', NULL, 'green', 'L',  6),   -- 27
  ('Calças de ganga',     3, 10, 3, 'V3', 'good',       '2026-02-20', NULL, 'green', '38', 4),   -- 28
  ('Calças de ganga',     3,  7, 3, 'V3', 'good',       '2026-02-20', NULL, 'green', '40', 4),   -- 29
  ('Calças de ganga',     3,  4, 3, 'V3', 'used',       '2026-02-20', NULL, 'green', '42', 4),   -- 30
  ('Ténis desportivos',   3,  6, 3, 'V4', 'new',        '2026-04-01', NULL, 'green', '41', 3),   -- 31
  ('Ténis desportivos',   3,  5, 3, 'V4', 'good',       '2026-04-01', NULL, 'green', '42', 3),   -- 32
  ('Ténis desportivos',   3,  1, 3, 'V4', 'to_repair',  '2026-04-01', NULL, 'green', '43', 3),   -- 33
  ('T-shirt algodão',     3, 30, 4, 'V5', 'new',        '2026-03-28', NULL, 'green', 'M',  8),   -- 34
  ('T-shirt algodão',     3, 25, 4, 'V5', 'new',        '2026-03-28', NULL, 'green', 'L',  8),   -- 35
  ('T-shirt algodão',     3,  3, 4, 'V5', 'used',       '2026-03-28', NULL, 'green', 'XL', 8),   -- 36
  ('Botas de criança',    3,  9, 5, 'V6', 'good',       '2026-02-15', NULL, 'green', '28', 4),   -- 37
  ('Botas de criança',    3,  6, 5, 'V6', 'good',       '2026-02-15', NULL, 'green', '30', 4),   -- 38
  ('Casaco impermeável',  3,  2, 5, 'V7', 'new',        '2026-04-10', NULL, 'green', 'M',  5);    -- 39

-- ---------- Movimentos de entrada ----------
INSERT INTO inventory_movements (product_id, type, quantity, reason, target_location)
  SELECT id, 'in', quantity, 'Stock inicial', location FROM products;


-- ---------- Doacoes (uma entrada por produto, Jan-Jun 2026) ----------
INSERT INTO donations (code, donor_id, status, expected_delivery_date, received_date, warehouse_id, notes) VALUES
  ('DON-2026-001', 1, 'received', '2026-01-05', '2026-01-07', 1, 'Doacao de Arroz 1kg'),
  ('DON-2026-002', 2, 'received', '2026-02-05', '2026-02-07', 1, 'Doacao de Massa 500g'),
  ('DON-2026-003', 3, 'received', '2026-03-05', '2026-03-07', 2, 'Doacao de Leite UHT 1L'),
  ('DON-2026-004', 4, 'received', '2026-04-05', '2026-04-07', 2, 'Doacao de Gel de banho 250ml'),
  ('DON-2026-005', 5, 'received', '2026-05-05', '2026-05-07', 3, 'Doacao de Casaco crianca'),
  ('DON-2026-006', 6, 'received', '2026-06-05', '2026-06-07', 4, 'Doacao de Fraldas T4'),
  ('DON-2026-007', 1, 'received', '2026-01-05', '2026-01-07', 1, 'Doacao de Feijao enlatado'),
  ('DON-2026-008', 2, 'received', '2026-02-05', '2026-02-07', 1, 'Doacao de Champo 400ml'),
  ('DON-2026-009', 3, 'received', '2026-03-05', '2026-03-07', 2, 'Doacao de Atum enlatado'),
  ('DON-2026-010', 4, 'received', '2026-04-05', '2026-04-07', 2, 'Doacao de Cobertor solteiro'),
  ('DON-2026-011', 5, 'received', '2026-05-05', '2026-05-07', 3, 'Doacao de Calcas adulto'),
  ('DON-2026-012', 6, 'received', '2026-06-05', '2026-06-07', 3, 'Doacao de Bolachas pacote'),
  ('DON-2026-013', 1, 'received', '2026-01-05', '2026-01-07', 3, 'Doacao de Sabonetes (pack 6)'),
  ('DON-2026-014', 2, 'received', '2026-02-05', '2026-02-07', 4, 'Doacao de Leite em po bebe'),
  ('DON-2026-015', 3, 'received', '2026-03-05', '2026-03-07', 4, 'Doacao de Papas infantis'),
  ('DON-2026-016', 4, 'received', '2026-04-05', '2026-04-07', 4, 'Doacao de Toalhitas bebe'),
  ('DON-2026-017', 5, 'received', '2026-05-05', '2026-05-07', 5, 'Doacao de Arroz 1kg'),
  ('DON-2026-018', 6, 'received', '2026-06-05', '2026-06-07', 5, 'Doacao de Conservas mistas'),
  ('DON-2026-019', 1, 'received', '2026-01-05', '2026-01-07', 5, 'Doacao de Pasta de dentes'),
  ('DON-2026-020', 2, 'received', '2026-02-05', '2026-02-07', 5, 'Doacao de Mantas'),
  ('DON-2026-021', 3, 'received', '2026-03-05', '2026-03-07', 5, 'Doacao de Paracetamol 1g'),
  ('DON-2026-022', 1, 'validated', '2026-06-12', NULL, 1, 'A aguardar rececao'),
  ('DON-2026-023', 2, 'pending', '2026-06-20', NULL, 3, 'Recente');

INSERT INTO donation_items (donation_id, product_id, quantity, expiry_date, `condition`) VALUES
  (1, 1, 120, '2027-01-28', 'new'),
  (2, 2, 40, '2027-02-28', 'new'),
  (3, 3, 40, '2027-03-28', 'new'),
  (4, 4, 120, '2027-04-28', 'new'),
  (5, 5, 60, NULL, 'good'),
  (6, 6, 50, '2027-06-28', 'new'),
  (7, 7, 50, '2027-01-28', 'new'),
  (8, 8, 50, '2027-02-28', 'new'),
  (9, 9, 120, '2027-03-28', 'new'),
  (10, 10, 40, NULL, 'good'),
  (11, 11, 120, NULL, 'good'),
  (12, 12, 120, '2027-06-28', 'new'),
  (13, 13, 100, '2027-01-28', 'new'),
  (14, 14, 40, '2027-02-28', 'new'),
  (15, 15, 100, '2027-03-28', 'new'),
  (16, 16, 80, '2027-04-28', 'new'),
  (17, 17, 40, '2027-05-28', 'new'),
  (18, 18, 40, '2027-06-28', 'new'),
  (19, 19, 40, '2027-01-28', 'new'),
  (20, 20, 50, NULL, 'good'),
  (21, 21, 50, '2027-03-28', 'new'),
  (22, 1, 50, '2027-06-30', 'new'),
  (23, 12, 30, '2026-12-31', 'new');

-- ---------- Pedidos (entregas para varios produtos, Jan-Jun 2026) ----------
INSERT INTO requests (code, beneficiary_id, status, priority, delivered_at, notes) VALUES
  ('REQ-2026-001', 1, 'delivered', 'high', '2026-01-15 10:30:00', 'Entrega de Massa 500g'),
  ('REQ-2026-002', 2, 'delivered', 'medium', '2026-02-16 10:30:00', 'Entrega de Gel de banho 250ml'),
  ('REQ-2026-003', 3, 'delivered', 'urgent', '2026-03-17 10:30:00', 'Entrega de Fraldas T4'),
  ('REQ-2026-004', 4, 'delivered', 'medium', '2026-04-18 10:30:00', 'Entrega de Champo 400ml'),
  ('REQ-2026-005', 5, 'delivered', 'high', '2026-05-19 10:30:00', 'Entrega de Cobertor solteiro'),
  ('REQ-2026-006', 6, 'delivered', 'high', '2026-06-20 10:30:00', 'Entrega de Bolachas pacote'),
  ('REQ-2026-007', 7, 'delivered', 'medium', '2026-01-21 10:30:00', 'Entrega de Leite em po bebe'),
  ('REQ-2026-008', 8, 'delivered', 'urgent', '2026-02-22 10:30:00', 'Entrega de Toalhitas bebe'),
  ('REQ-2026-009', 9, 'delivered', 'medium', '2026-03-23 10:30:00', 'Entrega de Conservas mistas'),
  ('REQ-2026-010', 1, 'delivered', 'high', '2026-04-24 10:30:00', 'Entrega de Mantas'),
  ('REQ-2026-011', 2, 'delivered', 'high', '2026-05-15 10:30:00', 'Entrega de Arroz 1kg'),
  ('REQ-2026-012', 3, 'delivered', 'medium', '2026-06-16 10:30:00', 'Entrega de Casaco crianca'),
  ('REQ-2026-013', 4, 'delivered', 'urgent', '2026-01-17 10:30:00', 'Entrega de Atum enlatado'),
  ('REQ-2026-014', 5, 'delivered', 'medium', '2026-02-18 10:30:00', 'Entrega de Arroz 1kg'),
  ('REQ-2026-015', 7, 'in_delivery', 'medium', NULL, 'Em curso'),
  ('REQ-2026-016', 8, 'approved', 'high', NULL, 'Em curso'),
  ('REQ-2026-017', 9, 'submitted', 'urgent', NULL, 'Em curso'),
  ('REQ-2026-018', 1, 'submitted', 'medium', NULL, 'Em curso');

INSERT INTO request_items (request_id, product_id, requested_qty, approved_qty, fulfilled_qty) VALUES
  (1, 2, 6, 6, 6),
  (2, 4, 6, 6, 6),
  (3, 6, 2, 2, 2),
  (4, 8, 6, 6, 6),
  (5, 10, 3, 3, 3),
  (6, 12, 8, 8, 8),
  (7, 14, 8, 8, 8),
  (8, 16, 8, 8, 8),
  (9, 18, 6, 6, 6),
  (10, 20, 5, 5, 5),
  (11, 1, 3, 3, 3),
  (12, 5, 5, 5, 5),
  (13, 9, 6, 6, 6),
  (14, 17, 4, 4, 4),
  (15, 16, 3, 3, 0),
  (16, 17, 3, 3, 0),
  (17, 18, 3, 0, 0),
  (18, 19, 3, 0, 0);

-- ---------- Entrega registada (exemplo de pickup) ----------
INSERT INTO pickup_deliveries (request_id, type, status, scheduled_for, completed_at, address) VALUES
  (1, 'delivery', 'completed', '2026-01-15 10:00:00', '2026-01-15 11:30:00', 'Rua das Flores 12, Torres Vedras');
