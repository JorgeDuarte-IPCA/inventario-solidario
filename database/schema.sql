-- Inventario Solidario
-- Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
-- Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

-- ============================================================
-- Sistema de Gestao de Inventario e Distribuicao de Bens
-- Associacoes de Caridade  |  IPCA - CTESP RSI 2025/2026
-- Base de dados: MySQL 8.x
-- ============================================================

DROP DATABASE IF EXISTS charity_inventory;
CREATE DATABASE charity_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE charity_inventory;
SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- MODULO 1 (Membro 1) - Utilizadores e Autenticacao
-- ------------------------------------------------------------
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','donor','beneficiary','social_technician','warehouse_operator') NOT NULL,
  address       VARCHAR(255),
  postal_code   VARCHAR(20),
  city          VARCHAR(120),
  phone         VARCHAR(40),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_approved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE beneficiaries (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  household_size      INT NOT NULL DEFAULT 1,
  vulnerability_score INT NOT NULL DEFAULT 0,
  address             VARCHAR(255),
  postal_code         VARCHAR(20),
  city                VARCHAR(120),
  phone               VARCHAR(40),
  latitude            DECIMAL(10,7) NULL,
  longitude           DECIMAL(10,7) NULL,
  warehouse_id        INT NULL,
  status              ENUM('active','suspended','archived') NOT NULL DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE donors (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  organization_name VARCHAR(160),
  contact_person    VARCHAR(120),
  phone             VARCHAR(40),
  address           VARCHAR(255),
  postal_code       VARCHAR(20),
  city              VARCHAR(120),
  latitude          DECIMAL(10,7) NULL,
  longitude         DECIMAL(10,7) NULL,
  warehouse_id      INT NULL,
  type              ENUM('individual','company','institution') NOT NULL DEFAULT 'individual',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MODULO 2 (Membro 2) - Armazens, Produtos, Inventario e Dashboard
-- ------------------------------------------------------------
CREATE TABLE warehouses (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  district  VARCHAR(60) NOT NULL,
  address   VARCHAR(255),
  phone     VARCHAR(40),
  email     VARCHAR(150) NULL,
  latitude  DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  INDEX idx_wh_district (district)
) ENGINE=InnoDB;

CREATE TABLE families (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- Configuracoes da aplicacao (chave/valor) - ex.: SMTP
CREATE TABLE settings (
  setting_key   VARCHAR(60) PRIMARY KEY,
  setting_value TEXT
) ENGINE=InnoDB;

-- Registo de auditoria: quem fez o que e quando (acoes sensiveis)
CREATE TABLE audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  user_name   VARCHAR(120),
  action      VARCHAR(60) NOT NULL,
  entity      VARCHAR(60),
  entity_id   VARCHAR(60),
  details     TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- Pedidos de alteracao de dados pessoais (por validar pelo admin/tecnico)
CREATE TABLE profile_change_requests (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  address     VARCHAR(255),
  postal_code VARCHAR(20),
  city        VARCHAR(120),
  phone       VARCHAR(40),
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at  DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pcr_status (status)
) ENGINE=InnoDB;

-- Tokens de recuperacao de senha
CREATE TABLE password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pr_token (token)
) ENGINE=InnoDB;

CREATE TABLE products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(160) NOT NULL,
  family_id    INT NULL,
  quantity     INT NOT NULL DEFAULT 0,
  warehouse_id INT NULL,
  location     VARCHAR(120),
  `condition`  ENUM('new','good','used','with_defect','to_repair') NOT NULL DEFAULT 'good',
  size         VARCHAR(20) NULL,
  min_stock    INT NOT NULL DEFAULT 0,
  received_at  DATE NOT NULL DEFAULT (CURRENT_DATE),
  expiry_date  DATE NULL,
  color_status ENUM('green','yellow','red','expired') NOT NULL DEFAULT 'green',
  FOREIGN KEY (family_id)    REFERENCES families(id)   ON DELETE SET NULL,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
  INDEX idx_products_family (family_id),
  INDEX idx_products_color (color_status),
  INDEX idx_products_location (location)
) ENGINE=InnoDB;

CREATE TABLE inventory_movements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  product_id      INT NOT NULL,
  request_id      INT NULL,
  type            ENUM('in','out','adjust','transfer') NOT NULL,
  quantity        INT NOT NULL,
  reason          VARCHAR(255),
  source_location VARCHAR(120) NULL,
  target_location VARCHAR(120) NULL,
  occurred_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_mov_product (product_id),
  INDEX idx_mov_type (type)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MODULO 3 (Membro 3) - Doacoes
-- ------------------------------------------------------------
CREATE TABLE donations (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  code                   VARCHAR(30) NOT NULL UNIQUE,
  donor_id               INT NOT NULL,
  status                 ENUM('pending','validated','received','rejected','cancelled') NOT NULL DEFAULT 'pending',
  expected_delivery_date DATE NULL,
  received_date          DATE NULL,
  warehouse_id           INT NULL,
  notes                  TEXT,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
  INDEX idx_don_status (status)
) ENGINE=InnoDB;

CREATE TABLE donation_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  donation_id INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL,
  expiry_date DATE NULL,
  `condition` ENUM('new','good','used','with_defect','to_repair') NOT NULL DEFAULT 'good',
  FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MODULO 4 (Membro 4) - Pedidos e Entregas
-- ------------------------------------------------------------
CREATE TABLE requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(30) NOT NULL UNIQUE,
  beneficiary_id INT NOT NULL,
  status         ENUM('draft','submitted','under_review','approved','rejected','on_hold','scheduled','in_delivery','delivered','cancelled','expired') NOT NULL DEFAULT 'draft',
  priority       ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  requested_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at   DATETIME NULL,
  decided_at     DATETIME NULL,
  scheduled_at   DATETIME NULL,
  delivered_at   DATETIME NULL,
  notes          TEXT,
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
  INDEX idx_req_status (status),
  INDEX idx_req_priority (priority)
) ENGINE=InnoDB;

CREATE TABLE request_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  request_id    INT NOT NULL,
  product_id    INT NOT NULL,
  requested_qty INT NOT NULL,
  approved_qty  INT NOT NULL DEFAULT 0,
  fulfilled_qty INT NOT NULL DEFAULT 0,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pickup_deliveries (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  request_id      INT NOT NULL,
  type            ENUM('pickup','delivery') NOT NULL DEFAULT 'delivery',
  status          ENUM('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  scheduled_for   DATETIME NULL,
  completed_at    DATETIME NULL,
  address         VARCHAR(255),
  proof_image_url VARCHAR(255) NULL,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Transferencias de stock entre armazens
CREATE TABLE stock_transfers (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(30) NOT NULL UNIQUE,
  from_warehouse_id INT NOT NULL,
  to_warehouse_id   INT NOT NULL,
  notes             VARCHAR(255),
  created_by        INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE stock_transfer_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  transfer_id INT NOT NULL,
  product_id  INT NOT NULL,
  product_name VARCHAR(160),
  quantity    INT NOT NULL,
  FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;
ALTER TABLE inventory_movements
  ADD CONSTRAINT fk_mov_request FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL;

-- FKs dos perfis ao armazem mais proximo (criadas apos warehouses existir)
ALTER TABLE beneficiaries
  ADD CONSTRAINT fk_benef_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE donors
  ADD CONSTRAINT fk_donor_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
