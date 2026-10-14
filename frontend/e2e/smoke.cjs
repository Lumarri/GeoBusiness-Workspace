// UI regression tests use explicitly synthetic responses; no provider traffic.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
function snapshot(lat, lng, radius) {
  const now = new Date().toISOString();
  const result = { location: { lat, lng }, radius_m: radius, region: 'Lima Metropolitana', total_in_radius: 1, total_filtered: 1,
    categories: [{ category: 'food', label: 'Restaurantes y cafés', count: 1 }],
    businesses: [{ osm_id: 'node/1', osm_type: 'node', name: 'Café de prueba', category: 'food', category_label: 'Restaurantes y cafés', subtype: 'cafe', lat, lng, distance_m: 0, location_method: 'node', address: null, opening_hours: null, osm_url: 'https://www.openstreetmap.org/node/1', evidence: 'osm_record' }],
    analysis: { methodology_version: 'territorial-v1', scope: 'whole_radius', area_km2: Math.PI*(radius/1000)**2, records_per_km2: 1/(Math.PI*(radius/1000)**2), diversity_index: 0, dominant_category: 'food', dominant_share: 1, mean_nearest_neighbor_m: null, share_with_neighbor_50m: null, named_share: 1, addressed_share: 0, hours_share: 0, spatial_engine: 'not_computed' },
    source: { provider: 'OpenStreetMap / Overpass', license: 'ODbL-1.0', retrieved_at: now, osm_base_timestamp: now, cache_hit: false, cache_expires_at: new Date(Date.now()+86400000).toISOString(), distance_method: 'haversine_straight_line', limitations: ['Datos sintéticos de pruebas.'] } };
  result.businesses.push({ ...result.businesses[0], osm_id: 'node/2', name: 'Farmacia de prueba', category: 'health', category_label: 'Salud y farmacias', subtype: 'pharmacy', lat: lat + 0.0001, distance_m: 11.1 });
  result.total_in_radius = result.total_filtered = 2;
  result.categories.push({ category: 'health', label: 'Salud y farmacias', count: 1 });
  Object.assign(result.analysis, { records_per_km2: 2/(Math.PI*(radius/1000)**2), diversity_index: Math.log(2)/Math.log(6), dominant_category: null, dominant_share: 0.5, mean_nearest_neighbor_m: 11.1, share_with_neighbor_50m: 1, spatial_engine: 'python' });
  return result;
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), args: ['--enable-unsafe-swiftshader'] });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('console', msg => { if (msg.type() === 'error') console.error('Browser:', msg.text()); });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4/eU9AAWcAs+9dDx1AAAAAElFTkSuQmCC', 'base64') }));
    await page.route('**/api/v1/weather?**', route => route.fulfill({ json: { provider: 'Open-Meteo', timezone: 'America/Lima', retrieved_at: '2026-10-14T15:00:00Z', limitations: 'Modelo de prueba', current: { time: '2026-10-14T10:00', temperature_2m: 21, relative_humidity_2m: 80, precipitation: 0, wind_speed_10m: 12, weather_code: 1 } } }));
    let geocodingCalls = 0;
    let nearbyCalls = 0;
    await page.route('**/api/v1/locations/search?**', route => { geocodingCalls++; return route.fulfill({ json: { results: [{ label: 'Parque Kennedy · prueba', lat: -12.1211, lng: -77.0300 }], provider: 'OpenStreetMap / Nominatim', license: 'ODbL-1.0' } }); });
    await page.route('**/api/v1/businesses/nearby?**', route => { nearbyCalls++; const p = new URL(route.request().url()).searchParams; return route.fulfill({ json: snapshot(Number(p.get('lat')), Number(p.get('lng')), Number(p.get('radius_m'))) }); });
    await page.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('.map-canvas[data-ready="true"]').waitFor({ timeout: 90000 });
    await page.getByRole('checkbox', { name: /Consultar negocios al seleccionar/ }).uncheck();
    await page.getByRole('button', { name: 'Ajustar punto', exact: true }).click();
    const pin = page.getByRole('button', { name: /Pin del lugar/ });
    await pin.focus(); await pin.press('ArrowRight');
    await page.getByRole('button', { name: 'Ajustar punto', exact: true }).click();
    await page.getByText('21 °C', { exact: true }).waitFor({ timeout: 30000 });
    for (const layer of ['Agrupaciones', 'Mapa de calor', 'Puntos']) {
      const button = page.getByRole('button', { name: layer, exact: true });
      await button.click(); assert.equal(await button.getAttribute('aria-pressed'), 'true');
    }
    const radiusLayer = page.getByRole('button', { name: 'Radio', exact: true });
    await radiusLayer.click(); assert.equal(await radiusLayer.getAttribute('aria-pressed'), 'false');
    await radiusLayer.click();
    await page.getByRole('tab', { name: 'Metodología', exact: true }).click();
    await page.getByText('Qué calculamos', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Indicadores', exact: true }).click();
    await page.getByLabel('Buscar dirección o lugar en Lima').fill('Kennedy');
    assert.equal(geocodingCalls, 0, 'Typing must not query the geocoder');
    await page.getByRole('button', { name: 'Buscar dirección', exact: true }).click();
    await page.getByRole('button', { name: 'Parque Kennedy · prueba', exact: true }).click();
    assert.equal(geocodingCalls, 1);
    await page.getByRole('button', { name: '250 m', exact: true }).click();
    await page.getByRole('checkbox', { name: /Consultar negocios al seleccionar/ }).check();
    await page.getByText('Densidad registrada', { exact: true }).waitFor({ timeout: 15000 });
    assert.equal(nearbyCalls, 1, 'The selected point must trigger one debounced business query');
    await page.getByText('Densidad registrada', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Agrupaciones', exact: true }).click();
    const canvas = page.locator('.map-canvas');
    const box = await canvas.boundingBox();
    // GeoJSON clustering is asynchronous: move the pointer after worker updates.
    const clusterTip = page.locator('.maplibregl-popup-content').filter({ hasText: '2 registros' });
    for (let attempt = 0; attempt < 40 && !(await clusterTip.count()); attempt++) {
      await canvas.hover({ position: { x: 5, y: 5 } });
      await canvas.hover({ position: { x: box.width/2, y: box.height/2 } });
      await page.waitForTimeout(250);
    }
    await clusterTip.waitFor({ timeout: 10000 });
    const scaleBefore = await page.locator('.maplibregl-ctrl-scale').innerText();
    await canvas.click({ position: { x: box.width/2, y: box.height/2 } });
    await page.waitForFunction(before => document.querySelector('.maplibregl-ctrl-scale').textContent !== before, scaleBefore);
    await page.getByRole('button', { name: 'Puntos', exact: true }).click();
    await page.getByLabel('Nombre del análisis').fill('Local A');
    await page.getByRole('button', { name: 'Guardar análisis', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Local A', exact: true }).waitFor();
    await page.locator('.site-editor summary').click();
    await page.getByLabel('Estado reportado', { exact: true }).selectOption('available');
    await page.getByLabel('Fuente y alcance', { exact: true }).fill('Contacto propietario · prueba');
    await page.getByLabel('Fecha de la fuente', { exact: true }).fill('2026-10-14');
    await page.getByLabel('Ticket supuesto (PEN/cliente)', { exact: true }).fill('20');
    await page.getByLabel('Clientes supuestos por día', { exact: true }).fill('30');
    await page.getByLabel('Días de operación al mes', { exact: true }).fill('26');
    await page.getByRole('button', { name: 'Guardar ficha del lugar', exact: true }).click();
    await page.getByText('Ficha guardada en este navegador para este punto.', { exact: true }).waitFor();

    await page.getByText('Densidad registrada', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Calidad de datos', exact: true }).click();
    assert.equal(await page.locator('.metric-grid article').filter({ hasText: 'Con nombre o marca' }).locator('strong').innerText(), '100 %');
    await page.getByRole('tab', { name: 'Indicadores', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar análisis JSON', exact: true }).click();
    assert.equal((await downloadPromise).suggestedFilename(), 'geobusiness-250m.json');
    await page.locator('.coordinate-row summary').click();
    await page.getByLabel('Latitud', { exact: true }).fill('-12.12');
    await page.getByLabel('Longitud', { exact: true }).fill('-77.031');
    await page.getByRole('button', { name: 'Ubicar', exact: true }).click();
    await page.getByRole('button', { name: 'Analizar ubicación', exact: true }).click();
    await page.getByLabel('Nombre del análisis').fill('Local B');
    await page.getByRole('button', { name: 'Guardar análisis', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Local B', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Abrir Local A', exact: true }).waitFor();
    for (const name of ['Local A', 'Local B']) await page.locator('.saved-list li').filter({ has: page.getByRole('button', { name: `Abrir ${name}`, exact: true }) }).getByRole('checkbox').check();
    await page.getByRole('table').waitFor();
    assert.equal(await page.getByRole('columnheader').count(), 3);
    await page.getByRole('button', { name: 'Abrir Local A', exact: true }).click();
    await page.getByText('Disponible · reporte propio', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Abrir Local B', exact: true }).click();
    await page.locator('#site-profile .metric-grid strong').filter({ hasText: /^Sin verificar$/ }).waitFor();
    await page.getByRole('button', { name: '500 m', exact: true }).click();
    await page.getByRole('button', { name: 'Analizar ubicación', exact: true }).click();
    await page.getByLabel('Nombre del análisis').fill('Local C');
    await page.getByRole('button', { name: 'Guardar análisis', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Local C', exact: true }).waitFor();
    await page.locator('.saved-list li').filter({ has: page.getByRole('button', { name: 'Abrir Local C', exact: true }) }).getByRole('checkbox').check();
    await page.getByText('Los radios o regiones son diferentes.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('table').count(), 0);
    await page.getByRole('button', { name: 'Eliminar Local C', exact: true }).click();
    await page.getByRole('table').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Abrir herramientas', exact: true }).click();
    await page.getByRole('button', { name: 'Comparar ubicaciones', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Mobile page must not overflow horizontally');
    assert.equal(await page.locator('.map-error').count(), 0, 'Map layers and test tiles must load without errors');
    assert.deepEqual(errors, [], 'Unexpected browser runtime errors');
    console.log('PASS: dynamic map controls and territorial tabs; address search, coordinates, saved snapshots after reload, comparison, incompatible radius, deletion and mobile navigation. Synthetic provider responses.');
  } catch (error) {
    if (page) {
      await page.screenshot({ path: process.env.E2E_FAILURE_SCREENSHOT || '/tmp/geobusiness-e2e-failure.png', fullPage: true }).catch(() => {});
      console.error('Map messages:', await page.locator('.map-error').allTextContents());
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
