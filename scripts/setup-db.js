// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// scripts/setup-db.js
// Cria as tabelas e (opcionalmente) os dados de exemplo.
//
// Uso:
//   node scripts/setup-db.js              -> cria tabelas + dados de exemplo
//   node scripts/setup-db.js --no-seed    -> cria so as tabelas
//
// Local (MySQL proprio): o schema.sql cria a base de dados do zero.
// Nuvem (Aiven, etc.): a base de dados ja existe e o utilizador NAO pode
//   fazer CREATE/DROP DATABASE. Define DB_CLOUD=true para o script ligar
//   diretamente a base (DB_NAME) e remover as linhas DROP/CREATE/USE.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const ehNuvem = process.env.DB_CLOUD === 'true' || process.env.DB_SSL === 'true';

let ssl;
if (process.env.DB_SSL === 'true') {
  ssl = process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : { rejectUnauthorized: false };
}

// Remove os comandos ao nivel de base de dados (para ambientes geridos)
function adaptarParaNuvem(sql) {
  return sql
    .replace(/DROP DATABASE[^;]*;/gi, '')
    .replace(/CREATE DATABASE[^;]*;/gi, '')
    .replace(/^\s*USE\s+[^;]*;/gim, '');
}

async function run() {
  const semSeed = process.argv.includes('--no-seed');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    // Na nuvem, liga diretamente a base de dados ja existente
    database: ehNuvem ? (process.env.DB_NAME || 'defaultdb') : undefined,
    ssl,
    multipleStatements: true
  });

  let schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  if (ehNuvem) schema = adaptarParaNuvem(schema);
  console.log('A criar tabelas...');
  await conn.query(schema);

  if (!semSeed) {
    let seed = fs.readFileSync(path.join(__dirname, '..', 'database', 'seed.sql'), 'utf8');
    if (ehNuvem) seed = adaptarParaNuvem(seed);
    console.log('A inserir dados de exemplo...');
    await conn.query(seed);
  }

  console.log('Base de dados pronta.');
  await conn.end();
}

run().catch(e => { console.error('Erro a preparar a base de dados:', e.message); process.exit(1); });
