// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/families.js - MEMBRO 2: Familias de produtos
const user = requireAuth();
renderShell('families.html', 'Famílias de Produtos');

// So o admin gere familias
if (user.role !== 'admin') location.href = 'dashboard.html';

async function carregar() {
  const rows = await api('/api/families');
  document.getElementById('tbody').innerHTML = rows.map(f => `
    <tr>
      <td>${f.name}</td>
      <td>${f.total_produtos}</td>
      <td>
        <button class="btn sm gray" onclick="renomear(${f.id}, '${f.name.replace(/'/g, "\\'")}')">Renomear</button>
        <button class="btn sm danger" onclick="apagar(${f.id})">Apagar</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="3" style="color:var(--cinza)">Sem famílias.</td></tr>';
}

async function criar() {
  document.getElementById('err').textContent = '';
  try {
    await api('/api/families', { method: 'POST', body: JSON.stringify({ name: document.getElementById('f-name').value }) });
    document.getElementById('f-name').value = '';
    carregar();
  } catch (e) { document.getElementById('err').textContent = e.message; }
}

async function renomear(id, atual) {
  const nome = prompt('Novo nome da família:', atual);
  if (!nome || nome === atual) return;
  try { await api('/api/families/' + id, { method: 'PUT', body: JSON.stringify({ name: nome }) }); carregar(); }
  catch (e) { alert(e.message); }
}

async function apagar(id) {
  if (!confirm('Apagar família? Os produtos associados ficam sem família.')) return;
  try { await api('/api/families/' + id, { method: 'DELETE' }); carregar(); }
  catch (e) { alert(e.message); }
}

carregar();
