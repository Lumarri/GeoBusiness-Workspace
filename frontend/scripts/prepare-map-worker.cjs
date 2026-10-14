// Serve MapLibre's version-matched worker without passing it through Turbopack.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'public', 'maplibre');
fs.mkdirSync(destination, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs']) {
  fs.copyFileSync(path.join(root, 'node_modules', 'maplibre-gl', 'dist', file), path.join(destination, file));
}
