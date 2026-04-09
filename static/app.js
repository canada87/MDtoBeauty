'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  files: [],    // [{ id, file, name, size }]  — markdown documents (ordered)
  assets: [],   // [{ file, path }]             — images / assets (flat bag)
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

const assetInput   = document.getElementById('asset-input');
const folderInput  = document.getElementById('folder-input');
const pickAssets   = document.getElementById('pick-assets');
const pickFolder   = document.getElementById('pick-folder');
const assetsList   = document.getElementById('assets-list');

const projectInput = document.getElementById('project-input');

// ── Drag & Drop (markdown) ─────────────────────────────────────────────────
['dragenter', 'dragover'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); })
);
dropzone.addEventListener('drop', e => addMarkdownFiles(e.dataTransfer.files));
dropzone.addEventListener('click', e => {
  if (e.target === pickBtn || pickBtn.contains(e.target)) return;
  fileInput.click();
});
pickBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', () => { addMarkdownFiles(fileInput.files); fileInput.value = ''; });

// ── Markdown file management ───────────────────────────────────────────────
function addMarkdownFiles(fileList) {
  Array.from(fileList).forEach(file => {
    if (!file.name.match(/\.(md|markdown|txt)$/i)) {
      showToast(`Tipo non supportato: ${file.name}`, 'error');
      return;
    }
    // Plain file picker: relPath is just the filename (root level, no rewriting needed)
    state.files.push({ id: ++state.idCounter, file, name: file.name, relPath: file.name, size: file.size });
  });
  renderFilesList();
}

// ── Project folder upload ──────────────────────────────────────────────────
const MD_RE    = /\.(md|markdown|txt)$/i;
const ASSET_RE = /\.(png|jpe?g|gif|svg|webp|bmp|tiff?|ico|avif)$/i;

projectInput.addEventListener('change', () => {
  addProjectFolder(projectInput.files);
  projectInput.value = '';
});

function addProjectFolder(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;

  const newMdItems = [];
  let assetAdded = 0;

  files.forEach(file => {
    // webkitRelativePath = "MAIN/chapter1/sub.md" → strip the root folder name
    const raw     = file.webkitRelativePath || file.name;
    const parts   = raw.split('/');
    const relPath = parts.length > 1 ? parts.slice(1).join('/') : file.name;

    if (MD_RE.test(file.name)) {
      if (state.files.some(f => f.relPath === relPath)) return;  // skip duplicate
      newMdItems.push({ id: ++state.idCounter, file, name: file.name, relPath, size: file.size });
    } else if (ASSET_RE.test(file.name)) {
      if (state.assets.some(a => a.path === relPath)) return;
      state.assets.push({ file, path: relPath });
      assetAdded++;
    }
  });

  // Sort: shallower paths first, then alphabetically within the same depth
  newMdItems.sort((a, b) => {
    const da = a.relPath.split('/').length;
    const db = b.relPath.split('/').length;
    return da !== db ? da - db : a.relPath.localeCompare(b.relPath);
  });

  state.files.push(...newMdItems);
  renderFilesList();
  if (assetAdded > 0) renderAssetsList();

  const summary = [];
  if (newMdItems.length > 0) summary.push(`${newMdItems.length} file markdown`);
  if (assetAdded > 0) summary.push(`${assetAdded} immagini`);
  if (summary.length > 0) showToast(`Caricati: ${summary.join(', ')}.`, 'success');
  else showToast('Nessun file supportato trovato nella cartella.', 'error');
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
        </svg>
      </div>
      <span class="file-name" title="${escHtml(item.relPath || item.name)}">${escHtml(item.relPath || item.name)}</span>
      <span class="file-size">${formatBytes(item.size)}</span>
      <div class="file-actions">
        <button class="icon-btn" data-action="up"   data-id="${item.id}" title="Sposta su"   ${idx === 0 ? 'disabled' : ''}>
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

filesList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === 'del')  removeFile(id);
  if (btn.dataset.action === 'up')   moveFile(id, -1);
  if (btn.dataset.action === 'down') moveFile(id, +1);
});

// ── Asset management ───────────────────────────────────────────────────────
pickAssets.addEventListener('click', () => assetInput.click());
pickFolder.addEventListener('click', () => {
  // Set webkitdirectory at click time to avoid browser quirks
  folderInput.setAttribute('webkitdirectory', '');
  folderInput.setAttribute('directory', '');
  folderInput.click();
});

assetInput.addEventListener('change', () => {
  addAssets(assetInput.files, false);
  assetInput.value = '';
});
folderInput.addEventListener('change', () => {
  addAssets(folderInput.files, true);
  folderInput.value = '';
});

function addAssets(fileList, fromFolder) {
  const ASSET_TYPES = /\.(png|jpe?g|gif|svg|webp|bmp|tiff?|ico|avif)$/i;
  let added = 0;

  Array.from(fileList).forEach(file => {
    // For folder uploads: use webkitRelativePath; strip the top-level folder name
    let relPath;
    if (fromFolder && file.webkitRelativePath) {
      const parts = file.webkitRelativePath.split('/');
      // Strip the root folder (e.g. "myproject/images/a.png" → "images/a.png")
      relPath = parts.slice(1).join('/') || file.name;
    } else {
      relPath = file.name;
    }

    // Skip non-image files when uploading a folder (ignore .md, .ds_store, etc.)
    if (fromFolder && !ASSET_TYPES.test(file.name)) return;

    // Skip duplicates by path
    if (state.assets.some(a => a.path === relPath)) return;

    state.assets.push({ file, path: relPath });
    added++;
  });

  if (added > 0) renderAssetsList();
  if (added === 0 && fromFolder) showToast('Nessuna immagine trovata nella cartella.', 'error');
}

function removeAsset(path) {
  state.assets = state.assets.filter(a => a.path !== path);
  renderAssetsList();
}

function renderAssetsList() {
  assetsList.innerHTML = '';
  state.assets.forEach(item => {
    const el = document.createElement('div');
    el.className = 'asset-item';
    el.innerHTML = `
      <div class="asset-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <span class="asset-path" title="${escHtml(item.path)}">${escHtml(item.path)}</span>
      <span class="asset-size">${formatBytes(item.file.size)}</span>
      <button class="icon-btn del" data-asset-path="${escHtml(item.path)}" title="Rimuovi">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>`;
    assetsList.appendChild(el);
  });
}

assetsList.addEventListener('click', e => {
  const btn = e.target.closest('[data-asset-path]');
  if (btn) removeAsset(btn.dataset.assetPath);
});

// ── Text Toggle ────────────────────────────────────────────────────────────
textToggle.addEventListener('click', () => {
  const open = textSection.style.display === 'none' || !textSection.style.display;
  textSection.style.display = open ? 'block' : 'none';
  textToggle.classList.toggle('open', open);
  textToggle.setAttribute('aria-expanded', String(open));
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
    showToast('Aggiungi almeno un file .md o del testo markdown.', 'error');
    return;
  }

  setLoading(true);

  const fd = new FormData();
  // Markdown files in user-defined order; relPath carries the project-relative path
  // so the backend can rewrite image references before merging.
  state.files.forEach(item => fd.append('files', item.file, item.relPath || item.name));
  // Asset files with their relative paths as filename
  state.assets.forEach(item => fd.append('assets', item.file, item.path));

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
    a.href     = url;
    a.download = `documento.${state.format === 'pdf' ? 'pdf' : 'docx'}`;
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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
