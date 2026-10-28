// AuRORa rail network (projects/hsr.html)
// Data: /assets/data/aurora-lines.json   Map: _includes/aurora-map.svg (inline, styled in style.css)

(function () {
  'use strict';

  const mapWrap = document.getElementById('mapWrap');
  const bar     = document.getElementById('filterBar');
  const grid    = document.getElementById('linesGrid');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let LINES = [];
  let activeLine = null;     // code of the line being shown, or null for all

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // white or near-black text, whichever reads better on the line colour
  function readableText(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0556 ? '#ffffff' : '#111111';
  }

  function infraClass(type) {
    if (/dedicated/i.test(type)) return 'infra-dedicated';
    if (/conventional/i.test(type)) return 'infra-upgraded';
    return 'infra-hybrid';
  }

  function announce(message) {
    const region = document.getElementById('hsr-status');
    if (!region) return;
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 30);
  }

  fetch('/assets/data/aurora-lines.json')
    .then(res => { if (!res.ok) throw new Error('aurora-lines.json ' + res.status); return res.json(); })
    .then(data => { LINES = data; buildFilters(); buildCards(); bindMap(); })
    .catch(err => {
      console.error('Could not load the lines:', err);
      const msg = document.getElementById('hsr-error');
      msg.textContent = 'The list of lines could not be loaded.';
      msg.hidden = false;
    });

  // ---- filter buttons ----
  function buildFilters() {
    LINES.forEach(l => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter-btn';
      b.dataset.filter = l.code;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span class="sw" aria-hidden="true" style="background:' + l.color + '"></span>' + esc(l.name);
      bar.appendChild(b);
    });
    bar.addEventListener('click', e => {
      const b = e.target.closest('.filter-btn');
      if (b) setFilter(b.dataset.filter);
    });
  }

  // ---- line cards ----
  function buildCards() {
    grid.innerHTML = LINES.map(l => {
      const stations = l.station_list.map(s => '<li class="sta-item"><span class="sta-dot" aria-hidden="true" style="border-color:' + l.color + '"></span>' + esc(typeof s === 'string' ? s : s.name) + '</li>').join('');
      return '<article class="line-card" data-code="' + l.code + '" style="--lc:' + l.color + '">' +
        '<div class="line-card-top">' +
          '<span class="line-badge" aria-hidden="true" style="background:' + l.color + ';color:' + readableText(l.color) + '">' + esc(l.code.toUpperCase()) + '</span>' +
          '<div class="line-card-title"><h3>' + esc(l.name) + '</h3><p class="line-terminals">' + esc(l.terminals) + '</p></div>' +
        '</div>' +
        '<p><span class="infra-tag ' + infraClass(l.infra_type) + '">' + esc(l.infra_type) + '</span></p>' +
        '<dl class="line-meta"><div><dt>Distance</dt><dd>' + esc(l.distance) + '</dd></div><div><dt>Stations</dt><dd>' + esc(l.stations) + '</dd></div><div><dt>Journey</dt><dd>' + esc(l.journey_time) + '</dd></div></dl>' +
        '<p class="infra-note">' + esc(l.infra) + '</p>' +
        '<button type="button" class="sta-toggle" aria-expanded="false" aria-controls="stations-' + l.code + '">Show stations</button>' +
        '<div class="station-list" id="stations-' + l.code + '"><ul>' + stations + '</ul></div>' +
      '</article>';
    }).join('');

    grid.addEventListener('click', e => {
      const card = e.target.closest('.line-card');
      if (card) toggleCard(card);
    });
  }

  function toggleCard(card) {
    const open = !card.classList.contains('open');
    grid.querySelectorAll('.line-card.open').forEach(c => { if (c !== card) closeCard(c); });
    card.classList.toggle('open', open);
    const btn = card.querySelector('.sta-toggle');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Hide stations' : 'Show stations';
    if (open) {
      highlight(card.dataset.code);
      card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    } else if (!activeLine) {
      clearSel();
    }
  }

  function closeCard(card) {
    card.classList.remove('open');
    const btn = card.querySelector('.sta-toggle');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = 'Show stations';
  }

  // ---- map highlighting ----
  function svgEls(sel) { return mapWrap.querySelectorAll(sel); }

  function highlight(code) {
    mapWrap.classList.add('sel');
    svgEls('.on').forEach(el => el.classList.remove('on'));
    svgEls('.' + code + '-line').forEach(el => el.classList.add('on'));
    svgEls('.xch-pill').forEach(el => {
      const lines = (el.getAttribute('data-lines') || el.getAttribute('data-line') || '').split(/[\s,]+/);
      el.classList.toggle('on', lines.includes(code));
    });
  }

  function clearSel() {
    mapWrap.classList.remove('sel');
    svgEls('.on').forEach(el => el.classList.remove('on'));
  }

  // ---- one place that changes what is shown ----
  function setFilter(code) {
    if (code !== 'all' && activeLine === code) code = 'all';     // choosing the same line again shows everything
    activeLine = code === 'all' ? null : code;

    bar.querySelectorAll('.filter-btn').forEach(b => {
      const on = b.dataset.filter === (activeLine || 'all');
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    grid.querySelectorAll('.line-card').forEach(c => {
      c.classList.toggle('hidden', !!activeLine && c.dataset.code !== activeLine);
      closeCard(c);
    });

    if (activeLine) {
      highlight(activeLine);
      const l = LINES.find(x => x.code === activeLine);
      announce('Showing the ' + l.name + ' only.');
    } else {
      clearSel();
      announce('Showing all lines.');
    }
  }

  // clicking a line on the map does the same as its filter button (mouse and touch)
  function bindMap() {
    mapWrap.addEventListener('click', e => {
      const el = e.target.closest('.transit-line, .station-icon');
      if (!el) return;
      const m = /(\w)-line/.exec(el.getAttribute('class') || '');
      if (m && LINES.some(l => l.code === m[1])) setFilter(m[1]);
    });
  }
})();
