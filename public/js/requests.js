// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/requests.js - MEMBRO 4
const user = requireAuth();
renderShell('requests.html', 'Pedidos e Entregas');

const podeGerir = ['admin', 'social_technician', 'warehouse_operator'].includes(user.role);
const podePedir = ['beneficiary', 'admin'].includes(user.role);

let produtos = [];

// Proximas transicoes (espelha a maquina de estados do backend)
const PROXIMO = {
  submitted:    [['approved', 'Aprovar'], ['rejected', 'Rejeitar']],
  approved:     [['scheduled', 'Agendar'], ['on_hold', 'Em espera']],
  on_hold:      [['scheduled', 'Retomar'], ['expired', 'Expirar']],
  scheduled:    [['in_delivery', 'Em entrega'], ['cancelled', 'Cancelar']],
  in_delivery:  [['delivered', 'Confirmar entrega'], ['cancelled', 'Cancelar']]
};

// Mostra o formulario a carenciados (e admin)
if (podePedir) document.getElementById('card-novo').style.display = '';

let catalogoProdutos = [];

async function carregarProdutos() {
  produtos = await api('/api/products');
  const vistos = new Map();
  for (const p of produtos) {
    if (!vistos.has(p.name)) vistos.set(p.name, { id: p.id, name: p.name, family_name: p.family_name });
  }
  catalogoProdutos = [...vistos.values()];
}

