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

// Endpoint para verificar artigos a expirar e alertar os armazens por email.
// Pode ser chamado por um servico de cron externo (ex.: cron-job.org) uma vez por dia.
// Protegido por uma chave: passar ?key=VALOR igual a CRON_KEY (variavel de ambiente).
const { verificarAExpirar } = require('./config/expiry-alert');
app.get('/api/cron/expiry-check', async (req, res) => {
  const chave = process.env.CRON_KEY;
  if (chave && req.query.key !== chave) return res.status(403).json({ error: 'Chave inválida' });
  const r = await verificarAExpirar();
  res.json({ ok: true, ...r });
});

const PORT = process.env.PORT || 3000;

// Inicializa a base de dados (se DB_AUTO_INIT=true) e so depois arranca
const initDb = require('./config/init-db');
initDb().finally(() => {
  app.listen(PORT, () => console.log(`Servidor a correr em http://localhost:${PORT}`));

  // Agendador diario: verifica artigos a expirar uma vez por dia enquanto a app estiver ativa.
  // Nota: no plano gratuito do Render a app adormece; para garantir a verificacao diaria,
  // configurar tambem um cron externo a chamar /api/cron/expiry-check.
  const UM_DIA = 24 * 60 * 60 * 1000;
  setInterval(() => { verificarAExpirar().catch(() => {}); }, UM_DIA);
});
