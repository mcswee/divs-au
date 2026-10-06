// ── Family definitions ────────────────────────────────────────────────────────
const FAMILIES = {
  R: { name: 'Red',            rep: '#c41e3a' },
  O: { name: 'Orange',         rep: '#ff7538' },
  Y: { name: 'Yellow',         rep: '#fedf00' },
  G: { name: 'Green',          rep: '#228b22' },
  T: { name: 'Teal & Cyan',    rep: '#069494' },
  B: { name: 'Blue',           rep: '#305cde' },
  V: { name: 'Violet & Purple',rep: '#7f00ff' },
  P: { name: 'Pink & Rose',    rep: '#ff8bc5' },
  N: { name: 'Neutral & Brown',rep: '#895129' },
  W: { name: 'White & Cream',  rep: '#f2f0e6' },
  K: { name: 'Black & Grey',   rep: '#898989' },
};

// ── Parse CSV ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = vals[i]?.trim() ?? '');
    return obj;
  });
}

// ── Year formatting ───────────────────────────────────────────────────────────
function formatYear(raw) {
  const y = raw.trim();
  if (y === 'imm.') return 'Known as a colour name since ancient times.';
  if (y.startsWith('c.')) {
    const yr = y.replace('c.', '').trim();
    return `First used as a name for a colour around ${yr}.`;
  }
  return `First used as a name for a colour in ${y}.`;
}

function yearForSort(raw) {
  const y = raw.trim();
  if (y === 'imm.') return -9999;
  return parseInt(y.replace('c.', '').replace('.', '')) || 9999;
}

// ── WCAG labels ───────────────────────────────────────────────────────────────
function wcagBadges(ratio) {
  const r = parseFloat(ratio);
  const badges = [];
  if (r >= 3)   badges.push({ label: 'AA Large', pass: true });
  if (r >= 4.5) badges.push({ label: 'AA', pass: true });
  else          badges.push({ label: 'AA', pass: false });
  if (r >= 7)   badges.push({ label: 'AAA', pass: true });
  else          badges.push({ label: 'AAA', pass: false });
  return badges;
}

// Pass/fail is shown as a symbol and spoken text, not only as a colour
function badgeHtml(b) {
  const word = b.pass ? 'pass' : 'fail';
  return `<span class="wcag-badge ${b.pass ? 'wcag-pass' : 'wcag-fail'}">${b.label} <span aria-hidden="true">${b.pass ? '✓' : '✗'}</span><span class="sr-only">${word}</span></span>`;
}

// ── App state ─────────────────────────────────────────────────────────────────
let colours = [];
let activeFamily = 'all';
let searchQuery = '';
let sortKey = 'name';
let lastFocus = null;   // element to return focus to when the dialog closes

