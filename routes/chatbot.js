// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// routes/chatbot.js - Assistente de ajuda com IA (Google Gemini)
// A chave fica no servidor (variavel de ambiente GEMINI_API_KEY), nunca no browser.
const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Contexto sobre o site, para a IA responder de forma relevante e limitada ao tema.
const CONTEXTO = `És o assistente de ajuda do "Inventário Solidário", um sistema de gestão de inventário para associações de caridade.
Responde apenas a dúvidas sobre o funcionamento do site, em português de Portugal, de forma breve e clara.
Se a pergunta não for sobre o site, diz educadamente que só podes ajudar com dúvidas sobre a plataforma.

Funcionamento do site:
- Papéis: administrador, técnico social, operador de armazém, doador e beneficiário.
- Doações: o doador vai a "Doações", escolhe os bens (com quantidade, validade e estado do bem), e pode escolher o armazém de destino ou deixar em branco (vai para o mais próximo). A doação fica pendente até a associação validar e rececionar; só então os bens entram no stock.
- Pedidos: o beneficiário vai a "Pedidos", escolhe os bens e indica as quantidades. O pedido passa por: submetido, aprovado, agendado, em entrega, entregue. O beneficiário é avisado por email em cada etapa.
- Estados das doações: pendente, validada, rececionada.
- Validade: indicada em cada bem na doação. O mesmo artigo pode ter vários lotes com validades diferentes. Cores: verde (válido), amarelo (atenção), vermelho (a expirar).
- Estado do bem: Novo, Bom estado, Gasto; para vestuário e casa há também "Com defeito" e "Para arranjar".
- Contas: regista-se na página inicial como beneficiário ou doador; a conta fica pendente até ser aprovada por um administrador ou técnico social.
- Dados pessoais: alteram-se em "A minha conta" e ficam pendentes de validação. O agregado familiar só é alterado por administrador/técnico.
- Senhas: alteram-se em "A minha conta"; há "Esqueci-me da senha" no login.
- Armazéns: os beneficiários veem os armazéns do seu distrito e os contactos.`;

router.post('/', authenticate, async (req, res) => {
  const pergunta = (req.body && req.body.pergunta || '').toString().slice(0, 500);
  if (!pergunta.trim()) return res.status(400).json({ error: 'Pergunta vazia' });

  const apiKey = process.env.GEMINI_API_KEY;
  // Sem chave configurada: avisar o frontend para usar o FAQ local.
  if (!apiKey) return res.json({ resposta: null, fonte: 'sem-ia' });

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
    const corpo = {
      systemInstruction: { parts: [{ text: CONTEXTO }] },
      contents: [{ role: 'user', parts: [{ text: pergunta }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 300 }
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    if (!r.ok) {
      console.error('Gemini erro HTTP', r.status);
      return res.json({ resposta: null, fonte: 'erro-ia' });
    }
    const data = await r.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) return res.json({ resposta: null, fonte: 'sem-resposta' });
    res.json({ resposta: texto.trim(), fonte: 'ia' });
  } catch (e) {
    console.error('Falha ao contactar a IA:', e.message);
    res.json({ resposta: null, fonte: 'erro-ia' });
  }
});

module.exports = router;
