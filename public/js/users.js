// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/users.js - MEMBRO 1
const user = requireAuth();
// Admin e tecnico social acedem; outros sao redirecionados
if (!guardPage(['admin', 'social_technician'])) throw new Error('redir');
renderShell('users.html', 'Gestão de Utilizadores');

const ehAdmin = user.role === 'admin';

const ROLE_LABEL = {
  admin: 'Administrador',
  social_technician: 'Técnico Social',
  warehouse_operator: 'Operador de Armazém',
  donor: 'Doador',
  beneficiary: 'Beneficiário'
};

function toggleAgregado() {
  const r = document.getElementById('u-role').value;
  // Agregado familiar: so beneficiario
  document.getElementById('u-campo-agregado').style.display = r === 'beneficiary' ? '' : 'none';
  // Morada/contactos: beneficiario e doador (como no registo publico)
  document.getElementById('u-campo-morada').style.display = ['beneficiary', 'donor'].includes(r) ? '' : 'none';
}

let tabelaUsers = null;

async function carregar() {
  const rows = await api('/api/users');
  if (!tabelaUsers) {
    tabelaUsers = criarTabela({
      container: document.getElementById('tabela-users'),
      colunas: [
        { titulo: 'ID', campo: 'id', tipo: 'number' },
        { titulo: 'Nome', campo: 'name' },
        { titulo: 'Email', campo: 'email' },
        { titulo: 'Papel', ordenarPor: 'role', render: u => ROLE_LABEL[u.role] || u.role },
        { titulo: 'Agregado', campo: 'household_size', tipo: 'number', render: u => u.household_size != null ? u.household_size : '-' },
        { titulo: 'Aprovação', ordenarPor: 'is_approved', render: u => u.is_approved
          ? '<span class="badge green">aprovado</span>' : '<span class="badge orange">pendente</span>' },
        { titulo: 'Estado', ordenarPor: 'is_active', render: u => u.is_active
          ? '<span class="badge green">ativo</span>' : '<span class="badge red">inativo</span>' },
        { titulo: 'Ações', ordenavel: false, render: u => {
          let acoes = '';
          if (!u.is_approved) acoes += `<button class="btn sm" onclick="aprovar(${u.id}, true)">Aprovar</button> `;
          if (ehAdmin) {
            acoes += `<button class="btn sm ${u.is_active ? 'danger' : ''}" onclick="alternar(${u.id}, ${u.is_active ? 0 : 1})">${u.is_active ? 'Desativar' : 'Ativar'}</button> `;
            acoes += `<button class="btn sm gray" onclick="mudarSenha(${u.id}, '${(u.name || '').replace(/'/g, "\\'")}')">Senha</button>`;
          }
          return acoes || '-';
        }},
      ],
      porPagina: 10,
      vazio: 'Sem utilizadores.'
    });
  }
  tabelaUsers.setDados(rows);
}

async function criar() {
  document.getElementById('err').textContent = '';
  try {
    const role = document.getElementById('u-role').value;
    const address = document.getElementById('u-address').value;
    const postal = document.getElementById('u-postal').value;
    const city = document.getElementById('u-city').value;
    const phone = document.getElementById('u-phone').value;
    // Morada obrigatoria para beneficiario (como no registo publico)
    if (role === 'beneficiary' && (!address || !postal || !city || !phone)) {
      document.getElementById('err').textContent = 'Para beneficiários, preencha morada, código postal, cidade e telemóvel.';
      return;
    }
    const body = {
      name: document.getElementById('u-name').value,
      email: document.getElementById('u-email').value,
      password: document.getElementById('u-pass').value,
      role: role,
      address: address,
      postal_code: postal,
      city: city,
      phone: phone
    };
    if (role === 'beneficiary') {
      body.household_size = Number(document.getElementById('u-household').value) || 1;
    }
    await api('/api/users', { method: 'POST', body: JSON.stringify(body) });
    ['u-name', 'u-email', 'u-pass', 'u-address', 'u-postal', 'u-city', 'u-phone'].forEach(id => document.getElementById(id).value = '');
    carregar();
  } catch (e) { document.getElementById('err').textContent = e.message; }
}

async function aprovar(id, is_approved) {
  try { await api('/api/users/' + id + '/approve', { method: 'PATCH', body: JSON.stringify({ is_approved }) }); carregar(); }
  catch (e) { alert(e.message); }
}

async function alternar(id, is_active) {
  try { await api('/api/users/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ is_active }) }); carregar(); }
  catch (e) { alert(e.message); }
}

async function mudarSenha(id, nome) {
  const nova = prompt('Nova senha para ' + nome + ' (mínimo 6 caracteres):');
  if (nova === null) return;
  if (nova.length < 6) { alert('A senha deve ter pelo menos 6 caracteres.'); return; }
  try {
    await api('/api/users/' + id + '/password', { method: 'PATCH', body: JSON.stringify({ new_password: nova }) });
    alert('Senha alterada com sucesso.');
  } catch (e) { alert(e.message); }
}

carregar();
toggleAgregado();
