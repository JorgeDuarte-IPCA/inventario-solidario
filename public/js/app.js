// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/app.js - utilitarios partilhados pelo frontend
const API = '';

function getToken()  { return localStorage.getItem('token'); }
function getUser()   { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } }
function logout()    { localStorage.clear(); location.href = 'index.html'; }

// Garante que o utilizador esta autenticado; se nao, vai para o login
function requireAuth() {
  if (!getToken()) { location.href = 'index.html'; return null; }
  return getUser();
}

// Pagina inicial consoante o papel (carenciado e doador nao veem o painel)
function homeFor(role) {
  if (role === 'beneficiary') return 'requests.html';
  if (role === 'donor') return 'donations.html';
  return 'dashboard.html';
}

// Garante que o papel tem acesso a pagina atual; se nao, redireciona
function guardPage(allowedRoles) {
  const u = getUser();
  if (!u) { location.href = 'index.html'; return false; }
  if (allowedRoles && !allowedRoles.includes(u.role)) {
    location.href = homeFor(u.role);
    return false;
  }
  return true;
}

// Wrapper de fetch com token
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getToken(),
      ...(options.headers || {})
    }
  });
  if (res.status === 401) { logout(); throw new Error('Sessao expirada'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro');
  return data;
}

// Etiquetas de estado -> classe de badge
const STATUS_CLASS = {
  green: 'green', yellow: 'yellow', red: 'red',
  delivered: 'green', approved: 'green', scheduled: 'green', in_delivery: 'green',
  received: 'green', validated: 'green',
  submitted: 'blue', under_review: 'orange', draft: 'gray', pending: 'blue',
  rejected: 'red', cancelled: 'red', expired: 'red', on_hold: 'orange'
};
// Traducao de papeis para portugues
const ROLE_PT = {
  admin: 'Administrador',
  social_technician: 'Técnico Social',
  warehouse_operator: 'Operador de Armazém',
  donor: 'Doador',
  beneficiary: 'Beneficiário'
};

// Traducao de estados / etiquetas para portugues
const ESTADO_PT = {
  green: 'Válido', yellow: 'Atenção', red: 'A expirar',
  draft: 'Rascunho', submitted: 'Submetido', under_review: 'Em revisão',
  approved: 'Aprovado', rejected: 'Rejeitado', on_hold: 'Em espera',
  scheduled: 'Agendado', in_delivery: 'Em entrega', delivered: 'Entregue',
  cancelled: 'Cancelado', expired: 'Expirado',
  pending: 'Pendente', validated: 'Validado', received: 'Rececionado',
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente'
};
function pt(value) { return ESTADO_PT[value] || value; }

function badge(value) {
  const cls = STATUS_CLASS[value] || 'gray';
  return `<span class="badge ${cls}">${pt(value)}</span>`;
}

// Etiqueta especifica do estado de validade do PRODUTO (color_status).
// Distingue 'expired' (fora de validade, cinzento/preto) de 'red' (a expirar).
const VALIDADE_CLASS = { green: 'green', yellow: 'yellow', red: 'red', expired: 'dark' };
const VALIDADE_PT = { green: 'Válido', yellow: 'Atenção', red: 'A expirar', expired: 'Fora de validade' };
function badgeValidade(value) {
  const cls = VALIDADE_CLASS[value] || 'gray';
  return `<span class="badge ${cls}">${VALIDADE_PT[value] || value}</span>`;
}

// Constroi a barra lateral consoante o papel
function buildSidebar(active) {
  const u = getUser() || {};
  const links = [
    { href: 'dashboard.html',  label: 'Painel',       roles: ['admin','social_technician','warehouse_operator'] },
    { href: 'relatorio-impacto.html', label: 'Relatório de Impacto', roles: ['admin','social_technician'] },
    { href: 'products.html',   label: 'Produtos',     roles: ['admin','warehouse_operator','social_technician'] },
    { href: 'families.html',   label: 'Famílias',     roles: ['admin'] },
    { href: 'warehouses.html', label: 'Armazéns',     roles: ['admin','warehouse_operator'] },
    { href: 'transfers.html',  label: 'Transferências', roles: ['admin','warehouse_operator'] },
    { href: 'donations.html',  label: 'Doações',      roles: ['admin','warehouse_operator','donor'] },
    { href: 'requests.html',   label: 'Pedidos',      roles: ['admin','social_technician','warehouse_operator','beneficiary'] },
    { href: 'meus-armazens.html', label: 'Armazéns do meu distrito', roles: ['beneficiary'] },
    { href: 'users.html',      label: 'Utilizadores', roles: ['admin','social_technician'] },
    { href: 'beneficiaries.html', label: 'Beneficiários', roles: ['admin','social_technician'] },
    { href: 'donors.html',     label: 'Doadores',     roles: ['admin','social_technician'] },
    { href: 'settings.html',   label: 'Configurações', roles: ['admin'] },
    { href: 'audit.html',      label: 'Auditoria',    roles: ['admin'] },
    { href: 'account.html',    label: 'A minha conta', roles: ['admin','social_technician','warehouse_operator','donor','beneficiary'] },
  ];
  const html = links
    .filter(l => l.roles.includes(u.role))
    .map(l => `<a href="${l.href}" class="${l.href === active ? 'active' : ''}">${l.label}</a>`)
    .join('');
  return `
    <a href="${homeFor(u.role)}" class="brand" style="text-decoration:none;color:inherit"><span class="cruz"></span>Inventário Solidário<small>${u.name || ''}</small></a>
    ${html}`;
}

function renderShell(active, title) {
  document.getElementById('sidebar').innerHTML = buildSidebar(active);
  document.getElementById('page-title').textContent = title;
  const u = getUser() || {};
  document.getElementById('user-chip').innerHTML =
    `${u.name} <button onclick="logout()">Sair</button>`;

  // Botao "Voltar" na topbar (apenas em paginas de detalhe, nao nas do menu principal)
  const topbar = document.querySelector('.topbar');
  const paginasMenu = ['dashboard.html', 'products.html', 'donations.html', 'requests.html',
    'transfers.html', 'warehouses.html', 'families.html', 'users.html', 'beneficiaries.html',
    'donors.html', 'clients.html', 'settings.html', 'audit.html', 'relatorio-impacto.html',
    'meus-armazens.html', 'account.html'];
  const ficheiroAtual = (location.pathname.split('/').pop() || '').toLowerCase();
  const ehPaginaDetalhe = !paginasMenu.includes(ficheiroAtual);
  if (topbar && ehPaginaDetalhe && !document.getElementById('btn-voltar')) {
    const voltar = document.createElement('button');
    voltar.id = 'btn-voltar';
    voltar.className = 'btn-voltar';
    voltar.innerHTML = '← Voltar';
    voltar.setAttribute('aria-label', 'Voltar à página anterior');
    voltar.onclick = irParaTras;
    topbar.insertBefore(voltar, topbar.firstChild);
  }

  // Botao "Imprimir" na topbar (em todas as paginas)
  if (topbar && !document.getElementById('btn-imprimir')) {
    const imp = document.createElement('button');
    imp.id = 'btn-imprimir';
    imp.className = 'btn-imprimir no-print';
    imp.innerHTML = '🖨 Imprimir';
    imp.setAttribute('aria-label', 'Imprimir esta página');
    imp.onclick = () => window.print();
    // Colocar antes do user-chip (lado direito)
    const chip = document.getElementById('user-chip');
    if (chip) topbar.insertBefore(imp, chip); else topbar.appendChild(imp);
  }

  // Botao hamburguer na topbar (visivel so em telemovel via CSS)
  if (topbar && !document.getElementById('menu-toggle')) {
    const btn = document.createElement('button');
    btn.id = 'menu-toggle';
    btn.className = 'menu-toggle';
    btn.setAttribute('aria-label', 'Abrir menu');
    btn.innerHTML = '☰';
    btn.onclick = toggleMenu;
    topbar.insertBefore(btn, topbar.firstChild);
  }

  // Overlay para fechar o menu ao tocar fora
  if (!document.getElementById('menu-overlay')) {
    const ov = document.createElement('div');
    ov.id = 'menu-overlay';
    ov.className = 'menu-overlay';
    ov.onclick = closeMenu;
    document.body.appendChild(ov);
  }

  // Fechar o menu ao escolher uma opcao (em mobile)
  document.querySelectorAll('#sidebar a').forEach(a => a.addEventListener('click', closeMenu));
}

function irParaTras() {
  // Se ha historico de navegacao dentro do site, volta atras.
  // Caso contrario (pagina aberta diretamente), vai para a pagina inicial do papel.
  if (document.referrer && document.referrer.indexOf(location.origin) === 0 && history.length > 1) {
    history.back();
  } else {
    const u = getUser() || {};
    location.href = homeFor(u.role);
  }
}

function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('menu-overlay').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('menu-overlay').classList.remove('open');
}