function opcoesProdutos() {
  return produtos.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

// ---- Itens do pedido ----
let seletorMultiplo = null;

// Adiciona uma linha de item ja com um produto definido
function addLinhaProduto(p) {
  // Evitar duplicados: se ja existe linha com este produto, nao repetir
  const existe = [...document.querySelectorAll('#itens .r-prod-nome')].some(el => el.dataset.id === String(p.id));
  if (existe) return;
  const div = document.createElement('div');
  div.className = 'flex';
  div.style.marginTop = '8px';
  div.innerHTML = `
    <div style="flex:2"><label>Bem</label>
      <input class="r-prod-nome" readonly value="${p.name}" data-id="${p.id}" style="background:#f7f7f7">
    </div>
    <div><label>Quantidade</label><input class="r-qty" type="number" value="1" min="1"></div>
    <div style="flex:0"><button type="button" class="btn gray sm" onclick="this.closest('.flex').remove()">Remover</button></div>`;
  document.getElementById('itens').appendChild(div);
}

function escolherBens() {
  if (!seletorMultiplo) {
    seletorMultiplo = criarSeletorMultiplo({
      produtos: catalogoProdutos,
      titulo: 'Escolher bens a pedir',
      onConfirma: (lista) => { lista.forEach(addLinhaProduto); }
    });
  }
  seletorMultiplo.abrir();
}

async function submeter() {
  document.getElementById('err-novo').textContent = '';
  const itens = [...document.querySelectorAll('#itens .flex')].map(row => ({
    product_id: Number(row.querySelector('.r-prod-nome').dataset.id),
    requested_qty: Number(row.querySelector('.r-qty').value)
  })).filter(i => i.product_id && i.requested_qty > 0);

  if (itens.length === 0) {
    document.getElementById('err-novo').textContent = 'Adicione pelo menos um bem ao pedido.';
    return;
  }
  try {
    await api('/api/requests', {
      method: 'POST',
      body: JSON.stringify({
        notes: document.getElementById('r-notes').value || null,
        items: itens
      })
    });
    document.getElementById('itens').innerHTML = '';
    document.getElementById('r-notes').value = '';
    carregar();
  } catch (e) { document.getElementById('err-novo').textContent = e.message; }
}

// ---- Lista ----
let tabelaPedidos = null;
let todosPedidos = [];

const ESTADOS_ATIVOS = ['submitted', 'approved', 'on_hold', 'scheduled', 'in_delivery'];

async function carregar() {
  todosPedidos = await api('/api/requests');
  // Mostrar filtros so a quem gere
  if (podeGerir) document.getElementById('card-filtros').style.display = '';
  if (!tabelaPedidos) {
    const cols = [
      { titulo: 'Código', campo: 'code', render: r =>
        `<a href="#" onclick="verDetalhe(${r.id});return false" style="color:var(--verde);font-weight:600;text-decoration:none">${r.code}</a>` },
      { titulo: 'Beneficiário', campo: 'beneficiary_name' },
      { titulo: 'Data', campo: 'requested_at', render: r => (r.requested_at || '').slice(0, 10) },
      { titulo: 'Prioridade', ordenarPor: 'priority', render: r => badge(r.priority) },
      { titulo: 'Estado', ordenarPor: 'status', render: r => badge(r.status) },
    ];
    if (podeGerir) {
      cols.push({ titulo: 'Ações', ordenavel: false, render: r => {
        if (PROXIMO[r.status]) {
          return PROXIMO[r.status]
            .map(([to, label]) => to === 'approved'
              ? `<button class="btn sm" onclick="abrirAprovacao(${r.id})">${label}</button>`
              : `<button class="btn sm" onclick="transicao(${r.id},'${to}')">${label}</button>`)
            .join(' ');
        }
        return '-';
      }});
    }
    tabelaPedidos = criarTabela({
      container: document.getElementById('tabela-pedidos'),
      colunas: cols,
      porPagina: 10,
      vazio: 'Sem pedidos.'
    });
  }
  aplicarFiltros();
}

function aplicarFiltros() {
  // Sem card de filtros (beneficiario): mostra tudo o que recebeu
  const elEstado = document.getElementById('f-estado');
  if (!elEstado || !podeGerir) { tabelaPedidos.setDados(todosPedidos); return; }

  const estado = elEstado.value;
  const de = document.getElementById('f-de').value;
  const ate = document.getElementById('f-ate').value;

  let lista = todosPedidos.filter(r => {
    if (estado === 'ativos') { if (!ESTADOS_ATIVOS.includes(r.status)) return false; }
    else if (estado) { if (r.status !== estado) return false; }
    const data = (r.requested_at || '').slice(0, 10);
    if (de && data < de) return false;
    if (ate && data > ate) return false;
    return true;
  });
  tabelaPedidos.setDados(lista);
}

function limparFiltros() {
  document.getElementById('f-estado').value = 'ativos';
  document.getElementById('f-de').value = '';
  document.getElementById('f-ate').value = '';
  aplicarFiltros();
}

let pedidoAtual = null;

async function verDetalhe(id) {
  try {
    const r = await api('/api/requests/' + id);
    pedidoAtual = r;
    document.getElementById('m-codigo').textContent = 'Pedido ' + r.code;
    document.getElementById('m-info').textContent =
      `Beneficiário: ${r.beneficiary_name || '-'} · Prioridade: ${pt(r.priority)} · Estado: ${pt(r.status)}`;
    // Beneficiarios nao veem o stock disponivel; so quem gere
    document.getElementById('m-cab').innerHTML = podeGerir
      ? '<tr><th>Artigo</th><th>Qtd pedida</th><th>Stock disponível</th></tr>'
      : '<tr><th>Artigo</th><th>Qtd pedida</th></tr>';
    document.getElementById('m-itens').innerHTML = (r.items || []).map(it => `
      <tr>
        <td>${it.product_name}</td>
        <td>${it.requested_qty}</td>
        ${podeGerir ? `<td>${it.stock_available != null ? it.stock_available : '-'}</td>` : ''}
      </tr>`).join('') || `<tr><td colspan="${podeGerir ? 3 : 2}" style="color:var(--cinza)">Sem artigos.</td></tr>`;
    document.getElementById('modal').classList.add('open');
  } catch (e) { alert(e.message); }
}

function imprimirDetalhe() {
  if (!pedidoAtual) return;
  const r = pedidoAtual;
  const dataHoje = new Date().toLocaleDateString('pt-PT');
  const linhas = (r.items || []).map(it => `
    <tr>
      <td>${it.product_name}</td>
      <td style="text-align:center">${it.requested_qty}</td>
      <td style="text-align:center">${it.stock_available != null ? it.stock_available : '-'}</td>
      <td style="width:90px"></td>
    </tr>`).join('') || '<tr><td colspan="4">Sem artigos.</td></tr>';

  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
    <title>Pedido ${r.code}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #1e2a26; padding: 30px; }
      h1 { color: #d7141a; font-size: 20px; margin: 0 0 4px; }
      .meta { color: #555; font-size: 13px; margin-bottom: 20px; }
      .meta b { color: #1e2a26; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
      th { background: #f3f3f3; }
      .rodape { margin-top: 30px; font-size: 11px; color: #888; }
      .assinatura { margin-top: 40px; font-size: 12px; }
      .assinatura .linha { border-top: 1px solid #333; width: 250px; margin-top: 36px; padding-top: 4px; }
    </style></head><body>
    <h1>Inventário Solidário — Pedido ${r.code}</h1>
    <div class="meta">
      <div><b>Beneficiário:</b> ${r.beneficiary_name || '-'}</div>
      <div><b>Prioridade:</b> ${pt(r.priority)} &nbsp;·&nbsp; <b>Estado:</b> ${pt(r.status)}</div>
      <div><b>Data de impressão:</b> ${dataHoje}</div>
    </div>
    <table>
      <thead><tr><th>Artigo</th><th style="text-align:center">Qtd pedida</th><th style="text-align:center">Stock</th><th>Separado ✓</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="assinatura"><div class="linha">Preparado por (nome e assinatura)</div></div>
    <div class="rodape">Documento gerado pelo sistema Inventário Solidário.</div>
    <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Permita janelas para imprimir.'); return; }
  w.document.write(html);
  w.document.close();
}

function fecharDetalhe() { document.getElementById('modal').classList.remove('open'); }

async function transicao(id, to) {
  try { await api('/api/requests/' + id + '/transition', { method: 'PATCH', body: JSON.stringify({ to }) }); carregar(); }
  catch (e) { document.getElementById('err').textContent = e.message; }
}

// ---- Aprovacao com prioridade e ajuste de quantidades ----
let aprovacaoId = null;

async function abrirAprovacao(id) {
  try {
    const r = await api('/api/requests/' + id);
    aprovacaoId = id;
    document.getElementById('a-codigo').textContent = r.code || ('#' + id);
    document.getElementById('a-priority').value = 'medium';
    document.getElementById('a-err').textContent = '';
    document.getElementById('a-itens').innerHTML = (r.items || []).map(it => {
      const disp = it.stock_available != null ? it.stock_available : 0;
      const sugerida = Math.min(it.requested_qty, disp);
      const alerta = disp < it.requested_qty ? ' style="color:var(--vermelho);font-weight:600"' : '';
      return `
      <tr>
        <td>${it.product_name}</td>
        <td>${it.warehouse_name || '-'}</td>
        <td>${it.requested_qty}</td>
        <td${alerta}>${disp}</td>
        <td><input class="a-qty" data-id="${it.id}" type="number" min="0" max="${disp}" value="${sugerida}" style="width:90px"></td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="color:var(--cinza)">Sem artigos.</td></tr>';
    document.getElementById('modal-aprovar').classList.add('open');
  } catch (e) { alert(e.message); }
}

function fecharAprovacao() {
  document.getElementById('modal-aprovar').classList.remove('open');
  aprovacaoId = null;
}

async function confirmarAprovacao() {
  if (!aprovacaoId) return;
  document.getElementById('a-err').textContent = '';
  const itens = [...document.querySelectorAll('#a-itens .a-qty')].map(el => ({
    id: Number(el.dataset.id),
    approved_qty: Math.max(0, Number(el.value) || 0)
  }));
  try {
    await api('/api/requests/' + aprovacaoId + '/transition', {
      method: 'PATCH',
      body: JSON.stringify({
        to: 'approved',
        priority: document.getElementById('a-priority').value,
        items: itens
      })
    });
    fecharAprovacao();
    carregar();
  } catch (e) { document.getElementById('a-err').textContent = e.message; }
}

(async () => {
  if (podePedir) { await carregarProdutos(); }
  await carregar();
  // Filtro vindo do URL (ex.: dashboard -> requests.html?estado=submitted)
  const params = new URLSearchParams(location.search);
  const estado = params.get('estado');
  const elEstado = document.getElementById('f-estado');
  if (estado && elEstado) { elEstado.value = estado; aplicarFiltros(); }
})();
