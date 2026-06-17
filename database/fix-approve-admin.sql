-- Inventario Solidario
-- Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
-- Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

-- ============================================================
-- Correcao: aprovar contas numa base de dados ja existente
-- ============================================================
-- Usar este script SE a base de dados foi criada ANTES da coluna
-- is_approved existir.
--
-- Como correr:
--   mysql -u root -p charity_inventory < database/fix-approve-admin.sql
--
-- NAO e preciso numa base de dados nova: o seed.sql ja cria as
-- contas de exemplo como aprovadas.
-- ============================================================
USE charity_inventory;

-- 1) Criar a coluna se ainda nao existir (compativel com MySQL 8)
SET @existe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'users'
     AND COLUMN_NAME = 'is_approved'
);
SET @sql := IF(@existe = 0,
  'ALTER TABLE users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT FALSE',
  'SELECT "coluna is_approved ja existe" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1b) Criar a tabela settings se ainda nao existir (para config SMTP no painel)
CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(60) PRIMARY KEY,
  setting_value TEXT
) ENGINE=InnoDB;

-- 1b2) Tabela de tokens de recuperacao de senha
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1c) Adicionar colunas de geolocalizacao se faltarem
-- (latitude/longitude/warehouse_id em beneficiaries e donors; lat/lon em warehouses)
-- Nota: se as colunas ja existirem, estes comandos dao erro inofensivo.
--       Em MySQL 8 podes correr cada um e ignorar "Duplicate column".
ALTER TABLE warehouses    ADD COLUMN latitude  DECIMAL(10,7) NULL;
ALTER TABLE warehouses    ADD COLUMN longitude DECIMAL(10,7) NULL;
ALTER TABLE beneficiaries ADD COLUMN latitude  DECIMAL(10,7) NULL;
ALTER TABLE beneficiaries ADD COLUMN longitude DECIMAL(10,7) NULL;
ALTER TABLE beneficiaries ADD COLUMN warehouse_id INT NULL;
ALTER TABLE donors        ADD COLUMN address   VARCHAR(255) NULL;
ALTER TABLE donors        ADD COLUMN latitude  DECIMAL(10,7) NULL;
ALTER TABLE donors        ADD COLUMN longitude DECIMAL(10,7) NULL;
ALTER TABLE donors        ADD COLUMN warehouse_id INT NULL;
ALTER TABLE donations     ADD COLUMN warehouse_id INT NULL;

-- 2) Aprovar as contas de exemplo (e o admin)
UPDATE users SET is_approved = TRUE
WHERE email IN (
  'admin@caridade.pt',
  'tecnico@caridade.pt',
  'armazem@caridade.pt',
  'doador@empresa.pt',
  'ana@familia.pt',
  'carlos@familia.pt'
);

-- 3) Mostrar o resultado
SELECT email, role, is_approved FROM users;
ALTER TABLE warehouses ADD COLUMN phone VARCHAR(40) NULL;
CREATE TABLE IF NOT EXISTS profile_change_requests (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
  address VARCHAR(255), postal_code VARCHAR(20), city VARCHAR(120), phone VARCHAR(40),
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
ALTER TABLE donation_items ADD COLUMN expiry_date DATE NULL;
ALTER TABLE products MODIFY `condition` ENUM('new','good','used','with_defect','to_repair') NOT NULL DEFAULT 'good';
ALTER TABLE donation_items MODIFY `condition` ENUM('new','good','used','with_defect','to_repair') NOT NULL DEFAULT 'good';
ALTER TABLE products MODIFY color_status ENUM('green','yellow','red','expired') NOT NULL DEFAULT 'green';
CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(120),
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(60),
  entity_id VARCHAR(60),
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;
ALTER TABLE products ADD COLUMN size VARCHAR(20) NULL;
ALTER TABLE products ADD COLUMN min_stock INT NOT NULL DEFAULT 0;
ALTER TABLE warehouses ADD COLUMN email VARCHAR(150) NULL;
