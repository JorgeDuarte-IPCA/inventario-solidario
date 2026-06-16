// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// server.js - Ponto de entrada da aplicacao
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Rotas por modulo (1 por elemento do grupo) ----
app.use('/api/auth',      require('./routes/auth'));        // Membro 1
app.use('/api/users',     require('./routes/users'));       // Membro 1
app.use('/api/settings',  require('./routes/settings'));    // Membro 1
app.use('/api/transfers', require('./routes/transfers'));   // Transferencias
app.use('/api/profile',   require('./routes/profile'));     // Alteracao de dados pessoais
app.use('/api/chatbot',   require('./routes/chatbot'));     // Assistente de ajuda (IA)
app.use('/api/audit',     require('./routes/audit'));       // Registo de auditoria
app.use('/api/products',  require('./routes/products'));    // Membro 2
app.use('/api/families',  require('./routes/families'));    // Membro 2
app.use('/api/warehouses', require('./routes/warehouses'));  // Membro 2
app.use('/api/inventory', require('./routes/inventory'));   // Membro 2
app.use('/api/dashboard', require('./routes/dashboard'));   // Membro 2
app.use('/api/donations', require('./routes/donations'));   // Membro 3
app.use('/api/requests',  require('./routes/requests'));    // Membro 4

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;

// Inicializa a base de dados (se DB_AUTO_INIT=true) e so depois arranca
const initDb = require('./config/init-db');
initDb().finally(() => {
  app.listen(PORT, () => console.log(`Servidor a correr em http://localhost:${PORT}`));
});
