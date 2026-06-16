// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/seletor.js
// Seletor de produto por popup com pesquisa.
// Uso:
//   const sel = criarSeletorProduto({ produtos: [...], onEscolha: (p) => {...} });
//   sel.abrir();           // abre o popup
//   sel.elemento;          // (opcional) campo "fake" que mostra a escolha
//
// Cada produto deve ter pelo menos: id, name. Opcionalmente family_name, warehouse_name, quantity.

function criarSeletorProduto(opcoes) {
  const { produtos = [], onEscolha, titulo = 'Escolher artigo', mostrarArmazem = false } = opcoes;

  // Criar overlay/popup uma vez
  let overlay = document.getElementById('seletor-produto-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'seletor-produto-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px">
        <h3 id="sp-titulo"></h3>
        <input id="sp-pesquisa" placeholder="Pesquisar artigo..." style="margin-bottom:10px">
        <div class="tbl-scroll" style="max-height:50vh;overflow-y:auto">
          <table class="tbl"><thead id="sp-thead"></thead><tbody id="sp-tbody"></tbody></table>
        </div>
        <div class="btn-row"><button class="btn gray" id="sp-fechar">Fechar</button></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  const elPesquisa = overlay.querySelector('#sp-pesquisa');
  const elThead = overlay.querySelector('#sp-thead');
  const elTbody = overlay.querySelector('#sp-tbody');
  overlay.querySelector('#sp-titulo').textContent = titulo;
  overlay.querySelector('#sp-fechar').onclick = () => overlay.classList.remove('open');

  function desenhar(termo) {
    const t = (termo || '').toLowerCase();
    const lista = produtos.filter(p => {
      if (!t) return true;
      return (p.name && p.name.toLowerCase().includes(t)) ||
             (p.family_name && p.family_name.toLowerCase().includes(t)) ||
             (mostrarArmazem && p.warehouse_name && p.warehouse_name.toLowerCase().includes(t));
    });
    elThead.innerHTML = '<tr><th>Artigo</th><th>Família</th>' +
      (mostrarArmazem ? '<th>Armazém</th><th>Stock</th>' : '') + '<th></th></tr>';
    elTbody.innerHTML = lista.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.family_name || '-'}</td>
        ${mostrarArmazem ? `<td>${p.warehouse_name || '-'}</td><td>${p.quantity != null ? p.quantity : '-'}</td>` : ''}
        <td><button class="btn sm" data-id="${p.id}">Escolher</button></td>
      </tr>`).join('') ||
      `<tr><td colspan="${mostrarArmazem ? 5 : 3}" style="color:var(--cinza)">Nenhum artigo encontrado.</td></tr>`;
    elTbody.querySelectorAll('button[data-id]').forEach(b => {
      b.onclick = () => {
        const p = produtos.find(x => String(x.id) === b.getAttribute('data-id'));
        overlay.classList.remove('open');
        if (onEscolha) onEscolha(p);
      };
    });
  }

  elPesquisa.oninput = () => desenhar(elPesquisa.value);

  return {
    abrir() { elPesquisa.value = ''; desenhar(''); overlay.classList.add('open'); setTimeout(() => elPesquisa.focus(), 50); },
    atualizar(novos) { if (Array.isArray(novos)) { produtos.length = 0; produtos.push(...novos); } }
  };
}

// Seletor MULTIPLO: escolher varios artigos com checkboxes e confirmar todos de uma vez.
// onConfirma recebe um array de produtos escolhidos.
function criarSeletorMultiplo(opcoes) {
  const { produtos = [], onConfirma, titulo = 'Escolher artigos' } = opcoes;

  let overlay = document.getElementById('seletor-multiplo-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'seletor-multiplo-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px">
        <h3 id="sm-titulo"></h3>
        <input id="sm-pesquisa" placeholder="Pesquisar artigo..." style="margin-bottom:10px">
        <div class="tbl-scroll" style="max-height:50vh;overflow-y:auto">
          <table class="tbl"><thead><tr><th style="width:36px"></th><th>Artigo</th><th>Família</th></tr></thead><tbody id="sm-tbody"></tbody></table>
        </div>
        <div class="btn-row">
          <button class="btn" id="sm-confirmar">Adicionar selecionados</button>
          <button class="btn gray" id="sm-fechar">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  const elPesquisa = overlay.querySelector('#sm-pesquisa');
  const elTbody = overlay.querySelector('#sm-tbody');
  overlay.querySelector('#sm-titulo').textContent = titulo;
  const escolhidos = new Set();

  function desenhar(termo) {
    const t = (termo || '').toLowerCase();
    const lista = produtos.filter(p => !t ||
      (p.name && p.name.toLowerCase().includes(t)) ||
      (p.family_name && p.family_name.toLowerCase().includes(t)));
    elTbody.innerHTML = lista.map(p => `
      <tr>
        <td><input type="checkbox" data-id="${p.id}" ${escolhidos.has(String(p.id)) ? 'checked' : ''}></td>
        <td>${p.name}</td>
        <td>${p.family_name || '-'}</td>
      </tr>`).join('') ||
      '<tr><td colspan="3" style="color:var(--cinza)">Nenhum artigo encontrado.</td></tr>';
    elTbody.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.onchange = () => {
        const id = cb.getAttribute('data-id');
        if (cb.checked) escolhidos.add(id); else escolhidos.delete(id);
      };
    });
  }

  elPesquisa.oninput = () => desenhar(elPesquisa.value);
  overlay.querySelector('#sm-fechar').onclick = () => overlay.classList.remove('open');
  overlay.querySelector('#sm-confirmar').onclick = () => {
    const sel = produtos.filter(p => escolhidos.has(String(p.id)));
    overlay.classList.remove('open');
    if (onConfirma) onConfirma(sel);
  };

  return {
    abrir() { escolhidos.clear(); elPesquisa.value = ''; desenhar(''); overlay.classList.add('open'); setTimeout(() => elPesquisa.focus(), 50); },
    atualizar(novos) { if (Array.isArray(novos)) { produtos.length = 0; produtos.push(...novos); } }
  };
}
