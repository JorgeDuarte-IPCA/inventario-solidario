// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/clients.js - MEMBRO 1: Carenciados e Doadores (tabelas separadas)
const user = requireAuth();
if (!guardPage(['admin', 'social_technician'])) throw new Error('redir');
renderShell('clients.html', 'Beneficiários e Doadores');

async function carregarArmazens() {
  const armazens = await api('/api/warehouses');
  document.getElementById('f-warehouse').innerHTML =
    '<option value="">Todos os armazéns</option>' +
    armazens.map(w => `<option value="${w.id}">${w.name} (${w.district})</option>`).join('');
}

function armazemLabel(c) {
  return c.warehouse_name ? `${c.warehouse_name} (${c.warehouse_district})` : '<span class="badge gray">não associado</span>';
}
function aprovacaoLabel(c) {
  return c.is_approved ? '<span class="badge green">aprovado</span>' : '<span class="badge orange">pendente</span>';
}
function acoesLabel(c) {
  return c.is_approved ? '-' : `<button class="btn sm" onclick="aprovar(${c.id})">Aprovar</button>`;
}

async function carregar() {
  document.getElementById('err').textContent = '';
  const arm = document.getElementById('f-warehouse').value;
  const filtro = arm ? '?warehouse_id=' + arm : '';
  try {
    const rows = await api('/api/users/clients' + filtro);
    const carenciados = rows.filter(c => c.profile_type === 'beneficiary');
    const doadores = rows.filter(c => c.profile_type === 'donor');

    document.getElementById('tbody-benef').innerHTML = carenciados.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.email}</td>
        <td>${c.phone || '-'}</td>
        <td>${c.address || '-'}</td>
        <td>${c.postal_code || '-'}</td>
        <td>${c.city || '-'}</td>
        <td>${c.household_size != null ? c.household_size : '-'}</td>
        <td>${armazemLabel(c)}</td>
        <td>${aprovacaoLabel(c)}</td>
        <td>${acoesLabel(c)}</td>
      </tr>`).join('') || '<tr><td colspan="10" style="color:var(--cinza)">Nenhum beneficiário.</td></tr>';

    document.getElementById('tbody-donor').innerHTML = doadores.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.email}</td>
        <td>${c.phone || '-'}</td>
        <td>${c.address || '-'}</td>
        <td>${c.postal_code || '-'}</td>
        <td>${c.city || '-'}</td>
        <td>${armazemLabel(c)}</td>
        <td>${aprovacaoLabel(c)}</td>
        <td>${acoesLabel(c)}</td>
      </tr>`).join('') || '<tr><td colspan="9" style="color:var(--cinza)">Nenhum doador.</td></tr>';
  } catch (e) { document.getElementById('err').textContent = e.message; }
}

async function aprovar(id) {
  try { await api('/api/users/' + id + '/approve', { method: 'PATCH', body: JSON.stringify({ is_approved: true }) }); carregar(); }
  catch (e) { alert(e.message); }
}

(async () => { await carregarArmazens(); carregar(); })();
