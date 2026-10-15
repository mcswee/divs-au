// Melbourne train departures (projects/metro.html)
// Data: /assets/data/trains/*.json   Live data: the Cloudflare Worker below (the API key lives there)

// ── Config ────────────────────────────────────────────────────────────────────
const DATA = '/assets/data/trains';
const RT   = 'https://melb-trains-rt.dj-mcsw-ee.workers.dev/';
const POLL = 30_000;

// Times are Melbourne time wherever the visitor is
const MEL_FMT = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });

// ── State ─────────────────────────────────────────────────────────────────────
let stations    = [];
let stationData = null;
let openTrip    = null;
let patCache    = {};
let rtData      = null;
let rtLookup    = {};
let rtNumLookup = {};
let liveOnline  = null;          // null until the first poll
const expandedAlerts = new Set(); // alerts the visitor has opened

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  tick();
  setInterval(tick, 15_000);
  pollRT();
  // no polling while the tab is hidden; catch up as soon as it is shown again
  setInterval(() => { if (!document.hidden) pollRT(); }, POLL);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); pollRT(); } });
  try {
    const r = await fetch(`${DATA}/stations.json`);
    const d = await r.json();
    stations = d.stations;
    buildDropdown(stations);
  } catch {
    setBoard('<p class="msg">Could not load station list.</p>');
  }
  document.getElementById('station-select')
    .addEventListener('change', e => loadStation(e.target.value));
})();

// ── Dropdown ──────────────────────────────────────────────────────────────────
function buildDropdown(list) {
  const sel = document.getElementById('station-select');
  list.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name;
    sel.appendChild(o);
  });
}

// ── Load station ──────────────────────────────────────────────────────────────
async function loadStation(id) {
  if (!id) { setBoard('<p class="msg">Select a station to see upcoming departures.</p>'); return; }
  setBoard('<p class="msg">Loading…</p>');
  openTrip = null;
  try {
    const r = await fetch(`${DATA}/departures_${safeFn(id)}.json`);
    stationData = await r.json();
    render();
    const n = document.querySelectorAll('#board .dep').length;
    announce(n ? `Departures for ${stationData.name}: ${n} upcoming services shown.` : `No upcoming services for ${stationData.name} today.`);
  } catch {
    setBoard('<p class="msg">Could not load departures for this station.</p>');
  }
}

// ── Real-time ─────────────────────────────────────────────────────────────────
function stableKey(tripId) {
  if (tripId.startsWith('0')) {
    const p = tripId.split('-');
    if (p.length >= 6) return `${p[1]}|${p[5]}`;
    return null;
  }
  const m = tripId.match(/vic:0[12]([A-Z]+):.*?_(\d+)_\d{8}/);
  if (m) return `${m[1]}|${m[2]}`;
  return null;
}

function tripNum(tripId) {
  if (tripId.startsWith('0')) {
    const p = tripId.split('-');
    return p.length >= 6 ? p[5] : null;
  }
  const m = tripId.match(/_(\d+)_\d{8}/);
  return m ? m[1] : null;
}

function buildRtLookup() {
  rtLookup = {};
  rtNumLookup = {};
  if (!rtData?.trips) return;
  for (const [id, data] of Object.entries(rtData.trips)) {
    const key = stableKey(id);
    if (key !== null) rtLookup[key] = data.delay;
    const num = tripNum(id);
    if (num !== null) rtNumLookup[num] = data.delay;
  }
}

function rtDelay(tripId) {
  const exact = rtData?.trips?.[tripId];
  if (exact !== undefined) return exact.delay;
  const key = stableKey(tripId);
  if (key !== null && key in rtLookup) return rtLookup[key];
  const num = tripNum(tripId);
  if (num !== null && num in rtNumLookup) return rtNumLookup[num];
  return null;
}

