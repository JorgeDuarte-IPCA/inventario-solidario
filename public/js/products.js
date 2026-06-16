// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/products.js - MEMBRO 2
const user = requireAuth();
renderShell('products.html', 'Produtos e Stock');

const podeGerir = ['admin', 'warehouse_operator'].includes(user.role);

// Opcoes de condicao: base para todos + extra para vestuario/casa
const CONDICOES_BASE = [
  { v: 'new', t: 'Novo' },
  { v: 'good', t: 'Bom estado' },
  { v: 'used', t: 'Gasto' },
];
const CONDICOES_EXTRA = [
  { v: 'with_defect', t: 'Com defeito' },
  { v: 'to_repair', t: 'Para arranjar' },
];
// Familias (pelo nome) que recebem as opcoes extra
function familiaUsaExtra(nomeFamilia) {
  if (!nomeFamilia) return false;
  const n = nomeFamilia.toLowerCase();
  return n.includes('vestu') || n.includes('roupa') || n.includes('casa') || n.includes('lar') || n.includes('mobil');
}
function preencherCondicao(selectId, familiaNome, valorAtual) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  let ops = [...CONDICOES_BASE];
  if (familiaUsaExtra(familiaNome)) ops = ops.concat(CONDICOES_EXTRA);
  sel.innerHTML = ops.map(o => `<option value="${o.v}">${o.t}</option>`).join('');
  if (valorAtual) sel.value = valorAtual;
}
function nomeFamiliaPorId(id) {
  const f = familias.find(x => String(x.id) === String(id));
  return f ? f.name : '';
}

let armazens = [];
let familias = [];
let produtos = [];   // guarda a lista atual para preencher o modal

// Preenche um <select> de familias / armazens
function opcoesFamilias(sel) {
  return '<option value="">— Sem família —</option>' +
    familias.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
}
function opcoesArmazens() {
  return '<option value="">— Sem armazém —</option>' +
    armazens.filter(w => w.is_active)
      .map(w => `<option value="${w.id}">${w.name} (${w.district})</option>`).join('');
}

async function carregarOpcoes() {
  [armazens, familias] = await Promise.all([
    api('/api/warehouses'),
    api('/api/families')
  ]);
  document.getElementById('p-family').innerHTML = opcoesFamilias();
  document.getElementById('m-warehouse').innerHTML = opcoesArmazens();
  document.getElementById('m-family').innerHTML = opcoesFamilias();

  // Ao mudar a familia no modal de edicao, atualizar opcoes de condicao (extras para vestuario/casa)
  document.getElementById('m-family').addEventListener('change', (e) =>
    preencherCondicao('m-condition', nomeFamiliaPorId(e.target.value), document.getElementById('m-condition').value));

  // Preencher os filtros (com opcao "Todos")
  document.getElementById('f-warehouse').innerHTML =
    '<option value="">Todos os armazéns</option>' +
    armazens.map(w => `<option value="${w.id}">${w.name} (${w.district})</option>`).join('');
  document.getElementById('f-family').innerHTML =
    '<option value="">Todos os tipos</option>' +
    familias.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
}

let tabelaProdutos = null;
let agrupados = [];   // artigos agrupados por nome

// Agrupa a lista de produtos (um registo por armazem) por nome de artigo
function agruparPorNome(lista) {
  const mapa = new Map();
  for (const p of lista) {
    const chave = p.name;
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        name: p.name,
        family_name: p.family_name,
        total: 0,
        num_armazens: 0,
        pior_cor: 'green',     // estado de validade mais critico do grupo
        validade_proxima: null, // data de validade mais proxima de expirar
        tamanhos: new Set(),    // tamanhos distintos do grupo (vestuario)
        registos: []
      });
    }
    const g = mapa.get(chave);
    g.total += Number(p.quantity) || 0;
    g.registos.push(p);
    if (p.size) g.tamanhos.add(p.size);
    // pior estado: expired > red > yellow > green
    const ordem = { green: 0, yellow: 1, red: 2, expired: 3 };
    if ((ordem[p.color_status] ?? 0) > (ordem[g.pior_cor] ?? 0)) g.pior_cor = p.color_status;
    // validade mais proxima (a mais antiga das que existem)
    if (p.expiry_date) {
      if (!g.validade_proxima || p.expiry_date < g.validade_proxima) g.validade_proxima = p.expiry_date;
    }
  }
  for (const g of mapa.values()) g.num_armazens = new Set(g.registos.map(r => r.warehouse_id)).size;
  return [...mapa.values()];
}

