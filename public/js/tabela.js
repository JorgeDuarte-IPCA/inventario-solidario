// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/tabela.js
// Componente de tabela reutilizavel com pesquisa, ordenacao e paginacao.
//
// Uso:
//   const t = criarTabela({
//     container: document.getElementById('tabela'),
//     colunas: [
//       { titulo: 'Nome', campo: 'name' },
//       { titulo: 'Qtd', campo: 'quantity', tipo: 'number' },
//       { titulo: 'Estado', render: (linha) => badge(linha.color_status), ordenarPor: 'color_status' },
//       { titulo: 'Ações', render: (linha) => `<button ...>`, ordenavel: false }
//     ],
//     porPagina: 10,
//     pesquisa: true,
//     vazio: 'Sem registos.'
//   });
//   t.setDados(arrayDeObjetos);
//
// Cada coluna:
//   - titulo: cabecalho
//   - campo: propriedade do objeto (para mostrar e ordenar)
//   - render(linha): HTML personalizado da celula (opcional)
//   - ordenarPor: campo a usar na ordenacao quando se usa render (opcional)
//   - ordenavel: false para desativar ordenacao nessa coluna
//   - tipo: 'number' | 'text' (para ordenar corretamente)

function criarTabela(opcoes) {
  const { container, colunas, porPagina: porPaginaInicial = 10, pesquisa = true, vazio = 'Sem registos.',
          opcoesPorPagina: opcoesPP = [10, 25, 50, 100] } = opcoes;
  // Garantir que o valor inicial esta entre as opcoes (e ordenar)
  const opcoesPorPagina = [...new Set([...opcoesPP, porPaginaInicial])].sort((a, b) => a - b);
  let porPagina = porPaginaInicial;
  let dados = [];
  let filtrados = [];
  let pagina = 1;
  let ordCampo = null;
  let ordDir = 1; // 1 asc, -1 desc
  let termo = '';
  let imprimindo = false;

  // Ao imprimir, mostrar todas as linhas filtradas (nao so a pagina atual)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeprint', () => { imprimindo = true; aplicar(); });
    window.addEventListener('afterprint', () => { imprimindo = false; aplicar(); });
  }

  // Construir a estrutura base
  container.innerHTML = `
    ${pesquisa ? `<div class="tbl-topo"><input class="tbl-pesquisa" placeholder="Pesquisar..."></div>` : ''}
    <div class="tbl-scroll"><table class="tbl"><thead></thead><tbody></tbody></table></div>
    <div class="tbl-rodape">
      <span class="tbl-info"></span>
      <span class="tbl-por-pagina">
        Linhas por página:
        <select class="tbl-select-pp">
          ${opcoesPorPagina.map(n => `<option value="${n}"${n === porPagina ? ' selected' : ''}>${n}</option>`).join('')}
        </select>
      </span>
      <span class="tbl-paginacao"></span>
    </div>`;

  const elPesquisa = container.querySelector('.tbl-pesquisa');
  const elThead = container.querySelector('thead');
  const elTbody = container.querySelector('tbody');
  const elInfo = container.querySelector('.tbl-info');
  const elPag = container.querySelector('.tbl-paginacao');
  const elSelPP = container.querySelector('.tbl-select-pp');

  if (elSelPP) {
    elSelPP.addEventListener('change', () => {
      porPagina = Number(elSelPP.value) || 10;
      pagina = 1;
      aplicar();
    });
  }

  if (elPesquisa) {
    elPesquisa.addEventListener('input', () => { termo = elPesquisa.value.toLowerCase(); pagina = 1; aplicar(); });
  }

  function valorCampo(linha, col) {
    const campo = col.ordenarPor || col.campo;
    return campo ? linha[campo] : '';
  }

  function aplicar() {
    // Pesquisa: procura em todos os campos definidos nas colunas
    filtrados = dados.filter(linha => {
      if (!termo) return true;
      return colunas.some(col => {
        const v = col.campo ? linha[col.campo] : (col.ordenarPor ? linha[col.ordenarPor] : '');
        return v != null && String(v).toLowerCase().includes(termo);
      });
    });

    // Ordenacao
    if (ordCampo) {
      const col = colunas.find(c => (c.ordenarPor || c.campo) === ordCampo);
      filtrados.sort((a, b) => {
        let va = a[ordCampo], vb = b[ordCampo];
        if (col && col.tipo === 'number') { va = Number(va) || 0; vb = Number(vb) || 0; return (va - vb) * ordDir; }
        va = va == null ? '' : String(va).toLowerCase();
        vb = vb == null ? '' : String(vb).toLowerCase();
        return va < vb ? -ordDir : va > vb ? ordDir : 0;
      });
    }

    desenhar();
  }

  function desenhar() {
    // Cabecalhos (com indicador de ordenacao)
    elThead.innerHTML = '<tr>' + colunas.map(col => {
      const podeOrdenar = col.ordenavel !== false && (col.campo || col.ordenarPor);
      const campo = col.ordenarPor || col.campo;
      let seta = '';
      if (podeOrdenar && ordCampo === campo) seta = ordDir === 1 ? ' ▲' : ' ▼';
      return `<th ${podeOrdenar ? `class="tbl-ord" data-campo="${campo}" style="cursor:pointer"` : ''}>${col.titulo}${seta}</th>`;
    }).join('') + '</tr>';

    elThead.querySelectorAll('.tbl-ord').forEach(th => {
      th.addEventListener('click', () => {
        const campo = th.getAttribute('data-campo');
        if (ordCampo === campo) ordDir = -ordDir; else { ordCampo = campo; ordDir = 1; }
        aplicar();
      });
    });

    // Corpo (pagina atual) — exceto ao imprimir, em que mostramos TODAS as linhas filtradas
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
    if (pagina > totalPaginas) pagina = totalPaginas;
    const inicio = (pagina - 1) * porPagina;
    const pageRows = imprimindo ? filtrados : filtrados.slice(inicio, inicio + porPagina);

    if (pageRows.length === 0) {
      elTbody.innerHTML = `<tr><td colspan="${colunas.length}" style="color:var(--cinza)">${vazio}</td></tr>`;
    } else {
      elTbody.innerHTML = pageRows.map(linha =>
        '<tr>' + colunas.map(col => {
          const conteudo = col.render ? col.render(linha) : (col.campo != null && linha[col.campo] != null ? linha[col.campo] : '-');
          return `<td>${conteudo}</td>`;
        }).join('') + '</tr>'
      ).join('');
    }

    // Etiquetas para o modo cartao em telemovel
    if (typeof rotularTabelas === 'function') rotularTabelas();

    // Info e paginacao
    const total = filtrados.length;
    const de = total === 0 ? 0 : inicio + 1;
    const ate = Math.min(inicio + porPagina, total);
    elInfo.textContent = `${de}-${ate} de ${total}`;

    elPag.innerHTML = '';
    if (totalPaginas > 1) {
      const btn = (txt, p, ativo, desativado) =>
        `<button class="tbl-pag-btn${ativo ? ' ativo' : ''}" ${desativado ? 'disabled' : ''} data-p="${p}">${txt}</button>`;
      let html = btn('‹', pagina - 1, false, pagina === 1);
      // janela de paginas (mostra ate 5)
      const ini = Math.max(1, pagina - 2);
      const fim = Math.min(totalPaginas, ini + 4);
      for (let p = ini; p <= fim; p++) html += btn(p, p, p === pagina, false);
      html += btn('›', pagina + 1, false, pagina === totalPaginas);
      elPag.innerHTML = html;
      elPag.querySelectorAll('.tbl-pag-btn').forEach(b => {
        b.addEventListener('click', () => {
          const p = Number(b.getAttribute('data-p'));
          if (p >= 1 && p <= totalPaginas) { pagina = p; desenhar(); }
        });
      });
    }
  }

  return {
    setDados(arr) { dados = Array.isArray(arr) ? arr : []; pagina = 1; aplicar(); },
    recarregar() { aplicar(); },
  };
}
