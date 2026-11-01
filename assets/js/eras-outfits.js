(() => {
  const root = document.getElementById('eras-catalogue');
  if (!root) return;

  const showSearch = document.getElementById('eras-show-search');
  const showList = document.getElementById('eras-show-list');
  const showCount = document.getElementById('eras-show-count');
  const showDetail = document.getElementById('eras-show-detail');
  const catalogueType = document.getElementById('eras-catalogue-type');
  const eraFilter = document.getElementById('eras-era-filter');
  const catalogueCount = document.getElementById('eras-catalogue-count');
  const catalogueResults = document.getElementById('eras-catalogue-results');
  const statusEl = document.getElementById('eras-status');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const PART_NAMES = ['Top', 'Skirt', 'Left shoe', 'Right shoe'];

  // Everything below is built once from eras-catalogue.json (see hydrate)
  let eras = [];           // [{ id, label }] in tour order
  let slots = [];          // every place a show can carry an image: { id, kind, era, label }
  let images = [];         // [{ code, label, family, category, value, src }]
  let imagesByCode = new Map();
  let shows = [];          // the JSON shows plus seq (their position, from 1)
  let catalogue = [];      // catalogue entries with showIds, eras and parts worked out
  let selectedSeq = 1;
  let announceTimer;

  // Debounced announcement, so typing and stepping don't read out every intermediate state
  function announce(message, delay = 600) {
    clearTimeout(announceTimer);
    statusEl.textContent = '';
    announceTimer = setTimeout(() => { statusEl.textContent = message; }, delay);
  }

  const formatDate = iso => {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  // ── Data ────────────────────────────────────────────────────────────────────
  function hydrate(raw) {
    eras = raw.eras.map(([id, label]) => ({ id, label }));
    slots = raw.slots.map(([id, kind, era, label]) => ({ id, kind, era, label }));
    images = raw.images.map(image => ({
      code: image.c,
      label: image.l,
      family: image.f,
      category: image.t,
      value: image.v ?? image.l,           // text shown under the heading; defaults to the label
      src: `${raw.imagePath}${image.c}.svg`
    }));
    imagesByCode = new Map(images.map(image => [image.code, image]));
    shows = raw.shows.map((show, index) => ({ ...show, seq: index + 1 }));
    catalogue = buildCatalogue(raw.catalogue);
  }

  // A show stores one number per slot: the image's position + 1, or 0 for nothing. Text that
  // differs from the image's default (a coat, gloves, a necklace) is in the show's `v`.
  function showItems(show) {
    const items = [];
    (show.refs || []).forEach((ref, slotIndex) => {
      if (!ref) return;
      const image = images[ref - 1];
      const slot = slots[slotIndex];
      items.push({ ...image, slot, category: slot.kind, label: slot.label, value: show.v?.[slotIndex] ?? image.value });
    });
    return items;
  }

  // Which shows, eras and pieces an image has is worked out from the shows themselves
  function buildCatalogue(codes) {
    const usage = new Map();
    const parts = new Map();
    const pieceEras = new Map();
    const eraRank = new Map(eras.map((era, index) => [era.id, index]));
    const note = (map, key, seq) => {
      const list = map.get(key) || [];
      if (list[list.length - 1] !== seq) list.push(seq);
      map.set(key, list);
    };
    shows.forEach(show => (show.refs || []).forEach((ref, slotIndex) => {
      if (!ref) return;
      const code = images[ref - 1].code;
      const entry = usage.get(code) || { showIds: [], eras: new Set() };
      if (entry.showIds[entry.showIds.length - 1] !== show.seq) entry.showIds.push(show.seq);
      entry.eras.add(slots[slotIndex].era);
      usage.set(code, entry);
      // A 1989 mix-and-match code ends in four letters: top, skirt, left shoe, right shoe.
      // Each piece counts towards the single-colour image of that letter, which also takes the era.
      if (images[ref - 1].family === '1989 mix and match') {
        [...code.slice(-4)].forEach((letter, n) => {
          const whole = `${code.slice(0, -4)}${letter.repeat(4)}`;
          note(parts, `${whole}|${PART_NAMES[n]}`, show.seq);
          pieceEras.set(whole, (pieceEras.get(whole) || new Set()).add(slots[slotIndex].era));
        });
      }
    }));
    return codes.map(code => {
      const image = imagesByCode.get(code);
      const used = usage.get(code) || { showIds: [], eras: new Set() };
      const item = {
        ...image,
        catalogueGroup: image.family,
        showIds: used.showIds,
        eras: [...new Set([...used.eras, ...(pieceEras.get(code) || [])])].sort((a, b) => eraRank.get(a) - eraRank.get(b))
      };
      if (image.family === '1989 mix and match') {
        item.parts = Object.fromEntries(PART_NAMES.map(name => [name, parts.get(`${code}|${name}`) || []]));
      }
      return item;
    });
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  const imageTag = (src, alt) => `<img class="eras-art-image" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  root.addEventListener('error', event => {
    if (!event.target.matches?.('.eras-art-image')) return;
    const image = event.target;
    image.hidden = true;
    const parent = image.parentElement;
    if (parent && !parent.querySelector('.eras-image-fallback')) {
      const fallback = document.createElement('span');
      fallback.className = 'eras-image-fallback';
      fallback.textContent = 'No image yet';
      parent.appendChild(fallback);
    }
  }, true);

  const showButtons = ids => (Array.isArray(ids) ? ids : []).map(id =>
    `<button type="button" class="eras-inline-show" data-open-show="${Number(id)}" aria-label="Show ${Number(id)}">${Number(id)}</button>`
  ).join(' ');

  const eraName = id => eras.find(era => era.id === id)?.label || id;

  function card(item, compact = false) {
    const artClass = compact ? 'eras-detail-art' : 'eras-art-placeholder';
    const copyClass = compact ? 'eras-detail-item-copy' : 'eras-card-body';
    const headingTag = compact ? 'h5' : 'h4';
    // In a show's detail the heading and value already say what the picture shows, so its alt is empty
    const art = item.src
      ? imageTag(item.src, compact ? '' : item.label)
      : '<span class="eras-image-fallback">No image yet</span>';
    let meta = '';
    let details = '';
    if (!compact) {
      if (item.parts) {
        details = `<details class="eras-show-list"><summary>Shows by piece</summary>${Object.entries(item.parts).map(([part,ids]) => `<p><strong>${esc(part)}:</strong> ${showButtons(ids)}</p>`).join('')}</details>`;
      } else {
        const ids = item.showIds;
        const verb = item.category === 'guitar' || item.category === 'microphone' ? 'used' : 'worn';
        const usedIn = item.eras.map(eraName);
        if (item.category === 'microphone') {
          meta = `<p class="eras-card-meta">Used in: ${esc(usedIn.join(', ') || 'No era recorded')}</p>`;
        } else if (item.category === 'guitar') {
          meta = `<p class="eras-card-meta">Era: ${esc(usedIn.join(', ') || 'Not recorded')}</p>`;
        } else {
          meta = `<p class="eras-card-meta">${ids.length} ${ids.length === 1 ? 'show' : 'shows'}</p>`;
        }
        details = `<details class="eras-show-list"><summary>Shows ${verb}</summary><p>${showButtons(ids)}</p></details>`;
      }
    }
    const value = compact && item.value ? `<p>${esc(item.value)}</p>` : '';
    return `<article class="${compact ? 'eras-detail-item eras-detail-visual' : 'eras-variant-card'}"><div class="${artClass}">${art}</div><div class="${copyClass}"><${headingTag}>${esc(item.label || item.code)}</${headingTag}>${value}${meta}${details}</div></article>`;
  }

  function renderShowList() {
    const query = showSearch.value.trim().toLowerCase();
    const matches = shows.filter(show =>
      `${show.city} ${show.night || ''} ${formatDate(show.date)} ${show.date} ${show.territory} ${show.venue} ${show.seq}`.toLowerCase().includes(query)
    );
    showCount.textContent = `${matches.length} of ${shows.length} shows`;
    showList.innerHTML = matches.length
      ? `<ul class="eras-show-options" aria-label="Shows">${matches.map(show =>
        `<li><button type="button" class="eras-show-option"${show.seq === selectedSeq ? ' aria-current="true"' : ''} data-seq="${show.seq}"><span class="eras-show-option-main"><strong>${esc(show.city)} ${esc(show.night || '')}</strong><small>Show ${show.seq} of ${shows.length} · ${esc(formatDate(show.date))} · ${esc(show.venue)}</small></span></button></li>`
      ).join('')}</ul>`
      : '<p class="eras-empty">No shows match that search.</p>';
    // Keep the selected show in view when stepping with Previous/Next
    const selected = showList.querySelector('[aria-current="true"]');
    if (selected) {
      const box = showList.getBoundingClientRect();
      const item = selected.getBoundingClientRect();
      if (item.top < box.top) showList.scrollTop -= box.top - item.top;
      else if (item.bottom > box.bottom) showList.scrollTop += item.bottom - box.bottom;
    }
  }

  function detailEra(era, items) {
    if (!items.length) return '';
    return `<div class="eras-detail-era"><h4>${esc(era.label)}</h4><div class="eras-detail-grid">${items.map(item => card(item, true)).join('')}</div></div>`;
  }

  const songText = (show, instrument) => {
    const tracks = show[instrument];
    if (!tracks?.length) return '';
    return show[`${instrument}Mashup`] ? `${tracks.join(' × ')} mashup` : tracks.join(' · ');
  };

  // focus: 'heading' moves focus to the show's heading (a list pick), 'step' keeps it on the
  // Previous/Next button that was used, and nothing leaves focus alone (first load)
  function renderDetail(seq, { focus = '', step = 0 } = {}) {
    const show = shows.find(item => item.seq === Number(seq));
    if (!show) return;
    selectedSeq = show.seq;
    renderShowList();
    let html = `<header class="eras-selected-show"><p class="eras-eyebrow">Show ${show.seq} of ${shows.length}</p><h2 tabindex="-1">${esc(show.city)} ${esc(show.night || '')}</h2><p class="eras-show-meta">${esc(formatDate(show.date))}${show.territory ? ` · ${esc(show.territory)}` : ''}</p><p class="eras-show-venue">${esc(show.venue || '')}</p><div class="eras-show-navigation"><button type="button" data-step="-1" ${selectedSeq <= 1 ? 'disabled' : ''}><span class="eras-nav-desktop"><span aria-hidden="true">←</span> Previous show</span><span class="eras-nav-mobile"><span aria-hidden="true">◀</span> Prev show</span></button><button type="button" data-step="1" ${selectedSeq >= shows.length ? 'disabled' : ''}><span class="eras-nav-desktop">Next show <span aria-hidden="true">→</span></span><span class="eras-nav-mobile">Next show <span aria-hidden="true">▶</span></span></button></div></header>`;

    const openingActs = show.acts || [];
    html += `<div class="eras-show-support"><h3>Opening acts</h3><p>${openingActs.length ? openingActs.map(esc).join(' · ') : 'None'}</p></div>`;

    if (show.cancelled) {
      html += '<div class="eras-cancelled-note"><img class="eras-cancelled-image" src="/assets/images/eras-tour/cancelled.svg" alt=""><p>This show was cancelled.</p></div>';
    } else {
      const items = showItems(show);
      const ofKind = kind => items.filter(item => item.slot.kind === kind);
      const byEra = list => era => list.filter(item => item.slot.era === era.id);

      html += '<section class="eras-detail-section"><h3>Outfits</h3>';
      eras.forEach(era => { html += detailEra(era, byEra(ofKind('outfit'))(era)); });
      html += '</section>';

      const guitars = ofKind('guitar');
      if (guitars.length) html += `<section class="eras-detail-section"><h3>Guitars</h3><div class="eras-detail-grid">${guitars.map(item => card(item,true)).join('')}</div></section>`;

      const microphones = ofKind('microphone');
      if (microphones.length) {
        html += '<section class="eras-detail-section"><h3>Microphones</h3>';
        eras.forEach(era => { html += detailEra(era, byEra(microphones)(era)); });
        html += '</section>';
      }

      const songs = [{label:'Guitar',value:songText(show,'guitar')},{label:'Piano',value:songText(show,'piano')}].filter(item => item.value);
      if (songs.length) html += `<section class="eras-detail-section"><h3>Surprise songs</h3><dl class="eras-detail-facts">${songs.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl></section>`;

      const moments = [
        {label:'“Oh Hi!”',value:show.ohHi},{label:'“Kam’s Like Ever!”',value:show.likeEver},
        {label:'Champagne Problems Ovation',value:show.ovation},{label:'Guy on the...',value:show.guyOn}
      ].filter(item => item.value);
      if (moments.length) html += `<section class="eras-detail-section"><h3>Show moments</h3><dl class="eras-detail-facts">${moments.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl></section>`;
      if (show.guests?.length) html += `<section class="eras-detail-section"><h3>Special guests</h3><p>${show.guests.map(esc).join(' · ')}</p></section>`;
    }
    showDetail.innerHTML = html;

    const title = `${show.city} ${show.night || ''}`.trim();
    if (focus === 'heading') {
      showDetail.querySelector('h2')?.focus({ preventScroll: true });
    } else if (focus === 'step') {
      // The button that was pressed has just been rebuilt, so put focus on its replacement
      const next = showDetail.querySelector(`[data-step="${step}"]:not(:disabled)`) || showDetail.querySelector('[data-step]:not(:disabled)');
      next?.focus({ preventScroll: true });
      announce(`${title}, show ${selectedSeq} of ${shows.length}`, 150);
    }
  }

  function renderCatalogue() {
    const type = catalogueType.value;
    const era = eraFilter.value;
    const items = catalogue
      .filter(item => type === 'all' || item.category === type)
      .filter(item => era === 'all' || item.eras.includes(era));
    catalogueCount.textContent = `${items.length} items`;
    // The catalogue list is already in display order, so groups appear as they first occur
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.catalogueGroup)) groups.set(item.catalogueGroup,[]);
      groups.get(item.catalogueGroup).push(item);
    }
    catalogueResults.innerHTML = [...groups].map(([group,groupItems]) =>
      `<section class="eras-catalogue-family"><h3>${esc(group)}</h3><div class="eras-card-grid">${groupItems.map(item => card(item,false)).join('')}</div></section>`
    ).join('') || '<p class="eras-empty">No catalogue entries match those filters.</p>';
  }

  showList.addEventListener('click',event => {
    const button = event.target.closest('[data-seq]');
    if (button) renderDetail(Number(button.dataset.seq), { focus: 'heading' });
  });
  showSearch.addEventListener('input',() => {
    renderShowList();
    announce(showCount.textContent);
  });
  showDetail.addEventListener('click',event => {
    const button = event.target.closest('[data-step]');
    if (button) renderDetail(selectedSeq + Number(button.dataset.step), { focus: 'step', step: Number(button.dataset.step) });
  });
  const filterChanged = () => {
    renderCatalogue();
    announce(catalogueCount.textContent);
  };
  catalogueType.addEventListener('change',filterChanged);
  eraFilter.addEventListener('change',filterChanged);
  catalogueResults.addEventListener('click',event => {
    const button = event.target.closest('[data-open-show]');
    if (!button) return;
    renderDetail(Number(button.dataset.openShow), { focus: 'heading' });
    const showAccordion = document.querySelector('.eras-show-data');
    if (showAccordion) showAccordion.open = true;
    const browser = document.querySelector('.eras-show-browser');
    if (browser) browser.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block:'start'});
  });

  fetch('/assets/data/eras-catalogue.json').then(response => {
    if (!response.ok) throw new Error('Could not load show data');
    return response.json();
  }).then(raw => {
    hydrate(raw);
    for (const option of [...eraFilter.options].slice(1)) option.remove();
    for (const era of eras) {
      const option = document.createElement('option');
      option.value = era.id;
      option.textContent = era.label;
      eraFilter.appendChild(option);
    }
    renderShowList();
    renderDetail(1);
    renderCatalogue();
  }).catch(error => {
    showCount.textContent = 'Show data unavailable';
    showDetail.innerHTML = `<p class="eras-empty" role="alert">${esc(error.message)}.</p>`;
  });
})();
