// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// config/db.js - Pool de ligacao a base de dados MySQL
const mysql = require('mysql2/promise');
require('dotenv').config();

// Suporte SSL (necessario em alojamento na nuvem, ex.: Aiven).
// Ativa-se com DB_SSL=true nas variaveis de ambiente.
// Opcionalmente, DB_SSL_CA pode conter o certificado CA fornecido pelo Aiven.
let ssl;
if (process.env.DB_SSL === 'true') {
  ssl = process.env.DB_SSL_CA
    ? { ca: process.env.DB_SSL_CA }
    : { rejectUnauthorized: false };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'charity_inventory',
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Alguns servidores (ex.: Aiven) ativam o modo estrito ONLY_FULL_GROUP_BY,
// que e mais rigoroso com GROUP BY. Removemo-lo em cada ligacao nova para
// garantir comportamento consistente com o desenvolvimento local.
pool.on('connection', (conn) => {
  conn.query("SET SESSION sql_mode = REPLACE(REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY,', ''), 'ONLY_FULL_GROUP_BY', '')");
});

module.exports = pool;
