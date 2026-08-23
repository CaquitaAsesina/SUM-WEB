// API Helper - Suministros Farmacias Peruanas (with JWT auth)
const API_BASE = '/api';

function getAuthToken() {
  return localStorage.getItem('fp_token');
}

function getUser() {
  try {
    const raw = localStorage.getItem('fp_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Validate required fields
    if (!user || !user.id || !user.usuario) return null;
    return user;
  } catch {
    return null;
  }
}

function isAdmin() {
  const user = getUser();
  return user && user.rol === 'admin';
}

function isLoggedIn() {
  const token = getAuthToken();
  if (!token) return false;
  // Check if token is expired (decode payload)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      logout();
      return false;
    }
    return true;
  } catch {
    logout();
    return false;
  }
}

function logout() {
  localStorage.removeItem('fp_token');
  localStorage.removeItem('fp_user');
  // Clear any cached data
  if (window.caches) caches.keys().then(names => names.forEach(name => caches.delete(name)));
  window.location.href = '/login.html';
}

function checkAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// Clear console in production to prevent data leakage
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
}

const api = {
  async get(endpoint, params = {}) {
    const url = new URL(API_BASE + endpoint, window.location.origin);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, val);
      }
    });
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (res.status === 401) { logout(); return; }
    return res.json();
  },

  async post(endpoint, data) {
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify(data)
    });
    if (res.status === 401) { logout(); return; }
    return res.json();
  },

  async put(endpoint, data) {
    const res = await fetch(API_BASE + endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify(data)
    });
    if (res.status === 401) { logout(); return; }
    return res.json();
  },

  async delete(endpoint) {
    const res = await fetch(API_BASE + endpoint, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (res.status === 401) { logout(); return; }
    return res.json();
  }
};

// ====== Toast notification system ======
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: 'bi-check-circle-fill',
    danger: 'bi-exclamation-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };
  const toast = document.createElement('div');
  toast.className = `toast-fp ${type}`;
  toast.innerHTML = `
    <i class="bi ${icons[type] || icons.info}"></i>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ====== Modal helper ======
function openModal(modalId) {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) return null;
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  return modal;
}

function closeModal(modalId) {
  const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
  if (modal) modal.hide();
}

// ====== Confirm Modal (replaces native confirm()) ======
function confirmAction(message, title = 'Confirmar acción') {
  return new Promise((resolve) => {
    const modalId = 'confirmModalFP';

    // Reuse or create modal
    let modalEl = document.getElementById(modalId);
    if (modalEl) modalEl.remove();

    modalEl = document.createElement('div');
    modalEl.className = 'modal fade modal-fp';
    modalEl.id = modalId;
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header" style="background:linear-gradient(135deg,#F57F17,#E65100);">
            <h5 class="modal-title"><i class="bi bi-question-circle"></i> ${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p style="font-size:15px; color:#333; margin:0;">${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn-fp btn-fp-danger" id="confirmBtnFP">Confirmar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById('confirmBtnFP').addEventListener('click', () => {
      modal.hide();
      resolve(true);
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
      resolve(false);
      modalEl.remove();
    });
  });
}

// ====== Prompt Modal (replaces native prompt()) ======
function promptAction(message, defaultValue = '', title = 'Ingrese un valor', type = 'text') {
  return new Promise((resolve) => {
    const modalId = 'promptModalFP';

    let modalEl = document.getElementById(modalId);
    if (modalEl) modalEl.remove();

    modalEl = document.createElement('div');
    modalEl.className = 'modal fade modal-fp';
    modalEl.id = modalId;
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header" style="background:linear-gradient(135deg,#FF3B30,#CC2D24);">
            <h5 class="modal-title" style="color:white;"><i class="bi bi-pencil-square"></i> ${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p style="font-size:14px; color:#666; margin-bottom:12px;">${message}</p>
            <input type="${type}" class="form-control" id="promptInputFP" value="${defaultValue}" style="border-radius:8px;">
            <div class="invalid-feedback" id="promptErrorFP"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn-fp" id="promptBtnFP">Aceptar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    setTimeout(() => {
      const input = document.getElementById('promptInputFP');
      input.focus();
      input.select();
    }, 300);

    document.getElementById('promptBtnFP').addEventListener('click', () => {
      const val = document.getElementById('promptInputFP').value.trim();
      if (val === '') {
        document.getElementById('promptInputFP').classList.add('is-invalid');
        document.getElementById('promptErrorFP').textContent = 'Este campo no puede estar vacío';
        return;
      }
      modal.hide();
      resolve(val);
    });

    document.getElementById('promptInputFP').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('promptBtnFP').click();
      }
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
      resolve(null);
      modalEl.remove();
    });
  });
}

// ====== Date formatters ======
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ====== XSS protection ======
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ====== Loading state ======
function setLoading(containerId, loading) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (loading) {
    el.innerHTML = '<div class="loading-spinner"></div>';
  }
}

// ====== Validation helpers ======
function validateRequired(value, fieldName) {
  if (!value || value.trim() === '') {
    showToast(`El campo "${fieldName}" es requerido`, 'warning');
    return false;
  }
  return true;
}

function validateMinLength(value, min, fieldName) {
  if (value && value.trim().length < min) {
    showToast(`"${fieldName}" debe tener al menos ${min} caracteres`, 'warning');
    return false;
  }
  return true;
}

function validateNumber(value, fieldName, min = 0) {
  const num = parseInt(value);
  if (isNaN(num) || num < min) {
    showToast(`"${fieldName}" debe ser un número válido ${min > 0 ? '(mínimo ' + min + ')' : ''}`, 'warning');
    return false;
  }
  return true;
}

function validatePositive(value, fieldName) {
  const num = parseInt(value);
  if (isNaN(num) || num < 0) {
    showToast(`"${fieldName}" debe ser un número positivo`, 'warning');
    return false;
  }
  return true;
}

function validateAlphaNumeric(value, fieldName) {
  if (value && !/^[a-zA-Z0-9\-_]+$/.test(value.trim())) {
    showToast(`"${fieldName}" solo puede contener letras, números, guiones o guiones bajos`, 'warning');
    return false;
  }
  return true;
}

function validateEmail(value, fieldName) {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    showToast(`"${fieldName}" debe ser un correo electrónico válido`, 'warning');
    return false;
  }
  return true;
}

function validateMaxLength(value, max, fieldName) {
  if (value && value.trim().length > max) {
    showToast(`"${fieldName}" no puede exceder ${max} caracteres`, 'warning');
    return false;
  }
  return true;
}
