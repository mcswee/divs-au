(() => {
  const root = document.getElementById('eras-catalogue');
  if (!root) return;
  const showSearch = document.getElementById('eras-show-search');
  const showList = document.getElementById('eras-show-list');
  const showCount = document.getElementById('eras-show-count');
  const showDetail = document.getElementById('eras-show-detail');
  const catalogueSearch = document.getElementById('eras-catalogue-search');
  const eraFilter = document.getElementById('eras-era-filter');
  const catalogueResults = document.getElementById('eras-catalogue-results');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const isNA = value => String(value ?? '').trim().toLowerCase() === 'n/a';
  let data, selectedSeq = 1;

  const outfitGroups = [
    ['Lover', ['Lover Bodysuit','Lover Jacket']],
    ['Fearless', ['Fearless Dress']],
    ['Evermore', ['Evermore Dress','Evermore Cloak']],
    ['Red', ['Red T-Shirt','Red Romper','Red Jacket']],
    ['Speak Now', ['Speak Now Dress']],
    ['Reputation', ['Reputation Bodysuit']],
    ['Folklore', ['Folklore Dress','Folklore Cloak']],
    ['1989', ['1989 v1','1989 v2']],
    ['The Tortured Poets Department', ['TTPD Dress','TTPD Gloves','TTPD Jacket','TTPD Necklace','TTPD Two Piece','TTPD Tailcoat']],
    ['Acoustic / surprise songs', ['Acoustic Dress']],
    ['Midnights', ['Midnights Coat','Midnights T-Shirt Dress','Midnights Bodysuit','Midnights Garter','Midnights Jacket']]
  ];
  const gearFields = ['Lover Guitar','Fearless Guitar','Red Guitar','Speak Now Guitar','Folklore Guitar','Accoustic Guitar','Lover Mic','Lover Stand Mic','Fearless Mic','Evermore Mic','Red Mic','Red ATW Mic','Speak Now Mic','Reputation Mic','Folklore Mic','1989 Mic','TTPD Mic','TTPD ICDIWABH Mic','Accoustic Guitar Mic','Accoustic Piano Mic','Midnights Mic'];
  const displayField = field => ({'Accoustic Guitar':'Acoustic guitar','Accoustic Guitar Mic':'Acoustic guitar microphone','Accoustic Piano Mic':'Acoustic piano microphone','Red ATW Mic':'Red / All Too Well microphone','TTPD ICDIWABH Mic':'TTPD “I Can Do It With a Broken Heart” microphone','1989 v1':'1989 outfit · version 1','1989 v2':'1989 outfit · version 2'})[field] || field;
  const labelShow = s => `${s.seq}. ${s.city} ${s.night || ''}`.trim();
  const allShows = () => data.showDetails.map(s => ({...s, ...(data.shows.find(x => x.seq === s.seq) || {})})).sort((a,b)=>a.seq-b.seq);
  const shows = () => allShows();

  function renderShowList() {
    const q = showSearch.value.trim().toLowerCase();
    const matches = shows().filter(s => `${s.seq} ${s.city} ${s.night} ${s.date} ${s.territory} ${s.venue}`.toLowerCase().includes(q));
    showCount.textContent = `${matches.length} of ${data.showDetails.length} shows`;
    showList.innerHTML = matches.map(s => `<button type="button" class="eras-show-option${s.seq===selectedSeq?' is-selected':''}" role="option" aria-selected="${s.seq===selectedSeq?'true':'false'}" data-seq="${s.seq}"><span class="eras-show-option-seq">${s.seq}</span><span class="eras-show-option-main"><strong>${esc(s.city)} ${esc(s.night || '')}</strong><small>${esc(s.date)} · ${esc(s.venue)}</small></span></button>`).join('') || '<p class="eras-empty">No shows match that search.</p>';
  }

  function outfitValue(show, field) {
    if (field === '1989 v2') {
      const parts = ['1989 Top','1989 Skirt','1989 Left Shoe','1989 Right Shoe'];
      if (parts.some(p => !isNA(show[p]))) return parts.filter(p=>!isNA(show[p])).map(p=>`${p.replace('1989 ','')}: ${show[p]}`).join(' · ');
      return '';
    }
    const value = show[field];
    return value != null && !isNA(value) ? value : '';
  }
  function renderDetail(seq) {
    const show = shows().find(s=>s.seq===Number(seq));
    if (!show) return;
    selectedSeq = show.seq;
    renderShowList();
    const cancelled = show['Lover Bodysuit'] == null || Object.keys(show).filter(k=>outfitGroups.some(([,fields])=>fields.includes(k))).every(k=>isNA(show[k]));
    let html = `<header class="eras-selected-show"><p class="eras-eyebrow">Show ${show.seq} of 152</p><h2>${esc(show.city)} ${esc(show.night || '')}</h2><p class="eras-show-meta">${esc(show.date)}${show.territory ? ` · ${esc(show.territory)}` : ''}</p><p class="eras-show-venue">${esc(show.venue || '')}</p><div class="eras-show-navigation"><button type="button" data-step="-1" ${show.seq<=1?'disabled':''}>← Previous show</button><button type="button" data-step="1" ${show.seq>=152?'disabled':''}>Next show →</button></div></header>`;
    if (show.firstAct || show.secondAct) html += `<div class="eras-show-support"><h3>Opening acts</h3><p>${[show.firstAct,show.secondAct].filter(Boolean).map(esc).join(' · ') || 'Not recorded'}</p></div>`;
    if (cancelled) {
      html += `<div class="eras-cancelled-note"><h3>No performance</h3><p>This planned show was cancelled, so no performance outfits or equipment were used.</p></div>`;
    } else {
      html += '<section class="eras-detail-section"><h3>Outfits</h3>';
      for (const [era, fields] of outfitGroups) {
        const items = fields.map(field=>({field,value:outfitValue(show,field)})).filter(x=>x.value);
        if (!items.length) continue;
        html += `<div class="eras-detail-era"><h4>${esc(era)}</h4><div class="eras-detail-grid">${items.map(({field,value})=>`<article class="eras-detail-item"><div class="eras-detail-art"><span>Illustration to be added</span></div><div class="eras-detail-item-copy"><h5>${esc(displayField(field))}</h5><p>${esc(value)}</p></div></article>`).join('')}</div></div>`;
      }
      html += '</section>';
      const gear = gearFields.map(field=>({field,value:show[field]})).filter(x=>x.value!=null&&!isNA(x.value)&&String(x.value).toLowerCase()!=='none');
      html += `<section class="eras-detail-section"><h3>Instruments and microphones</h3>${gear.length?`<dl class="eras-detail-facts">${gear.map(x=>`<div><dt>${esc(displayField(x.field))}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>`:'<p>No instrument or microphone details recorded.</p>'}</section>`;
      const songs = [
        ['Guitar First Song','Guitar first song'],['Guitar Second Song','Guitar second song'],['Guitar Third Song','Guitar third song'],['Guitar Mashup','Guitar mashup'],
        ['Piano First Song','Piano first song'],['Piano Second Song','Piano second song'],['Piano Third Song','Piano third song'],['Piano Mashup','Piano mashup']
      ].map(([field,label])=>({label,value:show[field]})).filter(x=>x.value!=null&&!isNA(x.value)&&String(x.value).toLowerCase()!=='false');
      if (songs.length) html += `<section class="eras-detail-section"><h3>Surprise songs</h3><dl class="eras-detail-facts">${songs.map(x=>`<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl></section>`;
      const guests = ['Special Guest','Second Guest','Third Guest'].map(k=>show[k]).filter(v=>v&&!isNA(v));
      if (guests.length) html += `<section class="eras-detail-section"><h3>Special guests</h3><p>${guests.map(esc).join(' · ')}</p></section>`;
    }
    showDetail.innerHTML = html;
  }

  function renderCatalogue() {
    const q = catalogueSearch.value.trim().toLowerCase(), era = eraFilter.value;
    const families = data.families.filter(f=>era==='all'||f.era===era);
    const html = families.map(f=>{
      const variants=f.variants.filter(v=>`${f.era} ${f.field} ${v.label}`.toLowerCase().includes(q));
      if(!variants.length)return '';
      return `<section class="eras-catalogue-family"><h3>${esc(f.era)} · ${esc(displayField(f.field))}</h3><div class="eras-card-grid">${variants.map(v=>`<article class="eras-variant-card"><div class="eras-art-placeholder"><span>Illustration to be added</span></div><div class="eras-card-body"><h4>${esc(v.label)}</h4><p>${v.count} ${v.count===1?'show':'shows'}</p><details><summary>Shows worn</summary><p>${v.showIds.map(id=>`<button type="button" class="eras-inline-show" data-open-show="${id}">${id}</button>`).join(' ')}</p></details></div></article>`).join('')}</div></section>`;
    }).join('');
    catalogueResults.innerHTML = html || '<p class="eras-empty">No catalogue entries match that search.</p>';
  }

  showList.addEventListener('click', e=>{const btn=e.target.closest('[data-seq]');if(btn)renderDetail(Number(btn.dataset.seq));});
  showSearch.addEventListener('input', renderShowList);
  showDetail.addEventListener('click', e=>{const step=e.target.closest('[data-step]');if(step)renderDetail(selectedSeq+Number(step.dataset.step));});
  catalogueSearch.addEventListener('input',renderCatalogue);
  eraFilter.addEventListener('change',renderCatalogue);
  catalogueResults.addEventListener('click',e=>{const btn=e.target.closest('[data-open-show]');if(btn){renderDetail(Number(btn.dataset.openShow));document.querySelector('.eras-show-browser').scrollIntoView({behavior:'smooth',block:'start'});}});

  fetch('/assets/data/eras-catalogue.json').then(r=>{if(!r.ok)throw new Error('Could not load show data');return r.json();}).then(loaded=>{
    data=loaded;
    [...new Set(data.families.map(f=>f.era))].forEach(era=>{const opt=document.createElement('option');opt.value=era;opt.textContent=era;eraFilter.appendChild(opt);});
    renderShowList();renderDetail(1);renderCatalogue();
  }).catch(err=>{showCount.textContent='Show data unavailable';showDetail.innerHTML=`<p class="eras-empty">${esc(err.message)}.</p>`;});
})();
