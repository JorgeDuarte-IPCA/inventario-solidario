// Inventario Solidario
// Projeto academico - CTESP Redes e Seguranca Informatica - IPCA
// Equipa: JDJB  (J-Jorge, D-Jose Daniel, J-Joao, B-Barreto)

// config/geo.js - geolocalizacao via OpenStreetMap/Nominatim
// Converte morada -> coordenadas e encontra o armazem mais proximo.
const pool = require('./db');

/**
 * Geocodifica uma morada usando o Nominatim (OpenStreetMap).
 * Gratuito, sem chave de API. Devolve { lat, lon } ou null.
 *
 * Nota: o Nominatim pede um User-Agent identificavel e limita a
 * 1 pedido por segundo. Para uso academico/demo e suficiente.
 */
async function geocode(address) {
  if (!address || !address.trim()) return null;
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pt&q='
      + encodeURIComponent(address);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'InventarioSolidario/1.0 (projeto academico IPCA)' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (e) {
    console.error('Geocode falhou:', e.message);
    return null;
  }
}

/**
 * Distancia em km entre dois pontos (formula de Haversine).
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // raio da Terra em km
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Encontra o armazem ativo mais proximo de umas coordenadas.
 * Devolve o id do armazem, ou null se nao houver armazens com coordenadas.
 */
async function nearestWarehouse(lat, lon) {
  if (lat == null || lon == null) return null;
  const [armazens] = await pool.query(
    'SELECT id, latitude, longitude FROM warehouses WHERE is_active = TRUE AND latitude IS NOT NULL'
  );
  let melhor = null, melhorDist = Infinity;
  for (const w of armazens) {
    const d = haversine(lat, lon, Number(w.latitude), Number(w.longitude));
    if (d < melhorDist) { melhorDist = d; melhor = w.id; }
  }
  return melhor;
}

/**
 * Geocodifica a morada e devolve { lat, lon, warehouseId }.
 * Se a geocodificacao falhar, devolve tudo a null (o registo segue na mesma).
 */
async function locateAndAssign(address) {
  const coords = await geocode(address);
  if (!coords) return { lat: null, lon: null, warehouseId: null };
  const warehouseId = await nearestWarehouse(coords.lat, coords.lon);
  return { lat: coords.lat, lon: coords.lon, warehouseId };
}

module.exports = { geocode, haversine, nearestWarehouse, locateAndAssign };