function colunasProdutos() {
  return [
    { titulo: 'Artigo', campo: 'name', render: g =>
      `<a href="artigo.html?nome=${encodeURIComponent(g.name)}" style="color:var(--verde);font-weight:600;text-decoration:none">${g.name}</a>` },
    { titulo: 'Família', campo: 'family_name', render: g => g.family_name || '-' },
    { titulo: 'Tamanhos', render: g => g.tamanhos && g.tamanhos.size ? [...g.tamanhos].sort().join(', ') : '-' },
    { titulo: 'Stock total', campo: 'total', tipo: 'number' },
    { titulo: 'Armazéns', campo: 'num_armazens', tipo: 'number' },
    { titulo: 'Validade + próxima', campo: 'validade_proxima', render: g => g.validade_proxima || '-' },
    { titulo: 'Estado', ordenarPor: 'pior_cor', render: g => badgeValidade(g.pior_cor) },
  ];
}

let distritoFiltro = '';

async function carregar() {
  const params = [];
  const fw = document.getElementById('f-warehouse');
  const ff = document.getElementById('f-family');
  const fc = document.getElementById('f-color');
  const fcond = document.getElementById('f-condition');
  if (fw && fw.value) params.push('warehouse_id=' + fw.value);
  if (ff && ff.value) params.push('family_id=' + ff.value);
  if (fc && fc.value) params.push('color=' + fc.value);
  if (fcond && fcond.value) params.push('condition=' + fcond.value);
  const fsize = document.getElementById('f-size');
  if (fsize && fsize.value) params.push('size=' + encodeURIComponent(fsize.value));
  if (distritoFiltro) params.push('district=' + encodeURIComponent(distritoFiltro));
  const query = params.length ? '?' + params.join('&') : '';
  produtos = await api('/api/products' + query);
  agrupados = agruparPorNome(produtos);

  // Preencher o filtro de tamanhos com TODOS os tamanhos existentes (independente do filtro de tamanho atual)
  if (fsize && !fsize.dataset.preenchido) {
    try {
      const todos = await api('/api/products');
      const tamanhos = [...new Set(todos.map(p => p.size).filter(Boolean))].sort();
      if (tamanhos.length) {
        const atual = fsize.value;
        fsize.innerHTML = '<option value="">Todos</option>' +
          tamanhos.map(t => `<option value="${t}">${t}</option>`).join('');
        fsize.value = atual;
        fsize.dataset.preenchido = '1';
      }
    } catch (_) {}
  }

  if (!tabelaProdutos) {
    tabelaProdutos = criarTabela({
      container: document.getElementById('tabela-produtos'),
      colunas: colunasProdutos(),
      porPagina: 10,
      vazio: 'Sem produtos.'
    });
  }
  tabelaProdutos.setDados(agrupados);
}

// Abre o detalhe de um artigo: distribuicao por armazem
function verArtigo(nome) {
  const g = agrupados.find(x => x.name === nome);
  if (!g) return;
  document.getElementById('d-titulo').textContent = g.name;
  document.getElementById('d-sub').textContent =
    `Stock total: ${g.total} · ${g.num_armazens} armazém(ns)`;
  document.getElementById('d-itens').innerHTML = g.registos.map(p => `
    <tr>
      <td>${p.warehouse_name || '-'}</td>
      <td>${p.warehouse_district || '-'}</td>
      <td>${p.location || '-'}</td>
      <td>${p.quantity}</td>
      <td>${p.expiry_date || '-'}</td>
      <td>${badgeValidade(p.color_status)}</td>
      <td>${podeGerir
        ? `<button class="btn sm gray" onclick="editar(${p.id})">Editar</button>
           <button class="btn sm danger" onclick="apagar(${p.id})">Apagar</button>`
        : ''}</td>
    </tr>`).join('') || '<tr><td colspan="7" style="color:var(--cinza)">Sem registos.</td></tr>';
  document.getElementById('modal-detalhe').classList.add('open');
}

function fecharDetalhe() { document.getElementById('modal-detalhe').classList.remove('open'); }

