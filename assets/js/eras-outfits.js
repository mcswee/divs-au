(() => {
  const root = document.getElementById('eras-catalogue');
  if (!root) return;
  const search = document.getElementById('eras-search');
  const sectionFilter = document.getElementById('eras-section-filter');
  const eraFilter = document.getElementById('eras-era-filter');
  const results = document.getElementById('eras-results');
  const count = document.getElementById('eras-result-count');
  const jumpLinks = document.getElementById('eras-jump-links');
  const hiddenFields = new Set(['1989 Top', '1989 Skirt', '1989 Left Shoe', '1989 Right Shoe']);
  let data;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const showById = new Map();
  const showLabel = id => {
    const s = showById.get(Number(id));
    return s ? `${s.seq}. ${s.city} ${s.night} (${s.date})` : String(id);
  };
  const showList = ids => `<details class="eras-show-list"><summary>${ids.length} ${ids.length === 1 ? 'show' : 'shows'} · view sequence numbers</summary><ol>${ids.map(id => `<li>${esc(showLabel(id))}</li>`).join('')}</ol></details>`;
  const card = (family, variant) => {
    const searchable = `${family.era} ${family.field} ${variant.label} ${variant.showIds.join(' ')}`.toLowerCase();
    return `<article class="eras-variant-card" data-kind="${family.kind}" data-era="${esc(family.era)}" data-search="${esc(searchable)}">
      <div class="eras-art-placeholder"><span>Illustration<br>to be added</span></div>
      <div class="eras-card-body"><h4>${esc(variant.label)}</h4><p class="eras-card-meta">${esc(family.field)} · ${variant.count} ${variant.count === 1 ? 'show' : 'shows'}</p>${showList(variant.showIds)}</div>
    </article>`;
  };
  const sectionStart = (id, title, desc='') => `<section class="eras-section" id="${id}" data-section="${id}"><div class="eras-section-heading"><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ''}</div>`;
  const gearTable = groups => groups.map(group => `<div class="eras-subsection" data-era="${esc(group.era)}"><h3>${esc(group.era)}</h3><table class="eras-gear-list"><thead><tr><th scope="col">Item</th><th scope="col">Variant / description</th><th scope="col">Shows</th></tr></thead><tbody>${group.variants.map(v => `<tr data-kind="gear" data-era="${esc(group.era)}" data-search="${esc(`${group.era} ${group.field} ${v.label} ${v.showIds.join(' ')}`.toLowerCase())}"><td>${esc(group.field)}</td><td>${esc(v.label)}</td><td>${v.showIds.map(id=>esc(id)).join(', ')}<br><details><summary>Show details</summary><ol>${v.showIds.map(id=>`<li>${esc(showLabel(id))}</li>`).join('')}</ol></details></td></tr>`).join('')}</tbody></table></div>`).join('');

  function render() {
    const q = search.value.trim().toLowerCase();
    const selectedSection = sectionFilter.value;
    const selectedEra = eraFilter.value;
    let shown = 0;
    const visible = (kind, era, text) => (selectedSection === 'all' || selectedSection === kind || (selectedSection === 'shows' && kind === 'shows')) && (selectedEra === 'all' || selectedEra === era) && (!q || text.toLowerCase().includes(q));
    let html = '';

    if (selectedSection === 'all' || selectedSection === 'wardrobe') {
      html += sectionStart('wardrobe-section','Outfits and clothing','Illustrations can be dropped into the marked spaces as the SVGs are completed.');
      const wardrobeFamilies = data.families.filter(f => f.kind === 'wardrobe' && !hiddenFields.has(f.field));
      const eras = [...new Set(wardrobeFamilies.map(f=>f.era))];
      for (const era of eras) {
        if (selectedEra !== 'all' && selectedEra !== era) continue;
        const familyHtml = wardrobeFamilies.filter(f=>f.era===era).map(f=>{
          const matches = f.variants.filter(v => visible('wardrobe',era,`${era} ${f.field} ${v.label} ${v.showIds.join(' ')}`));
          shown += matches.length;
          if (!matches.length) return '';
          return `<div class="eras-subsection"><h3>${esc(f.field)}</h3><div class="eras-card-grid">${matches.map(v=>card(f,v)).join('')}</div></div>`;
        }).join('');
        if (familyHtml) html += `<div class="eras-subsection" data-era="${esc(era)}"><h3>${esc(era)}</h3>${familyHtml}</div>`;
      }
      const comboMatches = data['1989v2'].filter(v => visible('wardrobe','1989',`1989 top ${v.top} skirt ${v.skirt} left shoe ${v.leftShoe} right shoe ${v.rightShoe} ${v.showIds.join(' ')}`));
      if (comboMatches.length && (selectedEra==='all'||selectedEra==='1989')) {
        shown += comboMatches.length;
        html += `<div class="eras-subsection" data-era="1989"><h3>1989 · Version 2 combinations</h3><p>Only combinations recorded in the show data are listed here. Each card represents the full top, skirt and shoe combination.</p><div class="eras-card-grid">${comboMatches.map(v=>`<article class="eras-variant-card eras-1989-card" data-kind="wardrobe" data-era="1989" data-search="${esc(`1989 ${v.top} ${v.skirt} ${v.leftShoe} ${v.rightShoe} ${v.showIds.join(' ')}`.toLowerCase())}"><div class="eras-art-placeholder"><span>Illustration<br>to be added</span></div><div class="eras-card-body"><h4>${esc(v.top)} top · ${esc(v.skirt)} skirt</h4><p class="eras-card-meta">Left shoe: ${esc(v.leftShoe)} · Right shoe: ${esc(v.rightShoe)}</p>${showList(v.showIds)}</div></article>`).join('')}</div></div>`;
      }
      html += '</section>';
    }

    if (selectedSection === 'all' || selectedSection === 'gear') {
      html += sectionStart('gear-section','Guitars and microphones','Listed as tour details, without separate instrument illustrations.');
      const groups = data.families.filter(f=>f.kind==='gear' && (selectedEra==='all'||f.era===selectedEra)).map(f=>({...f,variants:f.variants.filter(v=>visible('gear',f.era,`${f.era} ${f.field} ${v.label} ${v.showIds.join(' ')}`))})).filter(f=>f.variants.length);
      shown += groups.reduce((n,g)=>n+g.variants.length,0);
      html += gearTable(groups);
      if (!groups.length) html += '<p class="eras-empty">No guitar or microphone entries match these filters.</p>';
      html += '</section>';
    }

    if (selectedSection === 'all' || selectedSection === 'shows') {
      html += sectionStart('shows-section','Shows','The sequence follows the planned show order, including cancelled dates.');
      const matches = data.showDetails.filter(s => (selectedEra==='all' || selectedSection==='shows' || Object.entries(s).some(([k,v])=>k!=='seq' && String(v).toLowerCase()===selectedEra.toLowerCase())) && (!q || Object.entries(s).some(([k,v])=>`${k} ${v}`.toLowerCase().includes(q))));
      shown += matches.length;
      html += matches.length ? matches.map(s=>`<article class="eras-show-card" data-kind="shows" data-search="${esc(Object.values(s).join(' ').toLowerCase())}"><h3>${esc(s.seq)}. ${esc(s.city)} · ${esc(s.night)}</h3><p>${esc(s.date)}${s.territory ? ` · ${esc(s.territory)}` : ''}</p><p>${esc(s.venue)}</p></article>`).join('') : '<p class="eras-empty">No shows match this search.</p>';
      html += '</section>';
    }
    results.innerHTML = html || '<p class="eras-empty">No entries match these filters.</p>';
    count.textContent = `${shown} matching ${shown === 1 ? 'entry' : 'entries'}`;
    buildJumpLinks();
  }
  function buildJumpLinks() {
    const selectedSection = sectionFilter.value;
    if (selectedSection === 'shows') { jumpLinks.innerHTML=''; return; }
    const eras = [...new Set(data.families.filter(f => selectedSection==='all' || f.kind===selectedSection).map(f=>f.era))];
    jumpLinks.innerHTML = eras.filter(e=>eraFilter.value==='all'||e===eraFilter.value).map(e=>`<a href="#${slug(e)}-jump" data-era-jump="${esc(e)}">${esc(e)}</a>`).join('');
    // Point links at the first visible heading for that era.
    jumpLinks.querySelectorAll('a').forEach(a=>{
      const era=a.dataset.eraJump;
      const match=[...results.querySelectorAll('[data-era]')].find(el=>el.dataset.era===era);
      if (match) match.id=`${slug(era)}-jump`;
      else a.hidden=true;
    });
  }
  Promise.all([
    fetch('/assets/data/eras-catalogue.json').then(r=>{if(!r.ok) throw new Error('Could not load catalogue data'); return r.json();})
  ]).then(([loaded])=>{
    data=loaded;
    data.shows.forEach(s=>showById.set(s.seq,s));
    const eras=[...new Set(data.families.map(f=>f.era))];
    eras.forEach(era=>{const opt=document.createElement('option');opt.value=era;opt.textContent=era;eraFilter.appendChild(opt);});
    [search,sectionFilter,eraFilter].forEach(el=>el.addEventListener('input',render));
    render();
  }).catch(err=>{results.innerHTML=`<p class="eras-empty">The catalogue data could not be loaded. ${esc(err.message)}</p>`; count.textContent='Catalogue unavailable';});
})();
