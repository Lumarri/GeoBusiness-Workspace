# Verificación de la entrega

Realizada el **13 de octubre de 2026, hora de Lima** (14 de octubre UTC en parte de la ejecución). Entorno: Python 3.12.14 y Node.js 24.19.0.

| Comprobación ejecutada | Resultado |
| --- | --- |
| `python -m pytest -q` en backend | **31 passed, 1 skipped** |
| `ruff check app tests` | Sin errores |
| `ruff format --check app tests` | 22 archivos con formato válido |
| `npm run typecheck` | Sin errores de TypeScript |
| `npm test` | **5 pruebas aprobadas**, 2 archivos |
| `npm run build` | Compilación de producción Next.js completada |
| Una consulta real a Overpass | Éxito: 234 registros OSM normalizados en radio de 250 m |
| Parseo de `compose.yaml` con PyYAML | YAML válido; no equivale a ejecutar Compose |
| Compilación SQLAlchemy de INSERT geográfico con dialecto PostgreSQL | SQL `ST_GeogFromText` generado; no equivale a ejecutar SQL |

La consulta real de bajo volumen usó `lat=-12.1211`, `lng=-77.0300`, `radius_m=250`. Overpass informó `timestamp_osm_base=2026-10-14T01:56:30Z`. El recuento corresponde a los registros devueltos y filtrados entonces; no es un censo, ni un dato de demostración incorporado al frontend. No se descargaron teselas para esta prueba.

Las pruebas cubren validación regional y numérica, radios permitidos, límites por IP, contrato y healthchecks, Haversine, exclusión por radio sin redondeo prematuro, reglas de clasificación, datos malformados/inactivos, deduplicación por ID, TTL/LRU, reutilización de caché con filtros, errores/429/504, rechazo de respuestas parciales y límite de tamaño. Las pruebas frontend cubren geometría del círculo, orden de coordenadas, extensión regional, filtros y validación de evidencia/enlaces/respuestas.

El runner del backend mostró un aviso de deprecación de Starlette sobre `httpx` en TestClient; no hubo fallos. El cliente de la aplicación usa httpx para Overpass. El aviso no se ocultó en la ejecución registrada.

## No comprobado en este entorno

- **Integración PostgreSQL/PostGIS:** la prueba `test_postgis.py` quedó omitida por no existir `TEST_DATABASE_URL`. No había Docker ni PostgreSQL disponibles. Está incluido el comando para ejecutarla en README.
- **Build y arranque de contenedores:** no ejecutados; Docker Compose y Dockerfiles están preparados, pero requieren validación en una máquina con Docker.
- **QA visual e interacción en navegador:** no ejecutadas; no había una capacidad de navegador de prueba disponible. La compilación no sustituye pruebas de clic, WebGL, diseño móvil o accesibilidad visual.
- **Carga, uso multiusuario y disponibilidad futura de proveedores:** no medidos. Este MVP utiliza límites de un proceso y proveedores públicos configurados para desarrollo.
- **Módulos posteriores:** redes, comparación, puntajes, simulador/Monte Carlo y asistente no están implementados ni probados.

## Validación manual recomendada al arrancar

1. Cargar http://localhost:3000; comprobar mapa y atribución OSM visible.
2. Seleccionar un punto en Lima; consultar cada radio y comprobar círculo, lista y marcadores.
3. Abrir un registro OSM desde el panel y comparar fuente/dirección.
4. Filtrar por categoría/texto; comprobar que mapa y lista coinciden y no se realiza otra consulta externa.
5. Cambiar de ubicación durante una consulta; comprobar que no aparecen resultados de la ubicación anterior.
6. Probar coordenadas fuera de región, desconexión de API, límite de consultas y ausencia de registros.
7. Probar pantalla móvil, teclado y formulario de coordenadas sin WebGL.
8. Ejecutar la prueba PostGIS y comprobar persistencia al reiniciar servicios sin eliminar el volumen.

