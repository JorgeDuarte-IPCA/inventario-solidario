// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/settings.js - MEMBRO 1: Configuracao SMTP (admin)
const user = requireAuth();
if (!guardPage(['admin'])) throw new Error('redir');
renderShell('settings.html', 'Configurações');

async function carregar() {
  try {
    const s = await api('/api/settings/smtp');
    document.getElementById('s-host').value = s.smtp_host;
    document.getElementById('s-port').value = s.smtp_port;
    document.getElementById('s-secure').value = s.smtp_secure;
    document.getElementById('s-user').value = s.smtp_user;
    document.getElementById('s-from').value = s.smtp_from;
    if (s.smtp_pass_set) document.getElementById('s-pass').placeholder = '•••••• (guardada — deixe vazio para manter)';
    // Brevo
    document.getElementById('b-from').value = s.brevo_from || '';
    if (s.brevo_key_set) document.getElementById('b-key').placeholder = '•••••• (guardada — deixe vazio para manter)';
  } catch (e) { document.getElementById('err').textContent = e.message; }
}

async function guardarBrevo() {
  document.getElementById('err-brevo').textContent = '';
  document.getElementById('msg-brevo').textContent = '';
  try {
    await api('/api/settings/smtp', {
      method: 'PUT',
      body: JSON.stringify({
        brevo_api_key: document.getElementById('b-key').value, // vazio = manter a existente
        brevo_from: document.getElementById('b-from').value
      })
    });
    document.getElementById('msg-brevo').textContent = 'Configuração do Brevo guardada.';
    document.getElementById('b-key').value = '';
    carregar();
  } catch (e) { document.getElementById('err-brevo').textContent = e.message; }
}

async function guardar() {
  document.getElementById('err').textContent = '';
  document.getElementById('msg').textContent = '';
  try {
    await api('/api/settings/smtp', {
      method: 'PUT',
      body: JSON.stringify({
        smtp_host: document.getElementById('s-host').value,
        smtp_port: document.getElementById('s-port').value,
        smtp_secure: document.getElementById('s-secure').value,
        smtp_user: document.getElementById('s-user').value,
        smtp_pass: document.getElementById('s-pass').value, // vazio = manter a existente
        smtp_from: document.getElementById('s-from').value
      })
    });
    document.getElementById('msg').textContent = 'Configuração guardada.';
    document.getElementById('s-pass').value = '';
    carregar();
  } catch (e) { document.getElementById('err').textContent = e.message; }
}

async function testar() {
  document.getElementById('err-teste').textContent = '';
  document.getElementById('msg-teste').textContent = '';
  try {
    const r = await api('/api/settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify({ to: document.getElementById('t-to').value })
    });
    document.getElementById('msg-teste').textContent = r.message || 'Email de teste enviado.';
  } catch (e) { document.getElementById('err-teste').textContent = e.message; }
}

carregar();

async function carregarIntervalo() {
  try {
    const r = await api('/api/settings/request-interval');
    document.getElementById('ri-days').value = r.days || 0;
  } catch (_) {}
}

async function guardarIntervalo() {
  const msg = document.getElementById('ri-msg');
  msg.textContent = '';
  try {
    const dias = Number(document.getElementById('ri-days').value) || 0;
    const r = await api('/api/settings/request-interval', {
      method: 'PUT', body: JSON.stringify({ days: dias })
    });
    msg.style.color = 'var(--verde)';
    msg.textContent = r.days > 0
      ? `Guardado. Intervalo mínimo: ${r.days} dia(s).`
      : 'Guardado. Controlo de frequência desativado.';
  } catch (e) {
    msg.style.color = 'var(--vermelho)';
    msg.textContent = e.message;
  }
}

carregarIntervalo();
