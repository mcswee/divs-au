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

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const isNA = value => ['','n/a','none'].includes(String(value ?? '').trim().toLowerCase());
  let data;
  let selectedSeq = 1;

  // Do not sort show data here. Its order is the order in eras.csv.
  const rows = () => data.shows;
  const imageMap = () => new Map(data.images.map(image => [image.code, image]));

  const eraOrder = ['Lover','Fearless','Evermore','Reputation','Speak Now','Red','Folklore','1989','The Tortured Poets Department','Acoustic','Midnights'];
  const eraLabels = {'The Tortured Poets Department':'TTPD'};
  const outfitGroups = [
    ['Lover',['Lover Bodysuit','Lover Jacket']],
    ['Fearless',['Fearless Dress']],
    ['Evermore',['Evermore Dress','Evermore Cloak']],
    ['Reputation',['Reputation Bodysuit']],
    ['Speak Now',['Speak Now Dress']],
    ['Red',['Red T-Shirt','Red Romper','Red Jacket']],
    ['Folklore',['Folklore Dress','Folklore Cloak']],
    ['1989',['1989 v1','1989 v2']],
    ['The Tortured Poets Department',['TTPD Dress','TTPD Jacket','TTPD Two Piece']],
    ['Acoustic',['Acoustic Dress']],
    ['Midnights',['Midnights T-Shirt Dress','Midnights Bodysuit','Midnights Jacket']]
  ];
  const catalogueGroupOrder = [
    'Lover Bodysuit','Lover Jacket','Fearless Dress','Evermore Dress','Evermore Cloak','Speak Now Dress',
    'Red T-shirt','Red Romper','Red Coat','Reputation Bodysuit','Folklore Dress','Folklore Cloak',
    '1989 sets','1989 mix and match','TTPD Dress','TTPD Jacket','TTPD two-piece','Acoustic Dress',
    'Midnights T-shirt dress','Midnights bodysuit','Midnights jacket','Guitars','Microphones'
  ];
  const fieldLabels = {
    'Lover Bodysuit':'Lover bodysuit','Lover Jacket':'Lover jacket',
    'Fearless Dress':'Fearless dress','Evermore Dress':'Evermore dress','Evermore Cloak':'Evermore cloak',
    'Reputation Bodysuit':'Reputation bodysuit','Speak Now Dress':'Speak Now dress',
    'Red T-Shirt':'Red T-shirt','Red Romper':'Red romper','Red Jacket':'Red coat',
    'Folklore Dress':'Folklore dress','Folklore Cloak':'Folklore cloak','1989 v1':'1989 set','1989 v2':'1989 mix and match',
    'TTPD Dress':'TTPD dress','TTPD Jacket':'TTPD jacket','TTPD Two Piece':'TTPD two-piece',
    'Acoustic Dress':'Acoustic dress','Midnights T-Shirt Dress':'Midnights T-shirt dress',
    'Midnights Bodysuit':'Midnights bodysuit','Midnights Jacket':'Midnights jacket'
  };
  const guitarLabels = {
    'Lover Guitar':'Lover guitar','Fearless Guitar':'Fearless guitar','Red Guitar':'Red guitar',
    'Speak Now Guitar':'Speak Now guitar','Folklore Guitar':'Folklore guitar','Accoustic Guitar':'Acoustic guitar'
  };
  const micLabels = {
    'Lover Mic':'Lover microphone','Lover Stand Mic':'Lover stand microphone','Fearless Mic':'Fearless microphone',
    'Evermore Mic':'Evermore microphone','Reputation Mic':'Reputation microphone','Speak Now Mic':'Speak Now microphone',
    'Red Mic':'Red microphone','Red ATW Mic':'Red / All Too Well microphone','Folklore Mic':'Folklore microphone',
    '1989 Mic':'1989 microphone','TTPD Mic':'TTPD microphone',
    'TTPD ICDIWABH Mic':'TTPD “I Can Do It With a Broken Heart” microphone',
    'Accoustic Guitar Mic':'Acoustic guitar microphone','Accoustic Piano Mic':'Acoustic piano microphone',
    'Midnights Mic':'Midnights microphone'
  };
  const cancelledFields = [
    ...outfitGroups.flatMap(([,fields]) => fields), '1989 Top','1989 Skirt','1989 Left Shoe','1989 Right Shoe',
    'TTPD Gloves','TTPD Necklace','TTPD Tailcoat','Midnights Coat'
  ];

  const imageTag = (src, alt) => `<img class="eras-art-image" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  root.addEventListener('error', event => {
    if (!event.target.matches?.('.eras-art-image')) return;
    const image = event.target;
    image.hidden = true;
    const parent = image.parentElement;
    if (parent && !parent.querySelector('.eras-image-fallback')) {
      const fallback = document.createElement('span');
      fallback.className = 'eras-image-fallback';
      fallback.textContent = 'SVG unavailable';
      parent.appendChild(fallback);
    }
  }, true);

  const showButtons = ids => (Array.isArray(ids) ? ids : []).map(id =>
    `<button type="button" class="eras-inline-show" data-open-show="${Number(id)}">${Number(id)}</button>`
  ).join(' ');

  function card(item, compact = false) {
    const artClass = compact ? 'eras-detail-art' : 'eras-art-placeholder';
    const copyClass = compact ? 'eras-detail-item-copy' : 'eras-card-body';
    const headingTag = compact ? 'h5' : 'h4';
    const art = item.src
      ? imageTag(item.src, item.alt || item.label || item.code)
      : '<span class="eras-image-fallback">SVG unavailable</span>';
    let meta = '';
    let details = '';
    if (!compact) {
      if (item.parts) {
        details = `<details class="eras-show-list"><summary>Shows by piece</summary>${Object.entries(item.parts).map(([part,ids]) => `<p><strong>${esc(part)}:</strong> ${showButtons(ids)}</p>`).join('')}</details>`;
      } else {
        const ids = Array.isArray(item.showIds) ? item.showIds : [];
        const verb = item.category === 'guitar' || item.category === 'microphone' ? 'used' : 'worn';
        if (item.category === 'microphone') {
          const usedIn = (item.eras || []).map(era => eraLabels[era] || era);
          meta = `<p class="eras-card-meta">Used in: ${esc(usedIn.join(', ') || 'No era recorded')}</p>`;
        } else if (item.category === 'guitar') {
          const usedIn = (item.eras || []).map(era => eraLabels[era] || era);
          meta = `<p class="eras-card-meta">Era: ${esc(usedIn.join(', ') || 'Not recorded')}</p>`;
        } else {
          meta = `<p class="eras-card-meta">${ids.length} ${ids.length === 1 ? 'show' : 'shows'}</p>`;
        }
        details = `<details class="eras-show-list"><summary>Shows ${verb}</summary><p>${showButtons(ids)}</p></details>`;
      }
    }
    const value = item.value ? `<p>${esc(item.value)}</p>` : '';
    return `<article class="${compact ? 'eras-detail-item eras-detail-visual' : 'eras-variant-card'}"><div class="${artClass}">${art}</div><div class="${copyClass}"><${headingTag}>${esc(item.label || item.code)}</${headingTag}>${value}${meta}${details}</div></article>`;
  }

  function renderShowList() {
    const query = showSearch.value.trim().toLowerCase();
    const matches = rows().filter(show =>
      `${show.city} ${show.night || ''} ${show.date} ${show.territory} ${show.venue} ${show.seq}`.toLowerCase().includes(query)
    );
    showCount.textContent = `${matches.length} of ${data.shows.length} shows`;
    showList.innerHTML = matches.map(show =>
      `<button type="button" class="eras-show-option${Number(show.seq) === selectedSeq ? ' is-selected' : ''}" role="option" aria-selected="${Number(show.seq) === selectedSeq ? 'true' : 'false'}" data-seq="${Number(show.seq)}"><span class="eras-show-option-main"><strong>${esc(show.city)} ${esc(show.night || '')}</strong><small>Show ${Number(show.seq)} of ${data.shows.length} · ${esc(show.date)} · ${esc(show.venue)}</small></span></button>`
    ).join('') || '<p class="eras-empty">No shows match that search.</p>';
  }

  function visualCard(ref, show, images, kind) {
    const image = ref.c ? images.get(ref.c) : null;
    const field = ref.f;
    let label = kind === 'outfit' ? (fieldLabels[field] || field) : kind === 'guitar' ? (guitarLabels[field] || field) : (micLabels[field] || field);
    let value = String(show[field] ?? '').trim();
    if (kind === 'outfit') {
      if (field === 'Evermore Cloak') value = 'Forest Green';
      if (field === 'Folklore Cloak') value = 'Chocolate Brown';
      if (field === 'Red Jacket') value = 'Black & Red';
      if (field === '1989 v2') {
        const parts = [
          ['top','1989 Top'],['skirt','1989 Skirt'],['left shoe','1989 Left Shoe'],['right shoe','1989 Right Shoe']
        ].filter(([,key]) => !isNA(show[key])).map(([part,key]) => `${show[key]} ${part}`);
        value = parts.join(', ');
      }
      if (field === 'TTPD Dress') {
        const gloves = show['TTPD Gloves'];
        value = `${show['TTPD Dress']}${!isNA(gloves) ? ` with ${gloves} gloves` : ''}`;
      }
      if (field === 'TTPD Two Piece') {
        value = [show['TTPD Two Piece'], !isNA(show['TTPD Necklace']) ? `${show['TTPD Necklace']} necklace` : '', !isNA(show['TTPD Tailcoat']) ? `${show['TTPD Tailcoat']} tailcoat` : ''].filter(Boolean).join(' · ');
      }
      if (field === 'Midnights T-Shirt Dress') {
        value = `${show['Midnights T-Shirt Dress']}${!isNA(show['Midnights Coat']) ? ` with ${show['Midnights Coat']} coat` : ''}`;
      }
      if (field === 'Midnights Bodysuit' && String(show['Midnights Garter']).trim().toLowerCase() === 'no') {
        value = `${show['Midnights Bodysuit']} · No garter`;
      }
      if (field === 'Midnights Jacket' && ['mdn-jk-l','mdn-jk-s'].includes(ref.c)) {
        value = `No jacket · ${show['Midnights Bodysuit']} bodysuit`;
      }
    }
    return {
      ...(image || {}), code: ref.c || '', src: image?.src || '', label, value,
      alt: `${label}${value ? `: ${value}` : ''}`,
      category: kind
    };
  }

  function detailEra(era, items) {
    if (!items.length) return '';
    return `<div class="eras-detail-era"><h4>${esc(eraLabels[era] || era)}</h4><div class="eras-detail-grid">${items.map(item => card(item, true)).join('')}</div></div>`;
  }

  function renderDetail(seq) {
    const show = rows().find(item => Number(item.seq) === Number(seq));
    if (!show) return;
    selectedSeq = Number(show.seq);
    renderShowList();
    const images = imageMap();
    const cancelled = cancelledFields.every(field => isNA(show[field]));
    let html = `<header class="eras-selected-show"><p class="eras-eyebrow">Show ${Number(show.seq)} of ${data.shows.length}</p><h2>${esc(show.city)} ${esc(show.night || '')}</h2><p class="eras-show-meta">${esc(show.date)}${show.territory ? ` · ${esc(show.territory)}` : ''}</p><p class="eras-show-venue">${esc(show.venue || '')}</p><div class="eras-show-navigation"><button type="button" data-step="-1" ${selectedSeq <= 1 ? 'disabled' : ''}><span class="eras-nav-desktop">← Previous show</span><span class="eras-nav-mobile">◀ Prev show</span></button><button type="button" data-step="1" ${selectedSeq >= data.shows.length ? 'disabled' : ''}><span class="eras-nav-desktop">Next show →</span><span class="eras-nav-mobile">Next show ▶</span></button></div></header>`;

    const openingActs = [show.firstAct, show.secondAct].filter(value => !isNA(value));
    html += `<div class="eras-show-support"><h3>Opening acts</h3><p>${openingActs.length ? openingActs.map(esc).join(' · ') : 'None'}</p></div>`;

    if (cancelled) {
      html += '<div class="eras-cancelled-note"><img class="eras-cancelled-image" src="/assets/images/eras-tour-cancelled.svg" alt="Cancelled show"><p>This show was cancelled.</p></div>';
    } else {
      const refs = show.visualRefs || {outfits:[],guitars:[],microphones:[]};
      const outfitRefs = new Map((refs.outfits || []).map(ref => [ref.f,ref]));
      html += '<section class="eras-detail-section"><h3>Outfits</h3>';
      for (const [era,fields] of outfitGroups) {
        const items = fields.map(field => outfitRefs.get(field)).filter(Boolean).map(ref => visualCard(ref,show,images,'outfit')).filter(item => item.value && !isNA(item.value));
        html += detailEra(era,items);
      }
      html += '</section>';

      const guitarItems = (refs.guitars || []).map(ref => visualCard(ref,show,images,'guitar')).filter(item => item.value && !isNA(item.value));
      if (guitarItems.length) html += `<section class="eras-detail-section"><h3>Guitars</h3><div class="eras-detail-grid">${guitarItems.map(item => card(item,true)).join('')}</div></section>`;

      const microphoneRefs = refs.microphones || [];
      const microphoneGroups = new Map();
      for (const era of eraOrder) {
        const items = microphoneRefs.filter(ref => ref.era === era).map(ref => visualCard(ref,show,images,'microphone')).filter(item => item.value && !isNA(item.value));
        if (items.length) microphoneGroups.set(era,items);
      }
      if (microphoneGroups.size) {
        html += '<section class="eras-detail-section"><h3>Microphones</h3>';
        for (const [era,items] of microphoneGroups) html += detailEra(era,items);
        html += '</section>';
      }

      const surpriseSong = instrument => {
        const prefix = instrument === 'Guitar' ? 'Guitar' : 'Piano';
        const tracks = [`${prefix} First Song`,`${prefix} Second Song`,`${prefix} Third Song`].map(key => show[key]).filter(value => !isNA(value));
        if (!tracks.length) return '';
        return String(show[`${prefix} Mashup`]).toLowerCase() === 'true' ? `${tracks.join(' × ')} mashup` : tracks.join(' · ');
      };
      const songs = [{label:'Guitar',value:surpriseSong('Guitar')},{label:'Piano',value:surpriseSong('Piano')}].filter(item => item.value);
      if (songs.length) html += `<section class="eras-detail-section"><h3>Surprise songs</h3><dl class="eras-detail-facts">${songs.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl></section>`;

      const moments = [
        {label:'“Oh Hi!”',value:show['Oh Hi!']},{label:'“Like Ever!”',value:show['Like Ever!']},
        {label:'Ovation',value:show.Ovation},{label:'Guy on the screen',value:show['Guy on the']}
      ].filter(item => !isNA(item.value));
      if (moments.length) html += `<section class="eras-detail-section"><h3>Show moments</h3><dl class="eras-detail-facts">${moments.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl></section>`;
      const guests = ['Special Guest','Second Guest','Third Guest'].map(key => show[key]).filter(value => !isNA(value));
      if (guests.length) html += `<section class="eras-detail-section"><h3>Special guests</h3><p>${guests.map(esc).join(' · ')}</p></section>`;
    }
    showDetail.innerHTML = html;
  }

  function renderCatalogue() {
    const type = catalogueType.value;
    const era = eraFilter.value;
    const images = imageMap();
    const items = data.catalogue.map(ref => ({...(images.get(ref.code) || {}),...ref}))
      .filter(item => item.code && (type === 'all' || item.category === type))
      .filter(item => era === 'all' || (Array.isArray(item.eras) && item.eras.includes(era)) || (!item.eras && item.era === era));
    catalogueCount.textContent = `${items.length} items`;
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.catalogueGroup)) groups.set(item.catalogueGroup,[]);
      groups.get(item.catalogueGroup).push(item);
    }
    const rank = new Map(catalogueGroupOrder.map((group,index) => [group,index]));
    const orderedGroups = [...groups].sort((a,b) => (rank.get(a[0]) ?? 999) - (rank.get(b[0]) ?? 999));
    catalogueResults.innerHTML = orderedGroups.map(([group,groupItems]) =>
      `<section class="eras-catalogue-family"><h3>${esc(group)}</h3><div class="eras-card-grid">${groupItems.map(item => card(item,false)).join('')}</div></section>`
    ).join('') || '<p class="eras-empty">No catalogue entries match those filters.</p>';
  }

  showList.addEventListener('click',event => {
    const button = event.target.closest('[data-seq]');
    if (button) renderDetail(Number(button.dataset.seq));
  });
  showSearch.addEventListener('input',renderShowList);
  showDetail.addEventListener('click',event => {
    const button = event.target.closest('[data-step]');
    if (button) renderDetail(selectedSeq + Number(button.dataset.step));
  });
  catalogueType.addEventListener('change',renderCatalogue);
  eraFilter.addEventListener('change',renderCatalogue);
  catalogueResults.addEventListener('click',event => {
    const button = event.target.closest('[data-open-show]');
    if (!button) return;
    renderDetail(Number(button.dataset.openShow));
    const showAccordion = document.querySelector('.eras-show-data');
    if (showAccordion) showAccordion.open = true;
    const browser = document.querySelector('.eras-show-browser');
    if (browser) browser.scrollIntoView({behavior:'smooth',block:'start'});
  });

  fetch('/assets/data/eras-catalogue.json').then(response => {
    if (!response.ok) throw new Error('Could not load show data');
    return response.json();
  }).then(loaded => {
    data = loaded;
    for (const option of [...eraFilter.options].slice(1)) option.remove();
    for (const era of eraOrder) {
      const option = document.createElement('option');
      option.value = era;
      option.textContent = eraLabels[era] || era;
      eraFilter.appendChild(option);
    }
    renderShowList();
    renderDetail(1);
    renderCatalogue();
  }).catch(error => {
    showCount.textContent = 'Show data unavailable';
    showDetail.innerHTML = `<p class="eras-empty">${esc(error.message)}.</p>`;
  });
})();
