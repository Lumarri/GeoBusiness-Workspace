# Arquitectura · etapa 1

## Decisiones

Monorepo con aplicación Next.js y API FastAPI independientes. El frontend usa un proxy de rutas explícitas; no publica la URL interna de PostgreSQL, credenciales de proveedores ni claves de modelos. El backend obtiene y valida datos cartográficos; el navegador solo solicita teselas para la vista activa y consultas al pulsar Analizar.

Flujo de una consulta:

1. La selección guarda latitud/longitud y dibuja un círculo geodésico. No hace peticiones comerciales.
2. Analizar envía coordenadas y radio al proxy Next.js, que llama a FastAPI.
3. Pydantic valida valores finitos, radio y parámetros. La API valida la extensión regional.
4. Se busca una consulta espacial exacta en caché, identificada por SHA-256 de versión, latitud, longitud y radio. Los filtros se excluyen de la clave.
5. Si no existe una entrada vigente, se hace una única consulta Overpass de nodos, vías y relaciones. El cliente limita tiempo, tamaño, concurrencia y frecuencia.
6. Se descartan datos malformados/inactivos, se deduplican IDs, se clasifican etiquetas y se filtra por distancia geográfica al punto representativo.
7. Se almacena el payload completo con fechas de consulta/vencimiento. Con PostgreSQL se guardan también las observaciones PostGIS mediante upsert.
8. Se devuelve un contrato validado con fuente y limitaciones. Zod valida la respuesta antes de que React la muestre.
9. Búsqueda y categoría en la UI filtran localmente sin otra llamada al proveedor. Los marcadores y la lista usan los mismos resultados filtrados.

## Responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| `Workspace.tsx` | Selección, consulta explícita, filtros, espera y cancelación lógica |
| `CommercialMap.tsx` | MapLibre, fuentes GeoJSON, radio, marcadores y popup DOM seguro |
| `AnalysisPanel.tsx` | Lista, detalle, totales y evidencia de datos |
| `CategoryChart.tsx` | Visualización de recuentos observados en OSM |
| `lib/proxy.ts` | Conexión al backend con timeout, sin proxy arbitrario |
| `schemas.py` | Validación de entrada y contrato de respuesta |
| `services/overpass.py` | Adaptador del proveedor, throttling y errores externos |
| `services/businesses.py` | Clasificación documentada y normalización |
| `services/geo.py` | Distancia Haversine |
| `services/nearby.py` | Orquestación de caché, proveedor y filtros |
| `db/cache.py` | Caché intercambiable y observaciones persistentes |
| `core/limits.py` | Ventana deslizante por IP, memoria acotada |

La respuesta de una solicitud antigua no reemplaza la selección nueva: AbortController y un contador de versión invalidan solicitudes al cambiar punto/radio. El proveedor puede terminar la solicitud ya iniciada y cachearla; abortar la interfaz no garantiza cancelación remota.

## Persistencia y eficiencia

`query_cache` almacena respuestas espaciales completas. Las fechas de expiración están indexadas y las entradas vencidas se eliminan como máximo una vez por hora al escribir. Solo se sirve caché vigente: si OSM falla después del TTL no se presenta silenciosamente una observación vieja como actual.

`business_observations` conserva el último registro consultado por ID OSM y un punto `geography(Point,4326)` con GiST. Los upserts se agrupan en lotes de 500 y evitan que una consulta anterior reemplace otra posterior.

En esta etapa la API responde a partir de snapshots completos del proveedor, no de la unión global de observaciones: dicha unión no informa qué zonas están cubiertas ni cuáles están completas. El esquema espacial deja preparada la consulta eficiente para una fase de extractos regionales con cobertura conocida:

```sql
SELECT osm_id, name,
       ST_Distance(location, ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography) AS distance_m
FROM business_observations
WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography, :radius)
ORDER BY distance_m;
```

Este SQL usa metros mediante `geography` y el índice espacial para el filtro. **No es la fuente del endpoint actual**; tampoco se considera que la tabla sea un censo completo de Lima. No se eliminan observaciones antiguas por ausencia en una consulta puntual: el centro y el alcance pueden haber cambiado. Se necesitará una política de cobertura y bajas antes de servirlas como inventario regional.

