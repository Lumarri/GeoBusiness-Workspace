# Hoja de ruta

## Entregado: búsqueda y comparación inicial

Búsqueda explícita de direcciones en Lima mediante Nominatim; guardado de hasta diez snapshots por navegador; comparación descriptiva de dos o tres snapshots de la misma región y radio. No incluye cuentas, sincronización, análisis de redes ni puntuaciones. PostGIS y persistencia de caché se validaron en una base local; los conteos siguen representando registros OSM.

Las fases siguientes mantienen su alcance pendiente.

## Etapa 2: inteligencia territorial

Incorporar extractos OSM de Lima y un catálogo de cobertura, OSMnx/NetworkX para redes peatonales y viales, GeoPandas/Shapely para geometría y PostGIS para consultas regionales. Definir perfiles de acceso y restricciones de calles, no asumir que todo segmento permite caminar o circular.

Entregables: avenidas/intersecciones derivadas de la red, distancia por red separada de distancia Haversine, concentración comercial, comparación de ubicaciones y un modelo explicable de competencia. Las categorías amplias actuales no bastan para identificar competidores directos.

Una puntuación será una función versionada con variables, fuentes, normalización, ponderaciones que suman uno y contribuciones por ubicación. Si falta una variable, deberá indicar dato faltante y la regla de tratamiento; nunca convertirlo automáticamente en cero favorable. La puntuación será un índice derivado, no una probabilidad de éxito comercial.

## Etapa 3: simulador económico

Separar los supuestos introducidos por el usuario de datos territoriales. Definir unidades antes del contrato: demanda en unidades/mes, precio en PEN/unidad, costo variable en PEN/unidad, alquiler y otros fijos en PEN/mes, capital e inversión en PEN.

Implementar cálculos deterministas de margen, equilibrio, ingresos, gastos, caja e inversión; casos explícitos para margen no positivo, pérdidas, insuficiencia de capital y recuperación que no ocurre dentro del horizonte. Incluir impuestos/financiación solo como supuestos configurados.

Después incorporar NumPy/Pandas/SciPy y Monte Carlo con semilla, distribuciones, parámetros, correlaciones y límites físicos de demanda/precio visibles. Mostrar percentiles, probabilidad de pérdida y horizonte. Escenarios optimista/base/pesimista deben derivar de supuestos publicados y no de multiplicadores escondidos.

## Etapa 4: recomendaciones

Primer proveedor: motor de reglas que consuma resultados tipados de territorio y simulación. Cada recomendación debe incluir regla, datos que la activaron, incertidumbre y limitaciones. No hace falta una API de IA para recomendaciones reproducibles.

Diseñar una interfaz `RecommendationProvider` con un contrato común: entrada con evidence IDs/resultados/supuestos; salida con ventajas, riesgos, comparaciones y enlaces a evidencia. Un adaptador futuro de modelos de lenguaje traducirá esos mismos resultados, con claves privadas en el servidor y validación de salida. No podrá inventar métricas ausentes.

## Antes de SaaS público

Autenticación, autorizaciones por usuario, límites distribuidos, Alembic, observabilidad, backups/restauración verificados, política de cobertura/actualización OSM, proveedor cartográfico adecuado y revisión de licencias. Validar con ubicaciones de Lima contrastadas en campo antes de interpretar puntuaciones como información útil para inversión.


## Entregado: indicadores y capas espaciales

Análisis descriptivo por radio: densidad, diversidad, predominio de categoría sin resolver empates arbitrariamente, vecinos geográficos y presencia de datos. Motor C++17 con referencia Python y trabajo acotado; apartados de indicadores/calidad/metodología, exportación JSON y comparación ampliada. Mapa con puntos, agrupaciones, calor relativo y controles de radio/centrado.

Siguen pendientes las redes peatonales/viales, tiempos de recorrido, datos de demanda/alquileres, simulación financiera y recomendaciones económicas. Los indicadores de registros no sustituyen esos módulos.
