(() => {
  const root = document.getElementById('eras-catalogue');
  if (!root) return;
  const showSearch = document.getElementById('eras-show-search');
  const showList = document.getElementById('eras-show-list');
  const showCount = document.getElementById('eras-show-count');
  const showDetail = document.getElementById('eras-show-detail');
  const catalogueSearch = document.getElementById('eras-catalogue-search');
  const catalogueType = document.getElementById('eras-catalogue-type');
  const eraFilter = document.getElementById('eras-era-filter');
  const catalogueCount = document.getElementById('eras-catalogue-count');
  const catalogueResults = document.getElementById('eras-catalogue-results');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const isNA = value => String(value ?? '').trim().toLowerCase() === 'n/a';
  let data, selectedSeq = 1;

  const displayField = field => ({
    'Accoustic Guitar':'Acoustic guitar',
    'Accoustic Guitar Mic':'Acoustic guitar mic',
    'Accoustic Piano Mic':'Acoustic piano mic',
    'Red ATW Mic':'Red / All Too Well mic',
    'TTPD ICDIWABH Mic':'TTPD “I Can Do It With a Broken Heart” mic',
    '1989 v1':'1989 set',
    '1989 v2':'1989 pieces',
    'TTPD Two Piece':'TTPD two-piece',
    'Red Jacket':'Red coat'
  })[field] || field;
  const labelShow = s => `${s.city} ${s.night || ''}`.trim();
  const allShows = () => data.showDetails.map(s => ({...s, ...(data.shows.find(x => x.seq === s.seq) || {})})).sort((a,b)=>a.seq-b.seq);
  const shows = () => allShows();
  const imageTag = (src, alt, className='eras-art-image') => `<img class="${className}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  root.addEventListener('error', e => {
    if (!e.target.matches || !e.target.matches('.eras-art-image')) return;
    const img = e.target;
    img.hidden = true;
    const parent = img.parentElement;
    if (parent && !parent.querySelector('.eras-image-fallback')) {
      const fallback = document.createElement('span');
      fallback.className = 'eras-image-fallback';
      fallback.textContent = 'Illustration to be added';
      parent.appendChild(fallback);
    }
  }, true);
  const showButtonList = ids => ids.map(id => `<button type="button" class="eras-inline-show" data-open-show="${id}">${id}</button>`).join(' ');
  const card = (item, compact=false) => `<article class="${compact?'eras-detail-item eras-detail-visual':'eras-variant-card'}"><div class="${compact?'eras-detail-art':'eras-art-placeholder'}">${imageTag(item.src,item.label)}</div><div class="${compact?'eras-detail-item-copy':'eras-card-body'}"><h${compact?'5':'4'}>${esc(item.label)}</h${compact?'5':'4'}>${item.value && compact?`<p>${esc(item.value)}</p>`:''}${!compact?`<p>${item.showIds.length} ${item.showIds.length===1?'show':'shows'}</p><details><summary>Shows worn</summary><p>${showButtonList(item.showIds)}</p></details>`:''}</div></article>`;

  function renderShowList() {
    const q = showSearch.value.trim().toLowerCase();
    const matches = shows().filter(s => `${s.city} ${s.night} ${s.date} ${s.territory} ${s.venue} ${s.seq}`.toLowerCase().includes(q));
    showCount.textContent = `${matches.length} of ${data.showDetails.length} shows`;
    showList.innerHTML = matches.map(s => `<button type="button" class="eras-show-option${s.seq===selectedSeq?' is-selected':''}" role="option" aria-selected="${s.seq===selectedSeq?'true':'false'}" data-seq="${s.seq}"><span class="eras-show-option-main"><strong>${esc(s.city)} ${esc(s.night || '')}</strong><small>Show ${s.seq} of 152 · ${esc(s.date)} · ${esc(s.venue)}</small></span></button>`).join('') || '<p class="eras-empty">No shows match that search.</p>';
  }

  function renderVisualSection(title, items, className='eras-detail-grid') {
    if (!items || !items.length) return '';
    return `<section class="eras-detail-section"><h3>${esc(title)}</h3><div class="${className}">${items.map(item=>card(item,true)).join('')}</div></section>`;
  }

  function renderDetail(seq) {
    const show = shows().find(s=>s.seq===Number(seq));
    if (!show) return;
    selectedSeq = show.seq;
    renderShowList();
    const outfitKeys = ['Lover Bodysuit','Lover Jacket','Fearless Dress','Evermore Dress','Evermore Cloak','Red T-Shirt','Red Romper','Red Jacket','Speak Now Dress','Reputation Bodysuit','Folklore Dress','Folklore Cloak','1989 v1','1989 Top','1989 Skirt','1989 Left Shoe','1989 Right Shoe','TTPD Dress','TTPD Jacket','TTPD Two Piece','Acoustic Dress','Midnights T-Shirt Dress','Midnights Bodysuit','Midnights Jacket'];
    const cancelled = outfitKeys.every(k=>isNA(show[k]));
    let html = `<header class="eras-selected-show"><p class="eras-eyebrow">Show ${show.seq} of 152</p><h2>${esc(show.city)} ${esc(show.night || '')}</h2><p class="eras-show-meta">${esc(show.date)}${show.territory ? ` · ${esc(show.territory)}` : ''}</p><p class="eras-show-venue">${esc(show.venue || '')}</p><div class="eras-show-navigation"><button type="button" data-step="-1" ${show.seq<=1?'disabled':''}><span class="eras-nav-desktop">← Previous show</span><span class="eras-nav-mobile">◀ Prev show</span></button><button type="button" data-step="1" ${show.seq>=152?'disabled':''}><span class="eras-nav-desktop">Next show →</span><span class="eras-nav-mobile">Next show ▶</span></button></div></header>`;
    const openingActs = [show.firstAct, show.secondAct].filter(v => v && !isNA(v) && String(v).trim().toLowerCase() !== 'none');
    if (!cancelled) html += `<div class="eras-show-support"><h3>Opening acts</h3><p>${openingActs.length ? openingActs.map(esc).join(' · ') : 'None'}</p></div>`;
    if (cancelled) {
      html += `<div class="eras-cancelled-note"><img class="eras-cancelled-image" src="/assets/images/eras-tour-cancelled.svg" alt="Cancelled show"><p>This show was cancelled.</p></div>`;
    } else {
      const visuals = show.visuals || {outfits:[],guitars:[],microphones:[]};
      const byEra = new Map();
      visuals.outfits.forEach(item => { if (!byEra.has(item.era)) byEra.set(item.era,[]); byEra.get(item.era).push(item); });
      html += '<section class="eras-detail-section"><h3>Outfits</h3>';
      if (byEra.size) {
        for (const [era,items] of byEra) html += `<div class="eras-detail-era"><h4>${esc(era)}</h4><div class="eras-detail-grid">${items.map(item=>card(item,true)).join('')}</div></div>`;
      } else html += '<p>No outfit details recorded.</p>';
      html += '</section>';
      html += renderVisualSection('Guitars',visuals.guitars);
      html += renderVisualSection('Microphones',visuals.microphones);
      const surpriseSong = instrument => {
        const prefix = instrument === 'Guitar' ? 'Guitar' : 'Piano';
        const tracks = [`${prefix} First Song`, `${prefix} Second Song`, `${prefix} Third Song`].map(k=>show[k]).filter(v=>v!=null&&!isNA(v));
        if (!tracks.length) return '';
        return String(show[`${prefix} Mashup`]).toLowerCase() === 'true' ? `${tracks.join(' × ')} mashup` : tracks.join(' · ');
      };
      const songs = [{label:'Guitar',value:surpriseSong('Guitar')},{label:'Piano',value:surpriseSong('Piano')}].filter(x=>x.value);
      if (songs.length) html += `<section class="eras-detail-section"><h3>Surprise songs</h3><dl class="eras-detail-facts">${songs.map(x=>`<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl></section>`;
      const moments = [
        {label:'“Oh Hi!”', value:show['Oh Hi!']},
        {label:'“Like Ever!”', value:show['Like Ever!']},
        {label:'Ovation', value:show.Ovation},
        {label:'Guy on the screen', value:show['Guy on the']}
      ].filter(x=>x.value!=null&&!isNA(x.value));
      if (moments.length) html += `<section class="eras-detail-section"><h3>Show moments</h3><dl class="eras-detail-facts">${moments.map(x=>`<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl></section>`;
      const guests = ['Special Guest','Second Guest','Third Guest'].map(k=>show[k]).filter(v=>v&&!isNA(v));
      if (guests.length) html += `<section class="eras-detail-section"><h3>Special guests</h3><p>${guests.map(esc).join(' · ')}</p></section>`;
    }
    showDetail.innerHTML = html;
  }

  function renderCatalogue() {
    const q = catalogueSearch.value.trim().toLowerCase();
    const type = catalogueType.value;
    const era = eraFilter.value;
    const items = data.imageCatalog.filter(item => (type==='all'||item.category===type) && (era==='all'||item.era===era||item.era==='All eras') && `${item.era} ${item.family} ${item.label} ${item.code}`.toLowerCase().includes(q));
    catalogueCount.textContent = `${items.length} illustrations`;
    const groups = new Map();
    items.forEach(item=>{
      const group = item.category==='microphone' ? 'Microphones' : item.era;
      if(!groups.has(group)) groups.set(group,[]);
      groups.get(group).push(item);
    });
    catalogueResults.innerHTML = [...groups].map(([group,groupItems])=>`<section class="eras-catalogue-family"><h3>${esc(group)}</h3><div class="eras-card-grid">${groupItems.map(item=>card(item,false)).join('')}</div></section>`).join('') || '<p class="eras-empty">No catalogue entries match that search.</p>';
  }

  showList.addEventListener('click', e=>{const btn=e.target.closest('[data-seq]');if(btn)renderDetail(Number(btn.dataset.seq));});
  showSearch.addEventListener('input', renderShowList);
  showDetail.addEventListener('click', e=>{const step=e.target.closest('[data-step]');if(step)renderDetail(selectedSeq+Number(step.dataset.step));});
  catalogueSearch.addEventListener('input',renderCatalogue);
  catalogueType.addEventListener('change',renderCatalogue);
  eraFilter.addEventListener('change',renderCatalogue);
  catalogueResults.addEventListener('click',e=>{const btn=e.target.closest('[data-open-show]');if(btn){renderDetail(Number(btn.dataset.openShow));document.querySelector('.eras-show-browser').scrollIntoView({behavior:'smooth',block:'start'});}});

  fetch('/assets/data/eras-catalogue.json').then(r=>{if(!r.ok)throw new Error('Could not load show data');return r.json();}).then(loaded=>{
    data=loaded;
    [...new Set(data.imageCatalog.map(item=>item.era).filter(era=>era!=='All eras'))].forEach(era=>{const opt=document.createElement('option');opt.value=era;opt.textContent=era;eraFilter.appendChild(opt);});
    renderShowList();renderDetail(1);renderCatalogue();
  }).catch(err=>{showCount.textContent='Show data unavailable';showDetail.innerHTML=`<p class="eras-empty">${esc(err.message)}.</p>`;});
})();
