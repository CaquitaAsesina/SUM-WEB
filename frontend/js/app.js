// ============================================
// SUMINISTROS - Farmacias Peruanas
// Main Application (v3 - Theme + Users + Profile + Validations)
// ============================================

let activePeriod = null;
let allAreas = [];
let allProductos = [];
let currentPage = 'dashboard';
let pickingCalculations = [];

// ====== THEME SWITCHER ======
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('fp_theme', theme);
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function toggleThemeMenu() {
  const menu = document.getElementById('themeMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('themeMenu');
  const btn = document.getElementById('themeBtn');
  if (menu && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  init();
});

async function init() {
  await loadBaseData();
  updatePeriodIndicator();
  applyRoleRestrictions();
  navigateTo('dashboard');
  // Hide page loader after everything is loaded
  if (window.hidePageLoader) window.hidePageLoader();
}

// ====== ROLE-BASED UI ======
function applyRoleRestrictions() {
  if (!isAdmin()) {
    const banner = document.createElement('div');
    banner.className = 'viewer-banner';
    banner.innerHTML = '<i class="bi bi-eye-fill"></i> Modo Solo Lectura — No puede modificar datos';
    document.body.insertBefore(banner, document.body.firstChild);
    document.querySelector('.topbar').style.top = '36px';
    document.querySelector('.main-content').style.paddingTop = '110px';
    document.getElementById('navUsuarios').style.display = 'none';
  }
}

function hideViewerActions() {
  if (isAdmin()) return;
  document.querySelectorAll('.actions-cell').forEach(cell => {
    cell.innerHTML = '<i class="bi bi-eye" style="color:var(--text-muted);" title="Solo lectura"></i>';
  });
}

// ====== DATA LOADING ======
async function loadBaseData() {
  try {
    const [areasRes, prodRes] = await Promise.all([api.get('/areas'), api.get('/productos')]);
    allAreas = areasRes?.data || [];
    allProductos = prodRes?.data || [];
    populateFilterDropdowns();
  } catch (e) { console.error(e); }
}

function populateFilterDropdowns() {
  ['filterAsignArea','filterPickingArea','filterAudArea','filterMovArea','asignacionArea','pickingArea','audArea','movArea'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = el.value; const first = el.options[0];
    el.innerHTML = '';
    if (first) el.appendChild(first);
    allAreas.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.nombre; el.appendChild(o); });
    if (v) el.value = v;
  });
  ['filterAsignProducto','filterPickingProducto','filterAudProducto','filterMovProducto','asignacionProducto','movProducto'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = el.value; const first = el.options[0];
    el.innerHTML = '';
    if (first) el.appendChild(first);
    allProductos.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.nombre} (${p.codigo})`; el.appendChild(o); });
    if (v) el.value = v;
  });
  loadPeriodsForDropdowns();
}

async function loadPeriodsForDropdowns() {
  try {
    const res = await api.get('/periodos');
    const periods = res?.data || [];
    ['filterPickingPeriodo','filterAudPeriodo','filterMovPeriodo'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const first = el.options[0];
      el.innerHTML = '';
      if (first) el.appendChild(first);
      periods.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.nombre} (${p.estado})`; el.appendChild(o); });
    });
  } catch (e) { console.error(e); }
}

async function updatePeriodIndicator() {
  try {
    const res = await api.get('/periodos/activo');
    activePeriod = res?.data || null;
    const dot = document.getElementById('periodDot');
    const text = document.getElementById('periodText');
    if (activePeriod) {
      dot.className = 'status-dot';
      text.textContent = activePeriod.nombre;
      ['btnNuevoPicking','btnNuevaAuditoria','btnNuevoMovimiento'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = false; });
      const nb = document.getElementById('noPeriodBanner'); if (nb) nb.style.display = 'none';
    } else {
      dot.className = 'status-dot inactive';
      text.textContent = 'Sin período activo';
      ['btnNuevoPicking','btnNuevaAuditoria','btnNuevoMovimiento'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = true; });
      const nb = document.getElementById('noPeriodBanner'); if (nb) nb.style.display = 'block';
    }
  } catch (e) { console.error(e); }
}

// ====== NAVIGATION ======
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
  document.querySelectorAll('.page-section').forEach(s => s.classList.toggle('active', s.id === `page-${page}`));
  const titles = { dashboard:'Dashboard', 'nueva-tarea':'Nueva Tarea', 'nueva-operacion':'Nuevo', 'movimientos-trupal':'Movimientos', usuarios:'Gestión de Usuarios', perfil:'Mi Perfil' };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
  if (window.innerWidth <= 991) toggleSidebar(false);
  loadPageData(page);
}

