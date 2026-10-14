// UI regression tests use explicitly synthetic responses; no provider traffic.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
function snapshot(lat, lng, radius) {
  const now = new Date().toISOString();
  return { location: { lat, lng }, radius_m: radius, region: 'Lima Metropolitana', total_in_radius: 1, total_filtered: 1,
    categories: [{ category: 'food', label: 'Restaurantes y cafés', count: 1 }],
    businesses: [{ osm_id: 'node/1', osm_type: 'node', name: 'Café de prueba', category: 'food', category_label: 'Restaurantes y cafés', subtype: 'cafe', lat, lng, distance_m: 0, location_method: 'node', address: null, opening_hours: null, osm_url: 'https://www.openstreetmap.org/node/1', evidence: 'osm_record' }],
    source: { provider: 'OpenStreetMap / Overpass', license: 'ODbL-1.0', retrieved_at: now, osm_base_timestamp: now, cache_hit: false, cache_expires_at: new Date(Date.now()+86400000).toISOString(), distance_method: 'haversine_straight_line', limitations: ['Datos sintéticos de pruebas.'] } };
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=', 'base64') }));
    let geocodingCalls = 0;
    await page.route('**/api/v1/locations/search?**', route => { geocodingCalls++; return route.fulfill({ json: { results: [{ label: 'Parque Kennedy · prueba', lat: -12.1211, lng: -77.0300 }], provider: 'OpenStreetMap / Nominatim', license: 'ODbL-1.0' } }); });
    await page.route('**/api/v1/businesses/nearby?**', route => { const p = new URL(route.request().url()).searchParams; return route.fulfill({ json: snapshot(Number(p.get('lat')), Number(p.get('lng')), Number(p.get('radius_m'))) }); });
    await page.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000');
    await page.getByLabel('Buscar dirección o lugar en Lima').fill('Kennedy');
    assert.equal(geocodingCalls, 0, 'Typing must not query the geocoder');
    await page.getByRole('button', { name: 'Buscar dirección', exact: true }).click();
    await page.getByRole('button', { name: 'Parque Kennedy · prueba', exact: true }).click();
    assert.equal(geocodingCalls, 1);
    await page.getByRole('button', { name: '250 m', exact: true }).click();
    await page.getByRole('button', { name: 'Analizar ubicación', exact: true }).click();
    await page.getByLabel('Nombre del análisis').fill('Local A');
    await page.getByRole('button', { name: 'Guardar análisis', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Local A', exact: true }).waitFor();
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
    await page.getByRole('button', { name: 'Abrir Local B', exact: true }).click();
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
    assert.deepEqual(errors, [], 'Unexpected browser runtime errors');
    console.log('PASS: address search, coordinates, saved snapshots after reload, comparison, incompatible radius, deletion and mobile navigation. Synthetic provider responses.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
