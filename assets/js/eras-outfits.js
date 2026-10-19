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
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isNA = v => ['n/a','none',''].includes(String(v ?? '').trim().toLowerCase());
  let data, selectedSeq = 1;
  const rows = () => data.shows;
  const imageMap = () => new Map(data.images.map(x => [x.code, x]));
  const fieldLabels = {
    'Lover Bodysuit':'Lover Bodysuit','Lover Jacket':'Lover Jacket','Lover Guitar':'Lover Guitar',
    'Fearless Dress':'Fearless Dress','Evermore Dress':'Evermore Dress','Evermore Cloak':'Evermore Cloak',
    'Reputation Bodysuit':'Reputation Bodysuit','Speak Now Dress':'Speak Now Dress','Red T-Shirt':'Red T-shirt',
    'Red Romper':'Red Romper','Red Jacket':'Red coat','Folklore Dress':'Folklore Dress','Folklore Cloak':'Folklore Cloak',
    '1989 v1':'1989 set','1989 v2':'1989 mix and match','TTPD Dress':'TTPD Dress','TTPD Jacket':'TTPD Jacket',
    'TTPD Two Piece':'TTPD two-piece','Acoustic Dress':'Acoustic dress','Midnights T-Shirt Dress':'Midnights T-shirt dress',
    'Midnights Bodysuit':'Midnights bodysuit','Midnights Jacket':'Midnights jacket'
  };
  const imageTag = (src, alt, cls='eras-art-image') => `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  root.addEventListener('error', e => {
    if (!e.target.matches?.('.eras-art-image')) return;
    const img=e.target; img.hidden=true; const p=img.parentElement;
    if (p && !p.querySelector('.eras-image-fallback')) { const n=document.createElement('span'); n.className='eras-image-fallback'; n.textContent='Image not added yet'; p.appendChild(n); }
  }, true);
  const showButtons = ids => ids.map(id => `<button type="button" class="eras-inline-show" data-open-show="${id}">${id}</button>`).join(' ');
  const card = (item, compact=false) => { const showDetails=item.parts?`<details class="eras-show-list"><summary>Shows by piece</summary>${Object.entries(item.parts).map(([part,ids])=>`<p><strong>${esc(part)}:</strong> ${showButtons(ids)}</p>`).join('')}</details>`:`<details class="eras-show-list"><summary>Shows worn</summary><p>${showButtons(item.showIds)}</p></details>`; return `<article class="${compact?'eras-detail-item eras-detail-visual':'eras-variant-card'}"><div class="${compact?'eras-detail-art':'eras-art-placeholder'}">${imageTag(item.src,item.alt||item.label)}</div><div class="${compact?'eras-detail-item-copy':'eras-card-body'}"><h${compact?'5':'4'}>${esc(item.label)}</h${compact?'5':'4'}>${item.value&&compact?`<p>${esc(item.value)}</p>`:''}${!compact?`<p class="eras-card-meta">${item.showIds.length} ${item.showIds.length===1?'show':'shows'}</p>${showDetails}`:''}</div></article>`; };
  function renderShowList() {
    const q=showSearch.value.trim().toLowerCase();
    const matches=rows().filter(s=>`${s.city} ${s.night} ${s.date} ${s.territory} ${s.venue} ${s.seq}`.toLowerCase().includes(q));
    showCount.textContent=`${matches.length} of ${data.shows.length} shows`;
    showList.innerHTML=matches.map(s=>`<button type="button" class="eras-show-option${Number(s.seq)===selectedSeq?' is-selected':''}" role="option" aria-selected="${Number(s.seq)===selectedSeq?'true':'false'}" data-seq="${s.seq}"><span class="eras-show-option-main"><strong>${esc(s.city)} ${esc(s.night||'')}</strong><small>Show ${s.seq} of ${data.shows.length} · ${esc(s.date)} · ${esc(s.venue)}</small></span></button>`).join('') || '<p class="eras-empty">No shows match that search.</p>';
  }
  function visualCard(ref, show, images, kind) {
    const img=images.get(ref.c); if(!img)return null;
    const f=ref.f; let label=kind==='outfit'?(fieldLabels[f]||f):img.label; let value='';
    if(kind==='outfit') {
      value=show[f]||'';
      if(f==='Lover Guitar') value=`${show['Lover Guitar']} with ${show['Lover Bodysuit']} bodysuit`;
      if(f==='Evermore Cloak') value='Forest Green';
      if(f==='Folklore Cloak') value='Chocolate Brown';
      if(f==='Red Jacket') value='Black & Red';
      if(f==='1989 v2') value=`Top ${show['1989 Top']} · skirt ${show['1989 Skirt']} · left shoe ${show['1989 Left Shoe']} · right shoe ${show['1989 Right Shoe']}`;
      if(f==='TTPD Dress') value=`${show['TTPD Dress']}${!isNA(show['TTPD Gloves'])?' · '+show['TTPD Gloves']+' gloves':''}`;
      if(f==='TTPD Two Piece') value=`${show['TTPD Two Piece']} · ${show['TTPD Necklace']} necklace · ${show['TTPD Tailcoat']} tailcoat`;
      if(f==='Midnights T-Shirt Dress') value=`${show['Midnights T-Shirt Dress']} with ${show['Midnights Coat']} coat`;
      if(f==='Midnights Bodysuit') value=`${show['Midnights Bodysuit']}${String(show['Midnights Garter']).toLowerCase()==='yes'?' bodysuit with garter':' bodysuit without garter'}`;
      if(f==='Midnights Jacket' && ['mdn-jk-l','mdn-jk-s'].includes(ref.c)) value=`None with ${show['Midnights Bodysuit']} bodysuit`;
      if(f==='Speak Now Dress') value=show['Speak Now Dress'];
    }
    return {...img,label,value,alt:label};
  }
  function section(title, items) {
    if(!items.length)return '';
    return `<section class="eras-detail-section"><h3>${esc(title)}</h3><div class="eras-detail-grid">${items.map(x=>card(x,true)).join('')}</div></section>`;
  }
  function renderDetail(seq) {
    const show=rows().find(s=>Number(s.seq)===Number(seq)); if(!show)return;
    selectedSeq=Number(show.seq); renderShowList(); const im=imageMap();
    const keys=['Lover Bodysuit','Lover Jacket','Fearless Dress','Evermore Dress','Evermore Cloak','Red T-Shirt','Red Romper','Red Jacket','Speak Now Dress','Reputation Bodysuit','Folklore Dress','Folklore Cloak','1989 v1','1989 Top','TTPD Dress','TTPD Jacket','TTPD Two Piece','Acoustic Dress','Midnights T-Shirt Dress','Midnights Bodysuit','Midnights Jacket'];
    const cancelled=keys.every(k=>isNA(show[k]));
    let html=`<header class="eras-selected-show"><p class="eras-eyebrow">Show ${show.seq} of ${data.shows.length}</p><h2>${esc(show.city)} ${esc(show.night||'')}</h2><p class="eras-show-meta">${esc(show.date)}${show.territory?` · ${esc(show.territory)}`:''}</p><p class="eras-show-venue">${esc(show.venue||'')}</p><div class="eras-show-navigation"><button type="button" data-step="-1" ${selectedSeq<=1?'disabled':''}><span class="eras-nav-desktop">← Previous show</span><span class="eras-nav-mobile">◀ Prev show</span></button><button type="button" data-step="1" ${selectedSeq>=data.shows.length?'disabled':''}><span class="eras-nav-desktop">Next show →</span><span class="eras-nav-mobile">Next show ▶</span></button></div></header>`;
    const acts=[show['First Act']||show.firstAct,show['Second Act']||show.secondAct].filter(v=>v&&!isNA(v));
    if(!cancelled)html+=`<div class="eras-show-support"><h3>Opening acts</h3><p>${acts.length?acts.map(esc).join(' · '):'None'}</p></div>`;
    if(cancelled) html+=`<div class="eras-cancelled-note"><img class="eras-cancelled-image" src="/assets/images/eras-tour-cancelled.svg" alt="Cancelled show"><p>This show was cancelled.</p></div>`;
    else {
      const refs=show.visualRefs||{outfits:[],guitars:[],microphones:[]};
      html+=section('Outfits',(refs.outfits||[]).map(r=>visualCard(r,show,im,'outfit')).filter(Boolean));
      html+=section('Guitars',(refs.guitars||[]).map(r=>visualCard(r,show,im,'guitar')).filter(Boolean));
      html+=section('Microphones',(refs.microphones||[]).map(r=>visualCard(r,show,im,'microphone')).filter(Boolean));
      const surpriseSong=instrument=>{const p=instrument==='Guitar'?'Guitar':'Piano',tracks=[`${p} First Song`,`${p} Second Song`,`${p} Third Song`].map(k=>show[k]).filter(v=>v&&!isNA(v));return !tracks.length?'':String(show[`${p} Mashup`]).toLowerCase()==='true'?`${tracks.join(' × ')} mashup`:tracks.join(' · ');};
      const songs=[{label:'Guitar',value:surpriseSong('Guitar')},{label:'Piano',value:surpriseSong('Piano')}].filter(x=>x.value);
      if(songs.length)html+=`<section class="eras-detail-section"><h3>Surprise songs</h3><dl class="eras-detail-facts">${songs.map(x=>`<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl></section>`;
      const moments=[{label:'“Oh Hi!”',value:show['Oh Hi!']},{label:'“Like Ever!”',value:show['Like Ever!']},{label:'Ovation',value:show.Ovation},{label:'Guy on the screen',value:show['Guy on the']}].filter(x=>x.value&&!isNA(x.value));
      if(moments.length)html+=`<section class="eras-detail-section"><h3>Show moments</h3><dl class="eras-detail-facts">${moments.map(x=>`<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl></section>`;
      const guests=['Special Guest','Second Guest','Third Guest'].map(k=>show[k]).filter(v=>v&&!isNA(v));if(guests.length)html+=`<section class="eras-detail-section"><h3>Special guests</h3><p>${guests.map(esc).join(' · ')}</p></section>`;
    }
    showDetail.innerHTML=html;
  }
  function renderCatalogue() {
    const q=catalogueSearch.value.trim().toLowerCase(), type=catalogueType.value, era=eraFilter.value;
    const im=imageMap(); const items=data.catalogue.map(ref=>({...im.get(ref.code),catalogueGroup:ref.catalogueGroup,showIds:ref.showIds||[],parts:ref.parts||null})).filter(x=>x.code&&(type==='all'||x.category===type)&&(era==='all'||x.era===era||x.category==='microphone')&&`${x.catalogueGroup} ${x.era} ${x.family} ${x.label} ${x.code}`.toLowerCase().includes(q));
    catalogueCount.textContent=`${items.length} items`;
    const eraOrder=['Lover','Fearless','Evermore','Reputation','Speak Now','Red','Folklore','1989','TTPD','Acoustic','Midnights'];
    const groups=new Map(); items.forEach(x=>{const group=x.category==='guitar'?`${x.era} guitars`:x.catalogueGroup;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(x);});
    const ordered=[...groups].sort(([a],[b])=>{const eraA=a.replace(/ guitars$/,'');const eraB=b.replace(/ guitars$/,'');const isGuitarA=a.endsWith(' guitars'),isGuitarB=b.endsWith(' guitars');if(isGuitarA&&isGuitarB)return eraOrder.indexOf(eraA)-eraOrder.indexOf(eraB);if(isGuitarA!==isGuitarB)return isGuitarA?1:-1;return 0;});
    catalogueResults.innerHTML=ordered.map(([g,arr])=>`<section class="eras-catalogue-family"><h3>${esc(g)}</h3><div class="eras-card-grid">${arr.map(x=>card(x,false)).join('')}</div></section>`).join('')||'<p class="eras-empty">No catalogue entries match that search.</p>';
  }
  document.querySelectorAll('.eras-show-data, .eras-secondary-catalogue').forEach(details=>{const summary=details.querySelector(':scope > summary');if(summary)summary.addEventListener('click',()=>{if(!details.open)return;const y=window.scrollY;requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo(0,y)));});});
  showList.addEventListener('click',e=>{const b=e.target.closest('[data-seq]');if(b)renderDetail(Number(b.dataset.seq));});
  showSearch.addEventListener('input',renderShowList); showDetail.addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b)renderDetail(selectedSeq+Number(b.dataset.step));});
  catalogueSearch.addEventListener('input',renderCatalogue); catalogueType.addEventListener('change',renderCatalogue); eraFilter.addEventListener('change',renderCatalogue);
  catalogueResults.addEventListener('click',e=>{const b=e.target.closest('[data-open-show]');if(b){renderDetail(Number(b.dataset.openShow));document.querySelector('.eras-show-data').open=true;document.querySelector('.eras-show-browser').scrollIntoView({behavior:'smooth',block:'start'});}});
  fetch('/assets/data/eras-catalogue.json').then(r=>{if(!r.ok)throw new Error('Could not load show data');return r.json();}).then(d=>{data=d;[...new Set(data.images.filter(x=>['outfit','guitar'].includes(x.category)&&x.era&&x.era!=='All eras').map(x=>x.era))].sort((a,b)=>['Lover','Fearless','Evermore','Reputation','Speak Now','Red','Folklore','1989','TTPD','Acoustic','Midnights'].indexOf(a)-['Lover','Fearless','Evermore','Reputation','Speak Now','Red','Folklore','1989','TTPD','Acoustic','Midnights'].indexOf(b)).forEach(e=>{const o=document.createElement('option');o.value=e;o.textContent=e;eraFilter.appendChild(o);});renderShowList();renderDetail(1);renderCatalogue();}).catch(err=>{showCount.textContent='Show data unavailable';showDetail.innerHTML=`<p class="eras-empty">${esc(err.message)}.</p>`;});
})();
