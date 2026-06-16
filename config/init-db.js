// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// config/init-db.js
// No arranque, verifica se as tabelas existem. Se nao existirem,
// cria o schema e insere os dados de exemplo automaticamente.
// Assim, em alojamento na nuvem (ex.: Aiven), nao e preciso correr
// nenhum comando manual: basta a app arrancar.

const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Remove comandos ao nivel de base de dados (em ambientes geridos como o
// Aiven o utilizador nao pode fazer CREATE/DROP DATABASE; a base ja existe).
function adaptarParaNuvem(sql) {
  return sql
    .replace(/DROP DATABASE[^;]*;/gi, '')
    .replace(/CREATE DATABASE[^;]*;/gi, '')
    .replace(/^\s*USE\s+[^;]*;/gim, '');
}

async function initDb() {
  // So inicializa automaticamente quando pedido (evita correr sem querer em local)
  if (process.env.DB_AUTO_INIT !== 'true') return;

  let conn;
  try {
    conn = await pool.getConnection();

    // Ja existe a tabela 'users'? Se sim, assume-se que esta inicializada.
    const [tabelas] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"
    );
    if (tabelas[0].n > 0) {
      console.log('[init-db] Tabelas ja existem. Nada a fazer.');
      return;
    }

    console.log('[init-db] Base de dados vazia. A criar tabelas e dados de exemplo...');

    // Executa schema e seed (adaptados para nuvem)
    const schema = adaptarParaNuvem(
      fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8')
    );
    const seed = adaptarParaNuvem(
      fs.readFileSync(path.join(__dirname, '..', 'database', 'seed.sql'), 'utf8')
    );

    // multipleStatements e necessario para correr o ficheiro todo de uma vez.
    // Como o pool pode nao ter essa opcao, usamos uma ligacao dedicada.
    const mysql = require('mysql2/promise');
    let ssl;
    if (process.env.DB_SSL === 'true') {
      ssl = process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : { rejectUnauthorized: false };
    }
    const c = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'charity_inventory',
      ssl,
      multipleStatements: true,
    });
    await c.query(schema);
    await c.query(seed);
    await c.end();

    console.log('[init-db] Base de dados pronta.');
  } catch (e) {
    console.error('[init-db] Erro ao inicializar a base de dados:', e.message);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = initDb;
