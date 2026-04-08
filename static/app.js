'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  files: [],       // [{ id, file, name, size }]
  format: 'docx',
  separator: 'pagebreak',
  idCounter: 0,
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('file-input');
const pickBtn      = document.getElementById('pick-files');
const filesList    = document.getElementById('files-list');
const textToggle   = document.getElementById('text-toggle');
const textSection  = document.getElementById('text-section');
const textInput    = document.getElementById('text-input');
const convertBtn   = document.getElementById('convert-btn');
const convertLabel = document.getElementById('convert-label');
const toast        = document.getElementById('toast');

// ── Drag & Drop ────────────────────────────────────────────────────────────
['dragenter', 'dragover'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); })
);
dropzone.addEventListener('drop', e => addFiles(e.dataTransfer.files));
dropzone.addEventListener('click', e => {
  if (e.target === pickBtn || pickBtn.contains(e.target)) return;
  fileInput.click();
});
pickBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', () => addFiles(fileInput.files));

// ── File Management ────────────────────────────────────────────────────────
function addFiles(fileList) {
  Array.from(fileList).forEach(file => {
    if (!file.name.match(/\.(md|markdown|txt)$/i)) {
      showToast(`File non supportato: ${file.name}`, 'error');
      return;
    }
    state.files.push({ id: ++state.idCounter, file, name: file.name, size: file.size });
  });
  renderFilesList();
  fileInput.value = '';
}

function removeFile(id) {
  state.files = state.files.filter(f => f.id !== id);
  renderFilesList();
}

function moveFile(id, dir) {
  const idx = state.files.findIndex(f => f.id === id);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= state.files.length) return;
  [state.files[idx], state.files[newIdx]] = [state.files[newIdx], state.files[idx]];
  renderFilesList();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderFilesList() {
  filesList.innerHTML = '';
  state.files.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'file-item';
    el.innerHTML = `
      <div class="file-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </div>
      <span class="file-name" title="${escHtml(item.name)}">${escHtml(item.name)}</span>
      <span class="file-size">${formatBytes(item.size)}</span>
      <div class="file-actions">
        <button class="icon-btn" data-action="up" data-id="${item.id}" title="Sposta su" ${idx === 0 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button class="icon-btn" data-action="down" data-id="${item.id}" title="Sposta giù" ${idx === state.files.length - 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button class="icon-btn del" data-action="del" data-id="${item.id}" title="Rimuovi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`;
    filesList.appendChild(el);
  });
}

// Single delegated listener for the files list
filesList.addEventListener('click', handleFileListClick);

function handleFileListClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === 'del') removeFile(id);
  if (btn.dataset.action === 'up')  moveFile(id, -1);
  if (btn.dataset.action === 'down') moveFile(id, +1);
}

// ── Text Toggle ────────────────────────────────────────────────────────────
textToggle.addEventListener('click', () => {
  const open = textSection.style.display === 'none' || !textSection.style.display;
  textSection.style.display = open ? 'block' : 'none';
  textToggle.classList.toggle('open', open);
});

// ── Settings ───────────────────────────────────────────────────────────────
document.querySelectorAll('[data-format]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.format = btn.dataset.format;
    document.querySelectorAll('[data-format]').forEach(b => b.classList.toggle('active', b === btn));
  });
});

document.querySelectorAll('[data-sep]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.separator = btn.dataset.sep;
    document.querySelectorAll('[data-sep]').forEach(b => b.classList.toggle('active', b === btn));
  });
});

// ── Convert ────────────────────────────────────────────────────────────────
convertBtn.addEventListener('click', async () => {
  const hasFiles = state.files.length > 0;
  const hasText  = textInput.value.trim().length > 0;

  if (!hasFiles && !hasText) {
    showToast('Aggiungi almeno un file o del testo markdown.', 'error');
    return;
  }

  setLoading(true);

  const fd = new FormData();
  state.files.forEach(item => fd.append('files', item.file, item.name));
  if (hasText) fd.append('text', textInput.value.trim());
  fd.append('format', state.format);
  fd.append('separator', state.separator);

  try {
    const res = await fetch('/convert', { method: 'POST', body: fd });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Errore sconosciuto' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ext  = state.format === 'pdf' ? 'pdf' : 'docx';
    a.href     = url;
    a.download = `documento.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Download avviato!', 'success');
  } catch (err) {
    showToast(`Errore: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function setLoading(loading) {
  convertBtn.disabled = loading;
  convertLabel.innerHTML = loading
    ? '<div class="spinner"></div> Conversione in corso...'
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Converti e Scarica`;
}

let toastTimer;
function showToast(msg, type = '') {
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.querySelector('.toast-msg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
