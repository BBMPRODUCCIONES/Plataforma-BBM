

# Plan: Informe PDF Completo - Los 3 Entornos del Sistema

## Objetivo
Generar un PDF profesional que documente en detalle los 3 entornos que existen en GitHub (main, develop, lovable-hierarchical-text-change), explicando para cada uno: su funcionamiento, cómo se actualiza, sus conexiones, infraestructura, DNS, backend, y comportamiento real.

## Estructura del PDF

1. **Portada** - Titulo, fecha, proyecto BBM Producciones
2. **Resumen Ejecutivo** - Vista general de los 3 entornos
3. **Diagrama Visual** - Mapa de los 3 entornos con sus conexiones (ASCII)
4. **Entorno 1: Produccion (main)** - Funcionamiento completo, despliegue manual via Lovable, DNS Hostinger -> IP 185.158.133.1, dominio bbmproducciones.com.co, PWA negro, theme #0f172a, backend Supabase compartido, Edge Functions, Storage
5. **Entorno 2: Demo (develop)** - Auto-deploy via Vercel, DNS Hostinger -> CNAME Vercel, dominio demo.bbmproducciones.com.co, PWA morado, theme #7c3aed, manifest-demo.json, deteccion automatica de hostname
6. **Entorno 3: Rama Temporal (lovable-hierarchical-text-change)** - Rama de sincronizacion intermedia de Lovable, no es entorno de despliegue, comportamiento y ciclo de vida
7. **Backend Compartido** - Supabase unico: PostgreSQL, Auth, Storage (4 buckets), 12 Edge Functions, variables de entorno, secrets
8. **Tabla Comparativa** - Los 3 entornos lado a lado (infraestructura, deploy, DNS, PWA, backend)
9. **Flujo de Actualizacion** - Paso a paso de como se actualiza cada entorno
10. **Riesgos Identificados** - Data compartida, backend acoplado, Edge Functions/migraciones inmediatas

## Implementacion
- Script Python con reportlab
- Diagrama ASCII profesional incluido
- QA visual obligatorio de todas las paginas
- Archivo: `/mnt/documents/informe_3_entornos_bbm.pdf`

