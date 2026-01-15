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
        
        /* Mobile action bar */
        .mobile-action-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #1a1a2e;
          color: white;
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 9999;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .mobile-action-bar button {
          background: #f97316;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .mobile-action-bar button:active {
          background: #ea580c;
        }
        .mobile-action-bar .back-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.3);
        }
        .mobile-action-bar .title {
          font-size: 14px;
          font-weight: 600;
          flex: 1;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 0 8px;
        }
        
        @media print {
          body { padding: 20px; padding-top: 20px; }
          .no-print, .mobile-action-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="mobile-action-bar no-print">
        <button class="back-btn" onclick="window.close()">
          ← Volver
        </button>
        <span class="title">${options.title}</span>
        <button onclick="window.print()">
          🖨️ Imprimir
        </button>
      </div>
      
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
      <div class="info-row"><span class="info-label">Fecha Ejecución:</span> ${format(parseISO(project.fechaEjecucionInicio), "dd/MM/yyyy", { locale: es })} - ${format(parseISO(project.fechaEjecucionFin), "dd/MM/yyyy", { locale: es })}</div>
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
  `;
};

// Print Inventario section (standalone - kept for backward compatibility)
export const printInventario = (project: Project, includeNotes: boolean = true) => {
  const content = `
    <div class="info-section">
      <div class="info-row"><span class="info-label">Proyecto:</span> ${project.evento}</div>
      <div class="info-row"><span class="info-label">Cliente:</span> ${project.cliente}</div>
      <div class="info-row"><span class="info-label">Centro de Costos:</span> ${project.centroCostos}</div>
      <div class="info-row"><span class="info-label">Fecha Montaje:</span> ${format(parseISO(project.fechaMontajeInicio), "dd/MM/yyyy", { locale: es })} - ${format(parseISO(project.fechaMontajeFin), "dd/MM/yyyy", { locale: es })}</div>
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

// Print unified PDF with Personal + Inventario
export const printPersonalYInventario = (project: Project, includeNotes: boolean = true) => {
  const content = `
    <div class="info-section">
      <div class="info-row"><span class="info-label">Proyecto:</span> ${project.evento}</div>
      <div class="info-row"><span class="info-label">Cliente:</span> ${project.cliente}</div>
      <div class="info-row"><span class="info-label">Centro de Costos:</span> ${project.centroCostos}</div>
      <div class="info-row"><span class="info-label">Fecha Montaje:</span> ${format(parseISO(project.fechaMontajeInicio), "dd/MM/yyyy", { locale: es })} - ${format(parseISO(project.fechaMontajeFin), "dd/MM/yyyy", { locale: es })}</div>
      <div class="info-row"><span class="info-label">Fecha Ejecución:</span> ${format(parseISO(project.fechaEjecucionInicio), "dd/MM/yyyy", { locale: es })} - ${format(parseISO(project.fechaEjecucionFin), "dd/MM/yyyy", { locale: es })}</div>
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

// Employee type for resolving IDs to names
interface EmpleadoBasic {
  id: string;
  nombre: string;
}

// Helper to resolve employee ID to name
const getEmpleadoNombre = (empleadoId: string | undefined, empleados: EmpleadoBasic[]): string => {
  if (!empleadoId) return '-';
  const empleado = empleados.find(e => e.id === empleadoId);
  return empleado?.nombre || empleadoId;
};

// Generate Caja Menor section (internal use)
const generateCajaMenorSection = (project: Project, empleados: EmpleadoBasic[]): string => {
  const cajaMenor = project.cajaMenor || [];
  
  const tableRows = cajaMenor.map(c => `
    <tr>
      <td>${getEmpleadoNombre(c.empleadoId, empleados)}</td>
      <td>${c.concepto || '-'}</td>
      <td>${(c.imagenes || []).length} imagen(es)</td>
      <td>$${(c.valor || 0).toLocaleString('es-CO')}</td>
      <td>${c.categoria || '-'}</td>
      <td>${c.recursos || '-'}</td>
      <td>${c.contingencia || 'No'}</td>
      <td><span class="badge ${c.estado === 'Aprobado' ? 'badge-aprobado' : 'badge-no-aprobado'}">${c.estado || '-'}</span></td>
    </tr>
  `).join('');

  return `
    <h2 style="margin: 15px 0 10px; font-size: 14px;">Caja Menor (${cajaMenor.length} registros)</h2>
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
        ${tableRows || '<tr><td colspan="8" style="text-align: center;">No hay registros de caja menor</td></tr>'}
      </tbody>
    </table>
  `;
};

// Print Caja Menor PDF
export const printCajaMenor = (project: Project, empleados: EmpleadoBasic[] = []) => {
  const content = `
    <div class="info-section">
      <div class="info-row"><span class="info-label">Evento:</span> ${project.evento}</div>
      <div class="info-row"><span class="info-label">Cliente:</span> ${project.cliente}</div>
      <div class="info-row"><span class="info-label">Centro de Costos:</span> ${project.centroCostos}</div>
      <div class="info-row"><span class="info-label">Jefe de Operaciones:</span> ${project.jefeOperaciones || '-'}</div>
      <div class="info-row"><span class="info-label">Ubicación:</span> ${project.ubicacion || '-'}</div>
      <div class="info-row"><span class="info-label">Estado del evento:</span> ${project.estado}</div>
    </div>
    ${generateCajaMenorSection(project, empleados)}
  `;

  const html = generatePrintableHTML(content, {
    title: 'CAJA MENOR',
    subtitle: project.evento,
  });

  openPrintWindow(html);
};

// Export Caja Menor to Excel (real .xlsx file)
export const exportCajaMenorToExcel = async (project: Project, empleados: EmpleadoBasic[] = []) => {
  const XLSX = await import('xlsx');
  const cajaMenor = project.cajaMenor || [];
  
  // Header row
  const headers = ['Empleado', 'Concepto', 'Imágenes', 'Valor', 'Categoría', 'Recursos', 'Contingencia', 'Estado'];
  
  // Data rows with resolved employee names
  const data = cajaMenor.map(c => ({
    'Empleado': getEmpleadoNombre(c.empleadoId, empleados),
    'Concepto': c.concepto || '',
    'Imágenes': `${(c.imagenes || []).length} imagen(es)`,
    'Valor': c.valor || 0,
    'Categoría': c.categoria || '',
    'Recursos': c.recursos || '',
    'Contingencia': c.contingencia || 'No',
    'Estado': c.estado || ''
  }));
  
  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Empleado
    { wch: 40 }, // Concepto
    { wch: 15 }, // Imágenes
    { wch: 12 }, // Valor
    { wch: 15 }, // Categoría
    { wch: 18 }, // Recursos
    { wch: 15 }, // Contingencia
    { wch: 15 }, // Estado
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