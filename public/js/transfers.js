// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/transfers.js - Transferencias entre armazens (varios artigos)
const user = requireAuth();
if (!guardPage(['admin', 'warehouse_operator'])) throw new Error('redir');
renderShell('transfers.html', 'Transferências entre Armazéns');

let armazens = [], produtosOrigem = [];

async function carregarArmazens() {
  armazens = await api('/api/warehouses');
  const opts = armazens.map(w => `<option value="${w.id}">${w.name} (${w.district})</option>`).join('');
  document.getElementById('t-from').innerHTML = '<option value="">— Escolher —</option>' + opts;
  document.getElementById('t-to').innerHTML = '<option value="">— Escolher —</option>' + opts;
}

// Quando muda a origem, carregar os produtos desse armazem
async function aoMudarOrigem() {
  const from = document.getElementById('t-from').value;
  document.getElementById('itens').innerHTML = '';
  produtosOrigem = [];
  if (!from) return;
  produtosOrigem = await api('/api/products?warehouse_id=' + from);
  if (produtosOrigem.length === 0) {
    document.getElementById('itens').innerHTML = '<p style="color:var(--cinza);font-size:.85rem">Este armazém não tem artigos em stock.</p>';
    return;
  }
  addItem();
}

function opcoesProdutos() {
  return produtosOrigem.map(p => `<option value="${p.id}">${p.name} (stock: ${p.quantity})</option>`).join('');
}

function addItem() {
  if (produtosOrigem.length === 0) return;
  const div = document.createElement('div');
  div.className = 'flex';
  div.style.marginTop = '8px';
  div.innerHTML = `
    <div style="flex:2"><label>Artigo</label><select class="i-prod">${opcoesProdutos()}</select></div>
    <div><label>Quantidade</label><input class="i-qty" type="number" min="1" value="1"></div>
    <div style="flex:0"><button class="btn gray sm" onclick="this.closest('.flex').remove()">Remover</button></div>`;
  document.getElementById('itens').appendChild(div);
}

let tabelaTransfer = null;
let transferAtual = null;

async function carregar() {
  const rows = await api('/api/transfers');
  if (!tabelaTransfer) {
    tabelaTransfer = criarTabela({
      container: document.getElementById('tabela-transfer'),
      colunas: [
        { titulo: 'Código', campo: 'code', render: t =>
          `<a href="#" onclick="verDetalhe(${t.id});return false" style="color:var(--verde);font-weight:600;text-decoration:none">${t.code}</a>` },
        { titulo: 'Data', campo: 'created_at', render: t => (t.created_at || '').replace('T', ' ').slice(0, 16) },
        { titulo: 'Origem', campo: 'from_name' },
        { titulo: 'Destino', campo: 'to_name' },
        { titulo: 'Nº artigos', campo: 'num_itens', tipo: 'number' },
        { titulo: 'Qtd total', campo: 'total_qty', tipo: 'number' },
        { titulo: 'Por', campo: 'created_by_name', render: t => t.created_by_name || '-' },
      ],
      porPagina: 10,
      vazio: 'Sem transferências.'
    });
  }
  tabelaTransfer.setDados(rows);
}

async function verDetalhe(id) {
  try {
    const t = await api('/api/transfers/' + id);
    transferAtual = t;
    document.getElementById('m-codigo').textContent = 'Transferência ' + t.code;
    document.getElementById('m-info').textContent =
      `${t.from_name} → ${t.to_name} · ${(t.created_at || '').replace('T', ' ').slice(0, 16)}` +
      (t.created_by_name ? ` · por ${t.created_by_name}` : '');
    document.getElementById('m-itens').innerHTML = (t.items || []).map(it => `
      <tr><td>${it.product_name}</td><td>${it.quantity}</td></tr>`).join('')
      || '<tr><td colspan="2" style="color:var(--cinza)">Sem artigos.</td></tr>';
    document.getElementById('modal').classList.add('open');
  } catch (e) { alert(e.message); }
}

function fecharDetalhe() { document.getElementById('modal').classList.remove('open'); }

function imprimirDetalhe() {
  if (!transferAtual) return;
  const t = transferAtual;
  const linhas = (t.items || []).map(it =>
    `<tr><td>${it.product_name}</td><td style="text-align:center">${it.quantity}</td></tr>`).join('')
    || '<tr><td colspan="2">Sem artigos.</td></tr>';
  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
    <title>Transferência ${t.code}</title>
    <style>
      body { font-family: Arial, sans-serif; color:#1e2a26; padding:30px; }
      h1 { color:#d7141a; font-size:20px; margin:0 0 4px; }
      .meta { color:#555; font-size:13px; margin-bottom:20px; }
      .meta b { color:#1e2a26; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th,td { border:1px solid #ccc; padding:8px 10px; text-align:left; }
      th { background:#f3f3f3; }
      .rodape { margin-top:30px; font-size:11px; color:#888; }
    </style></head><body>
    <h1>Inventário Solidário — Transferência ${t.code}</h1>
    <div class="meta">
      <div><b>Origem:</b> ${t.from_name} &nbsp;→&nbsp; <b>Destino:</b> ${t.to_name}</div>
      <div><b>Data:</b> ${(t.created_at || '').replace('T', ' ').slice(0, 16)}</div>
      ${t.created_by_name ? `<div><b>Responsável:</b> ${t.created_by_name}</div>` : ''}
      ${t.notes ? `<div><b>Observações:</b> ${t.notes}</div>` : ''}
    </div>
    <table>
      <thead><tr><th>Artigo</th><th style="text-align:center">Quantidade</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="rodape">Documento gerado pelo sistema Inventário Solidário.</div>
    <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Permita janelas para imprimir.'); return; }
  w.document.write(html); w.document.close();
}

async function transferir() {
  document.getElementById('err').textContent = '';
  document.getElementById('msg').textContent = '';

  const from = document.getElementById('t-from').value;
  const to = document.getElementById('t-to').value;
  if (!from || !to) { document.getElementById('err').textContent = 'Escolha origem e destino.'; return; }
  if (from === to) { document.getElementById('err').textContent = 'A origem e o destino têm de ser diferentes.'; return; }

  const items = [...document.querySelectorAll('#itens .flex')].map(row => ({
    product_id: Number(row.querySelector('.i-prod').value),
    quantity: Number(row.querySelector('.i-qty').value)
  })).filter(i => i.product_id && i.quantity > 0);

  if (items.length === 0) { document.getElementById('err').textContent = 'Adicione pelo menos um artigo.'; return; }

  try {
    await api('/api/transfers', {
      method: 'POST',
      body: JSON.stringify({
        from_warehouse_id: Number(from),
        to_warehouse_id: Number(to),
        notes: document.getElementById('t-notes').value || null,
        items
      })
    });
    document.getElementById('msg').textContent = 'Transferência efetuada.';
    document.getElementById('t-notes').value = '';
    await aoMudarOrigem(); // recarrega stock atualizado da origem
    carregar();
  } catch (e) { document.getElementById('err').textContent = e.message; }
}

document.getElementById('t-from').addEventListener('change', aoMudarOrigem);

(async () => { await carregarArmazens(); carregar(); })();
