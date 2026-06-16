// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/chatbot.js
// Chatbot de ajuda (FAQ) sobre o funcionamento do site.
// - Funciona offline, sem chaves nem IA externa (fiavel para a apresentacao).
// - Tem um ponto preparado (responderIA) para ligar uma IA real no futuro.

(function () {
  // Base de conhecimento: cada entrada tem palavras-chave e uma resposta.
  const FAQ = [
    {
      chaves: ['doar', 'doacao', 'doação', 'doações', 'como doar', 'fazer doacao'],
      resposta: 'Para fazer uma doação: entre na página "Doações", clique em "Adicionar item", escolha o bem, a quantidade, a validade e o estado. Pode escolher o armazém de destino ou deixar em branco (vai para o mais próximo de si). A doação fica pendente até a associação a validar e rececionar.'
    },
    {
      chaves: ['pedir', 'pedido', 'pedidos', 'requisicao', 'requisição', 'como pedir', 'pedir bens'],
      resposta: 'Para pedir bens: vá à página "Pedidos", clique em "Escolher bens", selecione os artigos que precisa e indique as quantidades. O seu pedido passa por várias etapas (aprovado, agendado, em entrega, entregue) e será avisado por email em cada uma.'
    },
    {
      chaves: ['estado', 'estados', 'significa', 'submetido', 'aprovado', 'agendado', 'entregue', 'rececionado', 'validado', 'pendente'],
      resposta: 'Os estados indicam em que ponto está o processo. Pedidos: submetido → aprovado → agendado → em entrega → entregue. Doações: pendente → validada → rececionada. Quando uma doação é rececionada, os bens entram no stock; quando um pedido é entregue, saem do stock.'
    },
    {
      chaves: ['validade', 'expirar', 'expira', 'lote', 'lotes', 'caducar'],
      resposta: 'A validade é indicada em cada bem no momento da doação. O mesmo artigo pode ter vários lotes com validades diferentes. Na lista de produtos vê a validade mais próxima de expirar; ao abrir o artigo vê todas as validades e a quantidade de cada uma. As cores indicam: verde (válido), amarelo (atenção), vermelho (a expirar).'
    },
    {
      chaves: ['estado do bem', 'condicao', 'condição', 'novo', 'gasto', 'defeito', 'arranjar'],
      resposta: 'O estado do bem descreve a condição física do artigo doado: Novo, Bom estado ou Gasto. Para artigos de vestuário e casa existem ainda "Com defeito" e "Para arranjar". É indicado no momento da doação.'
    },
    {
      chaves: ['conta', 'registar', 'registo', 'criar conta', 'aprovacao', 'aprovação', 'aprovar'],
      resposta: 'Pode registar-se na página inicial como beneficiário ou doador. A conta fica pendente até ser aprovada por um administrador ou técnico social. Recebe um email quando a conta for aprovada.'
    },
    {
      chaves: ['morada', 'alterar dados', 'mudar morada', 'contacto', 'telemovel', 'telemóvel', 'dados pessoais'],
      resposta: 'Para alterar a sua morada ou contactos, vá a "A minha conta" e submeta as alterações. Estas ficam pendentes até serem validadas por um administrador ou técnico social. O agregado familiar só pode ser alterado por eles.'
    },
    {
      chaves: ['armazem', 'armazém', 'armazens', 'armazéns', 'distrito', 'onde'],
      resposta: 'Os armazéns guardam os bens por distrito. Como beneficiário, pode ver os armazéns do seu distrito e os respetivos contactos na página "Armazéns do meu distrito".'
    },
    {
      chaves: ['senha', 'password', 'palavra-passe', 'esqueci', 'recuperar'],
      resposta: 'Para alterar a sua senha, vá a "A minha conta". Se se esqueceu da senha, use a opção "Esqueci-me da senha" na página de login — receberá um email com um link para a redefinir.'
    },
    {
      chaves: ['ola', 'olá', 'bom dia', 'boa tarde', 'ajuda', 'help'],
      resposta: 'Olá! Posso ajudar com dúvidas sobre o site: como doar, como pedir bens, estados dos pedidos, validades, contas, moradas e armazéns. Sobre o que precisa de ajuda?'
    }
  ];

  // Sugestoes iniciais (botoes rapidos)
  const SUGESTOES = ['Como faço uma doação?', 'Como peço bens?', 'O que significam os estados?', 'Como altero a minha morada?'];

  // ---- Resposta por FAQ (correspondencia de palavras) ----
  function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function responderFAQ(pergunta) {
    const p = normalizar(pergunta);
    let melhor = null, melhorPontos = 0;
    for (const item of FAQ) {
      let pontos = 0;
      for (const chave of item.chaves) {
        if (p.includes(normalizar(chave))) pontos += chave.length; // chaves mais longas pesam mais
      }
      if (pontos > melhorPontos) { melhorPontos = pontos; melhor = item; }
    }
    if (melhor) return melhor.resposta;
    return 'Não tenho a certeza sobre isso. Posso ajudar com: como doar, como pedir bens, estados dos pedidos, validades, contas, moradas e armazéns. Pode reformular a pergunta?';
  }

  // ---- IA externa (Google Gemini, via backend) ----
  // Chama a rota do servidor, que guarda a chave e contacta a IA.
  // Se devolver null (sem chave, erro, ou fora do tema), cai no FAQ local.
  async function responderIA(pergunta) {
    try {
      const r = await api('/api/chatbot', {
        method: 'POST',
        body: JSON.stringify({ pergunta })
      });
      return r && r.resposta ? r.resposta : null;
    } catch (e) {
      return null;
    }
  }

  async function obterResposta(pergunta) {
    try {
      const ia = await responderIA(pergunta);
      if (ia) return ia;
    } catch (e) { /* se a IA falhar, cai no FAQ */ }
    return responderFAQ(pergunta);
  }

  // ---- Interface (botao flutuante + janela) ----
  function montar() {
    const wrap = document.createElement('div');
    wrap.id = 'chatbot';
    wrap.innerHTML = `
      <button id="cb-toggle" title="Ajuda" aria-label="Abrir ajuda">?</button>
      <div id="cb-janela" style="display:none">
        <div id="cb-cabecalho">
          <span>Ajuda</span>
          <button id="cb-fechar" aria-label="Fechar">×</button>
        </div>
        <div id="cb-mensagens"></div>
        <div id="cb-sugestoes"></div>
        <div id="cb-entrada">
          <input id="cb-input" placeholder="Escreva a sua dúvida..." autocomplete="off">
          <button id="cb-enviar">Enviar</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const janela = wrap.querySelector('#cb-janela');
    const msgs = wrap.querySelector('#cb-mensagens');
    const input = wrap.querySelector('#cb-input');
    const sugestoesBox = wrap.querySelector('#cb-sugestoes');

    function addMsg(texto, de) {
      const div = document.createElement('div');
      div.className = 'cb-msg cb-' + de;
      div.textContent = texto;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    async function enviar(texto) {
      const t = (texto || input.value).trim();
      if (!t) return;
      addMsg(t, 'user');
      input.value = '';
      const resp = await obterResposta(t);
      addMsg(resp, 'bot');
    }

    function mostrarSugestoes() {
      sugestoesBox.innerHTML = '';
      SUGESTOES.forEach(s => {
        const b = document.createElement('button');
        b.className = 'cb-sugestao';
        b.textContent = s;
        b.onclick = () => enviar(s);
        sugestoesBox.appendChild(b);
      });
    }

    wrap.querySelector('#cb-toggle').onclick = () => {
      const aberto = janela.style.display !== 'none';
      janela.style.display = aberto ? 'none' : 'flex';
      if (!aberto && msgs.childElementCount === 0) {
        addMsg('Olá! Sou o assistente do Inventário Solidário. Em que posso ajudar?', 'bot');
        mostrarSugestoes();
      }
    };
    wrap.querySelector('#cb-fechar').onclick = () => { janela.style.display = 'none'; };
    wrap.querySelector('#cb-enviar').onclick = () => enviar();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
  }

  // So montar depois do DOM pronto
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