async function pollRT() {
  try {
    const r = await fetch(RT);
    rtData = await r.json();
    buildRtLookup();
    const dot  = document.getElementById('live-dot');
    const text = document.getElementById('live-text');
    if (dot)  dot.classList.add('connected');
    if (text) text.textContent = 'LIVE';
    if (liveOnline === false) announce('Live data is back.');
    liveOnline = true;
    if (stationData) render();
  } catch {
    const dot  = document.getElementById('live-dot');
    const text = document.getElementById('live-text');
    if (dot)  dot.classList.remove('connected');
    if (text) text.textContent = 'OFFLINE';
    if (liveOnline !== false) announce('Live data is offline. Showing scheduled times.');
    liveOnline = false;
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  if (!stationData) return;

  const nowMin   = nowMins();
  const today    = dayType();
  const todayNum = todayDate();

  const raw = stationData.departures.filter(d => {
    if (!d.days[today]) return false;
    if (d.days.from  && todayNum < d.days.from)  return false;
    if (d.days.until && todayNum > d.days.until) return false;
    const t = hm2min(d.departs);
    if (t >= 1440) return false;
    const delay  = rtDelay(d.trip_id) ?? 0;
    const actual = t + Math.round(delay / 60);
    return actual >= nowMin - 1;
  });

  const bestVariant = {};
  raw.forEach(d => {
    const key = `${d.plat}|${d.departs}|${d.route}`;
    if (!bestVariant[key]) {
      bestVariant[key] = d;
    } else if (rtDelay(d.trip_id) !== null && rtDelay(bestVariant[key].trip_id) === null) {
      bestVariant[key] = d;
    }
  });
  const upcoming = Object.values(bestVariant)
    .sort((a, b) => hm2min(a.departs) - hm2min(b.departs));

  const byPlat = {};
  const vlineGroups = {};
  const isSouthernCross = stationData.name === 'Southern Cross';
  upcoming.forEach(d => {
    if (d.group === 'vline') {
      // V/Line has no platform data. At Southern Cross every departure is
      // "down" (nothing terminates there), so grouping by direction alone
      // would merge every line into one bucket and bury less-frequent
      // services — group by route instead. Everywhere else, combine all
      // routes together into a single "next 3 up" / "next 3 down" so e.g.
      // Footscray isn't showing six separate near-empty V/Line sections.
      const dir = vlineDirection(d.route, d.dest);
      const key = isSouthernCross ? d.route : dir;
      if (!vlineGroups[key]) vlineGroups[key] = { route: d.route, dir, deps: [] };
      if (vlineGroups[key].deps.length < 3) vlineGroups[key].deps.push(d);
      return;
    }
    const p = d.plat || '—';
    if (!byPlat[p]) byPlat[p] = [];
    const cap = p === '—' ? 6 : 3;
    if (byPlat[p].length < cap) byPlat[p].push(d);
  });

  const plats = Object.keys(byPlat).sort(platSort);
  const vlineKeys = Object.keys(vlineGroups).sort((a, b) => {
    const A = vlineGroups[a], B = vlineGroups[b];
    if (isSouthernCross) return A.route.localeCompare(B.route);
    if (A.dir !== B.dir) return A.dir === 'up' ? -1 : 1;
    return 0;
  });
  const frag  = document.createDocumentFragment();

  const stationAlerts = alertsForStation();
  if (stationAlerts.length) frag.appendChild(buildAlerts(stationAlerts));

  if (!plats.length && !vlineKeys.length) {
    const msg = el('p', 'msg');
    msg.textContent = stationAlerts.length
      ? 'No train services currently running — see alert above.'
      : 'No upcoming services for today.';
    frag.appendChild(msg);
    swapBoard(frag);
    return;
  }

  plats.forEach(p => frag.appendChild(buildPlatform(p, byPlat[p])));
  vlineKeys.forEach(k => {
    const g = vlineGroups[k];
    const label = isSouthernCross
      ? `V/Line: ${g.route}`
      : (g.dir === 'up' ? 'V/Line — to Southern Cross' : 'V/Line — Outbound');
    frag.appendChild(buildPlatform(label, g.deps, true));
  });

  swapBoard(frag);
}

// ── Alerts ────────────────────────────────────────────────────────────────────
const ROUTE_CODES = {
  'Frankston': 'FKN', 'Stony Point': 'STY',
  'Belgrave': 'BEG', 'Lilydale': 'LIL', 'Alamein': 'ALM', 'Glen Waverley': 'GWY',
  'Craigieburn': 'CGB', 'Upfield': 'UFD',
  'Mernda': 'MDD', 'Hurstbridge': 'HBE',
  'Pakenham': 'PKM', 'Cranbourne': 'CBE', 'Sunbury': 'SUY',
  'Sandringham': 'SHM', 'Werribee': 'WER', 'Williamstown': 'WIL',
  'Flemington Racecourse': 'FGS',
};

const SHOW_EFFECTS = new Set([
  'NO_SERVICE', 'REDUCED_SERVICE', 'SIGNIFICANT_DELAYS', 'MODIFIED_SERVICE', 'OTHER_EFFECT'
]);

// City-bound terminus check: anything ending at Southern Cross or Flinders
// Street is "up"; everything else is "down". A V/Line train that runs in
// the country but terminates in the suburbs would be mislabeled by this,
// but that's rare enough that a service alert will almost always be up
// alongside it anyway.
const VLINE_UP_TERMINI = new Set(['Southern Cross', 'Flinders Street']);

function vlineDirection(route, dest) {
  return VLINE_UP_TERMINI.has(dest) ? 'up' : 'down';
}

// PTV boilerplate that pads out nearly every alert description; stripped so
// the alert box shows only the actual disruption info.
const ALERT_BOILERPLATE = [
  'Check information displays and listen for announcements as services may be altered at short notice.',
  'Plan your journey at transport.vic.gov.au or call 1800 800 007.',
  'Visit our Planned Works page for more information.',
  'Allow extra travel time.',
  'Replacement buses are subject to local traffic conditions.',
  'These critical safety works form part of Metro\u2019s annual works program to maintain and renew the rail network.',
  'Every effort will be made to carry out these works with respect for our valued neighbours.',
  'Works may be subject to change due to weather conditions and operational requirements.',
];

function cleanAlertText(desc) {
  let out = desc || '';
  ALERT_BOILERPLATE.forEach(s => { out = out.split(s).join(''); });
  return out
    .replace(/\s*•\s*/g, ' • ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,])/g, '$1')
    .replace(/^•\s*/, '')
    .trim();
}

// Consistent category per alert, used to pick an icon and to key deduplication.
const ALERT_CATEGORY = {
  'Cancellation':      'cancellation',
  'Major Delay':       'delay_major',
  'Minor Delay':       'delay_minor',
  'Suspended':         'suspended',
  'Planned Works':     'planned_works',
  'Other Information': 'info_other',
};
const ALERT_ICON_SVG = {
  cancellation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/><line x1="5.5" y1="18.5" x2="18.5" y2="5.5"/>
  </svg>`,
  delay_major: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>
  </svg>`,
  delay_minor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>
  </svg>`,
  suspended: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="8 2 16 2 22 8 22 16 16 22 8 22 2 16 2 8"/>
    <line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12" y2="16.5"/>
  </svg>`,
  planned_works: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>
  </svg>`,
  info_other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12" y2="7.5"/>
  </svg>`,
  other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3.5 21.5 20h-19z"/><line x1="12" y1="9.5" x2="12" y2="14"/><line x1="12" y1="17" x2="12" y2="17"/>
  </svg>`,
};
function categoriseAlert(header) {
  if (header.startsWith('Planned work:')) return 'planned_works';
  return ALERT_CATEGORY[header] || 'other';
}

function alertsForStation() {
  if (!rtData?.alerts?.length || !stationData) return [];
  const codes = new Set(
    stationData.departures.map(d => ROUTE_CODES[d.route]).filter(Boolean)
  );
  const matched = rtData.alerts
    .filter(a => {
      if (!SHOW_EFFECTS.has(a.effect)) return false;
      // Station car-park/car-space/night-works notices: real but don't affect
      // train running, so keep them out of the live board.
      if (a.effect === 'OTHER_EFFECT' && a.header.startsWith('Planned work')) return false;
      return a.routes.some(r => [...codes].some(c => r.includes(`-${c}`)));
    })
    .map(a => ({ ...a, description: cleanAlertText(a.description), category: categoriseAlert(a.header) }));

  // Route-split alerts (the same disruption logged once per affected route)
  // carry identical header+description text, so dedupe on that rather than
  // on `id` — the id can differ per route for what's really one alert.
  const seen = new Set();
  return matched.filter(a => {
    const key = `${a.header}|${a.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildAlerts(alerts) {
  const container = el('div', 'alerts');
  alerts.forEach(a => {
    const key  = `${a.header}|${a.description}`;
    const open = expandedAlerts.has(key);
    const item = el('button', 'alert' + (open ? ' expanded' : ''));
    item.type = 'button';
    item.setAttribute('aria-expanded', open ? 'true' : 'false');
    item.dataset.focusKey = 'alert:' + key;
    const icon  = el('span', 'alert-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = ALERT_ICON_SVG[a.category] || ALERT_ICON_SVG.other;
    const main  = el('span', 'alert-main');
    const hdr   = el('span', 'alert-hdr');
    hdr.textContent = a.header;
    const desc  = el('span', 'alert-desc');
    desc.textContent = a.description;
    main.append(hdr, desc);
    const caret = el('span', 'alert-caret');
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = open ? '▲' : '▼';
    item.append(icon, main, caret);
    item.addEventListener('click', () => {
      const nowOpen = item.classList.toggle('expanded');
      item.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      caret.textContent = nowOpen ? '▲' : '▼';
      if (nowOpen) expandedAlerts.add(key); else expandedAlerts.delete(key);
    });
    container.appendChild(item);
  });
  return container;
}

// ── Platform ──────────────────────────────────────────────────────────────────
function buildPlatform(plat, services, rawLabel) {
  const sec = el('section', 'platform');
  const hdr = el('div', 'platform-hdr');
  hdr.textContent = rawLabel ? plat : (plat === '—' ? 'No platform data' : `Platform ${plat}`);
  sec.appendChild(hdr);
  services.forEach(dep => {
    sec.appendChild(buildDep(dep));
    if (openTrip === dep.trip_id) sec.appendChild(buildPattern(dep));
  });
  return sec;
}

// ── Departure row ─────────────────────────────────────────────────────────────
function buildDep(dep) {
  const row = el('div', 'dep' + (openTrip === dep.trip_id ? ' open' : ''));
  row.style.setProperty('--lc', dep.colour);
  row.setAttribute('role', 'button');
  row.setAttribute('tabindex', '0');
  row.setAttribute('aria-expanded', openTrip === dep.trip_id ? 'true' : 'false');
  if (openTrip === dep.trip_id) row.setAttribute('aria-controls', patternId(dep));
  row.dataset.focusKey = 'dep:' + dep.trip_id;

  const nowMin    = nowMins();
  const schedMin  = hm2min(dep.departs);
  const delay     = rtDelay(dep.trip_id);
  const delaySec  = delay ?? 0;
  const actualMin = schedMin + Math.round(delaySec / 60);
  const minsAway  = actualMin - nowMin;

  const timeEl = el('span', 'dep-time');
  const schedDisplay  = dep.departs;
  const actualDisplay = toHHMM(actualMin);
  const minuteChanged = schedDisplay !== actualDisplay;

  if (delay !== null && delaySec !== 0 && minuteChanged) {
    timeEl.classList.add('delayed');
    const sched = el('span', 'sched');
    sched.innerHTML = '<span class="sr-only">Scheduled </span>' + escHtml(schedDisplay);
    const actual = el('span', 'actual');
    actual.innerHTML = '<span class="sr-only">Expected </span>' + escHtml(actualDisplay);
    timeEl.append(sched, actual);
  } else {
    const actual = el('span', 'actual');
    actual.textContent = schedDisplay;
    timeEl.appendChild(actual);
  }

  const minsEl = el('span', 'dep-mins' + (minsAway <= 2 ? ' soon' : ''));
  minsEl.textContent = minsAway <= 0  ? 'Now'
                     : minsAway === 1 ? '1 min'
                     : minsAway >= 60 ? '1 hr +'
                     : `${minsAway} min`;

  const info = el('div', 'dep-info');
  const dest = el('div', 'dep-dest');

  let badge = '';
  if (delay !== null) {
    if (!minuteChanged)
      badge = '<span class="rt-ontime">on time</span>';
    else if (delaySec >= 0)
      badge = `<span class="rt-late">${Math.max(1, Math.round(delaySec/60))} min late</span>`;
    else
      badge = '<span class="rt-early">Early</span>';
  }
  dest.innerHTML = escHtml(dep.dest) + badge;

  const route = el('div', 'dep-route');
  const routeBadge = el('span', 'route-badge');
  routeBadge.style.backgroundColor = dep.colour || '#ccc';
  routeBadge.style.color = readableText(dep.colour);
  routeBadge.textContent = dep.route;
  if (dep.stype) {
    route.append(routeBadge, document.createTextNode(` · ${dep.stype}`));
  } else {
    route.appendChild(routeBadge);
  }
  info.append(dest, route);

  const caret = el('span', 'dep-caret');
  caret.setAttribute('aria-hidden', 'true');
  caret.textContent = openTrip === dep.trip_id ? '▲' : '▼';

  row.append(timeEl, minsEl, info, caret);

  const toggle = async () => {
    if (openTrip === dep.trip_id) { openTrip = null; render(); return; }
    openTrip = dep.trip_id;
    render();
    await ensurePattern(dep.route);
    render();
  };
  row.addEventListener('click', toggle);
  row.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  return row;
}

// ── Stopping pattern ──────────────────────────────────────────────────────────
async function ensurePattern(route) {
  if (patCache[route]) return;
  try {
    const r = await fetch(`${DATA}/patterns_${safeFn(route)}.json`);
    patCache[route] = await r.json();
  } catch {
    patCache[route] = {};
  }
}

function buildPattern(dep) {
  const wrap = el('div', 'pattern');
  wrap.id = patternId(dep);
  wrap.style.setProperty('--lc', dep.colour);

  const trips = patCache[dep.route];
  const full  = trips && trips[dep.trip_id];

  if (!full) {
    const loading = el('div', 'pat-loading');
    loading.textContent = 'Loading stops…';
    wrap.appendChild(loading);
    return wrap;
  }

  let realIdx = 0, stopCount = 0;
  for (let i = 0; i < full.length; i++) {
    if (full[i][0] === '__EXP__') continue;
    if (stopCount === dep.pat_idx) { realIdx = i; break; }
    stopCount++;
  }

  const stops = full.slice(realIdx);
  const last  = stops.reduce((acc, [n], i) => n !== '__EXP__' ? i : acc, 0);

  stops.forEach(([name, time], i) => {
    if (name === '__EXP__') {
      const row = el('div', 'pat-express');
      row.textContent = `Express: ${time}`;
      wrap.appendChild(row);
      return;
    }
    const row = el('div', 'pat-stop' +
      (i === 0    ? ' is-here' : '') +
      (i === last ? ' is-end'  : ''));
    const t = el('span', 'pat-time');
    t.textContent = time;
    const n = el('span', 'pat-name');
    n.textContent = name;
    row.append(t, n);
    wrap.appendChild(row);
  });

  return wrap;
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function tick() {
  const now = melNow();
  document.getElementById('clock').textContent = pad(now.h) + ':' + pad(now.m);
  if (stationData) render();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function melNow() {
  const p = {};
  MEL_FMT.formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return { h: Number(p.hour), m: Number(p.minute), wd: p.weekday, y: Number(p.year), mo: Number(p.month), d: Number(p.day) };
}
function nowMins()  { const n = melNow(); return n.h * 60 + n.m; }
function dayType()  { const w = melNow().wd; return w === 'Sun' ? 'sunday' : w === 'Sat' ? 'saturday' : 'weekday'; }
function todayDate(){ const n = melNow(); return n.y * 10000 + n.mo * 100 + n.d; }
function hm2min(hhmm) { const [h,m] = hhmm.split(':').map(Number); return h*60+m; }
function toHHMM(mins) { return `${pad(Math.floor(mins/60))}:${pad(mins%60)}`; }

function platSort(a, b) {
  if (a === '—') return 1;
  if (b === '—') return -1;
  const na = parseInt(a), nb = parseInt(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

function safeFn(s)   { return s.replace(/[^A-Za-z0-9_\-]/g, '_'); }
function pad(n)      { return String(n).padStart(2, '0'); }
function el(t, c)    { const e = document.createElement(t); if (c) e.className = c; return e; }
function setBoard(h) {
  const board = document.getElementById('board');
  board.innerHTML = h;
  announce(board.textContent.trim());
}

function patternId(dep) { return 'pat-' + safeFn(dep.trip_id); }

// short messages for screen readers (the board itself is not a live region,
// because it is redrawn every 15 seconds)
function announce(message) {
  const region = document.getElementById('board-status');
  if (!region) return;
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 30);
}

// the board is redrawn on every tick: keep keyboard focus on the same row or alert
function swapBoard(frag) {
  const board = document.getElementById('board');
  const active = document.activeElement;
  const key = active && board.contains(active) && active.dataset ? active.dataset.focusKey : null;
  board.innerHTML = '';
  board.appendChild(frag);
  if (key) {
    const target = [...board.querySelectorAll('[data-focus-key]')].find(e => e.dataset.focusKey === key);
    if (target) target.focus({ preventScroll: true });
  }
}

// white or near-black text, whichever reads better on the route colour
function readableText(colour) {
  const m = /^#?([0-9a-f]{6})$/i.exec(colour || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0556 ? '#ffffff' : '#111111';
}
function escHtml(s)  { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