// ====== NUEVA TAREA - TAB SWITCHER ======
function switchNtTab(tab) {
  document.querySelectorAll('#ntTabs .nav-link').forEach(btn => btn.classList.remove('active'));
  document.getElementById('ntTab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.querySelectorAll('.nt-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById('ntContent-' + tab).style.display = 'block';
  if (tab === 'productos') loadProductos();
  else if (tab === 'areas') loadAreas();
  else if (tab === 'asignaciones') loadAsignaciones();
}

function switchNoTab(tab) {
  document.querySelectorAll('#noTabs .nav-link').forEach(btn => btn.classList.remove('active'));
  document.getElementById('noTab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.querySelectorAll('.no-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById('noContent-' + tab).style.display = 'block';
  if (tab === 'periodos') loadPeriodos();
  else if (tab === 'picking') loadPicking();
  else if (tab === 'auditorias') loadAuditorias();
  else if (tab === 'movimientos') loadMovimientos();
}

function switchMtTab(tab) {
  document.querySelectorAll('#mtTabs .nav-link').forEach(btn => btn.classList.remove('active'));
  document.getElementById('mtTab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.querySelectorAll('.mt-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById('mtContent-' + tab).style.display = 'block';
  if (tab === 'productos') loadTrupalProductos();
  else if (tab === 'trupal') loadTrupal();
}

async function loadPageData(page) {
  await updatePeriodIndicator();
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'nueva-tarea': loadProductos(); break;
    case 'nueva-operacion': loadPeriodos(); break;
    case 'movimientos-trupal': loadTrupalProductos(); break;
    case 'usuarios': loadUsuarios(); break;
    case 'perfil': loadPerfil(); break;
  }
}

function toggleSidebar(show) {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (show === undefined) show = !s.classList.contains('show');
  s.classList.toggle('show', show);
  o.classList.toggle('show', show);
}

// ====== DASHBOARD ======
async function loadDashboard() {
  try {
    const [d, a, c] = await Promise.all([api.get('/dashboard'), api.get('/dashboard/area-status'), api.get('/dashboard/compliance')]);
    if (!d?.success) return;
    const s = d.data;
    document.getElementById('statPeriodos').textContent = s.periodos.total;
    document.getElementById('statCuadre').textContent = s.periodos.porcentajeCuadre + '%';
    document.getElementById('statProductos').textContent = s.productos;
    document.getElementById('statAreas').textContent = s.areas;
    document.getElementById('statActivos').textContent = s.periodos.activos;
    document.getElementById('statCerrados').textContent = s.periodos.cerrados;
    document.getElementById('statNoCuadran').textContent = s.periodos.noCuadraron;
    document.getElementById('statAsignaciones').textContent = s.asignaciones;
    renderAreaStatus(a?.data || []);
    renderComplianceChart(c?.data || []);
    renderTopProducts(s.productosMasMovimientos);
    renderTopAreas(s.areasMasIncidencias);
  } catch (e) { console.error(e); }
}

function renderAreaStatus(areas) {
  const c = document.getElementById('dashAreaStatus');
  if (!areas?.length) { c.innerHTML = '<div class="empty-state"><i class="bi bi-building"></i><p>No hay datos</p></div>'; return; }
  let h = '<div class="table-responsive"><table class="table-fp"><thead><tr><th>Área</th><th>Asignaciones</th><th>Pickings</th><th>Movimientos</th><th>Auditorías</th><th>Estado</th></tr></thead><tbody>';
  areas.forEach(a => {
    h += `<tr><td><strong>${escapeHtml(a.nombre)}</strong></td><td>${a.totalAsignaciones}</td><td>${a.pickingRealizado}</td><td>${a.movimientosRealizados} (${a.movimientosCantidad} uds.)</td><td>${a.auditoriasRealizadas}</td><td>${a.movimientosRealizados > 0 ? '<span class="badge-fp badge-no-cuadra">Con movimientos</span>' : '<span class="badge-fp badge-cuadra">Estándar</span>'}</td></tr>`;
  });
  c.innerHTML = h + '</tbody></table></div>';
}

function renderComplianceChart(data) {
  const c = document.getElementById('dashCompliance');
  if (!data?.length) { c.innerHTML = '<div class="empty-state"><i class="bi bi-bar-chart"></i><p>No hay datos</p></div>'; return; }
  let h = '<div class="chart-bar-group">';
  data.forEach(i => { const t = i.total_pickings||1; const p = Math.round((i.pickings_estandar/t)*100); h += `<div class="chart-bar-item"><span class="chart-bar-label">${escapeHtml(i.area_nombre)}</span><div class="chart-bar-track"><div class="chart-bar-fill standard" style="width:${p}%">${p}%</div></div></div>`; });
  c.innerHTML = h + '</div><div class="mt-3" style="font-size:12px;"><span class="badge-fp badge-cuadra" style="margin-right:8px;">■</span> Cumplimiento</div>';
}

function renderTopProducts(p) { const c = document.getElementById('dashProdMovs'); if (!p?.length) { c.innerHTML = '<div class="empty-state"><p>No hay movimientos</p></div>'; return; } let h = '<table class="table-fp"><thead><tr><th>Producto</th><th>Código</th><th>Movs</th><th>Cant.</th></tr></thead><tbody>'; p.forEach(x => { h += `<tr><td><strong>${escapeHtml(x.nombre)}</strong></td><td>${escapeHtml(x.codigo)}</td><td><span class="badge-fp badge-no-cuadra">${x.total_movimientos}</span></td><td>${x.total_cantidad} uds.</td></tr>`; }); c.innerHTML = h + '</tbody></table>'; }

function renderTopAreas(a) { const c = document.getElementById('dashAreaIncidencias'); if (!a?.length) { c.innerHTML = '<div class="empty-state"><p>No hay incidencias</p></div>'; return; } let h = '<table class="table-fp"><thead><tr><th>Área</th><th>Movs</th><th>Cant.</th></tr></thead><tbody>'; a.forEach(x => { h += `<tr><td><strong>${escapeHtml(x.nombre)}</strong></td><td><span class="badge-fp badge-no-cuadra">${x.total_movimientos}</span></td><td>${x.total_cantidad} uds.</td></tr>`; }); c.innerHTML = h + '</tbody></table>'; }

// ====== PRODUCTOS ======
async function loadProductos() { try { const r = await api.get('/productos', { nombre: document.getElementById('filterProductoNombre')?.value, codigo: document.getElementById('filterProductoCodigo')?.value }); renderProductosTable(r?.data || []); } catch(e) { console.error(e); } }

function renderProductosTable(p) { const t = document.getElementById('productosTableBody'); if (!p?.length) { t.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="empty-state"><p>No se encontraron productos</p></div></td></tr>'; return; } t.innerHTML = p.map((x,i) => `<tr><td>${i+1}</td><td><strong>${escapeHtml(x.nombre)}</strong></td><td><code>${escapeHtml(x.codigo)}</code></td><td>${formatDate(x.created_at)}</td><td class="actions-cell"><button class="btn btn-edit" onclick="editProducto(${x.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-delete" onclick="deleteProducto(${x.id})"><i class="bi bi-trash"></i></button></td></tr>`).join(''); hideViewerActions(); }

function clearProductoFilters() { document.getElementById('filterProductoNombre').value=''; document.getElementById('filterProductoCodigo').value=''; loadProductos(); }

function openProductoModal(p=null) { document.getElementById('productoId').value = p ? p.id : ''; document.getElementById('productoNombre').value = p ? p.nombre : ''; document.getElementById('productoCodigo').value = p ? p.codigo : ''; document.getElementById('productoModalTitle').innerHTML = p ? '<i class="bi bi-pencil"></i> Editar Producto' : '<i class="bi bi-box-seam"></i> Nuevo Producto'; openModal('productoModal'); }

async function editProducto(id) { try { const r = await api.get(`/productos/${id}`); if (r?.success) openProductoModal(r.data); } catch(e) { showToast('Error al cargar','danger'); } }

async function saveProducto() {
  const id = document.getElementById('productoId').value;
  const n = document.getElementById('productoNombre').value.trim();
  const c = document.getElementById('productoCodigo').value.trim();
  if (!validateRequired(n,'Nombre')) return;
  if (!validateRequired(c,'Código')) return;
  if (!validateMinLength(n,2,'Nombre')) return;
  if (!validateMinLength(c,2,'Código')) return;
  if (!validateAlphaNumeric(c,'Código')) return;
  try { const r = id ? await api.put(`/productos/${id}`,{nombre:n,codigo:c}) : await api.post('/productos',{nombre:n,codigo:c}); if (r?.success) { showToast(r.message,'success'); closeModal('productoModal'); await loadBaseData(); loadProductos(); } else showToast(r?.message||'Error','danger'); } catch(e) { showToast('Error de conexión','danger'); }
}

async function deleteProducto(id) { if (!await confirmAction('¿Eliminar este producto?')) return; try { const r = await api.delete(`/productos/${id}`); if (r?.success) { showToast(r.message,'success'); await loadBaseData(); loadProductos(); } else showToast(r?.message||'Error','danger'); } catch(e) { showToast('Error de conexión','danger'); } }

// ====== ÁREAS ======
async function loadAreas() { try { const r = await api.get('/areas',{nombre:document.getElementById('filterAreaNombre')?.value}); renderAreasTable(r?.data||[]); } catch(e){console.error(e);} }

function renderAreasTable(a) { const t = document.getElementById('areasTableBody'); if (!a?.length) { t.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="empty-state"><p>No se encontraron áreas</p></div></td></tr>'; return; } t.innerHTML = a.map((x,i) => `<tr><td>${i+1}</td><td><strong>${escapeHtml(x.nombre)}</strong></td><td>${escapeHtml(x.descripcion)||'<span class="text-muted">-</span>'}</td><td>${formatDate(x.created_at)}</td><td class="actions-cell"><button class="btn btn-edit" onclick="editArea(${x.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-delete" onclick="deleteArea(${x.id})"><i class="bi bi-trash"></i></button></td></tr>`).join(''); hideViewerActions(); }

function clearAreaFilters() { document.getElementById('filterAreaNombre').value=''; loadAreas(); }

function openAreaModal(a=null) { document.getElementById('areaId').value = a ? a.id : ''; document.getElementById('areaNombre').value = a ? a.nombre : ''; document.getElementById('areaDescripcion').value = a ? (a.descripcion||'') : ''; document.getElementById('areaModalTitle').innerHTML = a ? '<i class="bi bi-pencil"></i> Editar Área' : '<i class="bi bi-building"></i> Nueva Área'; openModal('areaModal'); }

async function editArea(id) { try { const r = await api.get(`/areas/${id}`); if (r?.success) openAreaModal(r.data); } catch(e){showToast('Error','danger');} }

async function saveArea() {
  const id = document.getElementById('areaId').value;
  const n = document.getElementById('areaNombre').value.trim();
  const d = document.getElementById('areaDescripcion').value.trim();
  if (!validateRequired(n,'Nombre')) return;
  if (!validateMinLength(n,2,'Nombre')) return;
  try { const r = id ? await api.put(`/areas/${id}`,{nombre:n,descripcion:d}) : await api.post('/areas',{nombre:n,descripcion:d}); if (r?.success) { showToast(r.message,'success'); closeModal('areaModal'); await loadBaseData(); loadAreas(); } else showToast(r?.message||'Error','danger'); } catch(e){showToast('Error de conexión','danger');}
}

async function deleteArea(id) { if (!await confirmAction('¿Eliminar esta área y todas sus asignaciones?')) return; try { const r = await api.delete(`/areas/${id}`); if (r?.success) { showToast(r.message,'success'); await loadBaseData(); loadAreas(); } else showToast(r?.message||'Error','danger'); } catch(e){showToast('Error de conexión','danger');} }

// ====== ASIGNACIONES ======
async function loadAsignaciones() { try { const r = await api.get('/asignaciones',{area_id:document.getElementById('filterAsignArea')?.value,producto_id:document.getElementById('filterAsignProducto')?.value}); renderAsignacionesAccordion(r?.data||[]); } catch(e){console.error(e);} }

function renderAsignacionesAccordion(as) { const c = document.getElementById('asignacionesAccordion'); const l = document.getElementById('asignacionesLoading'); if(l)l.style.display='none'; if (!as?.length) { c.innerHTML = '<div class="empty-state"><p>No hay asignaciones</p></div>'; return; } const g = {}; as.forEach(a => { if(!g[a.area_nombre])g[a.area_nombre]=[]; g[a.area_nombre].push(a); }); let h=''; let idx=0; for(const[n,items] of Object.entries(g)){const cid=`ac-${idx}`; h+=`<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${cid}"><i class="bi bi-building me-2" style="color:var(--accent-red);"></i><strong>${escapeHtml(n)}</strong><span class="badge bg-secondary ms-2">${items.length}</span></button></h2><div id="${cid}" class="accordion-collapse collapse" data-bs-parent="#asignacionesAccordion"><div class="accordion-body"><table class="table-fp"><thead><tr><th>Producto</th><th>Código</th><th>Cant.</th><th>Acciones</th></tr></thead><tbody>${items.map(a=>`<tr><td>${escapeHtml(a.producto_nombre)}</td><td><code>${escapeHtml(a.producto_codigo)}</code></td><td><strong>${a.cantidad_asignada}</strong></td><td class="actions-cell"><button class="btn btn-edit" onclick="editAsignacion(${a.id},${a.area_id},${a.producto_id},${a.cantidad_asignada})"><i class="bi bi-pencil"></i></button> <button class="btn btn-delete" onclick="deleteAsignacion(${a.id})"><i class="bi bi-trash"></i></button></td></tr>`).join('')}</tbody></table></div></div></div>`;idx++;} c.innerHTML=`<div class="accordion" id="aai">${h}</div>`; hideViewerActions(); }

function clearAsignacionFilters() { document.getElementById('filterAsignArea').value=''; document.getElementById('filterAsignProducto').value=''; loadAsignaciones(); }

function openAsignacionModal(a=null) { document.getElementById('asignacionId').value=a?a.id:''; document.getElementById('asignacionArea').value=a?a.area_id:''; document.getElementById('asignacionProducto').value=a?a.producto_id:''; document.getElementById('asignacionCantidad').value=a?a.cantidad_asignada:''; document.getElementById('asignacionModalTitle').innerHTML=a?'<i class="bi bi-pencil"></i> Editar':'<i class="bi bi-link-45deg"></i> Nueva Asignación'; document.getElementById('asignacionArea').disabled=!!a; document.getElementById('asignacionProducto').disabled=!!a; openModal('asignacionModal'); }

function editAsignacion(id,aid,pid,c) { openAsignacionModal({id,area_id:aid,producto_id:pid,cantidad_asignada:c}); }

async function saveAsignacion() { const id=document.getElementById('asignacionId').value; const aid=document.getElementById('asignacionArea').value; const pid=document.getElementById('asignacionProducto').value; const c=parseInt(document.getElementById('asignacionCantidad').value); if(!validateRequired(aid,'Área'))return; if(!validateRequired(pid,'Producto'))return; if(!validateNumber(c,'Cantidad Asignada',0))return; try{const r=id?await api.put(`/asignaciones/${id}`,{cantidad_asignada:c}):await api.post('/asignaciones',{area_id:parseInt(aid),producto_id:parseInt(pid),cantidad_asignada:c}); if(r?.success){showToast(r.message,'success');closeModal('asignacionModal');loadAsignaciones();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error de conexión','danger');} }

async function deleteAsignacion(id) { if(!await confirmAction('¿Eliminar esta asignación?'))return; try{const r=await api.delete(`/asignaciones/${id}`); if(r?.success){showToast(r.message,'success');loadAsignaciones();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');} }

// ====== PERÍODOS ======
async function loadPeriodos() { try { const r = await api.get('/periodos',{estado:document.getElementById('filterPeriodoEstado')?.value,fecha_desde:document.getElementById('filterPeriodoDesde')?.value,fecha_hasta:document.getElementById('filterPeriodoHasta')?.value}); renderPeriodosTable(r?.data||[]); } catch(e){console.error(e);} }

function renderPeriodosTable(p) { const t = document.getElementById('periodosTableBody'); if (!p?.length) { t.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="empty-state"><p>No hay períodos</p></div></td></tr>'; return; } t.innerHTML = p.map((x,i) => { const est=x.estado==='activo'?'<span class="badge-fp badge-activo">Activo</span>':'<span class="badge-fp badge-cerrado">Cerrado</span>'; let cuad='<span class="text-muted">-</span>'; if(x.estado==='cerrado') cuad=x.cuadra?'<span class="badge-fp badge-cuadra"><i class="bi bi-check"></i> Cuadra</span>':'<span class="badge-fp badge-no-cuadra"><i class="bi bi-x"></i> No cuadra</span>'; let act=''; if(isAdmin()){if(x.estado==='activo'){act=`<button class="btn btn-edit" onclick="editPeriodo(${x.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-fp btn-fp-green btn-fp-sm" onclick="closePeriodo(${x.id})"><i class="bi bi-lock"></i> Cerrar</button> <button class="btn btn-delete" onclick="deletePeriodo(${x.id})"><i class="bi bi-trash"></i></button>`;}else{act=`<button class="btn btn-delete" onclick="deletePeriodo(${x.id})"><i class="bi bi-trash"></i></button>`;}} return `<tr><td>${i+1}</td><td><strong>${escapeHtml(x.nombre)}</strong></td><td>${est}</td><td>${cuad}</td><td>${formatDateTime(x.fecha_creacion)}</td><td>${x.fecha_cierre?formatDateTime(x.fecha_cierre):'-'}</td><td class="actions-cell">${act}</td></tr>`; }).join(''); }

function clearPeriodoFilters() { document.getElementById('filterPeriodoEstado').value=''; document.getElementById('filterPeriodoDesde').value=''; document.getElementById('filterPeriodoHasta').value=''; loadPeriodos(); }

function openPeriodoModal(p=null) { document.getElementById('periodoId').value=p?p.id:''; document.getElementById('periodoNombre').value=p?p.nombre:''; document.getElementById('periodoModalTitle').innerHTML=p?'<i class="bi bi-pencil"></i> Editar':'<i class="bi bi-calendar3"></i> Nuevo Período'; openModal('periodoModal'); }

async function editPeriodo(id) { try{const r=await api.get(`/periodos/${id}`); if(r?.success)openPeriodoModal(r.data);}catch(e){showToast('Error','danger');} }

async function savePeriodo() { const id=document.getElementById('periodoId').value; const n=document.getElementById('periodoNombre').value.trim(); try{const r=id?await api.put(`/periodos/${id}`,{nombre:n}):await api.post('/periodos',{}); if(r?.success){showToast(r.message,'success');closeModal('periodoModal');await updatePeriodIndicator();loadPeriodsForDropdowns();loadPeriodos();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error de conexión','danger');} }

async function closePeriodo(id) { if(!await confirmAction('¿Cerrar este período? Se determinará si cuadra.','Cerrar Período'))return; try{const r=await api.put(`/periodos/${id}/cerrar`); if(r?.success){showToast(r.message,'success');await updatePeriodIndicator();loadPeriodsForDropdowns();loadPeriodos();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');} }

async function deletePeriodo(id) { if(!await confirmAction('¿Eliminar este período y TODOS sus registros? Esta acción es irreversible.','Eliminar Período'))return; try{const r=await api.delete(`/periodos/${id}`); if(r?.success){showToast(r.message,'success');await updatePeriodIndicator();loadPeriodsForDropdowns();loadPeriodos();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');} }

// ====== PICKING ======
async function loadPicking() { try{const r=await api.get('/picking',{periodo_id:document.getElementById('filterPickingPeriodo')?.value,area_id:document.getElementById('filterPickingArea')?.value,producto_id:document.getElementById('filterPickingProducto')?.value}); renderPickingTable(r?.data||[]);}catch(e){console.error(e);} }

function renderPickingTable(pk) { const t=document.getElementById('pickingTableBody'); if(!pk?.length){t.innerHTML='<tr><td colspan="8" class="text-center py-4"><div class="empty-state"><p>No hay pickings</p></div></td></tr>';return;} t.innerHTML=pk.map((p,i)=>{const ex=p.cantidad_entregada>p.cantidad_calculada&&p.cantidad_calculada>0;let act='';if(isAdmin()){act=`<button class="btn btn-edit" onclick="editPicking(${p.id},${p.cantidad_entregada})"><i class="bi bi-pencil"></i></button> <button class="btn btn-delete" onclick="deletePicking(${p.id})"><i class="bi bi-trash"></i></button>`;}return`<tr><td>${i+1}</td><td>${escapeHtml(p.periodo_nombre||'-')}</td><td>${escapeHtml(p.area_nombre)}</td><td>${escapeHtml(p.producto_nombre)} <small class="text-muted">(${escapeHtml(p.producto_codigo)})</small></td><td><span class="badge-fp badge-activo">${p.cantidad_calculada}</span></td><td class="${ex?'text-danger fw-bold':''}">${p.cantidad_entregada}${ex?` <span class="badge-fp badge-no-cuadra">+${p.cantidad_entregada-p.cantidad_calculada}</span>`:''}</td><td>${formatDateTime(p.created_at)}</td><td class="actions-cell">${act}</td></tr>`;}).join(''); hideViewerActions(); }

function clearPickingFilters(){document.getElementById('filterPickingPeriodo').value='';document.getElementById('filterPickingArea').value='';document.getElementById('filterPickingProducto').value='';loadPicking();}

async function openPickingModal(){if(!activePeriod){showToast('No hay período activo','warning');return;}document.getElementById('pickingPeriodo').value=activePeriod.nombre;document.getElementById('pickingPeriodoId').value=activePeriod.id;document.getElementById('pickingArea').value='';document.getElementById('pickingProductsContainer').innerHTML='<div class="empty-state"><p>Seleccione un área</p></div>';document.getElementById('pickingStockAlert').style.display='none';try{const r=await api.get('/picking',{periodo_id:activePeriod.id});const existingPickings=r?.data||[];const usedAreas=new Set(existingPickings.map(p=>String(p.area_id)));const sel=document.getElementById('pickingArea');sel.innerHTML='<option value="">Seleccione área...</option>';allAreas.forEach(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.nombre;if(usedAreas.has(String(a.id))){o.textContent+=' ✓ Ya tiene picking';o.disabled=true;}sel.appendChild(o);});}catch(e){}openModal('pickingModal');}

async function loadPickingCalculations(){const aid=document.getElementById('pickingArea').value;if(!aid){document.getElementById('pickingProductsContainer').innerHTML='<div class="empty-state"><p>Seleccione un área</p></div>';pickingCalculations=[];return;}try{const r=await api.get('/picking/calcular-area',{periodo_id:document.getElementById('pickingPeriodoId').value,area_id:aid});if(!r?.success){showToast(r?.message||'Error al calcular picking','danger');pickingCalculations=[];document.getElementById('pickingProductsContainer').innerHTML='<div class="empty-state"><p>'+escapeHtml(r?.message||'Error al cargar productos')+'</p></div>';return;}pickingCalculations=r?.data||[];if(!pickingCalculations.length){document.getElementById('pickingProductsContainer').innerHTML='<div class="empty-state"><p>No hay productos asignados a esta área</p></div>';}renderPickingProducts();}catch(e){showToast('Error de conexión al calcular picking','danger');}}

function renderPickingProducts(){const c=document.getElementById('pickingProductsContainer');const ac=document.getElementById('pickingStockAlert');if(!pickingCalculations?.length){c.innerHTML='<div class="empty-state"><p>No hay productos</p></div>';ac.style.display='none';return;}let h='<div class="table-responsive"><table class="table-fp"><thead><tr><th>Producto</th><th>Código</th><th>Asignada</th><th>Últ. Auditoría</th><th>a Entregar</th><th>Cant. Real</th></tr></thead><tbody>';pickingCalculations.forEach((x,i)=>{h+=`<tr><td><strong>${escapeHtml(x.producto_nombre)}</strong></td><td><code>${escapeHtml(x.producto_codigo)}</code></td><td>${x.cantidad_asignada}</td><td>${x.cantidad_encontrada}</td><td><span class="badge-fp badge-activo">${x.cantidad_calculada}</span>${x.cantidad_calculada===0&&x.cantidad_encontrada>0?' <small class="text-muted">(suficiente)</small>':''}</td><td><input type="number" class="form-control form-control-sm" style="width:80px" id="pickingQty_${i}" min="0" value="${x.cantidad_calculada}" onchange="checkPickingOversock(${i})"></td></tr>`;});c.innerHTML=h+'</tbody></table></div>';ac.style.display='none';}

function checkPickingOversock(i){const c=pickingCalculations[i];const q=parseInt(document.getElementById(`pickingQty_${i}`).value)||0;const ac=document.getElementById('pickingStockAlert');if(c.cantidad_encontrada>0&&q>c.cantidad_calculada){ac.innerHTML=`<div class="stock-alert"><i class="bi bi-exclamation-triangle-fill"></i><div class="alert-text"><strong>¡Sobrestock!</strong> Excederá ${q-c.cantidad_calculada} unidades para <strong>${escapeHtml(c.producto_nombre)}</strong>. Registre como Movimiento Fuera del Picking.</div></div>`;ac.style.display='block';}else{let any=false;pickingCalculations.forEach((x,j)=>{const q2=parseInt(document.getElementById(`pickingQty_${j}`)?.value)||0;if(x.cantidad_encontrada>0&&q2>x.cantidad_calculada)any=true;});if(!any)ac.style.display='none';}}

async function savePicking(){if(!pickingCalculations?.length){showToast('No hay productos para registrar. Seleccione un área primero.','warning');return;}const aid=parseInt(document.getElementById('pickingArea').value);const pid=parseInt(document.getElementById('pickingPeriodoId').value);const registros=[];for(let i=0;i<pickingCalculations.length;i++){const c=pickingCalculations[i];const q=parseInt(document.getElementById(`pickingQty_${i}`)?.value)||0;registros.push({producto_id:c.producto_id,cantidad_entregada:q});}try{const r=await api.post('/picking/batch',{periodo_id:pid,area_id:aid,registros});if(r?.success){showToast(r.message,'success');if(r.alertas)r.alertas.forEach(a=>showToast(a,'warning'));closeModal('pickingModal');loadPicking();}else showToast(r?.message||'Error al registrar','danger');}catch(e){showToast('Error de conexión','danger');}}

async function editPicking(id,c){const v=await promptAction('Nueva cantidad entregada:',c,'Editar Picking','number');if(v===null)return;const q=parseInt(v);if(isNaN(q)||q<0){showToast('Cantidad inválida','warning');return;}try{const r=await api.put(`/picking/${id}`,{cantidad_entregada:q});if(r?.success){showToast(r.message,'success');if(r.alerta)showToast(r.alerta,'warning');loadPicking();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');}}

async function deletePicking(id){if(!await confirmAction('¿Eliminar este picking?'))return;try{const r=await api.delete(`/picking/${id}`);if(r?.success){showToast(r.message,'success');loadPicking();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');}}

// ====== AUDITORÍAS ======
async function loadAuditorias(){try{const r=await api.get('/auditorias',{periodo_id:document.getElementById('filterAudPeriodo')?.value,area_id:document.getElementById('filterAudArea')?.value,producto_id:document.getElementById('filterAudProducto')?.value});renderAuditoriasTable(r?.data||[]);}catch(e){console.error(e);}}

function renderAuditoriasTable(a){const t=document.getElementById('auditoriasTableBody');if(!a?.length){t.innerHTML='<tr><td colspan="7" class="text-center py-4"><div class="empty-state"><p>No hay auditorías</p></div></td></tr>';return;}t.innerHTML=a.map((x,i)=>{let act='';if(isAdmin()){act=`<button class="btn btn-edit" onclick="editAuditoria(${x.id},${x.cantidad_encontrada})"><i class="bi bi-pencil"></i></button> <button class="btn btn-delete" onclick="deleteAuditoria(${x.id})"><i class="bi bi-trash"></i></button>`;}return`<tr><td>${i+1}</td><td>${escapeHtml(x.periodo_nombre||'-')}</td><td>${escapeHtml(x.area_nombre)}</td><td>${escapeHtml(x.producto_nombre)} <small class="text-muted">(${escapeHtml(x.producto_codigo)})</small></td><td><strong>${x.cantidad_encontrada}</strong></td><td>${formatDateTime(x.created_at)}</td><td class="actions-cell">${act}</td></tr>`;}).join('');hideViewerActions();}

function clearAuditoriaFilters(){document.getElementById('filterAudPeriodo').value='';document.getElementById('filterAudArea').value='';document.getElementById('filterAudProducto').value='';loadAuditorias();}

async function openAuditoriaModal(){if(!activePeriod){showToast('No hay período activo','warning');return;}document.getElementById('audPeriodo').value=activePeriod.nombre;document.getElementById('audPeriodoId').value=activePeriod.id;document.getElementById('audArea').value='';document.getElementById('auditoriaProductsContainer').innerHTML='<div class="empty-state"><p>Seleccione un área</p></div>';const sel=document.getElementById('audArea');sel.innerHTML='<option value="">Seleccione área...</option>';try{const r=await api.get('/auditorias',{periodo_id:activePeriod.id});const usedAreas=[...new Set((r?.data||[]).map(a=>String(a.area_id)))];allAreas.forEach(a=>{const o=document.createElement('option');o.value=a.id;if(usedAreas.includes(String(a.id))){o.textContent=a.nombre+' \u2713 Ya tiene auditoría';o.disabled=true;}else{o.textContent=a.nombre;}sel.appendChild(o);});}catch(e){allAreas.forEach(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.nombre;sel.appendChild(o);});}openModal('auditoriaModal');}

async function loadAuditProducts(){const aid=document.getElementById('audArea').value;const c=document.getElementById('auditoriaProductsContainer');if(!aid){c.innerHTML='<div class="empty-state"><p>Seleccione un área</p></div>';return;}try{const r=await api.get('/asignaciones/area/'+aid);const p=r?.data||[];if(!p.length){c.innerHTML='<div class="empty-state"><p>No hay productos</p></div>';return;}let h='<div class="table-responsive"><table class="table-fp"><thead><tr><th>Producto</th><th>Código</th><th>Estándar</th><th>Encontrada</th></tr></thead><tbody>';p.forEach(x=>{h+=`<tr><td><strong>${escapeHtml(x.producto_nombre)}</strong></td><td><code>${escapeHtml(x.producto_codigo)}</code></td><td>${x.cantidad_asignada}</td><td><input type="number" class="form-control form-control-sm" style="width:80px" id="auditQty_${x.producto_id}" min="0" value="${x.cantidad_asignada}"></td></tr>`;});c.innerHTML=h+'</tbody></table></div>';}catch(e){showToast('Error','danger');}}

async function saveAuditoria(){const aid=document.getElementById('audArea').value;const pid=document.getElementById('audPeriodoId').value;if(!validateRequired(aid,'Área'))return;const reg=[];document.querySelectorAll('[id^="auditQty_"]').forEach(i=>{reg.push({producto_id:parseInt(i.id.replace('auditQty_','')),cantidad_encontrada:parseInt(i.value)||0});});if(!reg.length){showToast('No hay productos','warning');return;}try{const r=await api.post('/auditorias',{periodo_id:parseInt(pid),area_id:parseInt(aid),registros:reg});if(r?.success){showToast(r.message,'success');closeModal('auditoriaModal');loadAuditorias();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');}}

async function editAuditoria(id,c){const v=await promptAction('Nueva cantidad encontrada:',c,'Editar Auditoría','number');if(v===null)return;const q=parseInt(v);if(isNaN(q)||q<0){showToast('Cantidad inválida','warning');return;}try{const r=await api.put(`/auditorias/${id}`,{cantidad_encontrada:q});if(r?.success){showToast(r.message,'success');loadAuditorias();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');}}

async function deleteAuditoria(id){if(!await confirmAction('¿Eliminar esta auditoría?'))return;try{const r=await api.delete(`/auditorias/${id}`);if(r?.success){showToast(r.message,'success');loadAuditorias();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');}}

// ====== MOVIMIENTOS ======
async function loadMovimientos(){try{const r=await api.get('/movimientos',{periodo_id:document.getElementById('filterMovPeriodo')?.value,area_id:document.getElementById('filterMovArea')?.value,producto_id:document.getElementById('filterMovProducto')?.value});renderMovimientosTable(r?.data||[]);}catch(e){console.error(e);}}

function renderMovimientosTable(m){const t=document.getElementById('movimientosTableBody');if(!m?.length){t.innerHTML='<tr><td colspan="8" class="text-center py-4"><div class="empty-state"><p>No hay movimientos</p></div></td></tr>';return;}t.innerHTML=m.map((x,i)=>{let act='';if(isAdmin()){act=`<button class="btn btn-edit" onclick="editMovimiento(${x.id},${x.area_id},${x.producto_id},${x.cantidad},'${escapeHtml(x.motivo||'').replace(/'/g,"\\'")}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-delete" onclick="deleteMovimiento(${x.id})"><i class="bi bi-trash"></i></button>`;}return`<tr><td>${i+1}</td><td>${escapeHtml(x.periodo_nombre||'-')}</td><td>${escapeHtml(x.area_nombre)}</td><td>${escapeHtml(x.producto_nombre)} <small class="text-muted">(${escapeHtml(x.producto_codigo)})</small></td><td><strong class="text-danger">+${x.cantidad}</strong></td><td>${escapeHtml(x.motivo)||'<span class="text-muted">-</span>'}</td><td>${formatDateTime(x.created_at)}</td><td class="actions-cell">${act}</td></tr>`;}).join('');hideViewerActions();}

function clearMovimientoFilters(){document.getElementById('filterMovPeriodo').value='';document.getElementById('filterMovArea').value='';document.getElementById('filterMovProducto').value='';loadMovimientos();}

function openMovimientoModal(m=null){if(!activePeriod&&!m){showToast('No hay período activo','warning');return;}document.getElementById('movimientoId').value=m?m.id:'';document.getElementById('movPeriodo').value=activePeriod?activePeriod.nombre:'';document.getElementById('movPeriodoId').value=activePeriod?activePeriod.id:'';document.getElementById('movArea').value=m?m.area_id:'';document.getElementById('movProducto').value=m?m.producto_id:'';document.getElementById('movCantidad').value=m?m.cantidad:'';document.getElementById('movMotivo').value=m?(m.motivo||''):'';document.getElementById('movimientoModalTitle').innerHTML=m?'<i class="bi bi-pencil"></i> Editar Movimiento':'<i class="bi bi-arrow-left-right"></i> Nuevo Movimiento Fuera del Picking';openModal('movimientoModal');}

function editMovimiento(id,aid,pid,c,mo){openMovimientoModal({id,area_id:aid,producto_id:pid,cantidad:c,motivo:mo});}

async function loadMovProductos(){const aid=document.getElementById('movArea').value;const ps=document.getElementById('movProducto');ps.innerHTML='<option value="">Seleccione producto</option>';if(!aid)return;try{const r=await api.get('/asignaciones/area/'+aid);(r?.data||[]).forEach(p=>{const o=document.createElement('option');o.value=p.producto_id;o.textContent=`${p.producto_nombre} (${p.producto_codigo})`;ps.appendChild(o);});}catch(e){console.error(e);}}

async function saveMovimiento(){const id=document.getElementById('movimientoId').value;const aid=document.getElementById('movArea').value;const pid=document.getElementById('movProducto').value;const c=parseInt(document.getElementById('movCantidad').value);const mo=document.getElementById('movMotivo').value.trim();if(!validateRequired(aid,'Área'))return;if(!validateRequired(pid,'Producto'))return;if(!validateNumber(c,'Cantidad',1))return;try{const r=id?await api.put(`/movimientos/${id}`,{cantidad:c,motivo:mo}):await api.post('/movimientos',{area_id:parseInt(aid),producto_id:parseInt(pid),cantidad:c,motivo:mo});if(r?.success){showToast(r.message,'success');closeModal('movimientoModal');loadMovimientos();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');}}

async function deleteMovimiento(id){if(!await confirmAction('¿Eliminar este movimiento?'))return;try{const r=await api.delete(`/movimientos/${id}`);if(r?.success){showToast(r.message,'success');loadMovimientos();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');}}

// ====== USUARIOS ======
async function loadUsuarios(){try{const r=await api.get('/usuarios');renderUsuariosTable(r?.data||[]);}catch(e){console.error(e);}}

function renderUsuariosTable(u){const t=document.getElementById('usuariosTableBody');if(!u?.length){t.innerHTML='<tr><td colspan="7" class="text-center py-4"><div class="empty-state"><p>No hay usuarios</p></div></td></tr>';return;}t.innerHTML=u.map((x,i)=>{const rolBadge=x.rol==='admin'?'<span class="badge-fp badge-activo">Admin</span>':'<span class="badge-fp badge-cerrado">Lectura</span>';const statusBadge=x.activo?'<span class="badge-fp badge-activo">Activo</span>':'<span class="badge-fp badge-no-cuadra">Inactivo</span>';let act='';if(x.id!==1){act=`<button class="btn btn-edit" onclick="editUsuario(${x.id})" title="Editar"><i class="bi bi-pencil"></i></button> <button class="btn btn-delete" onclick="deleteUsuario(${x.id})" title="Eliminar"><i class="bi bi-trash"></i></button>`;}return`<tr><td>${i+1}</td><td><strong>${escapeHtml(x.usuario)}</strong></td><td>${escapeHtml(x.nombre_completo)}</td><td>${rolBadge}</td><td>${statusBadge}</td><td>${formatDate(x.created_at)}</td><td class="actions-cell">${act}</td></tr>`;}).join('');}

function openUsuarioModal(u=null){document.getElementById('usuarioId').value=u?u.id:'';document.getElementById('usuarioLogin').value=u?u.usuario:'';document.getElementById('usuarioPass').value='';document.getElementById('usuarioNombre').value=u?u.nombre_completo:'';document.getElementById('usuarioRol').value=u?u.rol:'lectura';document.getElementById('usuarioModalTitle').innerHTML=u?'<i class="bi bi-pencil"></i> Editar Usuario':'<i class="bi bi-person-plus"></i> Nuevo Usuario';document.getElementById('usuarioLogin').disabled=!!u;document.getElementById('passFieldGroup').style.display=u?'none':'';openModal('usuarioModal');}

async function editUsuario(id){try{const r=await api.get(`/usuarios/${id}`);if(r?.success)openUsuarioModal(r.data);}catch(e){showToast('Error','danger');}}

async function saveUsuario(){const id=document.getElementById('usuarioId').value;const login=document.getElementById('usuarioLogin').value.trim();const pass=document.getElementById('usuarioPass').value;const nombre=document.getElementById('usuarioNombre').value.trim();const rol=document.getElementById('usuarioRol').value;if(!id){if(!validateRequired(login,'Usuario'))return;if(!validateMinLength(login,3,'Usuario'))return;if(!validateRequired(pass,'Contraseña'))return;if(pass.length<6){showToast('La contraseña debe tener al menos 6 caracteres','warning');return;}}if(!validateRequired(nombre,'Nombre Completo'))return;if(!validateMinLength(nombre,3,'Nombre Completo'))return;try{let r;if(id){r=await api.put(`/usuarios/${id}`,{nombre_completo:nombre,rol});}else{r=await api.post('/usuarios',{usuario:login,password:pass,nombre_completo:nombre,rol});}if(r?.success){showToast(r.message,'success');closeModal('usuarioModal');loadUsuarios();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error de conexión','danger');}}

async function deleteUsuario(id){if(!await confirmAction('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.'))return;try{const r=await api.delete(`/usuarios/${id}`);if(r?.success){showToast(r.message,'success');loadUsuarios();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error','danger');}}

// ====== PERFIL ======
async function loadPerfil(){try{const r=await api.get('/auth/me');if(r?.success)renderPerfilInfo(r.data);}catch(e){console.error(e);}}

function renderPerfilInfo(u){const c=document.getElementById('perfilInfo');const initials=u.nombre_completo.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();c.innerHTML=`
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
    <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--accent-red),#FF453A);display:flex;align-items:center;justify-content:center;font-size:24px;color:white;font-weight:700;">${initials}</div>
    <div><div style="font-size:18px;font-weight:700;">${escapeHtml(u.nombre_completo)}</div><div style="color:var(--text-secondary);font-size:13px;">${escapeHtml(u.usuario)}</div></div>
  </div>
  <div style="display:grid;gap:12px;">
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle);"><span style="color:var(--text-secondary);font-size:13px;">Rol</span><span>${u.rol==='admin'?'<span class="badge-fp badge-activo">Administrador</span>':'<span class="badge-fp badge-cerrado">Solo Lectura</span>'}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle);"><span style="color:var(--text-secondary);font-size:13px;">Estado</span><span>${u.activo?'<span class="badge-fp badge-activo">Activo</span>':'<span class="badge-fp badge-no-cuadra">Inactivo</span>'}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;"><span style="color:var(--text-secondary);font-size:13px;">Miembro desde</span><span style="font-size:13px;">${formatDate(u.created_at)}</span></div>
  </div>`;}

async function changeMyPassword(e){e.preventDefault();const cur=document.getElementById('currentPass').value;const nw=document.getElementById('newPass').value;const conf=document.getElementById('confirmPass').value;if(!validateRequired(cur,'Contraseña Actual'))return;if(!validateRequired(nw,'Nueva Contraseña'))return;if(nw.length<6){showToast('Mínimo 6 caracteres','warning');return;}if(nw!==conf){showToast('Las contraseñas no coinciden','warning');return;}if(cur===nw){showToast('La nueva contraseña debe ser diferente a la actual','warning');return;}try{const r=await api.put('/usuarios/change-password/me',{current_password:cur,new_password:nw});if(r?.success){showToast(r.message,'success');document.getElementById('changePassForm').reset();}else showToast(r?.message||'Error','danger');}catch(e){showToast('Error de conexión','danger');}}

// ===================== TRUPAL PRODUCTOS (Catálogo) =====================
let trupalProductosData = [];
let allTrupalProductos = [];

async function loadTrupalProductos() {
  try {
    const r = await api.get('/trupal-productos', {
      nombre: document.getElementById('filterTrupalProdNombre')?.value,
      codigo: document.getElementById('filterTrupalProdCodigo')?.value
    });
    trupalProductosData = r?.data || [];
    renderTrupalProductosTable(trupalProductosData);
  } catch(e) { showToast('Error al cargar productos','danger'); }
}

async function loadTrupalProductosDropdown() {
  try {
    const r = await api.get('/trupal-productos');
    allTrupalProductos = r?.data || [];
    ['trupalProducto','filterTrupalProducto'].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      const v = el.value;
      const first = el.options[0];
      el.innerHTML = '';
      if(first) el.appendChild(first);
      allTrupalProductos.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.codigo ? `${p.nombre} (${p.codigo})` : p.nombre;
        el.appendChild(o);
      });
      if(v) el.value = v;
    });
  } catch(e) { console.error(e); }
}

function renderTrupalProductosTable(data) {
  const t = document.getElementById('trupalProductosTableBody');
  if(!data?.length) {
    t.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="empty-state"><p>No se encontraron productos</p></div></td></tr>';
    return;
  }
  t.innerHTML = data.map((x, i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${escapeHtml(x.nombre)}</strong></td>
      <td>${x.codigo ? '<code>'+escapeHtml(x.codigo)+'</code>' : '<span class="text-muted">-</span>'}</td>
      <td>${formatDate(x.created_at)}</td>
      <td class="actions-cell">
        <button class="btn btn-edit" onclick="editTrupalProducto(${x.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-delete" onclick="deleteTrupalProducto(${x.id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');
  hideViewerActions();
}

function clearTrupalProdFilters() {
  document.getElementById('filterTrupalProdNombre').value = '';
  document.getElementById('filterTrupalProdCodigo').value = '';
  loadTrupalProductos();
}

function openTrupalProductoModal(data = null) {
  document.getElementById('trupalProductoId').value = data ? data.id : '';
  document.getElementById('trupalProductoNombre').value = data ? data.nombre : '';
  document.getElementById('trupalProductoCodigo').value = data ? (data.codigo || '') : '';
  document.getElementById('trupalProductoModalTitle').innerHTML = data
    ? '<i class="bi bi-pencil"></i> Editar Producto'
    : '<i class="bi bi-box-seam"></i> Nuevo Producto';
  openModal('trupalProductoModal');
}

async function editTrupalProducto(id) {
  try {
    const r = await api.get('/trupal-productos/' + id);
    if(r?.success) openTrupalProductoModal(r.data);
  } catch(e) { showToast('Error al cargar','danger'); }
}

async function saveTrupalProducto() {
  const id = document.getElementById('trupalProductoId').value;
  const nombre = document.getElementById('trupalProductoNombre').value.trim();
  const codigo = document.getElementById('trupalProductoCodigo').value.trim();
  if(!validateRequired(nombre, 'Nombre')) return;
  if(!validateMinLength(nombre, 2, 'Nombre')) return;
  try {
    const r = id
      ? await api.put('/trupal-productos/' + id, { nombre, codigo })
      : await api.post('/trupal-productos', { nombre, codigo });
    if(r?.success) {
      showToast(r.message, 'success');
      closeModal('trupalProductoModal');
      loadTrupalProductos();
      loadTrupalProductosDropdown();
    } else showToast(r?.message || 'Error', 'danger');
  } catch(e) { showToast('Error de conexión','danger'); }
}

async function deleteTrupalProducto(id) {
  if(!await confirmAction('¿Eliminar este producto? Asegúrese de que no tenga movimientos asociados.')) return;
  try {
    const r = await api.delete('/trupal-productos/' + id);
    if(r?.success) {
      showToast(r.message, 'success');
      loadTrupalProductos();
      loadTrupalProductosDropdown();
    } else showToast(r?.message || 'Error', 'danger');
  } catch(e) { showToast('Error de conexión','danger'); }
}

// ===================== TRUPAL (Movimientos) =====================
let trupalData = [];

function getTodayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function loadTrupal() {
  await loadTrupalProductosDropdown();
  const tipo = document.getElementById('filterTrupalTipo').value;
  const producto_id = document.getElementById('filterTrupalProducto').value;
  const placa = document.getElementById('filterTrupalPlaca').value;
  const desde = document.getElementById('filterTrupalDesde').value;
  const hasta = document.getElementById('filterTrupalHasta').value;
  try {
    const r = await api.get('/trupal', { tipo, producto_id, placa, fecha_desde: desde, fecha_hasta: hasta });
    trupalData = r?.data || [];
    renderTrupalTable();
    loadTrupalBalance();
  } catch(e) { showToast('Error al cargar Trupal','danger'); }
}

async function loadTrupalBalance() {
  const producto_id = document.getElementById('filterTrupalProducto').value;
  const placa = document.getElementById('filterTrupalPlaca').value;
  const desde = document.getElementById('filterTrupalDesde').value;
  const hasta = document.getElementById('filterTrupalHasta').value;
  try {
    const r = await api.get('/trupal/balance', { producto_id, placa, fecha_desde: desde, fecha_hasta: hasta });
    const d = r?.data;
    if(!d) return;
    document.getElementById('trupalTotalEntradas').textContent = d.total_entradas;
    document.getElementById('trupalTotalDevoluciones').textContent = d.total_devoluciones;
    document.getElementById('trupalBalance').textContent = d.balance;
    document.getElementById('trupalRegistros').textContent = trupalData.length;
    const ptb = document.getElementById('trupalBalanceProductTable');
    if(d.por_producto && d.por_producto.length > 0) {
      ptb.innerHTML = d.por_producto.map(p => `
        <tr>
          <td><strong>${escapeHtml(p.producto)}</strong></td>
          <td>${p.codigo ? '<code>'+escapeHtml(p.codigo)+'</code>' : '-'}</td>
          <td><span class="badge badge-activo">+${p.entradas}</span></td>
          <td><span class="badge badge-cerrado">-${p.devoluciones}</span></td>
          <td><strong style="color:${p.saldo >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${p.saldo}</strong></td>
        </tr>
      `).join('');
    } else {
      ptb.innerHTML = '<tr><td colspan="5" class="text-center py-3" style="color:var(--text-muted)">Sin datos</td></tr>';
    }
  } catch(e) { console.error('Error balance:', e); }
}

function renderTrupalTable() {
  const tbody = document.getElementById('trupalTableBody');
  if(!trupalData.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="empty-state"><p>No hay registros</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = trupalData.map((t, i) => {
    const tipoBadge = t.tipo==='entrada' ? '<i class="bi bi-box-arrow-in-down"></i> Entrada' : '<i class="bi bi-box-arrow-up"></i> Devolución';
    const fullNombre = t.producto_nombre||'';
    const nombreCorto = fullNombre.length > 18 ? fullNombre.substring(0, 18) + '...' : fullNombre;
    const placaHtml = t.placa ? '<code style="background:var(--bg-glass);padding:2px 8px;border-radius:4px;font-size:12px;">'+escapeHtml(t.placa)+'</code>' : '<span style="color:var(--text-muted)">—</span>';
    const guiaHtml = t.num_guia ? '<code style="background:var(--bg-glass);padding:2px 8px;border-radius:4px;font-size:12px;">'+escapeHtml(t.num_guia)+'</code>' : '<span style="color:var(--text-muted)">—</span>';
    const cantColor = t.tipo==='entrada' ? 'var(--accent-green)' : 'var(--accent-red)';
    const cantSign = t.tipo==='entrada' ? '+' : '-';
    let act = '';
    if(isAdmin()) {
      act = `<button class="btn btn-edit" onclick="editTrupal(${t.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-delete" onclick="deleteTrupal(${t.id})"><i class="bi bi-trash"></i></button>`;
    }
    return `<tr>
      <td>${i+1}</td>
      <td><span class="badge ${t.tipo==='entrada'?'badge-activo':'badge-cerrado'}" style="font-size:11px;">${tipoBadge}</span></td>
      <td><span class="tooltip-name" data-tip="${escapeHtml(fullNombre)}"><strong>${escapeHtml(nombreCorto)}</strong></span></td>
      <td>${guiaHtml}</td>
      <td>${placaHtml}</td>
      <td><strong style="color:${cantColor}">${cantSign}${t.cantidad}</strong></td>
      <td style="font-size:12px;color:var(--text-secondary);">${formatDate(t.fecha)}</td>
      <td class="actions-cell">${act}</td>
    </tr>`;
  }).join('');
  hideViewerActions();
}

function openTrupalModal(data = null) {
  document.getElementById('trupalForm').reset();
  document.getElementById('trupalId').value = '';
  document.getElementById('trupalCantidad').value = 1;
  document.getElementById('trupalFecha').value = getTodayLocal();
  if(data) {
    document.getElementById('trupalModalTitle').innerHTML = '<i class="bi bi-pencil"></i> Editar Registro';
    document.getElementById('trupalId').value = data.id;
    document.getElementById('trupalTipo').value = data.tipo;
    document.getElementById('trupalProducto').value = data.producto_id;
    document.getElementById('trupalNumGuia').value = data.num_guia || '';
    document.getElementById('trupalPlaca').value = data.placa || '';
    document.getElementById('trupalCantidad').value = data.cantidad;
    document.getElementById('trupalFecha').value = data.fecha ? data.fecha.split('T')[0] : getTodayLocal();
  } else {
    document.getElementById('trupalModalTitle').innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Nuevo Registro';
  }
  onTrupalTipoChange();
  openModal('trupalModal');
}

async function editTrupal(id) {
  try {
    const r = await api.get('/trupal/' + id);
    if(r?.success) openTrupalModal(r.data);
  } catch(e) { showToast('Error al cargar','danger'); }
}

function onTrupalTipoChange() {
  const tipo = document.getElementById('trupalTipo').value;
  const placaGroup = document.getElementById('trupalPlacaGroup');
  const placaInput = document.getElementById('trupalPlaca');
  if(tipo === 'devolucion') {
    placaInput.removeAttribute('required');
    placaGroup.querySelector('label').innerHTML = 'Placa del Camión <span style="font-size:11px;color:var(--text-muted);">(opcional en devoluciones)</span>';
  } else {
    placaInput.setAttribute('required', 'required');
    placaGroup.querySelector('label').innerHTML = 'Placa del Camión * <span style="font-size:11px;color:var(--text-muted);">(obligatoria en entradas)</span>';
  }
}

async function saveTrupal() {
  const id = document.getElementById('trupalId').value;
  const tipo = document.getElementById('trupalTipo').value;
  const producto_id = parseInt(document.getElementById('trupalProducto').value);
  const num_guia = document.getElementById('trupalNumGuia').value.trim();
  const placa = document.getElementById('trupalPlaca').value.trim();
  const cantidad = parseInt(document.getElementById('trupalCantidad').value);
  const fecha = document.getElementById('trupalFecha').value;

  if(!validateRequired(tipo, 'Tipo')) return;
  if(!producto_id) { showToast('Debe seleccionar un producto','warning'); return; }
  if(tipo === 'entrada' && !validateRequired(placa, 'Placa del Camión')) return;
  if(!cantidad || cantidad < 1) { showToast('La cantidad debe ser al menos 1','warning'); return; }
  if(!validateRequired(fecha, 'Fecha')) return;

  try {
    const body = { tipo, producto_id, num_guia: num_guia || null, placa: placa || null, cantidad, fecha };
    const r = id ? await api.put('/trupal/' + id, body) : await api.post('/trupal', body);
    if(r?.success) {
      showToast(r.message, 'success');
      closeModal('trupalModal');
      loadTrupal();
    } else showToast(r?.message || 'Error al guardar', 'danger');
  } catch(e) { showToast('Error de conexión','danger'); }
}

async function deleteTrupal(id) {
  if(!await confirmAction('¿Eliminar este registro de Trupal?')) return;
  try {
    const r = await api.delete('/trupal/' + id);
    if(r?.success) {
      showToast(r.message, 'success');
      loadTrupal();
    } else showToast(r?.message || 'Error al eliminar', 'danger');
  } catch(e) { showToast('Error de conexión','danger'); }
}

function clearTrupalFilters() {
  document.getElementById('filterTrupalTipo').value = '';
  document.getElementById('filterTrupalProducto').value = '';
  document.getElementById('filterTrupalPlaca').value = '';
  document.getElementById('filterTrupalDesde').value = '';
  document.getElementById('filterTrupalHasta').value = '';
  loadTrupal();
}

