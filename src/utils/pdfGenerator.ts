import { Project, PersonalItem, InventarioItem, Proveedor, CajaMenorItem } from "@/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface PrintOptions {
  title: string;
  subtitle?: string;
  includeAttachments?: boolean;
  notes?: string;
}

// Generate printable HTML content
const generatePrintableHTML = (content: string, options: PrintOptions): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${options.title}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #333;
          padding: 20px;
          padding-top: 80px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #333;
        }
        .header h1 {
          font-size: 18px;
          margin-bottom: 5px;
        }
        .header p {
          font-size: 12px;
          color: #666;
        }
        .info-section {
          margin-bottom: 15px;
          padding: 10px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        .info-row {
          display: flex;
          margin-bottom: 5px;
        }
        .info-label {
          font-weight: bold;
          width: 150px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background: #333;
          color: white;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background: #f9f9f9;
        }
        .notes-section {
          margin-top: 20px;
          padding: 10px;
          border: 1px dashed #999;
          background: #fff9e6;
        }
        .notes-section h3 {
          margin-bottom: 5px;
          font-size: 14px;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #999;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
        }
        .badge-bbm { background: #dbeafe; color: #1d4ed8; }
        .badge-proveedor { background: #ffedd5; color: #c2410c; }
        .badge-transporte { background: #dcfce7; color: #16a34a; }
        .badge-aprobado { background: #dcfce7; color: #16a34a; }
        .badge-no-aprobado { background: #fee2e2; color: #dc2626; }
        .badge-pendiente { background: #ffedd5; color: #ea580c; }
        .checkbox {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 1px solid #333;
          text-align: center;
          line-height: 12px;
        }
        .checkbox.checked::after {
          content: "✓";
        }
        
        /* Mobile action bar - always visible */
        .mobile-action-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #1a1a2e;
          color: white;
          padding: 12px 16px;
          padding-top: calc(12px + env(safe-area-inset-top, 0px));
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 9999;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          gap: 8px;
        }
        .mobile-action-bar button {
          background: #f97316;
          color: white;
          border: none;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          min-height: 44px;
          -webkit-tap-highlight-color: transparent;
        }
        .mobile-action-bar button:active {
          background: #ea580c;
          transform: scale(0.98);
        }
        .mobile-action-bar .back-btn {
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.3);
        }
        .mobile-action-bar .back-btn:active {
          background: rgba(255,255,255,0.25);
        }
        .mobile-action-bar .title {
          font-size: 13px;
          font-weight: 600;
          flex: 1;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 0 4px;
        }
        
        @media print {
          /* En iOS/PWA a veces el "modo impresión" es la única vista; mantenemos la barra para poder volver */
          body { padding: 20px; padding-top: 100px; }
          .no-print { display: none !important; }
          .mobile-action-bar {
            display: flex !important;
            background: #ffffff;
            color: #111111;
            box-shadow: none;
            border-bottom: 1px solid #e5e7eb;
          }
          .mobile-action-bar button {
            background: #111111;
            color: #ffffff;
          }
          .mobile-action-bar .back-btn {
            background: #ffffff;
            color: #111111;
            border: 1px solid #111111;
          }
        }
      </style>
    </head>
    <body>
      <div class="mobile-action-bar"> 
        <button class="back-btn" onclick="goBack()">
          ← Volver
        </button>
        <span class="title">${options.title}</span>
        <button onclick="window.print()">
          📄 Guardar PDF
        </button>
        <button onclick="saveAsImage()">
          📷 Guardar Foto
        </button>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
      <script>
        function goBack() {
          // Try multiple methods to go back
          if (window.opener) {
            window.close();
          } else if (history.length > 1) {
            history.back();
          } else {
            // Fallback: redirect to origin
            window.location.href = window.location.origin;
          }
        }
        
        function saveAsImage() {
          // Hide action bar temporarily for screenshot
          const actionBar = document.querySelector('.mobile-action-bar');
          actionBar.style.display = 'none';
          
          // Capture the entire body as image
          html2canvas(document.body, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollY: -window.scrollY,
            windowHeight: document.body.scrollHeight
          }).then(function(canvas) {
            // Show action bar again
            actionBar.style.display = 'flex';
            
            // Convert to blob and trigger download
            canvas.toBlob(function(blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = '${options.title.replace(/[^a-zA-Z0-9]/g, '_')}_' + new Date().toISOString().split('T')[0] + '.png';
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
            }, 'image/png');
          }).catch(function(err) {
            actionBar.style.display = 'flex';
            alert('Error al guardar imagen: ' + err.message);
          });
        }
      </script>
      
      <div class="header">
        <h1>${options.title}</h1>
        ${options.subtitle ? `<p>${options.subtitle}</p>` : ''}
        <p>Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
      </div>
      ${content}
      ${options.notes ? `
        <div class="notes-section">
          <h3>Notas Generales:</h3>
          <p>${options.notes}</p>
        </div>
      ` : ''}
      <div class="footer">
        <p>PRODUCCIÓN DE EVENTOS - Sistema de Gestión</p>
      </div>
    </body>
    </html>
  `;
};

// Print Personal section (internal use)
const generatePersonalSection = (project: Project): string => {
  const personal = project.personal || [];
  
  const tableRows = personal.map(p => `
    <tr>
      <td>${p.nombre}</td>
      <td>${p.cedula || '-'}</td>
      <td>${p.cargo}</td>
      <td>${p.telefono}</td>
      <td><span class="badge badge-${p.tipoPersonal.toLowerCase()}">${p.tipoPersonal}</span></td>
      <td>${p.notas || '-'}</td>
      ${p.tipoPersonal === 'Transporte' ? `<td>${p.rutaTransporte || '-'}</td>` : '<td>-</td>'}
    </tr>
  `).join('');

  return `
    <h2 style="margin: 15px 0 10px; font-size: 14px;">Personal Asignado (${personal.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Cédula</th>
          <th>Cargo</th>
          <th>Teléfono</th>
          <th>Tipo</th>
          <th>Notas</th>
          <th>Ruta Transporte</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="7" style="text-align: center;">No hay personal asignado</td></tr>'}
      </tbody>
    </table>
  `;
};

// Print Personal section (standalone - kept for backward compatibility)
export const printPersonal = (project: Project, includeNotes: boolean = true) => {
  const content = `
    <div class="info-section">
      <div class="info-row"><span class="info-label">Proyecto:</span> ${project.evento}</div>
      <div class="info-row"><span class="info-label">Cliente:</span> ${project.cliente}</div>
      <div class="info-row"><span class="info-label">Centro de Costos:</span> ${project.centroCostos}</div>
      <div class="info-row"><span class="info-label">Fecha Montaje:</span> ${formatDateRange(project.fechaMontajeInicio, project.fechaMontajeFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Ejecución:</span> ${formatDateRange(project.fechaEjecucionInicio, project.fechaEjecucionFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Desmontaje:</span> ${formatDateRange(project.fechaDesmontajeInicio || "", project.fechaDesmontajeFin || "")}</div>
    </div>
    ${generatePersonalSection(project)}
  `;

  const html = generatePrintableHTML(content, {
    title: 'LISTADO DE PERSONAL',
    subtitle: project.evento,
    notes: includeNotes ? project.notas : undefined,
  });

  openPrintWindow(html);
};

// Generate Responsables del Inventario section
const generateResponsablesSection = (project: Project): string => {
  // Parse responsables from JSON fields (stored as arrays)
  let responsablesEntradasSalidas: Array<{tipo?: string; nombre?: string}> = [];
  let responsablesMaterialEvento: Array<{tipo?: string; nombre?: string}> = [];
  
  // Try to parse the stored data - it might be single object (legacy) or JSON array (new format)
  try {
    if (project.inventarioResponsableEntradasSalidasNombre) {
      const parsed = JSON.parse(project.inventarioResponsableEntradasSalidasNombre);
      if (Array.isArray(parsed)) {
        responsablesEntradasSalidas = parsed.map((item: { tipo?: string; nombre?: string }) => ({
          tipo: item.tipo,
          nombre: item.nombre
        }));
      }
    }
  } catch {
    // Legacy single value format
    if (project.inventarioResponsableEntradasSalidasNombre) {
      responsablesEntradasSalidas = [{
        tipo: project.inventarioResponsableEntradasSalidasTipo,
        nombre: project.inventarioResponsableEntradasSalidasNombre
      }];
    }
  }
  
  try {
    if (project.inventarioResponsableMaterialEventoNombre) {
      const parsed = JSON.parse(project.inventarioResponsableMaterialEventoNombre);
      if (Array.isArray(parsed)) {
        responsablesMaterialEvento = parsed.map((item: { tipo?: string; nombre?: string }) => ({
          tipo: item.tipo,
          nombre: item.nombre
        }));
      }
    }
  } catch {
    // Legacy single value format
    if (project.inventarioResponsableMaterialEventoNombre) {
      responsablesMaterialEvento = [{
        tipo: project.inventarioResponsableMaterialEventoTipo,
        nombre: project.inventarioResponsableMaterialEventoNombre
      }];
    }
  }

  const hasEntradasSalidas = responsablesEntradasSalidas.length > 0;
  const hasMaterialEvento = responsablesMaterialEvento.length > 0;

  if (!hasEntradasSalidas && !hasMaterialEvento) return '';

  const entradasRows = responsablesEntradasSalidas.map(r => `
    <tr>
      <td>Entradas y Salidas</td>
      <td><span class="badge badge-${r.tipo === 'empleado' ? 'bbm' : 'proveedor'}">${r.tipo === 'empleado' ? 'Empleado' : 'Proveedor'}</span></td>
      <td>${r.nombre || '-'}</td>
    </tr>
  `).join('');

  const materialRows = responsablesMaterialEvento.map(r => `
    <tr>
      <td>Material durante el Evento</td>
      <td><span class="badge badge-${r.tipo === 'empleado' ? 'bbm' : 'proveedor'}">${r.tipo === 'empleado' ? 'Empleado' : 'Proveedor'}</span></td>
      <td>${r.nombre || '-'}</td>
    </tr>
  `).join('');

  return `
    <h2 style="margin: 25px 0 10px; font-size: 14px;">Responsables del Inventario</h2>
    <table>
      <thead>
        <tr>
          <th>Responsabilidad</th>
          <th>Tipo</th>
          <th>Nombre</th>
        </tr>
      </thead>
      <tbody>
        ${entradasRows}
        ${materialRows}
      </tbody>
    </table>
  `;
};

// Generate Inventario section (internal use)
const generateInventarioSection = (project: Project): string => {
  const inventario = project.inventario || [];
  
  const tableRows = inventario.map(i => `
    <tr>
      <td>${i.nombreMaterial}</td>
      <td>${i.cantidad} ${i.unidad}</td>
      <td>${i.observaciones || '-'}</td>
      <td><span class="checkbox ${i.recibido ? 'checked' : ''}"></span></td>
      <td>${i.notasAdicionales || '-'}</td>
    </tr>
  `).join('');

  return `
    <h2 style="margin: 15px 0 10px; font-size: 14px;">Inventario (${inventario.length} items)</h2>
    <table>
      <thead>
        <tr>
          <th>Material</th>
          <th>Cantidad</th>
          <th>Observaciones</th>
          <th>Recibido</th>
          <th>Notas Adicionales</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="5" style="text-align: center;">No hay inventario registrado</td></tr>'}
      </tbody>
    </table>
    ${generateResponsablesSection(project)}
  `;
};

// Print Inventario section (standalone - kept for backward compatibility)
export const printInventario = (project: Project, includeNotes: boolean = true) => {
  const content = `
    <div class="info-section">
      <div class="info-row"><span class="info-label">Proyecto:</span> ${project.evento}</div>
      <div class="info-row"><span class="info-label">Cliente:</span> ${project.cliente}</div>
      <div class="info-row"><span class="info-label">Centro de Costos:</span> ${project.centroCostos}</div>
      <div class="info-row"><span class="info-label">Fecha Montaje:</span> ${formatDateRange(project.fechaMontajeInicio, project.fechaMontajeFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Ejecución:</span> ${formatDateRange(project.fechaEjecucionInicio, project.fechaEjecucionFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Desmontaje:</span> ${formatDateRange(project.fechaDesmontajeInicio || "", project.fechaDesmontajeFin || "")}</div>
    </div>
    ${generateInventarioSection(project)}
  `;

  const html = generatePrintableHTML(content, {
    title: 'LISTADO DE INVENTARIO',
    subtitle: project.evento,
    notes: includeNotes ? project.notas : undefined,
  });

  openPrintWindow(html);
};

// Generate attachments section for PDF
const generateAdjuntosSection = (project: Project): string => {
  const personalConAdjuntos = (project.personal || []).filter(
    p => (p.tipoPersonal === 'Proveedor' || p.tipoPersonal === 'Transporte') && p.adjuntos && p.adjuntos.length > 0
  );

  if (personalConAdjuntos.length === 0) return '';

  const rows = personalConAdjuntos.flatMap(p => 
    (p.adjuntos || []).map(adj => `
      <tr>
        <td>${p.nombre}</td>
        <td><span class="badge badge-${p.tipoPersonal.toLowerCase()}">${p.tipoPersonal}</span></td>
        <td>${adj.name}</td>
        <td>${adj.type}</td>
      </tr>
    `)
  ).join('');

  return `
    <h2 style="margin: 25px 0 10px; font-size: 14px;">Archivos Adjuntos</h2>
    <table>
      <thead>
        <tr>
          <th>Personal</th>
          <th>Tipo</th>
          <th>Archivo</th>
          <th>Formato</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

// Helper to format date range safely
const formatDateRange = (startDate: string, endDate: string): string => {
  if (!startDate || !endDate) return '-';
  try {
    return `${format(parseISO(startDate), "dd/MM/yyyy", { locale: es })} - ${format(parseISO(endDate), "dd/MM/yyyy", { locale: es })}`;
  } catch {
    return '-';
  }
};

// Print unified PDF with Personal + Inventario
export const printPersonalYInventario = (project: Project, includeNotes: boolean = true) => {
  const content = `
    <div class="info-section">
      <div class="info-row"><span class="info-label">Proyecto:</span> ${project.evento}</div>
      <div class="info-row"><span class="info-label">Cliente:</span> ${project.cliente}</div>
      <div class="info-row"><span class="info-label">Centro de Costos:</span> ${project.centroCostos}</div>
      <div class="info-row"><span class="info-label">Fecha Montaje:</span> ${formatDateRange(project.fechaMontajeInicio, project.fechaMontajeFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Ejecución:</span> ${formatDateRange(project.fechaEjecucionInicio, project.fechaEjecucionFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Desmontaje:</span> ${formatDateRange(project.fechaDesmontajeInicio || "", project.fechaDesmontajeFin || "")}</div>
    </div>
    ${generatePersonalSection(project)}
    <div style="margin-top: 30px;"></div>
    ${generateInventarioSection(project)}
    ${generateAdjuntosSection(project)}
  `;

  const html = generatePrintableHTML(content, {
    title: 'PERSONAL E INVENTARIO',
    subtitle: project.evento,
    notes: includeNotes ? project.notas : undefined,
  });

  openPrintWindow(html);
};

// Print Cotizaciones Proveedor section
export const printCotizaciones = (project: Project, includeNotes: boolean = true) => {
  const cotizaciones = project.cotizacionesProveedor || [];
  
  const tableRows = cotizaciones.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.type}</td>
      <td>${c.size ? (c.size / 1024).toFixed(2) + ' KB' : '-'}</td>
      <td>${format(parseISO(c.uploadedAt), "dd/MM/yyyy HH:mm", { locale: es })}</td>
    </tr>
  `).join('');

  const content = `
    <div class="info-section">
      <div class="info-row"><span class="info-label">Proyecto:</span> ${project.evento}</div>
      <div class="info-row"><span class="info-label">Cliente:</span> ${project.cliente}</div>
      <div class="info-row"><span class="info-label">Centro de Costos:</span> ${project.centroCostos}</div>
      <div class="info-row"><span class="info-label">Fecha Montaje:</span> ${formatDateRange(project.fechaMontajeInicio, project.fechaMontajeFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Ejecución:</span> ${formatDateRange(project.fechaEjecucionInicio, project.fechaEjecucionFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Desmontaje:</span> ${formatDateRange(project.fechaDesmontajeInicio || "", project.fechaDesmontajeFin || "")}</div>
    </div>
    <h2 style="margin: 15px 0 10px; font-size: 14px;">Cotizaciones de Proveedores (${cotizaciones.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Archivo</th>
          <th>Tipo</th>
          <th>Tamaño</th>
          <th>Fecha Subida</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="4" style="text-align: center;">No hay cotizaciones adjuntas</td></tr>'}
      </tbody>
    </table>
  `;

  const html = generatePrintableHTML(content, {
    title: 'COTIZACIONES DE PROVEEDORES',
    subtitle: project.evento,
    notes: includeNotes ? project.notas : undefined,
  });

  openPrintWindow(html);
};

// Employee type for resolving IDs to names with banking info
interface EmpleadoBasic {
  id: string;
  nombre: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  cedula?: string;
  cargo?: string;
}

// Helper to resolve employee ID to name
const getEmpleadoNombre = (empleadoId: string | undefined, empleados: EmpleadoBasic[]): string => {
  if (!empleadoId) return '-';
  const empleado = empleados.find(e => e.id === empleadoId);
  return empleado?.nombre || empleadoId;
};

// Helper to get employee banking info
const getEmpleadoBankingInfo = (empleadoId: string | undefined, empleados: EmpleadoBasic[]): { banco: string; tipoCuenta: string; numeroCuenta: string } => {
  if (!empleadoId) return { banco: '-', tipoCuenta: '-', numeroCuenta: '-' };
  const empleado = empleados.find(e => e.id === empleadoId);
  return {
    banco: empleado?.banco || '-',
    tipoCuenta: empleado?.tipoCuenta || '-',
    numeroCuenta: empleado?.numeroCuenta || '-'
  };
};

// Helper to get status badge class
const getEstadoBadgeClass = (estado: string | undefined): string => {
  if (!estado) return '';
  if (estado === 'Aprobado') return 'badge-aprobado';
  if (estado === 'No aprobado') return 'badge-no-aprobado';
  if (estado === 'Pendiente') return 'badge-pendiente';
  return '';
};

// Generate Solicitud de Presupuesto section with optional banking info
const generateSolicitudPresupuestoSection = (project: Project, empleados: EmpleadoBasic[], includeBankingInfo: boolean = false): string => {
  const cajaMenor = project.cajaMenor || [];
  
  const headers = includeBankingInfo 
    ? `<tr>
        <th>Empleado</th>
        <th>Banco</th>
        <th>Cuenta</th>
        <th># Cuenta</th>
        <th>Concepto</th>
        <th>Imágenes</th>
        <th>Valor</th>
        <th>Categoría</th>
        <th>Recursos</th>
        <th>Contingencia</th>
        <th>Estado</th>
      </tr>`
    : `<tr>
        <th>Empleado</th>
        <th>Concepto</th>
        <th>Imágenes</th>
        <th>Valor</th>
        <th>Categoría</th>
        <th>Recursos</th>
        <th>Contingencia</th>
        <th>Estado</th>
      </tr>`;
  
  const tableRows = cajaMenor.map(c => {
    const bankInfo = getEmpleadoBankingInfo(c.empleadoId, empleados);
    if (includeBankingInfo) {
      return `
        <tr>
          <td>${getEmpleadoNombre(c.empleadoId, empleados)}</td>
          <td>${bankInfo.banco}</td>
          <td>${bankInfo.tipoCuenta}</td>
          <td>${bankInfo.numeroCuenta}</td>
          <td>${c.concepto || '-'}</td>
          <td>${(c.imagenes || []).length} imagen(es)</td>
          <td>$${(c.valor || 0).toLocaleString('es-CO')}</td>
          <td>${c.categoria || '-'}</td>
          <td>${c.recursos || '-'}</td>
          <td>${c.contingencia || 'No'}</td>
          <td><span class="badge ${getEstadoBadgeClass(c.estado)}">${c.estado || '-'}</span></td>
        </tr>
      `;
    }
    return `
      <tr>
        <td>${getEmpleadoNombre(c.empleadoId, empleados)}</td>
        <td>${c.concepto || '-'}</td>
        <td>${(c.imagenes || []).length} imagen(es)</td>
        <td>$${(c.valor || 0).toLocaleString('es-CO')}</td>
        <td>${c.categoria || '-'}</td>
        <td>${c.recursos || '-'}</td>
        <td>${c.contingencia || 'No'}</td>
        <td><span class="badge ${getEstadoBadgeClass(c.estado)}">${c.estado || '-'}</span></td>
      </tr>
    `;
  }).join('');

  const colspan = includeBankingInfo ? 11 : 8;
  
  return `
    <h2 style="margin: 15px 0 10px; font-size: 14px;">SOLICITUD DE PRESUPUESTO (${cajaMenor.length} registros)</h2>
    <table>
      <thead>
        ${headers}
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="${colspan}" style="text-align: center;">No hay registros</td></tr>`}
      </tbody>
    </table>
  `;
};

// Generate Legalizacion section using actual data from project
const generateLegalizacionSection = (project: Project, empleados: EmpleadoBasic[], includeBankingInfo: boolean = false): string => {
  // Combine synced legalization (from cajaMenor approved) and manual entries
  const cajaMenor = project.cajaMenor || [];
  const manualLegalizacion = ((project.legalizacion as any[]) || []).filter(l => !l.id.startsWith('leg-'));
  
  // Build synced legalization from cajaMenor (with leg- prefix conceptually)
  const syncedLegalizacion = cajaMenor.map(cm => {
    // Find corresponding legalization entry if exists
    const legEntry = ((project.legalizacion as any[]) || []).find(l => l.id === `leg-${cm.id}`);
    return {
      empleadoId: cm.empleadoId,
      concepto: cm.concepto,
      notaAdicional: legEntry?.notaAdicional || '',
      imagenes: legEntry?.imagenes || [],
      valor: legEntry?.valor || 0,
      categoria: cm.categoria,
      recursos: cm.recursos,
      contingencia: legEntry?.contingencia || cm.contingencia,
      estado: legEntry?.estado || 'Pendiente'
    };
  });
  
  const allLegalizacion = [...syncedLegalizacion, ...manualLegalizacion];
  
  if (allLegalizacion.length === 0) {
    return `
      <h2 style="margin: 25px 0 10px; font-size: 14px;">LEGALIZACIÓN (0 registros)</h2>
      <table>
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Concepto</th>
            <th>Imágenes</th>
            <th>Valor</th>
            <th>Categoría</th>
            <th>Recursos</th>
            <th>Contingencia</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="8" style="text-align: center;">No hay registros de legalización</td></tr>
        </tbody>
      </table>
    `;
  }
  
  const headers = includeBankingInfo 
    ? `<tr>
        <th>Empleado</th>
        <th>Banco</th>
        <th>Cuenta</th>
        <th># Cuenta</th>
        <th>Concepto</th>
        <th>Imágenes</th>
        <th>Valor</th>
        <th>Categoría</th>
        <th>Recursos</th>
        <th>Contingencia</th>
        <th>Estado</th>
      </tr>`
    : `<tr>
        <th>Empleado</th>
        <th>Concepto</th>
        <th>Imágenes</th>
        <th>Valor</th>
        <th>Categoría</th>
        <th>Recursos</th>
        <th>Contingencia</th>
        <th>Estado</th>
      </tr>`;
  
  const tableRows = allLegalizacion.map(l => {
    const bankInfo = getEmpleadoBankingInfo(l.empleadoId, empleados);
    const conceptoDisplay = l.notaAdicional 
      ? `${l.concepto || '-'}<br><small style="color:#666;">+ ${l.notaAdicional}</small>`
      : (l.concepto || '-');
      
    if (includeBankingInfo) {
      return `
        <tr>
          <td>${getEmpleadoNombre(l.empleadoId, empleados)}</td>
          <td>${bankInfo.banco}</td>
          <td>${bankInfo.tipoCuenta}</td>
          <td>${bankInfo.numeroCuenta}</td>
          <td>${conceptoDisplay}</td>
          <td>${(l.imagenes || []).length} imagen(es)</td>
          <td>$${(l.valor || 0).toLocaleString('es-CO')}</td>
          <td>${l.categoria || '-'}</td>
          <td>${l.recursos || '-'}</td>
          <td>${l.contingencia || 'No'}</td>
          <td><span class="badge ${getEstadoBadgeClass(l.estado)}">${l.estado || '-'}</span></td>
        </tr>
      `;
    }
    return `
      <tr>
        <td>${getEmpleadoNombre(l.empleadoId, empleados)}</td>
        <td>${conceptoDisplay}</td>
        <td>${(l.imagenes || []).length} imagen(es)</td>
        <td>$${(l.valor || 0).toLocaleString('es-CO')}</td>
        <td>${l.categoria || '-'}</td>
        <td>${l.recursos || '-'}</td>
        <td>${l.contingencia || 'No'}</td>
        <td><span class="badge ${getEstadoBadgeClass(l.estado)}">${l.estado || '-'}</span></td>
      </tr>
    `;
  }).join('');

  const colspan = includeBankingInfo ? 11 : 8;

  return `
    <h2 style="margin: 25px 0 10px; font-size: 14px;">LEGALIZACIÓN (${allLegalizacion.length} registros)</h2>
    <table>
      <thead>
        ${headers}
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="${colspan}" style="text-align: center;">No hay registros</td></tr>`}
      </tbody>
    </table>
  `;
};

// Generate employee banking info section for the first solicitor
const generateSolicitanteBankingSection = (project: Project, empleados: EmpleadoBasic[]): string => {
  const cajaMenor = project.cajaMenor || [];
  if (cajaMenor.length === 0) return '';
  
  // Get the first employee who made a solicitud de presupuesto
  const firstSolicitud = cajaMenor[0];
  if (!firstSolicitud?.empleadoId) return '';
  
  const bankInfo = getEmpleadoBankingInfo(firstSolicitud.empleadoId, empleados);
  const empleadoNombre = getEmpleadoNombre(firstSolicitud.empleadoId, empleados);
  
  // Only show if there's actual banking info
  if (bankInfo.banco === '-' && bankInfo.tipoCuenta === '-' && bankInfo.numeroCuenta === '-') return '';
  
  return `
    <div class="info-section" style="margin-top: 15px; background: #e8f4e8;">
      <h3 style="margin-bottom: 8px; font-size: 13px; color: #16a34a;">DATOS BANCARIOS DEL SOLICITANTE</h3>
      <div class="info-row"><span class="info-label">Solicitante:</span> ${empleadoNombre}</div>
      <div class="info-row"><span class="info-label">Banco:</span> ${bankInfo.banco}</div>
      <div class="info-row"><span class="info-label">Tipo de Cuenta:</span> ${bankInfo.tipoCuenta}</div>
      <div class="info-row"><span class="info-label"># Cuenta:</span> ${bankInfo.numeroCuenta}</div>
    </div>
  `;
};

// Generate info section for exports
const generateProjectInfoSection = (project: Project, empleados: EmpleadoBasic[] = []): string => {
  return `
    <div class="info-section">
      <div class="info-row"><span class="info-label">Evento:</span> ${project.evento}</div>
      <div class="info-row"><span class="info-label">Cliente:</span> ${project.cliente}</div>
      <div class="info-row"><span class="info-label">Centro de Costos:</span> ${project.centroCostos}</div>
      <div class="info-row"><span class="info-label">Fecha Montaje:</span> ${formatDateRange(project.fechaMontajeInicio, project.fechaMontajeFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Ejecución:</span> ${formatDateRange(project.fechaEjecucionInicio, project.fechaEjecucionFin)}</div>
      <div class="info-row"><span class="info-label">Fecha Desmontaje:</span> ${formatDateRange(project.fechaDesmontajeInicio || "", project.fechaDesmontajeFin || "")}</div>
      <div class="info-row"><span class="info-label">Jefe de Operaciones:</span> ${project.jefeOperaciones || '-'}</div>
      <div class="info-row"><span class="info-label">Ubicación:</span> ${project.ubicacion || '-'}</div>
      <div class="info-row"><span class="info-label">Estado del evento:</span> ${project.estado}</div>
    </div>
    ${generateSolicitanteBankingSection(project, empleados)}
  `;
};

// Helper to get employee full info for solicitud
const getEmpleadoFullInfo = (empleadoId: string | undefined, empleados: EmpleadoBasic[]) => {
  if (!empleadoId) return { nombre: '-', cedula: '-', cargo: '-', banco: '-', tipoCuenta: '-', numeroCuenta: '-' };
  const e = empleados.find(emp => emp.id === empleadoId);
  return {
    nombre: e?.nombre || '-',
    cedula: e?.cedula || '-',
    cargo: e?.cargo || '-',
    banco: e?.banco || '-',
    tipoCuenta: e?.tipoCuenta || '-',
    numeroCuenta: e?.numeroCuenta || '-',
  };
};

// Generate corporate FIN-F-002 format HTML
const generateCorporateFormatoHTML = (
  project: Project,
  empleados: EmpleadoBasic[],
  solicitudAnticipoNum?: number,
  includeLegalizacion: boolean = false
): string => {
  const cajaMenor = project.cajaMenor || [];
  const firstItem = cajaMenor[0];
  const solicitante = getEmpleadoFullInfo(firstItem?.empleadoId, empleados);
  const totalValor = cajaMenor.reduce((sum, c) => sum + (c.valor || 0), 0);
  const fechaHoy = format(new Date(), "dd/MM/yyyy", { locale: es });
  
  // Build expense rows (RELACION DE GASTOS)
  const expenseRows = cajaMenor.map(c => {
    const emp = getEmpleadoFullInfo(c.empleadoId, empleados);
    return `
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;font-size:10px;">${emp.nombre}</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:10px;">${emp.cedula}</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:10px;">${c.concepto || '-'}</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:right;">$ ${(c.valor || 0).toLocaleString('es-CO')}</td>
      </tr>`;
  }).join('');

  // Empty rows to fill table (minimum 12 rows like the original format)
  const emptyRowsCount = Math.max(0, 12 - cajaMenor.length);
  const emptyRows = Array(emptyRowsCount).fill(0).map(() => `
    <tr>
      <td style="border:1px solid #000;padding:4px 6px;height:20px;">&nbsp;</td>
      <td style="border:1px solid #000;padding:4px 6px;">&nbsp;</td>
      <td style="border:1px solid #000;padding:4px 6px;">&nbsp;</td>
      <td style="border:1px solid #000;padding:4px 6px;">&nbsp;</td>
    </tr>`).join('');

  // Legalization section if included
  let legalizacionHTML = '';
  if (includeLegalizacion) {
    const manualLeg = ((project.legalizacion as any[]) || []).filter(l => !l.id.startsWith('leg-'));
    const syncedLeg = cajaMenor.map(cm => {
      const legEntry = ((project.legalizacion as any[]) || []).find(l => l.id === `leg-${cm.id}`);
      return {
        empleadoId: cm.empleadoId,
        concepto: cm.concepto + (legEntry?.notaAdicional ? ` + ${legEntry.notaAdicional}` : ''),
        imagenes: legEntry?.imagenes || [],
        valor: legEntry?.valor || 0,
        categoria: cm.categoria,
        recursos: cm.recursos,
        contingencia: legEntry?.contingencia || cm.contingencia,
        estado: legEntry?.estado || 'Pendiente'
      };
    });
    const allLeg = [...syncedLeg, ...manualLeg];
    const legTotal = allLeg.reduce((sum, l) => sum + (l.valor || 0), 0);
    const diferencia = totalValor - legTotal;

    const legRows = allLeg.map(l => {
      const emp = getEmpleadoFullInfo(l.empleadoId, empleados);
      return `
        <tr>
          <td style="border:1px solid #000;padding:4px 6px;font-size:10px;">${emp.nombre}</td>
          <td style="border:1px solid #000;padding:4px 6px;font-size:10px;">${emp.cedula}</td>
          <td style="border:1px solid #000;padding:4px 6px;font-size:10px;">${l.concepto || '-'}</td>
          <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:right;">$ ${(l.valor || 0).toLocaleString('es-CO')}</td>
        </tr>`;
    }).join('');

    legalizacionHTML = `
      <div style="page-break-before:always;margin-top:30px;">
        <h3 style="font-size:12px;font-weight:bold;margin:15px 0 8px;border-bottom:2px solid #000;padding-bottom:4px;">LEGALIZACIÓN</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#e5e7eb;">
              <th style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:left;width:25%;">NOMBRE DE TERCEROS</th>
              <th style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:left;width:15%;">NIT/CEDULA</th>
              <th style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:left;width:40%;">CONCEPTO</th>
              <th style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:right;width:20%;">VALOR</th>
            </tr>
          </thead>
          <tbody>
            ${legRows}
          </tbody>
          <tfoot>
            <tr style="font-weight:bold;background:#f3f4f6;">
              <td colspan="3" style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:right;">TOTAL LEGALIZADO</td>
              <td style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:right;">$ ${legTotal.toLocaleString('es-CO')}</td>
            </tr>
            <tr style="font-weight:bold;">
              <td colspan="3" style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:right;">DIFERENCIA</td>
              <td style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:right;color:${diferencia > 0 ? '#dc2626' : '#16a34a'};">$ ${diferencia < 0 ? `(${Math.abs(diferencia).toLocaleString('es-CO')})` : diferencia.toLocaleString('es-CO')}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SOLICITUD DE ANTICIPO${solicitudAnticipoNum ? ` No. ${solicitudAnticipoNum}` : ''} - ${project.evento}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; padding-top: 80px; }
        .mobile-action-bar {
          position: fixed; top: 0; left: 0; right: 0;
          background: #1a1a2e; color: white;
          padding: 12px 16px; padding-top: calc(12px + env(safe-area-inset-top, 0px));
          display: flex; justify-content: space-between; align-items: center;
          z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.3); gap: 8px;
        }
        .mobile-action-bar button {
          background: #f97316; color: white; border: none;
          padding: 12px 16px; border-radius: 8px; font-size: 14px;
          font-weight: 600; cursor: pointer; display: flex;
          align-items: center; gap: 6px; min-height: 44px;
          -webkit-tap-highlight-color: transparent;
        }
        .mobile-action-bar button:active { background: #ea580c; transform: scale(0.98); }
        .mobile-action-bar .back-btn { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); }
        .mobile-action-bar .back-btn:active { background: rgba(255,255,255,0.25); }
        .mobile-action-bar .title { font-size: 13px; font-weight: 600; flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; }
        @media print {
          body { padding: 15px; padding-top: 15px; }
          .mobile-action-bar { display: none !important; }
          @page { margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="mobile-action-bar"> 
        <button class="back-btn" onclick="goBack()">← Volver</button>
        <span class="title">Solicitud de Anticipo${solicitudAnticipoNum ? ` No. ${solicitudAnticipoNum}` : ''}</span>
        <button onclick="window.print()">📄 PDF</button>
        <button onclick="saveAsImage()">📷 Foto</button>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
      <script>
        function goBack() { if (window.opener) { window.close(); } else if (history.length > 1) { history.back(); } else { window.location.href = window.location.origin; } }
        function saveAsImage() {
          var ab = document.querySelector('.mobile-action-bar'); ab.style.display = 'none';
          html2canvas(document.body, { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: -window.scrollY, windowHeight: document.body.scrollHeight }).then(function(c) {
            ab.style.display = 'flex';
            c.toBlob(function(b) { var u = URL.createObjectURL(b); var a = document.createElement('a'); a.download = 'solicitud_anticipo_${(project.evento || '').replace(/[^a-zA-Z0-9]/g, '_')}_' + new Date().toISOString().split('T')[0] + '.png'; a.href = u; a.click(); URL.revokeObjectURL(u); }, 'image/png');
          }).catch(function(e) { ab.style.display = 'flex'; alert('Error: ' + e.message); });
        }
      </script>

      <!-- HEADER CORPORATIVO -->
      <table style="width:100%;border-collapse:collapse;border:2px solid #000;margin-bottom:0;">
        <tr>
          <td rowspan="3" style="border:1px solid #000;padding:10px;width:30%;vertical-align:middle;">
            <div style="font-weight:bold;font-size:14px;">BBM Producciones S.A.S.</div>
            <div style="font-size:9px;color:#444;margin-top:4px;">Carrera 74 # 48 19</div>
            <div style="font-size:9px;color:#444;">Celular: 3142777773</div>
            <div style="font-size:9px;color:#444;">Bogotá, D.C. Colombia</div>
            <div style="font-size:9px;color:#444;">NIT 901.577.285-7</div>
          </td>
          <td rowspan="3" style="border:1px solid #000;padding:10px;text-align:center;vertical-align:middle;width:40%;">
            <div style="font-size:16px;font-weight:bold;">SOLICITUD DE ANTICIPO</div>
          </td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:9px;font-weight:bold;width:15%;">CÓDIGO</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:9px;width:15%;">FIN-F-002</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:4px 8px;font-size:9px;font-weight:bold;">VERSIÓN</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:9px;">1</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:4px 8px;font-size:9px;font-weight:bold;">FECHA ELABORACIÓN</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:9px;">${fechaHoy}</td>
        </tr>
      </table>

      <!-- TIPO: ADMON / OPERATIVO -->
      <table style="width:100%;border-collapse:collapse;border-left:2px solid #000;border-right:2px solid #000;">
        <tr>
          <td style="border:1px solid #000;padding:5px 10px;width:50%;"></td>
          <td style="border:1px solid #000;padding:5px 10px;font-size:10px;font-weight:bold;width:15%;">ADMON</td>
          <td style="border:1px solid #000;padding:5px 10px;width:10%;text-align:center;"></td>
          <td style="border:1px solid #000;padding:5px 10px;font-size:10px;font-weight:bold;width:15%;">OPERATIVO</td>
          <td style="border:1px solid #000;padding:5px 10px;width:10%;text-align:center;font-weight:bold;">X</td>
        </tr>
      </table>

      <!-- SOLICITUD DE ANTICIPO No. -->
      <table style="width:100%;border-collapse:collapse;border-left:2px solid #000;border-right:2px solid #000;">
        <tr>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;font-weight:bold;width:70%;">SOLICITUD DE ANTICIPO No.</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:14px;font-weight:bold;text-align:center;width:30%;color:#1d4ed8;">${solicitudAnticipoNum || ''}</td>
        </tr>
      </table>

      <!-- TITULO SOLICITUD DE ANTICIPO -->
      <table style="width:100%;border-collapse:collapse;border-left:2px solid #000;border-right:2px solid #000;">
        <tr>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;font-weight:bold;background:#f3f4f6;text-align:center;">SOLICITUD DE ANTICIPO</td>
        </tr>
      </table>

      <!-- DATOS DEL SOLICITANTE -->
      <table style="width:100%;border-collapse:collapse;border-left:2px solid #000;border-right:2px solid #000;">
        <tr>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;width:18%;">SOLICITADO POR</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;width:32%;">${solicitante.nombre}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;width:18%;">CIUDAD</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;width:32%;">BOGOTÁ</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;">CÉDULA</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;">${solicitante.cedula}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;">EVENTO</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;">${project.evento || '-'}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;">CARGO</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;">${solicitante.cargo}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;">CENTRO DE COSTO</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;">${project.centroCostos || '-'}</td>
        </tr>
      </table>

      <!-- VALOR Y DATOS BANCARIOS -->
      <table style="width:100%;border-collapse:collapse;border-left:2px solid #000;border-right:2px solid #000;">
        <tr>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;width:18%;">VALOR SOLICITADO</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;width:18%;">$ ${totalValor.toLocaleString('es-CO')}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;width:10%;">BANCO:</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;width:22%;">${solicitante.banco}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;width:12%;">No CUENTA</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;width:20%;">${solicitante.numeroCuenta}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;">FECHA SOLICITUD</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;">${fechaHoy}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;">TIPO</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;">${solicitante.tipoCuenta === 'Ahorros' ? 'AH' : solicitante.tipoCuenta === 'Corriente' ? 'CTE' : solicitante.tipoCuenta}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;" colspan="2"></td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;font-weight:bold;">FECHA A LEGALIZAR</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;"></td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:10px;" colspan="4"></td>
        </tr>
      </table>

      <!-- RELACION DE GASTOS -->
      <table style="width:100%;border-collapse:collapse;border-left:2px solid #000;border-right:2px solid #000;margin-top:0;">
        <tr>
          <td colspan="4" style="border:1px solid #000;padding:6px 8px;font-size:11px;font-weight:bold;background:#f3f4f6;">RELACIÓN DE GASTOS</td>
        </tr>
        <tr style="background:#e5e7eb;">
          <th style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:left;width:25%;">NOMBRE DE TERCEROS</th>
          <th style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:left;width:15%;">NIT/CÉDULA</th>
          <th style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:left;width:40%;">CONCEPTO</th>
          <th style="border:1px solid #000;padding:5px 6px;font-size:10px;text-align:right;width:20%;">VALOR</th>
        </tr>
        ${expenseRows}
        ${emptyRows}
        <tr style="font-weight:bold;background:#f3f4f6;">
          <td colspan="3" style="border:1px solid #000;padding:5px 8px;font-size:10px;text-align:right;">TOTAL</td>
          <td style="border:1px solid #000;padding:5px 8px;font-size:10px;text-align:right;">$ ${totalValor.toLocaleString('es-CO')}</td>
        </tr>
        <tr style="font-weight:bold;">
          <td colspan="3" style="border:1px solid #000;padding:5px 8px;font-size:10px;text-align:right;">DIFERENCIA</td>
          <td style="border:1px solid #000;padding:5px 8px;font-size:10px;text-align:right;">$ (${totalValor.toLocaleString('es-CO')})</td>
        </tr>
      </table>

      <!-- OBSERVACIONES -->
      <table style="width:100%;border-collapse:collapse;border-left:2px solid #000;border-right:2px solid #000;">
        <tr>
          <td style="border:1px solid #000;padding:5px 8px;font-size:10px;font-weight:bold;">OBSERVACIONES:</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:8px;font-size:10px;min-height:40px;">${project.notas || '&nbsp;'}</td>
        </tr>
      </table>

      <!-- TESORERIA -->
      <table style="width:100%;border-collapse:collapse;border-left:2px solid #000;border-right:2px solid #000;">
        <tr>
          <td style="border:1px solid #000;padding:5px 8px;font-size:10px;font-weight:bold;width:50%;">TESORERÍA</td>
          <td style="border:1px solid #000;padding:5px 8px;font-size:10px;width:50%;"></td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:5px 8px;font-size:10px;font-weight:bold;">FECHA DE PAGO</td>
          <td style="border:1px solid #000;padding:5px 8px;font-size:10px;"></td>
        </tr>
      </table>

      <!-- NOTA ACLARATORIA -->
      <table style="width:100%;border-collapse:collapse;border:2px solid #000;">
        <tr>
          <td style="border:1px solid #000;padding:5px 8px;font-size:10px;font-weight:bold;">NOTA ACLARATORIA</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:6px 8px;font-size:9px;line-height:1.4;">
            COMO SOLICITANTE DEL PRESENTE ANTICIPO, MANIFIESTO QUE CONOZCO EL REGLAMENTO QUE RIGE PARA LOS ANTICIPOS Y POR CONSIGUIENTE AUTORIZO A LA COMPAÑÍA PARA QUE EN CASO DE NO HACER LAS LEGALIZACIONES DENTRO DEL PLAZO ESTIPULADO (5 DÍAS HÁBILES) LAS DIFERENCIAS SEAN DESCONTADAS DE LOS PAGOS QUE ME CORRESPONDAN
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:5px 8px;">
            <table style="width:100%;border:none;">
              <tr>
                <td style="border:none;width:50%;"></td>
                <td style="border:none;font-size:10px;font-weight:bold;width:20%;">ANTICIPOS VENCIDOS</td>
                <td style="border:none;width:30%;"></td>
              </tr>
              <tr>
                <td style="border:none;"></td>
                <td style="border:none;font-size:10px;">SI &nbsp;&nbsp;☐ &nbsp;&nbsp;&nbsp; NO &nbsp;&nbsp;☐</td>
                <td style="border:none;"></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- FIRMAS -->
      <table style="width:100%;border-collapse:collapse;border:2px solid #000;margin-top:0;">
        <tr>
          <td style="border:1px solid #000;padding:30px 8px 8px;font-size:10px;text-align:center;width:33%;">
            <div style="border-top:1px solid #000;display:inline-block;padding-top:4px;min-width:150px;">${solicitante.nombre}</div>
            <div style="font-weight:bold;font-size:9px;margin-top:2px;">SOLICITANTE</div>
          </td>
          <td style="border:1px solid #000;padding:30px 8px 8px;font-size:10px;text-align:center;width:34%;">
            <div style="border-top:1px solid #000;display:inline-block;padding-top:4px;min-width:150px;">&nbsp;</div>
            <div style="font-weight:bold;font-size:9px;margin-top:2px;">APROBADO</div>
          </td>
          <td style="border:1px solid #000;padding:30px 8px 8px;font-size:10px;text-align:center;width:33%;">
            <div style="border-top:1px solid #000;display:inline-block;padding-top:4px;min-width:150px;">&nbsp;</div>
            <div style="font-weight:bold;font-size:9px;margin-top:2px;">TESORERÍA</div>
          </td>
        </tr>
      </table>

      ${legalizacionHTML}

      <div style="margin-top:20px;text-align:center;font-size:8px;color:#999;">
        PRODUCCIÓN DE EVENTOS - Sistema de Gestión | Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
      </div>
    </body>
    </html>
  `;
};

// Print ONLY Solicitud de Presupuesto (Corporate Format FIN-F-002)
export const printSolicitudPresupuesto = (project: Project, empleados: EmpleadoBasic[] = [], includeLegalizacion: boolean = false, solicitudAnticipoNum?: number) => {
  const html = generateCorporateFormatoHTML(project, empleados, solicitudAnticipoNum, includeLegalizacion);
  openPrintWindow(html);
};

// Print ONLY Legalizacion
export const printLegalizacion = (project: Project, empleados: EmpleadoBasic[] = [], includeSolicitud: boolean = false) => {
  let content = generateProjectInfoSection(project, empleados);
  
  if (includeSolicitud) {
    content += generateSolicitudPresupuestoSection(project, empleados, true);
  }
  
  content += generateLegalizacionSection(project, empleados, true); // Include banking info

  const html = generatePrintableHTML(content, {
    title: includeSolicitud ? 'LEGALIZACIÓN + SOLICITUD DE PRESUPUESTO' : 'LEGALIZACIÓN',
    subtitle: project.evento,
  });

  openPrintWindow(html);
};

// Legacy: Print Gastos PDF (Solicitud de Presupuesto + Legalización) - kept for backward compatibility
export const printCajaMenor = (project: Project, empleados: EmpleadoBasic[] = []) => {
  const content = `
    ${generateProjectInfoSection(project, empleados)}
    ${generateSolicitudPresupuestoSection(project, empleados, true)}
    ${generateLegalizacionSection(project, empleados, true)}
  `;

  const html = generatePrintableHTML(content, {
    title: 'GASTOS',
    subtitle: project.evento,
  });

  openPrintWindow(html);
};

// Export ONLY Solicitud de Presupuesto to Excel
export const exportSolicitudToExcel = async (project: Project, empleados: EmpleadoBasic[] = [], includeLegalizacion: boolean = false, solicitudAnticipoNum?: number) => {
  const XLSX = await import('xlsx');
  const cajaMenor = project.cajaMenor || [];
  
  // Data rows with resolved employee names and banking info
  const solicitudData = cajaMenor.map(c => {
    const bankInfo = getEmpleadoBankingInfo(c.empleadoId, empleados);
    return {
      'Empleado': getEmpleadoNombre(c.empleadoId, empleados),
      'Banco': bankInfo.banco,
      'Tipo Cuenta': bankInfo.tipoCuenta,
      '# Cuenta': bankInfo.numeroCuenta,
      'Concepto': c.concepto || '',
      'Imágenes': `${(c.imagenes || []).length} imagen(es)`,
      'Valor': c.valor || 0,
      'Categoría': c.categoria || '',
      'Recursos': c.recursos || '',
      'Contingencia': c.contingencia || 'No',
      'Estado': c.estado || ''
    };
  });
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  
  // Solicitud sheet
  const solicitudHeaders = ['Empleado', 'Banco', 'Tipo Cuenta', '# Cuenta', 'Concepto', 'Imágenes', 'Valor', 'Categoría', 'Recursos', 'Contingencia', 'Estado'];
  const solicitudSheet = XLSX.utils.json_to_sheet(solicitudData, { header: solicitudHeaders });
  solicitudSheet['!cols'] = [
    { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 15 }
  ];
  const sheetName = solicitudAnticipoNum ? `Solicitud Anticipo No.${solicitudAnticipoNum}` : 'Solicitud Presupuesto';
  XLSX.utils.book_append_sheet(workbook, solicitudSheet, sheetName);
  
  if (includeLegalizacion) {
    // Build legalization data
    const manualLeg = ((project.legalizacion as any[]) || []).filter(l => !l.id.startsWith('leg-'));
    const syncedLeg = cajaMenor.map(cm => {
      const legEntry = ((project.legalizacion as any[]) || []).find(l => l.id === `leg-${cm.id}`);
      return {
        empleadoId: cm.empleadoId,
        concepto: cm.concepto + (legEntry?.notaAdicional ? ` + ${legEntry.notaAdicional}` : ''),
        imagenes: legEntry?.imagenes || [],
        valor: legEntry?.valor || 0,
        categoria: cm.categoria,
        recursos: cm.recursos,
        contingencia: legEntry?.contingencia || cm.contingencia,
        estado: legEntry?.estado || 'Pendiente'
      };
    });
    
    const allLeg = [...syncedLeg, ...manualLeg];
    const legData = allLeg.map(l => {
      const bankInfo = getEmpleadoBankingInfo(l.empleadoId, empleados);
      return {
        'Empleado': getEmpleadoNombre(l.empleadoId, empleados),
        'Banco': bankInfo.banco,
        'Tipo Cuenta': bankInfo.tipoCuenta,
        '# Cuenta': bankInfo.numeroCuenta,
        'Concepto': l.concepto || '',
        'Imágenes': `${(l.imagenes || []).length} imagen(es)`,
        'Valor': l.valor || 0,
        'Categoría': l.categoria || '',
        'Recursos': l.recursos || '',
        'Contingencia': l.contingencia || 'No',
        'Estado': l.estado || ''
      };
    });
    
    const legSheet = XLSX.utils.json_to_sheet(legData, { header: solicitudHeaders });
    legSheet['!cols'] = solicitudSheet['!cols'];
    XLSX.utils.book_append_sheet(workbook, legSheet, 'Legalización');
  }
  
  // Generate and download file
  const numSuffix = solicitudAnticipoNum ? `_No${solicitudAnticipoNum}` : '';
  const fileName = `solicitud_anticipo${numSuffix}_${project.evento.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

// Export ONLY Legalizacion to Excel
export const exportLegalizacionToExcel = async (project: Project, empleados: EmpleadoBasic[] = [], includeSolicitud: boolean = false) => {
  const XLSX = await import('xlsx');
  const cajaMenor = project.cajaMenor || [];
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  const headers = ['Empleado', 'Banco', 'Tipo Cuenta', '# Cuenta', 'Concepto', 'Imágenes', 'Valor', 'Categoría', 'Recursos', 'Contingencia', 'Estado'];
  const colWidths = [
    { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 15 }
  ];
  
  if (includeSolicitud) {
    const solicitudData = cajaMenor.map(c => {
      const bankInfo = getEmpleadoBankingInfo(c.empleadoId, empleados);
      return {
        'Empleado': getEmpleadoNombre(c.empleadoId, empleados),
        'Banco': bankInfo.banco,
        'Tipo Cuenta': bankInfo.tipoCuenta,
        '# Cuenta': bankInfo.numeroCuenta,
        'Concepto': c.concepto || '',
        'Imágenes': `${(c.imagenes || []).length} imagen(es)`,
        'Valor': c.valor || 0,
        'Categoría': c.categoria || '',
        'Recursos': c.recursos || '',
        'Contingencia': c.contingencia || 'No',
        'Estado': c.estado || ''
      };
    });
    const solicitudSheet = XLSX.utils.json_to_sheet(solicitudData, { header: headers });
    solicitudSheet['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(workbook, solicitudSheet, 'Solicitud Presupuesto');
  }
  
  // Build legalization data
  const manualLeg = ((project.legalizacion as any[]) || []).filter(l => !l.id.startsWith('leg-'));
  const syncedLeg = cajaMenor.map(cm => {
    const legEntry = ((project.legalizacion as any[]) || []).find(l => l.id === `leg-${cm.id}`);
    return {
      empleadoId: cm.empleadoId,
      concepto: cm.concepto + (legEntry?.notaAdicional ? ` + ${legEntry.notaAdicional}` : ''),
      imagenes: legEntry?.imagenes || [],
      valor: legEntry?.valor || 0,
      categoria: cm.categoria,
      recursos: cm.recursos,
      contingencia: legEntry?.contingencia || cm.contingencia,
      estado: legEntry?.estado || 'Pendiente'
    };
  });
  
  const allLeg = [...syncedLeg, ...manualLeg];
  const legData = allLeg.map(l => {
    const bankInfo = getEmpleadoBankingInfo(l.empleadoId, empleados);
    return {
      'Empleado': getEmpleadoNombre(l.empleadoId, empleados),
      'Banco': bankInfo.banco,
      'Tipo Cuenta': bankInfo.tipoCuenta,
      '# Cuenta': bankInfo.numeroCuenta,
      'Concepto': l.concepto || '',
      'Imágenes': `${(l.imagenes || []).length} imagen(es)`,
      'Valor': l.valor || 0,
      'Categoría': l.categoria || '',
      'Recursos': l.recursos || '',
      'Contingencia': l.contingencia || 'No',
      'Estado': l.estado || ''
    };
  });
  
  const legSheet = XLSX.utils.json_to_sheet(legData, { header: headers });
  legSheet['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(workbook, legSheet, 'Legalización');
  
  // Generate and download file
  const fileName = `legalizacion_${project.evento.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

// Legacy: Export Caja Menor to Excel (real .xlsx file) - kept for backward compatibility
export const exportCajaMenorToExcel = async (project: Project, empleados: EmpleadoBasic[] = []) => {
  const XLSX = await import('xlsx');
  const cajaMenor = project.cajaMenor || [];
  
  // Header row
  const headers = ['Empleado', 'Banco', 'Tipo Cuenta', '# Cuenta', 'Concepto', 'Imágenes', 'Valor', 'Categoría', 'Recursos', 'Contingencia', 'Estado'];
  
  // Data rows with resolved employee names and banking info
  const data = cajaMenor.map(c => {
    const bankInfo = getEmpleadoBankingInfo(c.empleadoId, empleados);
    return {
      'Empleado': getEmpleadoNombre(c.empleadoId, empleados),
      'Banco': bankInfo.banco,
      'Tipo Cuenta': bankInfo.tipoCuenta,
      '# Cuenta': bankInfo.numeroCuenta,
      'Concepto': c.concepto || '',
      'Imágenes': `${(c.imagenes || []).length} imagen(es)`,
      'Valor': c.valor || 0,
      'Categoría': c.categoria || '',
      'Recursos': c.recursos || '',
      'Contingencia': c.contingencia || 'No',
      'Estado': c.estado || ''
    };
  });
  
  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 15 }
  ];
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Caja Menor');
  
  // Generate and download file
  const fileName = `caja_menor_${project.evento.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

// Open print window - on mobile, don't auto-trigger print (let user use buttons)
const openPrintWindow = (html: string) => {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Only auto-trigger print on desktop (screen width > 768px)
    // On mobile, user will use the action bar buttons
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }
};