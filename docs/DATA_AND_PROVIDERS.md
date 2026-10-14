# Datos, clasificación y proveedores

## Significado de los datos

| Dato visible | Procedencia | Interpretación |
| --- | --- | --- |
| Nombre, dirección, horario | Etiquetas OSM | Registro colaborativo, puede faltar/estar desactualizado |
| Ubicación de nodo | Coordenada OSM | Punto registrado, sin verificación presencial |
| Ubicación de vía/relación | `out center` de Overpass | Centro de caja envolvente, no puerta/centroide real |
| Categoría | Regla de agrupación de tags | Clasificación derivada, no clasificación municipal |
| Distancia | Haversine desde punto seleccionado | Cálculo en línea geográfica, no recorrido |
| Cantidad | Registros OSM únicos por tipo/ID dentro del radio | No censo de negocios físicos ni conteo de clientes |

No se distinguen duplicados físicos etiquetados como nodo y como polígono. No se supone que negocios de la misma categoría sean competidores directos. La ausencia de registros o datos no debe convertirse en evidencia de baja competencia o buena rentabilidad.

## Consulta

Consulta acotada `nwr[shop]` y una lista explícita de amenities comerciales: restaurantes, cafés, comida rápida, bares, pubs, heladerías, patios de comidas, farmacias, clínicas, dentistas, consultorios, veterinarias, bancos, estaciones de combustible, lavado de autos y casas de cambio.

No es un catálogo exhaustivo: por ejemplo, oficinas sin `shop` y mercados etiquetados solo como `amenity=marketplace` no se consultan todavía. Se descartan `shop=no/vacant/disused` y tags `disused/abandoned/demolished=yes`. La consulta Overpass puede seleccionar un área por su geometría, pero el resultado mostrado se limita por distancia a su centro de caja; un área cuyo borde está dentro y centro fuera se excluye. Ambas limitaciones son explícitas para no aparentar cobertura total.

## Reglas de categorías

Orden de prioridad implementado en `services/businesses.py`:

| Categoría | Tags |
| --- | --- |
| Salud | `amenity=pharmacy/clinic/dentist/doctors/veterinary` |
| Gastronomía | `amenity=restaurant/cafe/fast_food/bar/pub/ice_cream/food_court` |
| Alimentos | `shop=supermarket/convenience/bakery/greengrocer/butcher/seafood/deli/kiosk` |
| Servicios | `amenity=bank/fuel/car_wash/bureau_de_change`; `shop=hairdresser/beauty/laundry/car_repair/travel_agency/copyshop` |
| Comercio | Otros `shop` activos |
| Otros | Reserva para ampliaciones del catálogo; normalmente vacío con estas reglas |

Se conserva el subtipo OSM para poder ampliar reglas más adelante. La búsqueda ignora mayúsculas y diacríticos. Los registros sin nombre tienen un rótulo explícito, no un nombre inventado.

## Teselas

El mapa base raster se solicita directamente desde el navegador. El desarrollo local usa `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; la URL es configurable durante el build. No se hacen descargas masivas, exportaciones offline ni precarga de una ciudad. Se deja actuar el caché HTTP del navegador y una Referrer-Policy compatible con el envío de Referer.

La atribución OSM queda visible en el mapa, incluso en móviles. Si se cambia de proveedor, configura su atribución adicional y verifica sus términos. Nunca pongas claves privadas en `NEXT_PUBLIC_*`; si el proveedor necesita un token para navegador, debe ser público, restringido a tus dominios y con límites adecuados.

Política oficial: https://operations.osmfoundation.org/policies/tiles/

## Overpass

La instancia pública se configura por defecto solo para desarrollo de bajo volumen. El adaptador envía un User-Agent identificado, no realiza reintentos automáticos ni rota servidores para evadir límites, mantiene una única solicitud externa en curso y pausa nuevas peticiones. Si el proveedor devuelve 429/504, activa un enfriamiento de al menos 30 segundos. La interfaz exige acción explícita y bloquea el botón durante `Retry-After`.

El TTL de 24 horas reutiliza respuestas completas. Filtros por categoría/nombre reutilizan esa misma entrada. Una respuesta con `remark` de Overpass se considera incompleta y se rechaza; no se muestra como inventario completo ni se cachea. Si la API devuelve un error, el frontend lo distingue de una consulta exitosa vacía.

La caché local y los límites propios **no garantizan disponibilidad ni autorización para usar la instancia pública como backend de un SaaS**. Antes de publicar para múltiples usuarios, utiliza extractos regionales OSM con cobertura gestionada, una instancia propia o un proveedor contratado, y configura `OVERPASS_URL` según corresponda. Publica un contacto real en `OSM_USER_AGENT` para un despliegue operado.

Manual del operador: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html

## Licencias

Datos OSM: ODbL 1.0, con atribución y obligaciones aplicables a bases derivadas/distribuidas. No se incluyen teselas, extractos reales ni dumps en el archivo del proyecto. Las fixtures son sintéticas y están rotuladas como pruebas. Las dependencias conservan sus licencias propias; instalar paquetes no cambia la licencia de sus componentes.

- Licencia y atribución: https://www.openstreetmap.org/copyright
- Guía de atribución: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines

Referencias consultadas para esta implementación el 13 de octubre de 2026, hora de Lima. Revisar las políticas nuevamente antes de un despliegue público.

