// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/warehouses.js - MEMBRO 2: Armazens por distrito
const user = requireAuth();
renderShell('warehouses.html', 'Armazéns');

const podeGerir = user.role === 'admin';
if (!podeGerir) document.getElementById('card-novo').style.display = 'none';

// Preenche o filtro de distritos a partir dos armazens existentes
async function carregarFiltro() {
  const distritos = await api('/api/warehouses/districts');
  const sel = document.getElementById('filtro');
  sel.innerHTML = '<option value="">Todos os distritos</option>' +
    distritos.map(d => `<option value="${d}">${d}</option>`).join('');
}

let armazensLista = [];

async function carregar() {
  const d = document.getElementById('filtro').value;
  const rows = await api('/api/warehouses' + (d ? '?district=' + encodeURIComponent(d) : ''));
  armazensLista = rows;
  document.getElementById('tbody').innerHTML = rows.map(w => `
    <tr>
      <td><a href="armazem.html?id=${w.id}" style="color:var(--verde);font-weight:600;text-decoration:none">${w.name}</a></td>
      <td>${w.district}</td>
      <td>${w.address || '-'}</td>
      <td>${w.phone || '-'}</td>
      <td>${w.total_produtos}</td>
      <td>${w.is_active ? '<span class="badge green">ativo</span>' : '<span class="badge red">inativo</span>'}</td>
      <td>${podeGerir ? `
        <button class="btn sm gray" onclick="editar(${w.id})">Editar</button>
        <button class="btn sm ${w.is_active ? '' : ''}" onclick="alternar(${w.id}, ${w.is_active ? 0 : 1})">${w.is_active ? 'Desativar' : 'Ativar'}</button>
        <button class="btn sm danger" onclick="apagar(${w.id})">Apagar</button>` : '-'}</td>
    </tr>`).join('') || '<tr><td colspan="7" style="color:var(--cinza)">Sem armazéns.</td></tr>';
}

let editId = null;
function editar(id) {
  const w = armazensLista.find(x => x.id === id);
  if (!w) return;
  editId = id;
  document.getElementById('e-name').value = w.name;
  document.getElementById('e-district').value = w.district;
  document.getElementById('e-address').value = w.address || '';
  document.getElementById('e-phone').value = w.phone || '';
  document.getElementById('e-email').value = w.email || '';
  document.getElementById('e-err').textContent = '';
  document.getElementById('modal-edit').classList.add('open');
}
function fecharEdicao() { document.getElementById('modal-edit').classList.remove('open'); editId = null; }
async function guardarEdicao() {
  document.getElementById('e-err').textContent = '';
  const name = document.getElementById('e-name').value.trim();
  if (!name) { document.getElementById('e-err').textContent = 'O nome é obrigatório.'; return; }
  try {
    await api('/api/warehouses/' + editId, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        district: document.getElementById('e-district').value,
        address: document.getElementById('e-address').value,
        phone: document.getElementById('e-phone').value,
        email: document.getElementById('e-email').value
      })
    });
    fecharEdicao();
    carregar();
  } catch (e) { document.getElementById('e-err').textContent = e.message; }
}

async function criar() {
  document.getElementById('err').textContent = '';
  try {
    await api('/api/warehouses', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('w-name').value,
        district: document.getElementById('w-district').value,
        address: document.getElementById('w-address').value,
        phone: document.getElementById('w-phone').value,
        email: document.getElementById('w-email').value
      })
    });
    document.getElementById('w-name').value = '';
    document.getElementById('w-address').value = '';
    document.getElementById('w-phone').value = '';
    document.getElementById('w-email').value = '';
    await carregarFiltro();
    carregar();
  } catch (e) { document.getElementById('err').textContent = e.message; }
}

async function alternar(id, is_active) {
  try { await api('/api/warehouses/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ is_active }) }); carregar(); }
  catch (e) { alert(e.message); }
}

async function apagar(id) {
  if (!confirm('Apagar armazém? Os produtos associados ficam sem armazém.')) return;
  try { await api('/api/warehouses/' + id, { method: 'DELETE' }); await carregarFiltro(); carregar(); }
  catch (e) { alert(e.message); }
}

(async () => { await carregarFiltro(); carregar(); })();
