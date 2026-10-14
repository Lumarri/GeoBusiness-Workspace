# GeoBusiness AI · MVP, etapa 1

Explorador territorial para emprendedores en Lima, Perú. Primera implementación con **Next.js, React, TypeScript, Tailwind CSS, MapLibre GL JS, Recharts, FastAPI, Pydantic, SQLAlchemy, PostgreSQL y PostGIS**.

Este repositorio implementa la primera etapa solicitada. El simulador financiero, el análisis de redes y el asistente comercial se incorporarán después; sus accesos aparecen identificados como próximos.

## Qué funciona

- Mapa de calles navegable, centrado inicialmente en Miraflores, Lima.
- Selección de ubicación con clic o formulario de coordenadas.
- Radios geográficos de **250, 500 y 1.000 metros**, representados sobre el mapa.
- Consulta explícita a Overpass de establecimientos registrados en OpenStreetMap.
- Marcadores y seis categorías comerciales.
- Búsqueda por nombre, dirección y etiqueta OSM **dentro de los resultados consultados**; no es geocodificación de toda la ciudad.
- Panel de establecimientos ordenados por distancia, detalle y enlace al registro OSM.
- Recuento por categoría y gráfico interactivo de composición comercial.
- Fuente, fecha de consulta, uso de caché, licencia y limitaciones visibles.
- Diseño adaptable, menú móvil, estados de carga, errores y resultado vacío.
- API validada y versionada, caché PostgreSQL con TTL, límites de consultas externas y por IP.
- Persistencia de observaciones geográficas en PostGIS, con índice GiST.
- Docker Compose, archivos de configuración, dependencias fijadas y pruebas básicas.

**No se inventan establecimientos ni se carga una base de demostración.** Los datos sintéticos de `backend/tests/conftest.py` y de las pruebas frontend solo se utilizan para pruebas.

Los recuentos representan **registros OSM**: no son un censo, no verifican apertura actual, ni demuestran demanda o rentabilidad. No hay puntuación comercial en esta etapa. Las calles e intersecciones se ven en el mapa base; todavía no se extraen ni se analizan como red.

## Inicio rápido con Docker

Instala Docker Engine o Docker Desktop con Docker Compose v2. Abre la carpeta `geobusiness-ai` en VS Code.

En **PowerShell (Windows)**:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

En **Linux, macOS o WSL**:

```bash
cp .env.example .env
docker compose up --build
```

Abre:

- Aplicación: http://localhost:3000
- Documentación interactiva de la API: http://localhost:8000/docs
- Readiness: http://localhost:8000/health/ready

Espera a que PostgreSQL y la API estén listos. El frontend se inicia después de que ambas dependencias pasen sus healthchecks. Necesitas conexión a Internet para descargar dependencias e imágenes y consultar OSM.

1. Selecciona una ubicación en Lima.
2. Elige el radio.
3. Pulsa **Analizar ubicación**.
4. Filtra los resultados por categoría o texto.
5. Selecciona un establecimiento para inspeccionar su registro, o abre **Resumen**.

Para detener los servicios sin borrar datos:

```bash
docker compose down
```

El volumen `postgres_data` conserva la caché y las observaciones. No uses `down -v` si deseas conservarlo. Los scripts de `database/init` se ejecutan al crear un volumen nuevo; cambios posteriores del esquema necesitan migraciones explícitas.

La configuración de ejemplo utiliza credenciales locales de desarrollo. Los puertos se enlazan a `127.0.0.1` y la base de datos no publica un puerto al host. No es un despliegue SaaS público ni incorpora autenticación.

## Desarrollo nativo sin Docker

Requisitos: **Node.js 24 LTS** y **Python 3.12** para reproducir el entorno de verificación. Next.js requiere como mínimo Node 20.9; este proyecto usa Node 24 también para sus herramientas de prueba.

Desde la raíz, crea el entorno Python. En Linux/macOS/WSL:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.lock
python -m pip install --no-deps -e ./backend
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

En PowerShell, la alternativa que no requiere activar scripts es:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e .\backend
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

En una segunda terminal:

```bash
cd frontend
npm ci
```

Copia `frontend/.env.example` a `frontend/.env.local` (`cp` o `Copy-Item`) y ejecuta:

```bash
npm run dev
```

Sin `DATABASE_URL`, el backend usa una caché LRU en memoria de hasta 16 consultas. Este modo permite trabajar y probar el mapa sin instalar PostgreSQL; **no persiste observaciones**. Docker habilita por defecto PostgreSQL/PostGIS y caché persistente.

Para usar PostGIS en desarrollo nativo, aplica `database/init/001_schema.sql` a una base de desarrollo y configura en `backend/.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://usuario:password@localhost:5432/geobusiness
```

Si la URL está configurada y la base o el esquema no están disponibles, el arranque falla; no se cambia silenciosamente a memoria. Si una contraseña tiene caracteres reservados de URL, codifícalos en la URL de conexión.

