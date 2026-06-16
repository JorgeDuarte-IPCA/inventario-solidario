// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/donations.js - MEMBRO 3
const user = requireAuth();
renderShell('donations.html', 'Doações');

const podeGerir = ['admin', 'warehouse_operator'].includes(user.role);
const podeDoar  = ['donor', 'admin'].includes(user.role);

let produtos = [];

// Mostra o formulario de submissao a doadores (e admin)
if (podeDoar) document.getElementById('card-nova').style.display = '';

let catalogoProdutos = [];

async function carregarProdutos() {
  produtos = await api('/api/products');
  // Catalogo com nomes unicos (o doador escolhe um tipo de bem)
  const vistos = new Map();
  for (const p of produtos) {
    if (!vistos.has(p.name)) vistos.set(p.name, { id: p.id, name: p.name, family_name: p.family_name });
  }
  catalogoProdutos = [...vistos.values()];
}

async function carregarArmazens() {
  const armazens = await api('/api/warehouses');
  const sel = document.getElementById('d-warehouse');
  if (sel) {
    sel.innerHTML = '<option value="">— Escolher —</option>' +
      armazens.map(w => `<option value="${w.id}">${w.name} (${w.district})</option>`).join('');
  }
}

function opcoesProdutos() {
  return produtos.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

// ---- Itens da doacao ----
let seletorDoacao = null;
let linhaAtiva = null;

function addItem() {
  const div = document.createElement('div');
  div.className = 'flex';
  div.style.marginTop = '8px';
  div.innerHTML = `
    <div style="flex:2"><label>Bem</label>
      <input class="d-prod-nome" readonly placeholder="Escolher artigo..." style="cursor:pointer;background:#fff" data-id="">
    </div>
    <div><label>Quantidade</label><input class="d-qty" type="number" value="1" min="1"></div>
    <div><label>Validade</label><input class="d-validade" type="date"></div>
    <div><label>Estado do bem</label>
      <select class="d-condition">
        <option value="new">Novo</option>
        <option value="good">Bom estado</option>
        <option value="used">Gasto</option>
        <option value="with_defect">Com defeito</option>
        <option value="to_repair">Para arranjar</option>
      </select>
    </div>
    <div style="flex:0"><button type="button" class="btn gray sm" onclick="this.closest('.flex').remove()">Remover</button></div>`;
  document.getElementById('itens').appendChild(div);

  // Ao clicar no campo do bem, abre o popup de pesquisa
  const campo = div.querySelector('.d-prod-nome');
  campo.addEventListener('click', () => {
    linhaAtiva = campo;
    if (!seletorDoacao) {
      seletorDoacao = criarSeletorProduto({
        produtos: catalogoProdutos,
        titulo: 'Escolher bem a doar',
        onEscolha: (p) => {
          if (linhaAtiva && p) { linhaAtiva.value = p.name; linhaAtiva.dataset.id = p.id; }
        }
      });
    }
    seletorDoacao.abrir();
  });
}

async function submeter() {
  document.getElementById('err-nova').textContent = '';
  const itens = [...document.querySelectorAll('#itens .flex')].map(row => ({
    product_id: Number(row.querySelector('.d-prod-nome').dataset.id),
    quantity: Number(row.querySelector('.d-qty').value),
    expiry_date: row.querySelector('.d-validade').value || null,
    condition: row.querySelector('.d-condition').value
  })).filter(i => i.product_id && i.quantity > 0);

  if (itens.length === 0) {
    document.getElementById('err-nova').textContent = 'Adicione pelo menos um bem à doação.';
    return;
  }
  try {
    await api('/api/donations', {
      method: 'POST',
      body: JSON.stringify({
        expected_delivery_date: document.getElementById('d-date').value || null,
        warehouse_id: document.getElementById('d-warehouse').value || null,
        notes: document.getElementById('d-notes').value || null,
        items: itens
      })
    });
    document.getElementById('itens').innerHTML = '';
    document.getElementById('d-notes').value = '';
    document.getElementById('d-date').value = '';
    document.getElementById('d-warehouse').value = '';
    carregar();
  } catch (e) { document.getElementById('err-nova').textContent = e.message; }
}

// ---- Lista ----
let tabelaDoacoes = null;
let todasDoacoes = [];

const ESTADOS_ATIVOS_DOA = ['pending', 'validated'];

async function carregar() {
  todasDoacoes = await api('/api/donations');
  if (podeGerir) document.getElementById('card-filtros').style.display = '';
  if (!tabelaDoacoes) {
    const cols = [
      { titulo: 'Código', campo: 'code', render: d =>
        `<a href="#" onclick="verDetalhe(${d.id});return false" style="color:var(--verde);font-weight:600;text-decoration:none">${d.code}</a>` },
      { titulo: 'Doador', campo: 'donor_name' },
      { titulo: 'Estado', ordenarPor: 'status', render: d => badge(d.status) },
      { titulo: 'Entrega prevista', campo: 'expected_delivery_date', render: d => d.expected_delivery_date || '-' },
    ];
    if (podeGerir) {
      cols.push({ titulo: 'Ações', ordenavel: false, render: d => {
        if (d.status === 'pending') {
          return `<button class="btn sm" onclick="mudar(${d.id},'validated')">Validar</button>
                  <button class="btn sm danger" onclick="mudar(${d.id},'rejected')">Rejeitar</button>`;
        } else if (d.status === 'validated') {
          return `<button class="btn sm" onclick="mudar(${d.id},'received')">Rececionar</button>`;
        }
        return '-';
      }});
    }
    tabelaDoacoes = criarTabela({
      container: document.getElementById('tabela-doacoes'),
      colunas: cols,
      porPagina: 10,
      vazio: 'Sem doações.'
    });
  }
  aplicarFiltros();
}

function aplicarFiltros() {
  const elEstado = document.getElementById('f-estado');
  if (!elEstado || !podeGerir) { tabelaDoacoes.setDados(todasDoacoes); return; }
  const estado = elEstado.value;
  const de = document.getElementById('f-de').value;
  const ate = document.getElementById('f-ate').value;
  let lista = todasDoacoes.filter(d => {
    if (estado === 'ativos') { if (!ESTADOS_ATIVOS_DOA.includes(d.status)) return false; }
    else if (estado) { if (d.status !== estado) return false; }
    const data = (d.expected_delivery_date || '').slice(0, 10);
    if (de && data && data < de) return false;
    if (ate && data && data > ate) return false;
    return true;
  });
  tabelaDoacoes.setDados(lista);
}

function limparFiltros() {
  document.getElementById('f-estado').value = 'ativos';
  document.getElementById('f-de').value = '';
  document.getElementById('f-ate').value = '';
  aplicarFiltros();
}

async function mudar(id, status) {
  try { await api('/api/donations/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }); carregar(); }
  catch (e) { document.getElementById('err').textContent = e.message; }
}

const COND_PT = { new: 'Novo', good: 'Bom estado', used: 'Gasto', with_defect: 'Com defeito', to_repair: 'Para arranjar' };

let doacaoAtual = null;

async function verDetalhe(id) {
  try {
    const d = await api('/api/donations/' + id);
    doacaoAtual = d;
    document.getElementById('m-codigo').textContent = 'Doação ' + d.code;
    document.getElementById('m-info').textContent =
      `Doador: ${d.donor_name || '-'} · Estado: ${pt(d.status)}`;
    document.getElementById('m-itens').innerHTML = (d.items || []).map(it => `
      <tr>
        <td>${it.product_name}</td>
        <td>${it.quantity}</td>
        <td>${it.expiry_date || '-'}</td>
        <td>${COND_PT[it.condition] || it.condition || '-'}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="color:var(--cinza)">Sem artigos.</td></tr>';
    document.getElementById('modal').classList.add('open');
  } catch (e) { alert(e.message); }
}

function imprimirDetalhe() {
  if (!doacaoAtual) return;
  const d = doacaoAtual;
  const dataHoje = new Date().toLocaleDateString('pt-PT');
  const linhas = (d.items || []).map(it => `
    <tr>
      <td>${it.product_name}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:center">${COND_PT[it.condition] || it.condition || '-'}</td>
      <td style="width:90px"></td>
    </tr>`).join('') || '<tr><td colspan="4">Sem artigos.</td></tr>';

  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
    <title>Doação ${d.code}</title>
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
    <h1>Inventário Solidário — Doação ${d.code}</h1>
    <div class="meta">
      <div><b>Doador:</b> ${d.donor_name || '-'}</div>
      <div><b>Estado:</b> ${pt(d.status)}</div>
      <div><b>Data de impressão:</b> ${dataHoje}</div>
    </div>
    <table>
      <thead><tr><th>Artigo</th><th style="text-align:center">Quantidade</th><th style="text-align:center">Estado do bem</th><th>Rececionado ✓</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="assinatura"><div class="linha">Rececionado por (nome e assinatura)</div></div>
    <div class="rodape">Documento gerado pelo sistema Inventário Solidário.</div>
    <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Permita janelas para imprimir.'); return; }
  w.document.write(html);
  w.document.close();
}

function fecharDetalhe() { document.getElementById('modal').classList.remove('open'); }

(async () => {
  if (podeDoar) { await carregarProdutos(); await carregarArmazens(); addItem(); }
  carregar();
})();
