

# Plan: Mover columna "#Factura" después de "Cotización"

## Resumen

Se reordenará la columna **#Factura** (actualmente en posición 3, después de "Centro de Costos") para ubicarla después de la columna **Cotización** (posición 11).

## Cambio

Es una actualización directa en la configuración de columnas del Panel Directivo almacenada en la base de datos. No requiere cambios de código.

### Orden actual
```
Evento → Centro de Costos → #Factura → Cliente → Avanzada → Fecha Montaje → Fecha Ejecución → Estado → Ingreso Bruto → Ingreso Total → Cotización → Notas
```

### Orden nuevo
```
Evento → Centro de Costos → Cliente → Avanzada → Fecha Montaje → Fecha Ejecución → Estado → Ingreso Bruto → Ingreso Total → Cotización → #Factura → Notas
```

## Implementación

Se actualizará el registro en la tabla `panel_column_configs` con el nuevo orden de columnas. El cambio se reflejará automáticamente para todos los usuarios en tiempo real gracias a la suscripción Realtime que ya tiene el hook `useGlobalColumns`.

## Archivos a modificar

Ninguno. Es exclusivamente una actualización de datos en la base de datos.