## Pruebas y compilación

Con el entorno Python activo, desde `backend/`:

```bash
python -m pytest -q
ruff check app tests
ruff format --check app tests
```

Desde `frontend/`:

```bash
npm run typecheck
npm test
npm run build
```

También puedes ejecutar las pruebas de backend dentro de los contenedores:

```bash
docker compose exec backend python -m pytest -q
```

La prueba opcional de integración PostGIS requiere `TEST_DATABASE_URL` hacia una base desechable con el esquema inicial. Crea registros aislados de prueba y los elimina al terminar. Con Compose, después de iniciar los servicios:

```bash
docker compose exec -e TEST_DATABASE_URL=postgresql+asyncpg://geobusiness:geobusiness_local_dev@db:5432/geobusiness backend python -m pytest tests/test_postgis.py -q
```

Adapta las credenciales si cambiaste `.env`. No ejecutes esta prueba sobre una base de producción; incluye limpieza de caché expirada, como el repositorio normal.

La verificación realizada durante esta entrega está registrada en [docs/VERIFICATION.md](docs/VERIFICATION.md). No confundir archivos preparados con servicios ejecutados: el arranque Docker y la integración PostGIS no se comprobaron en el entorno de entrega.

## Estructura y archivos principales

```text
geobusiness-ai/
├── frontend/
│   ├── src/app/                       # App Router, página y proxy API
│   ├── src/components/                # Workspace, mapa, panel y gráfico
│   ├── src/lib/                       # Contratos Zod, filtros, geometría y API
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
├── backend/
│   ├── app/api/                       # Endpoints /api/v1
│   ├── app/core/                      # Configuración regional y límites
│   ├── app/db/                        # Modelos SQLAlchemy y repositorios de caché
│   ├── app/services/                  # Overpass, clasificación y distancias
│   ├── app/schemas.py                 # Validación y contratos Pydantic
│   ├── app/main.py                    # Lifespan, middleware y healthchecks
│   ├── tests/                         # Pruebas y fixture OSM sintética
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── requirements.lock
├── database/init/001_schema.sql       # PostGIS, tablas e índices
├── docs/ARCHITECTURE.md
├── docs/DATA_AND_PROVIDERS.md
├── docs/ROADMAP.md
├── docs/VERIFICATION.md
├── .env.example
└── compose.yaml
```

## API

```http
GET /api/v1/config
GET /api/v1/businesses/nearby?lat=-12.1211&lng=-77.0300&radius_m=250
GET /api/v1/businesses/nearby?lat=-12.1211&lng=-77.0300&radius_m=500&category=food&search=cafe
```

Categorías: `food`, `groceries`, `health`, `retail`, `services`, `other`.

La respuesta incluye `total_in_radius`, `total_filtered`, `categories`, `businesses` y `source`. Los totales por categoría se calculan sobre todos los registros del radio; `businesses` aplica los filtros. Los filtros no vuelven a consultar OSM cuando la respuesta espacial está en caché.

Errores: `422` entrada inválida/región no habilitada, `429` límite o pausa local, `503` proveedor/base no disponible. `Retry-After` indica cuándo puede reintentarse; la UI muestra la espera y no reintenta automáticamente. La documentación OpenAPI se genera en `/docs`.

## Configuración

| Variable | Uso | Predeterminado |
| --- | --- | --- |
| `DATABASE_URL` | Conexión privada SQLAlchemy/asyncpg | Ausente: memoria |
| `OVERPASS_URL` | Endpoint privado del proveedor de registros | Instancia pública de Overpass |
| `OSM_USER_AGENT` | Identificación de la aplicación en Overpass | GeoBusinessAI/0.1, desarrollo |
| `CACHE_TTL_SECONDS` | Validez de una consulta completa | 86.400 s |
| `PROVIDER_INTERVAL_SECONDS` | Pausa mínima entre consultas externas | 3 s |
| `RATE_LIMIT_PER_MINUTE` | Máximo por IP vista por la API | 12 |
| `REGION_BBOX` | JSON `[oeste,sur,este,norte]` | Extensión de Lima |
| `REGION_NAME` | Nombre de la región habilitada | Lima Metropolitana |
| `CORS_ORIGINS` | Lista JSON de orígenes permitidos | `["http://localhost:3000"]` |
| `API_BASE_URL` | API privada para el proxy Next.js | `http://localhost:8000` |
| `NEXT_PUBLIC_TILE_URL` | Plantilla pública de teselas raster | OSM estándar |
| `NEXT_PUBLIC_TILE_ATTRIBUTION` | Atribución adicional del proveedor | OSM contributors |

FastAPI lee `backend/.env` al ejecutarse desde ese directorio. Compose inyecta las variables indicadas en `compose.yaml`; para otra ciudad agrega allí `REGION_BBOX` y `REGION_NAME`, además de adaptar los puntos de navegación del frontend. `NEXT_PUBLIC_*` se integra durante la compilación: tras cambiar el mapa base recompila el frontend. Solo se admiten teselas raster en este MVP.

