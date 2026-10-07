/* ============================================================
   Melbourne suburb pronunciations (projects/suburbs.html)
   Data:  /assets/data/suburbs.json   name, postcode, lga, pronunciation
          /assets/data/sounds.json    sym, ipa, seg, ex  (the phoneme key)
          /assets/data/suburbs.geojson  one polygon per suburb, matched on "name"
   ============================================================ */

(function () {
  'use strict';

  const AUDIO_PATH = '/assets/audio/suburbs/';
  const hasSpeech = 'speechSynthesis' in window;

  // ---- state ----
  let SUBURBS = [];
  let PHONEMES = [];
  let SORTED_SYMS = [];
  let SYM_MAP = {};

  let searchVal = '';
  let lgaVal = '';
  let selectedName = null;     // lowercase name of the suburb highlighted on the map
  let currentList = [];        // suburbs matching the current search / council filter

  let map = null;
  let geojsonLayer = null;
  const geojsonMap = new Map(); // lowercase suburb name -> Leaflet layer

  let currentBtn = null;
  let currentAudio = null;

  // ---- DOM ----
  const results = document.getElementById('results');
  const count = document.getElementById('count');
  const tip = document.getElementById('ph-tip');

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- loading ----

  function load(url) {
    return fetch(url).then(res => {
      if (!res.ok) throw new Error(url + ' ' + res.status);
      return res.json();
    });
  }

  Promise.all([load('/assets/data/suburbs.json'), load('/assets/data/sounds.json')])
    .then(data => init(data[0], data[1]))
    .catch(err => {
      console.error('Could not load suburb data:', err);
      results.innerHTML = '<p class="empty">The suburb list could not be loaded.</p>';
      count.textContent = '';
    });

  function init(suburbs, phonemes) {
    SUBURBS = suburbs;
    PHONEMES = phonemes;
    SORTED_SYMS = [...PHONEMES].sort((a, b) => b.sym.length - a.sym.length);
    SYM_MAP = Object.fromEntries(PHONEMES.map(p => [p.sym, p]));

    buildLegend();
    populateLGA();
    filter();
    initMap();
    bindEvents();
  }

  // ---- phoneme tokeniser ----

  function buildTooltip(p) {
    return '/' + p.ipa + '/ \u00b7 ' + p.ex;
  }

  function tokenise(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
      let matched = false;
      for (const p of SORTED_SYMS) {
        if (str.startsWith(p.sym, i)) {
          tokens.push({ type: 'phoneme', sym: p.sym, text: p.sym });
          i += p.sym.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        tokens.push({ type: 'punct', text: str[i] });
        i++;
      }
    }
    return tokens;
  }

  function renderPronunciation(str) {
    return tokenise(str).map(t => {
      if (t.type === 'phoneme') {
        return '<span class="ph" data-tip="' + escHtml(buildTooltip(SYM_MAP[t.sym])) + '">' + escHtml(t.text) + '</span>';
      }
      return escHtml(t.text);
    }).join('');
  }

  // ---- phoneme key ----

  function buildLegend() {
    const panel = document.getElementById('legend-panel');
    const toggle = document.getElementById('legend-toggle');
    if (!panel || !toggle) return;

    const rows = arr => '<div class="legend-grid">' + arr.map(p =>
      '<div class="legend-item">' +
        '<span class="legend-sym">' + escHtml(p.sym) + '</span>' +
        '<span class="legend-ipa">' + escHtml(p.ipa) + '</span>' +
        '<span class="legend-example">' + escHtml(p.ex) + '</span>' +
      '</div>').join('') + '</div>';

    panel.innerHTML =
      '<p class="legend-title">Phoneme key</p>' +
      '<p class="legend-section-label">Vowels</p>' + rows(PHONEMES.filter(p => p.seg === 'vowel')) +
      '<p class="legend-section-label">Consonants</p>' + rows(PHONEMES.filter(p => p.seg === 'consonant'));

    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ---- sound playback ----

  function setSpeaking(btn, on) {
    btn.classList.toggle('speaking', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function stopSound() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (hasSpeech) window.speechSynthesis.cancel();
  }

  function speak(name, btn) {
    stopSound();
    if (currentBtn && currentBtn !== btn) setSpeaking(currentBtn, false);

    setSpeaking(btn, true);
    currentBtn = btn;

    const fallback = () => {
      currentAudio = null;
      if (!hasSpeech) { setSpeaking(btn, false); return; }
      const utt = new SpeechSynthesisUtterance(name);
      utt.lang = 'en-AU';
      utt.rate = 0.85;
      utt.onend = () => setSpeaking(btn, false);
      utt.onerror = () => setSpeaking(btn, false);
      window.speechSynthesis.speak(utt);
    };

    const audio = new Audio(AUDIO_PATH + encodeURIComponent(name) + '.mp3');
    currentAudio = audio;
    audio.onended = () => { setSpeaking(btn, false); currentAudio = null; };
    audio.onerror = fallback;
    audio.play().catch(fallback);
  }

  function togglePlay(btn) {
    if (btn.classList.contains('speaking')) {
      stopSound();
      setSpeaking(btn, false);
    } else {
      speak(btn.dataset.name, btn);
    }
  }

  // ---- symbol tooltip (hover, tap, or Escape to close) ----

  function showTip(ph) {
    tip.textContent = ph.dataset.tip;
    tip.hidden = false;
    const r = ph.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.top - h - 6;
    if (top < 8) top = r.bottom + 6;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function hideTip() {
    tip.hidden = true;
  }

  // ---- cards ----

  function playIcon() {
    return '<svg width="10" height="12" viewBox="0 0 8 10" fill="currentColor" aria-hidden="true" focusable="false"><path d="M0 0l8 5-8 5z"/></svg>';
  }

  function renderCard(sub, highlight) {
    const hl = s => {
      if (!highlight) return escHtml(s);
      const re = new RegExp('(' + highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return escHtml(s).replace(re, '<mark>$1</mark>');
    };
    const clean = sub.name.toLowerCase().trim();

    return '<li class="suburb-card" data-suburb="' + escHtml(clean) + '">' +
      '<button type="button" class="suburb-name" aria-pressed="false" aria-label="Show ' + escHtml(sub.name) + ' on the map">' + hl(sub.name) + '</button>' +
      '<div class="suburb-meta">' +
        '<span class="suburb-postcode">' + hl(sub.postcode) + '</span>' +
        '<span class="suburb-lga">' + hl(sub.lga) + '</span>' +
      '</div>' +
      '<div class="pronunciation-row">' +
        '<span class="pronunciation" aria-hidden="true">' + renderPronunciation(sub.pronunciation) + '</span>' +
        '<button type="button" class="play-btn" aria-pressed="false" aria-label="Listen to ' + escHtml(sub.name) + '" data-name="' + escHtml(sub.name) + '">' + playIcon() + '</button>' +
      '</div>' +
    '</li>';
  }

  // ---- A-Z bar ----

  function buildAlphaBar(available) {
    const inner = document.getElementById('alpha-inner');
    if (!inner) return;
    inner.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l =>
      available.has(l)
        ? '<a class="alpha-link" href="#letter-' + l + '">' + l + '</a>'
        : '<span class="alpha-link disabled" aria-hidden="true">' + l + '</span>'
    ).join('');
  }

  // ---- render ----

  function groupByLetter(arr) {
    const groups = {};
    for (const s of arr) {
      const l = s.name[0].toUpperCase();
      (groups[l] = groups[l] || []).push(s);
    }
    return groups;
  }

  function render(filtered, highlight) {
    hideTip();

    if (!filtered.length) {
      results.innerHTML = '<p class="empty">No suburbs found.</p>';
      count.textContent = '0 results';
      buildAlphaBar(new Set());
      return;
    }

    count.textContent = filtered.length + ' suburb' + (filtered.length !== 1 ? 's' : '');

    const groups = groupByLetter(filtered);
    const letters = Object.keys(groups).sort();
    buildAlphaBar(new Set(letters));

    results.innerHTML = letters.map(l =>
      '<div class="letter-group" id="letter-' + l + '">' +
        '<h2 class="letter-heading">' + l + '</h2>' +
        '<ul class="suburb-grid">' + groups[l].map(s => renderCard(s, highlight)).join('') + '</ul>' +
      '</div>'
    ).join('');

    markSelectedCard(false);
  }

  // ---- selection (card <-> map) ----

  function markSelectedCard(scrollIntoView) {
    let found = null;
    results.querySelectorAll('.suburb-card').forEach(card => {
      const on = card.dataset.suburb === selectedName;
      card.classList.toggle('selected', on);
      card.querySelector('.suburb-name').setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) found = card;
    });
    if (found && scrollIntoView) {
      found.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function selectSuburbByName(suburbName, scrollToList) {
    selectedName = suburbName.toLowerCase().trim();

    if (geojsonLayer) geojsonMap.forEach(layer => geojsonLayer.resetStyle(layer));

    const layer = geojsonMap.get(selectedName);
    if (layer && map) {
      layer.setStyle(highlightStyle());
      layer.bringToFront();
      map.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 14 });
    }

    markSelectedCard(!!scrollToList);
  }

  // ---- map ----

  function defaultStyle() {
    return { fillColor: '#336', fillOpacity: 0.05, weight: 1, color: '#767676', opacity: 0.8 };
  }

  function highlightStyle() {
    return { fillColor: '#336', fillOpacity: 0.3, weight: 2, color: '#336', opacity: 1 };
  }

  function onEachFeature(feature, layer) {
    const cleanName = ((feature.properties && feature.properties.name) || '').toLowerCase().trim();
    if (cleanName) geojsonMap.set(cleanName, layer);
    layer.on({ click: () => selectSuburbByName(cleanName, true) });
  }

  function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof L === 'undefined') return;

    map = L.map('map').setView([-37.8136, 144.9631], 10);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    }).addTo(map);

    fetch('/assets/data/suburbs.geojson')
      .then(res => res.json())
      .then(data => {
        geojsonLayer = L.geoJSON(data, { style: defaultStyle, onEachFeature: onEachFeature }).addTo(map);
        syncMapWithFilteredSuburbs(currentList);
        if (selectedName) selectSuburbByName(selectedName, false);
      })
      .catch(err => console.error('Could not load suburbs.geojson:', err));
  }

  function syncMapWithFilteredSuburbs(list) {
    if (!geojsonLayer || !map) return;
    const active = new Set(list.map(s => s.name.toLowerCase().trim()));
    geojsonMap.forEach((layer, name) => {
      if (active.has(name)) {
        if (!map.hasLayer(layer)) layer.addTo(map);
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
  }

  // ---- filters ----

  function populateLGA() {
    const sel = document.getElementById('lga-filter');
    if (!sel) return;
    [...new Set(SUBURBS.map(s => s.lga))].sort().forEach(l => {
      const o = document.createElement('option');
      o.value = l;
      o.textContent = l;
      sel.appendChild(o);
    });
  }

  function filter() {
    const q = searchVal.trim().toLowerCase();
    let out = SUBURBS;

    if (lgaVal) out = out.filter(s => s.lga === lgaVal);
    if (q) out = out.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.postcode.includes(q) ||
      s.lga.toLowerCase().includes(q)
    );

    out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    currentList = out;
    render(out, q.length >= 2 ? q : '');
    syncMapWithFilteredSuburbs(out);
  }

  // ---- events ----

  function bindEvents() {
    document.getElementById('search').addEventListener('input', e => {
      searchVal = e.target.value;
      filter();
    });

    document.getElementById('lga-filter').addEventListener('change', e => {
      lgaVal = e.target.value;
      filter();
    });

    // one set of handlers for every card
    results.addEventListener('click', e => {
      const play = e.target.closest('.play-btn');
      if (play) { togglePlay(play); return; }

      const ph = e.target.closest('.ph');
      if (ph) { showTip(ph); return; }

      const card = e.target.closest('.suburb-card');
      if (card) selectSuburbByName(card.dataset.suburb, false);
    });

    results.addEventListener('mouseover', e => {
      const ph = e.target.closest('.ph');
      if (ph) showTip(ph);
    });

    results.addEventListener('mouseout', e => {
      const ph = e.target.closest('.ph');
      if (!ph) return;
      const to = e.relatedTarget;
      if (!(to && to.closest && to.closest('.ph'))) hideTip();
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.ph')) hideTip();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideTip();
    });

    const main = document.querySelector('main');
    if (main) main.addEventListener('scroll', hideTip, { passive: true });
  }
})();
