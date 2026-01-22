# Documentación Técnica - BBM Producciones

## ¿Qué es este directorio?

El directorio `/docs` es el repositorio oficial de documentación técnica de la plataforma BBM Producciones. Contiene guías, manuales y referencias técnicas para todos los usuarios del sistema.

## ¿Para qué sirve?

- **Referencia técnica**: Documentación de la arquitectura, base de datos y configuración
- **Guías de usuario**: Manuales para usuarios finales según su rol
- **Guías de desarrollo**: Información para desarrolladores que mantengan el proyecto
- **Registro de cambios**: Historial de modificaciones importantes

## ¿A quién va dirigido?

| Audiencia | Documentos recomendados |
|-----------|------------------------|
| **Administradores** | `usuario/manual_basico.md`, `base_de_datos.md` |
| **Usuarios Operativos** | `usuario/manual_basico.md`, `usuario/tutorial_inicio.md` |
| **Usuarios Visuales** | `usuario/tutorial_inicio.md` |
| **Desarrolladores** | `desarrollador/estructura.md`, `desarrollador/configuracion.md`, `api.md` |

## Estructura del directorio

```
/docs
├── README.md                    # Este archivo
├── instalacion.md               # Guía de instalación y despliegue
├── api.md                       # Documentación de APIs y endpoints
├── base_de_datos.md             # Esquema y relaciones de la base de datos
├── usuario/
│   ├── manual_basico.md         # Manual completo para usuarios
│   └── tutorial_inicio.md       # Guía rápida de primeros pasos
└── desarrollador/
    ├── estructura.md            # Arquitectura del proyecto
    └── configuracion.md         # Configuración y reglas técnicas
```

## ¿Cómo mantener actualizada esta documentación?

### Regla obligatoria

> **IMPORTANTE**: Cada modificación funcional, visual, lógica o técnica del aplicativo debe reflejarse en este directorio de documentación.

### Proceso de actualización

1. **Identificar el tipo de cambio**:
   - Cambio en UI/UX → Actualizar `usuario/manual_basico.md`
   - Cambio en base de datos → Actualizar `base_de_datos.md`
   - Nueva funcionalidad → Actualizar documento correspondiente
   - Cambio en configuración → Actualizar `desarrollador/configuracion.md`

2. **Actualizar el documento afectado**:
   - Agregar la nueva información
   - Marcar secciones obsoletas si aplica
   - Actualizar ejemplos si es necesario

3. **Actualizar este README**:
   - Modificar la fecha de última actualización
   - Incrementar la versión si es un cambio mayor

## Información del sistema

| Campo | Valor |
|-------|-------|
| **Última actualización** | 22 de enero de 2026 |
| **Versión del sistema** | 1.0.0 |
| **Plataforma** | React + Vite + TypeScript + Tailwind CSS |
| **Backend** | Lovable Cloud (Supabase) |
| **Autenticación** | Supabase Auth con roles personalizados |

## Convenciones de documentación

- Usar Markdown para todos los documentos
- Incluir ejemplos prácticos cuando sea posible
- Mantener un tono técnico pero accesible
- Usar tablas para información estructurada
- Incluir capturas de pantalla cuando ayuden a la comprensión

---

*Documentación mantenida por el equipo de desarrollo de BBM Producciones*