No se requieren claves de IA ni pagos de API para esta etapa local. OSM/Overpass públicos son servicios comunitarios sin SLA: para un SaaS público debes elegir un proveedor o infraestructura cartográfica acorde al tráfico y a sus condiciones. Consulta [políticas y límites](docs/DATA_AND_PROVIDERS.md).

## Problemas frecuentes

- **No se conecta la API:** verifica `API_BASE_URL` y que el backend esté iniciado. En Compose debe ser `http://backend:8000`; en desarrollo nativo, `http://localhost:8000`.
- **503 de OSM:** espera el tiempo indicado. No se muestran resultados parciales ni se sustituye el error por cero establecimientos.
- **El mapa no carga:** revisa WebGL, conexión y `NEXT_PUBLIC_TILE_URL`. Puedes seleccionar coordenadas y consultar registros aunque falle el mapa base.
- **422:** radios permitidos: 250/500/1.000. Se usa punto decimal. La selección debe estar dentro de la extensión configurada.
- **0 registros:** no significa ausencia de negocios reales. Contrasta presencialmente y prueba un radio mayor.
- **Error de esquema PostGIS:** comprueba que `001_schema.sql` haya sido aplicado. Los volúmenes existentes no vuelven a ejecutar automáticamente los scripts iniciales.
- **429 con varios usuarios:** el proxy Next.js comparte una IP frente al backend. En este MVP el límite se agrega para esos usuarios; no se confía en cabeceras de IP suministradas por el navegador.


## Búsqueda, guardado y comparación

- El formulario **Buscar dirección o lugar en Lima** consulta Nominatim únicamente al enviar la búsqueda. Elegir un resultado mueve la ubicación; analizar negocios sigue siendo una acción explícita.
- `GET /api/v1/locations/search?q=...` limita la consulta a Perú y a la extensión regional, devuelve hasta cinco candidatos y filtra resultados fuera de ella. La API valida 3–160 caracteres, limita consultas y cachea búsquedas durante 24 horas (hasta 128 entradas por proceso). No hay autocompletado.
- `GEOCODING_URL` permite configurar un endpoint compatible con el contrato JSON de Nominatim; por defecto `https://nominatim.openstreetmap.org/search`. El proveedor público se limita a desarrollo de bajo volumen, una solicitud por segundo y un solo proceso. Para uso público configura identificación/contacto real en `OSM_USER_AGENT`, revisa https://operations.osmfoundation.org/policies/nominatim/ y utiliza un proveedor apropiado con límites compartidos entre instancias.
- Tras una consulta puedes **Guardar análisis** con un nombre. Se conservan hasta diez snapshots completos en `localStorage` del navegador. No hay sincronización entre dispositivos ni cuentas; borrar los datos del sitio elimina estos análisis. Si el almacenamiento falla se muestra un error sin sustituir los datos anteriores.
- **Abrir** restaura el snapshot y su ubicación; no solicita datos frescos automáticamente. Para actualizarlo, pulsa Analizar ubicación y guarda el nuevo resultado.
- Selecciona dos o tres snapshots de la misma región y radio para ver conteos por categoría, coordenadas, fechas y vigencia de caché. Las diferencias de cobertura y fecha deben considerarse; los conteos no representan demanda, competencia directa ni probabilidad de éxito.

Pruebas nuevas: `backend/tests/test_geocoding.py` (validación, cobertura regional, caché, pausa y errores del proveedor) y `frontend/src/lib/analyses.test.ts` (persistencia, formatos inválidos y compatibilidad de comparación).

### Base local nativa y regresión en navegador

En este entorno, Docker no puede leer montajes de archivos del checkout. Para usar una base local sin ese montaje, crea `.env` desde `.env.example` y ejecuta `bash scripts/start-local-db.sh`. El script inicia/reutiliza `geobusiness-postgis`, conserva `geobusiness_postgres_data`, publica PostgreSQL solo en loopback y aplica el esquema por stdin. No borra datos ni sustituye migraciones. Configura `backend/.env` con `DATABASE_URL` correspondiente a estos valores de desarrollo y reinicia la API; `/health/ready` debe indicar `postgresql`.

Desde `frontend`, con frontend/API activos:

```bash
# Una sola vez, si no tienes Chromium instalado:
npx playwright install chromium
npm run test:e2e
# Alternativa con el Chromium disponible en esta máquina:
BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

`E2E_BASE_URL` permite cambiar el servidor de prueba. Esta regresión usa respuestas de proveedor sintéticas y teselas de prueba para comprobar interacciones sin tráfico externo: búsqueda explícita, coordenadas, persistencia al recargar, comparación, radios incompatibles, eliminación y navegación móvil. No equivale a validar disponibilidad o calidad cartográfica real.