function limparFiltros() {
  document.getElementById('f-warehouse').value = '';
  document.getElementById('f-family').value = '';
  document.getElementById('f-color').value = '';
  document.getElementById('f-condition').value = '';
  carregar();
}

async function criar() {
  document.getElementById('err').textContent = '';
  const nome = document.getElementById('p-name').value.trim();
  if (!nome) {
    document.getElementById('err').textContent = 'O nome do artigo é obrigatório.';
    return;
  }
  try {
    await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: nome,
        family_id: document.getElementById('p-family').value || null,
        quantity: 0,
        warehouse_id: null,
        location: document.getElementById('p-loc').value,
        size: document.getElementById('p-size').value.trim() || null,
        min_stock: Number(document.getElementById('p-min').value) || 0
      })
    });
    document.getElementById('p-name').value = '';
    document.getElementById('p-size').value = '';
    document.getElementById('p-min').value = '0';
    carregar();
  } catch (e) { document.getElementById('err').textContent = e.message; }
}

// ---- Edicao ----
let editId = null;

function editar(id) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  fecharDetalhe();
  editId = id;
  document.getElementById('m-titulo').textContent = p.name;
  document.getElementById('m-name').value = p.name;
  document.getElementById('m-family').value = p.family_id || '';
  document.getElementById('m-qty').value = p.quantity;
  document.getElementById('m-warehouse').value = p.warehouse_id || '';
  document.getElementById('m-loc').value = p.location || '';
  document.getElementById('m-size').value = p.size || '';
  document.getElementById('m-min').value = p.min_stock || 0;
  // Preencher condicao conforme a familia (com extras se vestuario/casa)
  preencherCondicao('m-condition', p.family_name || nomeFamiliaPorId(p.family_id), p.condition || 'good');
  document.getElementById('m-err').textContent = '';
  document.getElementById('modal').classList.add('open');
}

function fecharModal() {
  document.getElementById('modal').classList.remove('open');
  editId = null;
}

async function guardar() {
  document.getElementById('m-err').textContent = '';
  const nome = document.getElementById('m-name').value.trim();
  if (!nome) {
    document.getElementById('m-err').textContent = 'O nome do artigo é obrigatório.';
    return;
  }
  try {
    await api('/api/products/' + editId, {
      method: 'PUT',
      body: JSON.stringify({
        name: nome,
        family_id: document.getElementById('m-family').value || null,
        quantity: Number(document.getElementById('m-qty').value),
        warehouse_id: document.getElementById('m-warehouse').value || null,
        location: document.getElementById('m-loc').value,
        condition: document.getElementById('m-condition').value,
        size: document.getElementById('m-size').value.trim() || null,
        min_stock: Number(document.getElementById('m-min').value) || 0
      })
    });
    fecharModal();
    carregar();
  } catch (e) { document.getElementById('m-err').textContent = e.message; }
}

async function apagar(id) {
  if (!confirm('Apagar produto?')) return;
  try { await api('/api/products/' + id, { method: 'DELETE' }); fecharDetalhe(); carregar(); }
  catch (e) { alert(e.message); }
}

// Fechar modal ao clicar fora
document.getElementById('modal').addEventListener('click', e => {
  if (e.target.id === 'modal') fecharModal();
});

(async () => {
  await carregarOpcoes();

  // Aplicar filtros vindos do URL (ex.: dashboard -> products.html?color=red)
  const params = new URLSearchParams(location.search);
  const mapaFiltros = { color: 'f-color', warehouse_id: 'f-warehouse', family_id: 'f-family', condition: 'f-condition' };
  for (const [param, elId] of Object.entries(mapaFiltros)) {
    const valor = params.get(param);
    const el = document.getElementById(elId);
    if (valor && el) el.value = valor;
  }
  // Filtro por distrito (nao tem select proprio; vem do grafico do painel)
  const distParam = params.get('district');
  if (distParam) {
    distritoFiltro = distParam;
    const aviso = document.getElementById('aviso-distrito');
    if (aviso) {
      aviso.style.display = '';
      aviso.querySelector('span').textContent = 'A mostrar apenas o distrito: ' + distParam;
    }
  }

  await carregar();

  // Se vier ?editar=ID (a partir da pagina de detalhe do artigo), abrir edicao
  const editarId = params.get('editar');
  if (editarId) editar(Number(editarId));
})();
