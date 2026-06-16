// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// public/js/dashboard.js - MEMBRO 2
requireAuth();
if (!guardPage(['admin', 'social_technician', 'warehouse_operator'])) throw new Error('redir');
renderShell('dashboard.html', 'Painel');

const KPI_LABELS = {
  total_products:     'Produtos',
  total_warehouses:   'Armazéns',
  total_stock:        'Unidades em stock',
  expiring_soon:      'A expirar',
  pending_requests:   'Pedidos pendentes',
  delivered_requests: 'Pedidos entregues',
  pending_donations:  'Doações por validar'
};

// Para onde cada KPI leva ao ser clicado
const KPI_LINKS = {
  total_products:     'products.html',
  total_warehouses:   'warehouses.html',
  total_stock:        'products.html',
  expiring_soon:      'products.html?color=red',
  pending_requests:   'requests.html',
  delivered_requests: 'requests.html',
  pending_donations:  'donations.html'
};

const cor = { verde: '#1b6b4c', verdeClaro: '#2e8b6a', laranja: '#d98326',
              vermelho: '#c0392b', amarelo: '#e0a800', azul: '#2c6fbb', cinza: '#9aa8a3',
              primaria: '#d7141a', primariaClara: '#e8565b' };

// Controlar o tamanho dos graficos: nao manter racio fixo (a altura vem do CSS)
if (window.Chart) {
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.responsive = true;
  // Plugin de etiquetas: mostrar os valores dentro dos graficos
  if (window.ChartDataLabels) {
    Chart.register(window.ChartDataLabels);
    Chart.defaults.plugins.datalabels = {
      color: '#fff',
      font: { weight: 'bold', size: 13 },
      // Nao mostrar etiqueta para fatias com valor 0
      display: (ctx) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        return v != null && Number(v) > 0;
      },
      // Circulares (pie/doughnut) -> percentagem; barras -> valor absoluto
      formatter: (value, ctx) => {
        const tipo = ctx.chart.config.type;
        if (tipo === 'pie' || tipo === 'doughnut') {
          const dados = ctx.dataset.data || [];
          const total = dados.reduce((s, n) => s + (Number(n) || 0), 0);
          if (!total) return '';
          const pct = (Number(value) / total) * 100;
          return pct.toFixed(pct < 10 ? 1 : 0) + '%';
        }
        return value;
      }
    };
  }
}