Las categorías/descripciones devueltas son calculadas desde tags. Las distancias en esta fase usan una esfera, mientras PostGIS `geography` emplea por defecto un esferoide: no deben mezclarse sin indicar el método. Las diferencias pequeñas en bordes del radio son esperables.

## Límites del MVP

- Una instancia Uvicorn, un proceso. La pausa global de Overpass y los límites por IP están en memoria; no son límites distribuidos. Antes de escalar, centralizarlos en Redis/gateway y añadir deduplicación de solicitudes en vuelo.
- Los navegadores que pasan por el proxy Next.js comparten la IP observada por FastAPI. El límite efectivo de 12/minuto se agrega para ellos. No se aceptan cabeceras `X-Forwarded-For` arbitrarias para evitar evasión; una capa de identidad y proxies de confianza debe preceder al SaaS multiusuario.
- Caché por coordenada exacta y radio; no cubre puntos cercanos por aproximación. La memoria de desarrollo admite 16 entradas y no es persistente.
- La extensión regional es una caja configurable, no una delimitación administrativa oficial.
- No hay autenticación, cuentas, facturación ni gestión de permisos. La comparación descriptiva se guarda en localStorage del navegador, sin sincronización ni persistencia por usuario en el servidor.
- La API usa GET; no recibe operaciones de escritura del navegador ni solicitudes QL libres. Las únicas URLs de proveedores son configuración del operador.
- Los payloads completos se limitan a 8 MiB y las consultas a 25 segundos en Overpass / 35 segundos HTTP. El proxy tiene un timeout de 40 segundos.
- No existe un sistema de migraciones todavía. El SQL inicial sirve para una base nueva; adoptar Alembic antes de evolucionar datos persistidos.

## Expansión

Para otra ciudad, cambiar extensión/nombre en el backend y puntos de navegación/centro inicial en el frontend. No hay filtros por nombre de distrito incrustados en la consulta Overpass. En una fase multi-ciudad, mover la configuración a un catálogo de regiones y añadir `region_id` explícito al contrato.

Las dependencias de redes y estadística están declaradas en el extra Python `analysis`, pero **no se instalan ni se ejecutan** en esta primera etapa. La API versionada y los componentes separados permiten agregarlas sin rehacer el mapa.


## Búsqueda y snapshots locales

`AddressSearch.tsx` envía una búsqueda explícita al proxy `/api/v1/locations/search`. `GeocodingClient` limita Nominatim a una solicitud por segundo por proceso, cachea hasta 128 búsquedas durante 24 horas y restringe resultados a Perú y al bbox. Es un servicio de desarrollo de bajo volumen, no un geocodificador distribuido. No hay autocompletado.

`AnalysisLibrary.tsx` guarda hasta diez respuestas completas con nombre y fecha en un formato versionado y validado por Zod. Solo actualiza el estado si la escritura de localStorage tiene éxito. Un formato ilegible se conserva y bloquea escrituras para evitar pérdida silenciosa. La comparación requiere 2–3 snapshots de la misma región y radio, muestra fecha/TTL y no asigna puntajes. Abrir restaura el snapshot; actualizar requiere una nueva consulta explícita.

## Indicadores territoriales y motor nativo

La API calcula `analysis` desde todos los registros del snapshot espacial, antes de aplicar filtros de categoría/texto. Un worker de Python ejecuta la agregación fuera del event loop; los cálculos entre vecinos se delegan a C++17 mediante ABI C/ctypes cuando la biblioteca local está disponible. La función nativa es independiente del estado de la API, valida coordenadas y tamaño y usa Haversine con el mismo radio terrestre que Python. Sin biblioteca se usa la referencia Python. No se devuelve una puntuación económica.

La complejidad de vecinos es O(n²), acotada a 2–2.000 registros; las métricas correspondientes son nulas fuera de ese rango. La densidad y la diversidad siguen usando el conjunto completo. La diversidad se normaliza por log(6); la categoría predominante solo es única cuando no hay empate. Las métricas de presencia de etiquetas no son una estimación de cobertura de negocios reales.

El mapa mantiene fuentes separadas para puntos y agrupaciones, una capa de calor relativa y visibilidad independiente del radio. La inicialización usa `style.load` para que los overlays no esperen a que finalicen las descargas raster. El panel conserva snapshots anteriores sin `analysis`, indica que requieren una nueva consulta y permite exportar el contrato actual como JSON.
