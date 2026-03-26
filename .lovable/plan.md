

# Plan: PDF Actualizado - Ramas, Conexión Vercel y Flujo de Despliegue

## Objetivo
Generar un PDF profesional que documente quién creó cada rama en GitHub, cómo se conectan a Vercel, y el flujo completo de despliegue de cada entorno.

## Estructura del PDF

1. **Portada** - Título, fecha, proyecto BBM Producciones
2. **Las 3 Ramas en GitHub** - Origen de cada una (quién la creó y por qué):
   - `main`: creada automáticamente por Lovable al conectar GitHub
   - `develop`: creada manualmente por el equipo para el entorno Demo
   - `lovable-hierarchical-text-change`: creada automáticamente por Lovable como rama temporal de sincronización
3. **Conexión con Vercel** - Paso a paso de cómo se vinculó el repositorio a Vercel, configuración del branch `develop`, `vercel.json` (SPA rewrites), CNAME en Hostinger
4. **Conexión con Lovable Hosting** - Cómo `main` se publica manualmente, DNS A record en Hostinger → IP 185.158.133.1
5. **Flujo Completo de Despliegue** - Diagrama paso a paso:
   - Cambio en Lovable → push a GitHub → rama temporal → merge a main
   - main → Publish manual → Producción (bbmproducciones.com.co)
   - develop → auto-deploy Vercel → Demo (demo.bbmproducciones.com.co)
   - Backend (Edge Functions + migraciones) → deploy inmediato a Supabase compartido
6. **Detección Automática de Entorno** - Lógica en `index.html` que detecta hostname para aplicar manifest y theme correcto (negro vs morado)
7. **Tabla Resumen** - Las 3 ramas lado a lado: creador, propósito, plataforma de deploy, dominio, DNS, PWA theme
8. **Riesgos del Modelo Actual** - Backend compartido, deploys inmediatos de Edge Functions

## Implementación
- Script Python con reportlab
- QA visual obligatorio de todas las páginas
- Archivo: `/mnt/documents/informe_ramas_vercel_deploy_bbm.pdf`