// ============================================================
// Responsivo: em ecras pequenos, preenche data-label nas celulas
// das tabelas (a partir dos cabecalhos), para o CSS as mostrar
// como cartoes empilhados. Funciona em todas as paginas.
// ============================================================
function rotularTabelas() {
  document.querySelectorAll('table').forEach(tabela => {
    const cabecalhos = [...tabela.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (cabecalhos.length === 0) return;
    tabela.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((td, i) => {
        if (cabecalhos[i]) td.setAttribute('data-label', cabecalhos[i]);
      });
    });
  });
}

// Correr sempre que o conteudo das tabelas muda.
// Observa alteracoes ao DOM para reaplicar apos cada carregamento de dados.
function ativarRotulagemAuto() {
  rotularTabelas();
  const obs = new MutationObserver(() => rotularTabelas());
  document.querySelectorAll('tbody').forEach(tb => obs.observe(tb, { childList: true }));
}

// Ativar quando a pagina estiver pronta
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ativarRotulagemAuto);
} else {
  ativarRotulagemAuto();
}

// Carregar o chatbot de ajuda em paginas autenticadas (nao no login/reset)
(function carregarChatbot() {
  const pagina = location.pathname.split('/').pop();
  if (pagina === 'index.html' || pagina === '' || pagina === 'reset.html') return;
  if (!getToken()) return;
  if (document.getElementById('chatbot-script')) return;
  const s = document.createElement('script');
  s.id = 'chatbot-script';
  s.src = 'js/chatbot.js';
  document.body.appendChild(s);
})();
