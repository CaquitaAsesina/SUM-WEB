// ============================================
// EXPORT & CAPTURE UTILITIES (v2 - Fixed)
// ============================================

const ExportUtil = {
  // Format Excel with headers, borders, colors
  _styleSheet(data, sheetName) {
    if (!data || data.length === 0) return null;
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = Object.keys(data[0]).map(key => {
      const maxLen = Math.max(
        key.length,
        ...data.map(row => String(row[key] ?? '').length)
      );
      return { wch: Math.min(maxLen + 4, 40) };
    });
    ws['!cols'] = colWidths;

    // Style header row
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) {
        ws[addr].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Segoe UI' },
          fill: { fgColor: { rgb: 'C62828' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            bottom: { style: 'thin', color: { rgb: '8E0000' } }
          }
        };
      }
    }

    // Style data rows
    for (let r = 1; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) {
          ws[addr].s = {
            font: { sz: 10, name: 'Segoe UI' },
            fill: { fgColor: { rgb: r % 2 === 0 ? 'FFF5F5' : 'FFFFFF' } },
            border: {
              bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }
            }
          };
        }
      }
    }

    ws['!rows'] = [{ hpt: 28 }, ...data.map(() => ({ hpt: 22 }))];
    return ws;
  },

  toExcel(data, filename, sheetName = 'Datos') {
    if (!data || data.length === 0) {
      showToast('No hay datos para exportar', 'warning');
      return;
    }
    try {
      const ws = this._styleSheet(data, sheetName);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${filename}.xlsx`);
      showToast(`"${filename}.xlsx" descargado`, 'success');
    } catch (e) {
      console.error('Excel error:', e);
      showToast('Error al generar Excel', 'danger');
    }
  },

  toMultiSheetExcel(sheets, filename) {
    if (!sheets || sheets.length === 0) {
      showToast('No hay datos para exportar', 'warning');
      return;
    }
    try {
      const wb = XLSX.utils.book_new();
      let count = 0;
      sheets.forEach(({ data, name }) => {
        if (data && data.length > 0) {
          const ws = this._styleSheet(data, name);
          XLSX.utils.book_append_sheet(wb, ws, name);
          count++;
        }
      });
      if (count === 0) { showToast('No hay datos para exportar', 'warning'); return; }
      XLSX.writeFile(wb, `${filename}.xlsx`);
      showToast(`"${filename}.xlsx" descargado (${count} hojas)`, 'success');
    } catch (e) {
      console.error('Excel error:', e);
      showToast('Error al generar Excel', 'danger');
    }
  },

  async captureElement(elementId, filename) {
    const el = document.getElementById(elementId);
    if (!el) { showToast('Elemento no encontrado', 'warning'); return; }
    try {
      showToast('Generando captura...', 'info');
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
        removeContainer: true,
        imageTimeout: 15000
      });
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      showToast(`Captura descargada`, 'success');
    } catch (e) {
      console.error('Capture error:', e);
      showToast('Error al capturar', 'danger');
    }
  },

  async capturePage(pageId, filename) {
    const page = document.getElementById(`page-${pageId}`);
    if (!page) { showToast('Página no encontrada', 'warning'); return; }
    try {
      showToast('Generando captura...', 'info');
      const canvas = await html2canvas(page, {
        backgroundColor: '#0F0F0F',
        scale: 2,
        useCORS: true,
        logging: false,
        removeContainer: true,
        windowWidth: 1400,
        onclone: (doc) => {
          const target = doc.getElementById(`page-${pageId}`);
          if (target) {
            target.style.background = '#0F0F0F';
            target.style.color = '#E0E0E0';
          }
        }
      });
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      showToast(`Captura descargada`, 'success');
    } catch (e) {
      console.error('Capture error:', e);
      showToast('Error al capturar', 'danger');
    }
  }
};

// ====== MODULE EXPORT FUNCTIONS ======

async function exportDashboardExcel() {
  try {
    showToast('Recopilando datos...', 'info');
    const [dashRes, areasRes, pickRes, audRes, movRes, asigRes, perRes] = await Promise.all([
      api.get('/dashboard'), api.get('/dashboard/area-status'),
      api.get('/picking'), api.get('/auditorias'), api.get('/movimientos'),
      api.get('/asignaciones'), api.get('/periodos')
    ]);

    const sheets = [];
    if (dashRes?.success) {
      const d = dashRes.data;
      sheets.push({ name: 'Resumen', data: [{
        'Total Períodos': d.periodos.total, 'Activos': d.periodos.activos,
        'Cerrados': d.periodos.cerrados, 'Cuadran': d.periodos.cuadraron,
        'Sin Cuadre': d.periodos.noCuadraron, '% Cuadre': d.periodos.porcentajeCuadre + '%',
        'Productos': d.productos, 'Áreas': d.areas, 'Asignaciones': d.asignaciones
      }]});
    }
    if (areasRes?.data) sheets.push({ name: 'Estado por Área', data: areasRes.data.map(a => ({
      'Área': a.nombre, 'Asignaciones': a.totalAsignaciones, 'Pickings': a.pickingRealizado,
      'Movimientos': a.movimientosRealizados, 'Cant. Mov.': a.movimientosCantidad, 'Auditorías': a.auditoriasRealizadas
    }))});
    if (perRes?.data) sheets.push({ name: 'Períodos', data: perRes.data.map(p => ({
      'Nombre': p.nombre, 'Estado': p.estado,
      'Cuadra': p.cuadra === 1 ? 'Sí' : p.cuadra === 0 ? 'No' : 'N/A',
      'Creación': p.fecha_creacion, 'Cierre': p.fecha_cierre || '-'
    }))});
    if (asigRes?.data) sheets.push({ name: 'Asignaciones', data: asigRes.data.map(a => ({
      'Área': a.area_nombre, 'Producto': a.producto_nombre, 'Código': a.producto_codigo, 'Cant. Asignada': a.cantidad_asignada
    }))});
    if (pickRes?.data) sheets.push({ name: 'Picking', data: pickRes.data.map(p => ({
      'Período': p.periodo_nombre, 'Área': p.area_nombre, 'Producto': p.producto_nombre,
      'Código': p.producto_codigo, 'Calculada': p.cantidad_calculada, 'Entregada': p.cantidad_entregada, 'Fecha': p.created_at
    }))});
    if (audRes?.data) sheets.push({ name: 'Auditorías', data: audRes.data.map(a => ({
      'Período': a.periodo_nombre, 'Área': a.area_nombre, 'Producto': a.producto_nombre,
      'Código': a.producto_codigo, 'Encontrada': a.cantidad_encontrada, 'Fecha': a.created_at
    }))});
    if (movRes?.data) sheets.push({ name: 'Movimientos', data: movRes.data.map(m => ({
      'Período': m.periodo_nombre, 'Área': m.area_nombre, 'Producto': m.producto_nombre,
      'Código': m.producto_codigo, 'Cantidad': m.cantidad, 'Motivo': m.motivo || '-', 'Fecha': m.created_at
    }))});

    ExportUtil.toMultiSheetExcel(sheets, `FP_Dashboard_${new Date().toISOString().slice(0,10)}`);
  } catch (e) { console.error(e); showToast('Error al exportar', 'danger'); }
}

async function exportPickingExcel() {
  try {
    const res = await api.get('/picking', { periodo_id: document.getElementById('filterPickingPeriodo')?.value, area_id: document.getElementById('filterPickingArea')?.value, producto_id: document.getElementById('filterPickingProducto')?.value });
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(p => ({
      'Período': p.periodo_nombre, 'Área': p.area_nombre, 'Producto': p.producto_nombre, 'Código': p.producto_codigo,
      'Calculada': p.cantidad_calculada, 'Entregada': p.cantidad_entregada,
      'Exceso': p.cantidad_entregada > p.cantidad_calculada ? p.cantidad_entregada - p.cantidad_calculada : 0, 'Fecha': p.created_at
    })), `FP_Picking_${new Date().toISOString().slice(0,10)}`, 'Picking');
  } catch (e) { showToast('Error', 'danger'); }
}

async function exportAuditoriasExcel() {
  try {
    const res = await api.get('/auditorias', { periodo_id: document.getElementById('filterAudPeriodo')?.value, area_id: document.getElementById('filterAudArea')?.value, producto_id: document.getElementById('filterAudProducto')?.value });
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(a => ({
      'Período': a.periodo_nombre, 'Área': a.area_nombre, 'Producto': a.producto_nombre, 'Código': a.producto_codigo,
      'Encontrada': a.cantidad_encontrada, 'Fecha': a.created_at
    })), `FP_Auditorias_${new Date().toISOString().slice(0,10)}`, 'Auditorías');
  } catch (e) { showToast('Error', 'danger'); }
}

async function exportMovimientosExcel() {
  try {
    const res = await api.get('/movimientos', { periodo_id: document.getElementById('filterMovPeriodo')?.value, area_id: document.getElementById('filterMovArea')?.value, producto_id: document.getElementById('filterMovProducto')?.value });
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(m => ({
      'Período': m.periodo_nombre, 'Área': m.area_nombre, 'Producto': m.producto_nombre, 'Código': m.producto_codigo,
      'Cantidad': m.cantidad, 'Motivo': m.motivo || '-', 'Fecha': m.created_at
    })), `FP_Movimientos_${new Date().toISOString().slice(0,10)}`, 'Movimientos');
  } catch (e) { showToast('Error', 'danger'); }
}

async function exportPeriodosExcel() {
  try {
    const res = await api.get('/periodos');
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(p => ({
      'Nombre': p.nombre, 'Estado': p.estado,
      'Cuadra': p.cuadra === 1 ? 'Sí' : p.cuadra === 0 ? 'No' : 'N/A',
      'Creación': p.fecha_creacion, 'Cierre': p.fecha_cierre || '-'
    })), `FP_Periodos_${new Date().toISOString().slice(0,10)}`, 'Períodos');
  } catch (e) { showToast('Error', 'danger'); }
}

async function exportAsignacionesExcel() {
  try {
    const res = await api.get('/asignaciones');
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(a => ({
      'Área': a.area_nombre, 'Producto': a.producto_nombre, 'Código': a.producto_codigo, 'Cantidad': a.cantidad_asignada
    })), `FP_Asignaciones_${new Date().toISOString().slice(0,10)}`, 'Asignaciones');
  } catch (e) { showToast('Error', 'danger'); }
}

async function exportProductosExcel() {
  try {
    const res = await api.get('/productos');
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(p => ({ 'Nombre': p.nombre, 'Código': p.codigo, 'Creado': p.created_at })),
      `FP_Productos_${new Date().toISOString().slice(0,10)}`, 'Productos');
  } catch (e) { showToast('Error', 'danger'); }
}

async function exportAreasExcel() {
  try {
    const res = await api.get('/areas');
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(a => ({ 'Nombre': a.nombre, 'Descripción': a.descripcion || '-', 'Creado': a.created_at })),
      `FP_Areas_${new Date().toISOString().slice(0,10)}`, 'Áreas');
  } catch (e) { showToast('Error', 'danger'); }
}

// Capture functions
function captureDashboard() { ExportUtil.capturePage('dashboard', `FP_Dashboard_${new Date().toISOString().slice(0,10)}`); }
function capturePicking() { ExportUtil.capturePage('picking', `FP_Picking_${new Date().toISOString().slice(0,10)}`); }
function captureAuditorias() { ExportUtil.capturePage('auditorias', `FP_Auditorias_${new Date().toISOString().slice(0,10)}`); }
function captureMovimientos() { ExportUtil.capturePage('movimientos', `FP_Movimientos_${new Date().toISOString().slice(0,10)}`); }
function capturePeriodos() { ExportUtil.capturePage('periodos', `FP_Periodos_${new Date().toISOString().slice(0,10)}`); }
function captureProductos() { ExportUtil.capturePage('productos', `FP_Productos_${new Date().toISOString().slice(0,10)}`); }
function captureAreas() { ExportUtil.capturePage('areas', `FP_Areas_${new Date().toISOString().slice(0,10)}`); }
function captureAsignaciones() { ExportUtil.capturePage('asignaciones', `FP_Asignaciones_${new Date().toISOString().slice(0,10)}`); }

// ====== TRUPAL PRODUCTOS ======
async function exportTrupalProductosExcel() {
  try {
    const res = await api.get('/trupal-productos');
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(p => ({ 'Nombre': p.nombre, 'Código': p.codigo || '-', 'Creado': p.created_at })),
      `FP_Productos_${new Date().toISOString().slice(0,10)}`, 'Productos');
  } catch (e) { showToast('Error', 'danger'); }
}

// ====== TRUPAL (Movimientos) ======
async function exportTrupalExcel() {
  try {
    const res = await api.get('/trupal');
    const data = res?.data || [];
    if (!data.length) { showToast('No hay datos para exportar', 'warning'); return; }

    const mainData = data.map((t, i) => ({
      '#': i + 1,
      'Tipo': t.tipo === 'entrada' ? 'ENTRADA' : 'DEVOLUCION',
      'Producto': t.producto_nombre || '-',
      'Código': t.producto_codigo || '-',
      'N° Guía': t.num_guia || '-',
      'Placa': t.placa || '-',
      'Cantidad': t.tipo === 'entrada' ? t.cantidad : -t.cantidad,
      'Fecha': t.fecha ? new Date(t.fecha).toLocaleDateString('es-PE') : '-'
    }));

    const balanceRes = await api.get('/trupal/balance');
    const bal = balanceRes?.data || {};
    const summaryData = [
      { 'Concepto': 'Total Entradas', 'Valor': bal.total_entradas || 0 },
      { 'Concepto': 'Total Devoluciones', 'Valor': bal.total_devoluciones || 0 },
      { 'Concepto': 'BALANCE TOTAL', 'Valor': bal.balance || 0 }
    ];
    const perProduct = (bal.por_producto || []).map(p => ({
      'Producto': p.producto,
      'Código': p.codigo || '-',
      'Entradas': p.entradas,
      'Devoluciones': p.devoluciones,
      'Saldo': p.saldo
    }));

    const sheets = [{ data: mainData, name: 'Registros' }];
    if (summaryData.length) sheets.push({ data: summaryData, name: 'Resumen' });
    if (perProduct.length) sheets.push({ data: perProduct, name: 'Balance por Producto' });
    ExportUtil.toMultiSheetExcel(sheets, `FP_Movimientos_${new Date().toISOString().slice(0,10)}`);
  } catch (e) { showToast('Error al exportar', 'danger'); }
}

async function exportUsuariosExcel() {
  try {
    const res = await api.get('/usuarios');
    if (!res?.data?.length) { showToast('No hay datos', 'warning'); return; }
    ExportUtil.toExcel(res.data.map(u => ({ 'Usuario': u.usuario, 'Nombre': u.nombre_completo, 'Rol': u.rol, 'Activo': u.activo ? 'Sí' : 'No', 'Creado': u.created_at })),
      `FP_Usuarios_${new Date().toISOString().slice(0,10)}`, 'Usuarios');
  } catch (e) { showToast('Error', 'danger'); }
}