(async function () {
  try {
    const d = await api('/api/dashboard');

    // Aviso de pedidos pendentes (so para admin e tecnico social)
    const u = getUser();
    if (['admin', 'social_technician'].includes(u.role)) {
      const n = d.kpis.requests_to_review || 0;
      if (n > 0) {
        document.getElementById('aviso-pendentes').innerHTML =
          `<div class="aviso">
            <span>⚠️ Existe<span class="num"> ${n} </span>${n === 1 ? 'pedido' : 'pedidos'} à espera de análise.</span>
            <a href="requests.html">Ver pedidos →</a>
          </div>`;
      }
    }

    // KPIs (nao mostrar o requests_to_review como KPI separado)
    const kpisVisiveis = { ...d.kpis };
    delete kpisVisiveis.requests_to_review;
    document.getElementById('kpis').innerHTML = Object.entries(kpisVisiveis)
      .map(([k, v]) => {
        const link = KPI_LINKS[k];
        const inner = `<div class="label">${KPI_LABELS[k] || k}</div><div class="value">${v}</div>`;
        return link
          ? `<a class="kpi kpi-link" href="${link}">${inner}</a>`
          : `<div class="kpi">${inner}</div>`;
      })
      .join('');

    // Grafico: stock por familia
    const familiasId = d.byFamily.map(r => r.family_id);
    new Chart(document.getElementById('chartFamily'), {
      type: 'bar',
      data: {
        labels: d.byFamily.map(r => r.family),
        datasets: [{ label: 'Unidades', data: d.byFamily.map(r => r.total),
          backgroundColor: cor.primaria, borderRadius: 6 }]
      },
      options: {
        onClick: (e, els, chart) => {
          let idx = els.length ? els[0].index : null;
          if (idx === null) {
            const pts = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);
            if (pts.length) idx = pts[0].index;
          }
          if (idx !== null) { const fid = familiasId[idx]; if (fid) location.href = 'products.html?family_id=' + fid; }
        },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } }
      }
    });

    // Grafico: pedidos por estado
    const estadosPedido = d.byStatus.map(r => r.status);
    new Chart(document.getElementById('chartStatus'), {
      type: 'doughnut',
      data: {
        labels: d.byStatus.map(r => pt(r.status)),
        datasets: [{ data: d.byStatus.map(r => r.total),
          backgroundColor: [cor.azul, cor.laranja, cor.verde, cor.vermelho, cor.amarelo, cor.cinza, cor.verdeClaro] }]
      },
      options: {
        onClick: (e, els) => {
          if (els.length) { const s = estadosPedido[els[0].index]; if (s) location.href = 'requests.html?estado=' + s; }
        }
      }
    });

    // Grafico: cor de validade
    const mapCor = { green: cor.verde, yellow: cor.amarelo, red: cor.vermelho, expired: '#3a3a3a' };
    const coresStock = d.byColor.map(r => r.color_status);
    new Chart(document.getElementById('chartColor'), {
      type: 'pie',
      data: {
        labels: d.byColor.map(r => ({ green: 'Válido', yellow: 'Atenção', red: 'A expirar', expired: 'Fora de validade' }[r.color_status] || r.color_status)),
        datasets: [{ data: d.byColor.map(r => r.total),
          backgroundColor: d.byColor.map(r => mapCor[r.color_status] || cor.cinza) }]
      },
      options: {
        onClick: (e, els) => {
          if (els.length) { const c = coresStock[els[0].index]; if (c) location.href = 'products.html?color=' + c; }
        }
      }
    });

    // Grafico: stock por distrito
    const distritos = d.byDistrict.map(r => r.district);
    new Chart(document.getElementById('chartDistrict'), {
      type: 'bar',
      data: {
        labels: d.byDistrict.map(r => r.district),
        datasets: [{ label: 'Unidades', data: d.byDistrict.map(r => r.total),
          backgroundColor: cor.primariaClara, borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y',
        onClick: (e, els, chart) => {
          let idx = els.length ? els[0].index : null;
          if (idx === null) {
            const pts = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);
            if (pts.length) idx = pts[0].index;
          }
          if (idx !== null) { const dist = distritos[idx]; if (dist && dist !== 'Sem armazem') location.href = 'products.html?district=' + encodeURIComponent(dist); }
        },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } }
      }
    });

    // Graficos mensais em percentagem (distribuicao entre meses)
    function nomeMes(ym) {
      // ym = 'YYYY-MM'
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const [ano, m] = (ym || '').split('-');
      return (meses[Number(m) - 1] || ym) + '/' + (ano ? ano.slice(2) : '');
    }
    function graficoMensalPct(canvasId, dados, corBarra) {
      const total = dados.reduce((s, r) => s + Number(r.total || 0), 0);
      const labels = dados.map(r => nomeMes(r.mes));
      const valores = dados.map(r => total ? (Number(r.total) / total) * 100 : 0);
      new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: { labels, datasets: [{ data: valores, backgroundColor: corBarra, borderRadius: 6 }] },
        options: {
          plugins: {
            legend: { display: false },
            datalabels: {
              color: '#444', anchor: 'end', align: 'end',
              display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
              formatter: (v) => v.toFixed(v < 10 ? 1 : 0) + '%'
            },
            tooltip: { callbacks: { label: (ctx) => ctx.parsed.y.toFixed(1) + '%' } }
          },
          scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } }
        }
      });
    }
    graficoMensalPct('chartDoadosMes', d.doadosMes || [], cor.verde);
    graficoMensalPct('chartRecebidosMes', d.recebidosMes || [], cor.azul);

    // Tops: artigos mais pedidos e mais doados (barras horizontais, valor absoluto)
    function graficoTop(canvasId, dados, corBarra) {
      new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: {
          labels: dados.map(r => r.name),
          datasets: [{ data: dados.map(r => Number(r.total)), backgroundColor: corBarra, borderRadius: 6 }]
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } }
        }
      });
    }
    graficoTop('chartTopPedidos', d.topPedidos || [], cor.laranja);
    graficoTop('chartTopDoados', d.topDoados || [], cor.verde);

    // Grafico combinado: Procura vs. Oferta por artigo
    (function () {
      const dados = d.demandaOferta || [];
      if (!dados.length) return;
      new Chart(document.getElementById('chartDemandaOferta'), {
        type: 'bar',
        data: {
          labels: dados.map(r => r.nome),
          datasets: [
            { label: 'Procura (pedida)', data: dados.map(r => Number(r.procura)),
              backgroundColor: dados.map(r => Number(r.defice) > 0 ? cor.vermelho : cor.azul), borderRadius: 4 },
            { label: 'Oferta (doada)', data: dados.map(r => Number(r.oferta)),
              backgroundColor: cor.verde, borderRadius: 4 }
          ]
        },
        options: {
          indexAxis: 'y',
          plugins: {
            legend: { display: true, position: 'top' },
            datalabels: { display: false },
            tooltip: { callbacks: { afterBody: (items) => {
              const i = items[0].dataIndex; const def = Number(dados[i].defice);
              return def > 0 ? 'Défice: faltam ' + def : (def < 0 ? 'Excedente: +' + (-def) : 'Equilibrado');
            } } }
          },
          scales: { x: { beginAtZero: true, stacked: false }, y: { stacked: false } }
        }
      });
    })();
  } catch (e) {
    document.querySelector('.main').insertAdjacentHTML('beforeend', `<p class="error">${e.message}</p>`);
  }
})();