// ── Render family buttons ─────────────────────────────────────────────────────
function setFamily(code) {
  activeFamily = code;
  document.querySelectorAll('.family-btn, .family-all').forEach(b => {
    const on = b.dataset.family === code;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  render();
}

function renderFamilyButtons() {
  const container = document.getElementById('familyFilters');
  Object.entries(FAMILIES).forEach(([code, { name, rep }]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'family-btn';
    btn.dataset.family = code;
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<span class="swatch-dot" style="background:${rep}" aria-hidden="true"></span>${name}`;
    btn.addEventListener('click', () => setFamily(code));
    container.appendChild(btn);
  });

  document.querySelector('.family-all').addEventListener('click', () => setFamily('all'));
}

// ── Filter + sort ─────────────────────────────────────────────────────────────
function filtered() {
  let list = colours;
  if (activeFamily !== 'all') list = list.filter(c => c.family === activeFamily);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.hex.toLowerCase().includes(q)
    );
  }
  list = [...list].sort((a, b) => {
    switch (sortKey) {
      case 'name':      return a.name.localeCompare(b.name);
      case 'year':      return yearForSort(a.year) - yearForSort(b.year);
      case 'year-desc': return yearForSort(b.year) - yearForSort(a.year);
      case 'hue':       return parseFloat(a.hue) - parseFloat(b.hue);
      case 'lum':       return parseFloat(b.lum) - parseFloat(a.lum);
      case 'lum-desc':  return parseFloat(a.lum) - parseFloat(b.lum);
      case 'sat':       return parseFloat(b.sat) - parseFloat(a.sat);
      default:          return 0;
    }
  });
  return list;
}

// ── Render grid ───────────────────────────────────────────────────────────────
function render() {
  const list = filtered();
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');
  const bar = document.getElementById('resultsBar');

  bar.textContent = `${list.length} colour${list.length !== 1 ? 's' : ''}`;
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  list.forEach((c, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'swatch-card';
    card.setAttribute('aria-haspopup', 'dialog');
    card.style.animationDelay = `${Math.min(i * 20, 400)}ms`;
    card.innerHTML = `
      <span class="swatch-color" style="background:${c.hex}">
        <span class="swatch-copy-hint" aria-hidden="true">${c.hex}</span>
      </span>
      <span class="swatch-info">
        <span class="swatch-name">${c.name}</span>
        <span class="swatch-hex">${c.hex.toUpperCase()}</span>
        <span class="swatch-year-mini">${c.year === 'imm.' ? 'Since antiquity' : c.year}</span>
      </span>`;
    card.addEventListener('click', () => openModal(c));
    grid.appendChild(card);
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(c) {
  const overlay = document.getElementById('modalOverlay');
  const swatch  = document.getElementById('modalSwatch');
  const hexBadge= document.getElementById('modalHexBadge');
  const name    = document.getElementById('modalName');
  const famTag  = document.getElementById('modalFamilyTag');
  const year    = document.getElementById('modalYear');
  const contrast= document.getElementById('contrastRow');
  const preview = document.getElementById('legibilityPreview');
  const datagrid= document.getElementById('modalDataGrid');
  const actions = document.getElementById('modalActions');

  swatch.style.background = c.hex;
  hexBadge.textContent = c.hex.toUpperCase();
  name.textContent = c.name;
  famTag.textContent = FAMILIES[c.family]?.name ?? c.family;
  year.textContent = formatYear(c.year);

  // Contrast chips
  const wBadges = wcagBadges(c.wcag_w);
  const kBadges = wcagBadges(c.wcag_k);

  contrast.innerHTML = `
    <div class="contrast-chip" style="background:#ffffff;color:#1a1714">
      <span class="chip-label">on white</span>
      <span class="chip-ratio">${parseFloat(c.wcag_w).toFixed(2)}:1</span>
      <div class="chip-badges">
        ${wBadges.map(badgeHtml).join('')}
      </div>
    </div>
    <div class="contrast-chip" style="background:#000000;color:#f5f2ec">
      <span class="chip-label">on black</span>
      <span class="chip-ratio">${parseFloat(c.wcag_k).toFixed(2)}:1</span>
      <div class="chip-badges">
        ${kBadges.map(badgeHtml).join('')}
      </div>
    </div>`;

  // Legibility preview
  preview.innerHTML = `
    <div class="preview-block" style="background:#ffffff;color:${c.hex}">
      The quick brown fox jumps over the lazy dog.
    </div>
    <div class="preview-block" style="background:#000000;color:${c.hex}">
      The quick brown fox jumps over the lazy dog.
    </div>`;

  // Data grid
  datagrid.innerHTML = `
    <div class="data-cell"><div class="label">Hue</div><div class="value">${parseFloat(c.hue).toFixed(1)}°</div></div>
    <div class="data-cell"><div class="label">Saturation</div><div class="value">${parseFloat(c.sat).toFixed(1)}%</div></div>
    <div class="data-cell"><div class="label">Luminosity</div><div class="value">${parseFloat(c.lum).toFixed(1)}%</div></div>
    <div class="data-cell"><div class="label">Red</div><div class="value">${c.r}</div></div>
    <div class="data-cell"><div class="label">Green</div><div class="value">${c.g}</div></div>
    <div class="data-cell"><div class="label">Blue</div><div class="value">${c.b}</div></div>`;

  // Actions
  actions.innerHTML = `
    <button class="btn btn-primary" id="copyHexBtn">Copy hex</button>
    <button class="btn" id="copyRgbBtn">Copy RGB</button>
    <button class="btn" id="copyHslBtn">Copy HSL</button>
    <button class="btn" id="filterFamilyBtn">Show ${FAMILIES[c.family]?.name ?? 'family'}</button>`;

  document.getElementById('copyHexBtn').addEventListener('click', () => {
    copyText(c.hex.toUpperCase(), 'copyHexBtn', `${c.hex.toUpperCase()} copied`);
  });
  document.getElementById('copyRgbBtn').addEventListener('click', () => {
    copyText(`rgb(${c.r}, ${c.g}, ${c.b})`, 'copyRgbBtn', 'RGB copied');
  });
  document.getElementById('copyHslBtn').addEventListener('click', () => {
    copyText(`hsl(${parseFloat(c.hue).toFixed(0)}, ${parseFloat(c.sat).toFixed(0)}%, ${parseFloat(c.lum).toFixed(0)}%)`, 'copyHslBtn', 'HSL copied');
  });
  document.getElementById('filterFamilyBtn').addEventListener('click', () => {
    closeModal();
    setFamily(c.family);
    document.querySelector(`.family-btn[data-family="${c.family}"]`)?.focus();
  });

  lastFocus = document.activeElement;
  overlay.classList.add('open');
  document.querySelector('main').style.overflow = 'hidden';
  setBackgroundInert(true);
  document.getElementById('modalClose').focus();
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay.classList.contains('open')) return;
  overlay.classList.remove('open');
  document.querySelector('main').style.overflow = '';
  setBackgroundInert(false);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}

// While the dialog is open, everything outside it is inert: keyboard focus
// and screen readers stay inside the dialog (the toast stays live).
function setBackgroundInert(on) {
  let node = document.getElementById('modalOverlay');
  while (node && node !== document.body) {
    [...node.parentElement.children].forEach(sib => {
      if (sib !== node && sib.tagName !== 'SCRIPT' && sib.id !== 'toast') sib.toggleAttribute('inert', on);
    });
    node = node.parentElement;
  }
}

// ── Copy helper ───────────────────────────────────────────────────────────────
function copyText(text, btnId, message) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message);
    const btn = document.getElementById(btnId);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
    }
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value;
  render();
});

document.getElementById('sortSelect').addEventListener('change', e => {
  sortKey = e.target.value;
  render();
});

document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

document.getElementById('modalClose').addEventListener('click', closeModal);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── Init ──────────────────────────────────────────────────────────────────────
fetch('/assets/data/colours.csv')
  .then(res => {
    if (!res.ok) throw new Error(res.status);
    return res.text();
  })
  .then(text => {
    colours = parseCSV(text);
    document.getElementById('totalCount').textContent = `${colours.length} colours in the reference.`;
    renderFamilyButtons();
    render();
  })
  .catch(() => {
    document.getElementById('resultsBar').textContent = 'The colour data could not be loaded.';
  });
