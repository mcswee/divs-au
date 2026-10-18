// Royal family tree (projects/royal.html)
// Data: /assets/data/royal.json (nodes, edges, house_colours)   Chart: D3

const CW=148, CH=98, SG=158, GG=156;

// Text on a card is whichever of dark or cream reads better on that house colour;
// the "dim" lines are as close to the card colour as still passes 4.5:1
const DARK='#111111', LIGHT='#f5edd8';
const textCache={};
function toRgb(hex){ const h=hex.replace('#',''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); }
function relLum(hex){ const [r,g,b]=toRgb(hex).map(v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; }
function contrast(a,b){ const x=relLum(a), y=relLum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
function mixHex(a,b,t){ const A=toRgb(a), B=toRgb(b); return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join(''); }
function cardText(bg){
  if(textCache[bg]) return textCache[bg];
  let fill = contrast(DARK,bg) >= contrast(LIGHT,bg) ? DARK : LIGHT;
  if(contrast(fill,bg) < 4.5) fill = contrast('#000000',bg) >= contrast('#ffffff',bg) ? '#000000' : '#ffffff';   // mid-tone colours
  let dim = fill;
  for(let t=0.05; t<=0.6; t+=0.05){
    const m = mixHex(fill,bg,t);
    if(contrast(m,bg) < 4.5) break;
    dim = m;
  }
  return (textCache[bg] = { fill, dim });
}
function trunc(s,n){ return s&&s.length>n ? s.slice(0,n-1)+'…' : (s||''); }

function cardBg(d){
  const c=d.colours; if(!c||!c.member) return '#2a2518';
  if(d.state==='excluded') return c.excluded;
  if(d.state==='reigning') return c.reigning;
  return c.member;
}

function buildLines(d){
  const L=[];
  if(d.is_sovereign){
    L.push({t:trunc(d.name,20),      cinzel:true,  sz:10.5, bold:true });
    if(d.sobriquet)  L.push({t:trunc(d.sobriquet,24), italic:true, sz:9.5, dim:true});
    if(d.birth_line) L.push({t:d.birth_line,           sz:9.5, dim:true});
    if(d.reign)       L.push({t:d.reign,                sz:9.5, dim:true});
  } else if(d.gender==='F'){
    L.push({t:trunc(d.name,22),      cinzel:true,  sz:10,   bold:true });
    if(d.sobriquet)  L.push({t:trunc(d.sobriquet,24), italic:true, sz:9.5, dim:true});
    if(d.birth_line) L.push({t:d.birth_line,           sz:9.5, dim:true});
    if(d.marriage)   L.push({t:trunc('m. '+d.marriage,24), italic:true, sz:9, dim:true});
  } else {
    L.push({t:trunc(d.name,22),      cinzel:true,  sz:10,   bold:true });
    if(d.sobriquet)    L.push({t:trunc(d.sobriquet,24),   italic:true, sz:9.5, dim:true});
    if(d.designation) L.push({t:trunc(d.designation,24),  sz:9,   dim:true});
    if(d.birth_line)  L.push({t:d.birth_line,             sz:9.5, dim:true});
  }
  return L.slice(0,5);
}

// ── Layout: use manual Column field directly from spreadsheet ────────────
function computeLayout(data){
  data.nodes.forEach(n=>{
    n.px = (n.column || 0) * SG;
    n.py = ((n.generation || 1) - 1) * GG;
  });
}

const tree=document.getElementById('royal-tree');
const reduceMotion=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function viewSize(){ const r=tree.getBoundingClientRect(); return { w:r.width||window.innerWidth, h:r.height||window.innerHeight }; }

function announce(message){
  const region=document.getElementById('royal-status');
  if(!region) return;
  region.textContent='';
  setTimeout(()=>{ region.textContent=message; },30);
}

// ── Main ──────────────────────────────────────────────────────────────────
fetch('/assets/data/royal.json')
  .then(r=>{ if(!r.ok) throw new Error('royal.json '+r.status); return r.json(); })
  .then(data=>{
    computeLayout(data);
    render(data);
    buildTextVersion(data);
  })
  .catch(e=>{
    console.error('Could not load the family tree data:', e);
    const msg=document.getElementById('royal-error');
    msg.textContent='The family tree data could not be loaded. Please try again later.';
    msg.hidden=false;
  });

function render(data){
  const nm={};
  data.nodes.forEach(n=>{ nm[n.id]=n; });

  const allX=data.nodes.map(n=>n.px), allY=data.nodes.map(n=>n.py);
  const minX=Math.min(...allX)-80,  maxX=Math.max(...allX)+CW+80;
  const minY=Math.min(...allY)-80,  maxY=Math.max(...allY)+CH+80;

  const svg=d3.select('#canvas')
    .attr('width',viewSize().w).attr('height',viewSize().h);

  const g=svg.append('g');

  const zoom=d3.zoom().scaleExtent([0.02,3])
    .on('start',()=>svg.classed('drag',true))
    .on('zoom', e=>g.attr('transform',e.transform))
    .on('end',  ()=>svg.classed('drag',false));
  svg.call(zoom).on('dblclick.zoom',null);

  const sg=g.append('g');
  const maxGen = Math.max(...data.nodes.map(n=>n.generation||1));
  for(let gen=1; gen<=maxGen; gen++){
    const y = (gen-1)*GG;
    sg.append('text').attr('class','era-lbl')
      .attr('x',minX+8).attr('y',y+CH/2)
      .attr('dominant-baseline','middle')
      .text(`Gen ${gen}`);
  }

  // Edges
  const eg=g.append('g');
  data.edges.forEach(e=>{
    const p=nm[e.from], c=nm[e.to];
    if(!p||!c) return;
    const x1=p.px+CW/2, y1=p.py+CH;
    const x2=c.px+CW/2, y2=c.py;
    const my=y2-(GG-CH)*0.5;
    const col=(p.colours&&p.colours.border)||'#666';
    eg.append('path')
      .attr('class',e.type==='primary'?'ep':'es')
      .attr('stroke',col)
      .attr('d',`M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`);
  });

  // Nodes
  const ng=g.append('g');
  const cards=ng.selectAll('g.node-card')
    .data(data.nodes).join('g')
    .attr('class','node-card')
    .attr('transform',d=>`translate(${d.px},${d.py})`);

  cards.append('rect').attr('class','bg')
    .attr('width',CW).attr('height',CH).attr('rx',3).attr('ry',3)
    .attr('fill',d=>cardBg(d))
    .attr('stroke',d=>(d.colours&&d.colours.border)||'#555')
    .attr('stroke-width',1.5)
    .style('filter','drop-shadow(0 2px 5px #00000055)');

  // Sovereign accent bar
  cards.filter(d=>d.is_sovereign).append('rect')
    .attr('width',CW).attr('height',3).attr('rx',3)
    .attr('fill',d=>(d.colours&&d.colours.border)||'#888');

  // Text
  cards.each(function(d){
    const el=d3.select(this);
    const bg=cardBg(d), {fill, dim:fillDim}=cardText(bg);
    const lines=buildLines(d);
    const lh=13.5, total=lines.length*lh;
    let y=(CH-total)/2+(d.is_sovereign?4:2);
    lines.forEach(ln=>{
      el.append('text')
        .attr('x',CW/2).attr('y',y)
        .attr('text-anchor','middle').attr('dominant-baseline','hanging')
        .attr('font-family',ln.cinzel?"'Cinzel',serif":"'Cormorant Garamond',Georgia,serif")
        .attr('font-size',ln.sz||10)
        .attr('font-weight',ln.bold?600:400)
        .attr('font-style',ln.italic?'italic':'normal')
        .attr('fill',ln.dim?fillDim:fill)
        .text(ln.t);
      y+=lh;
    });
  });

  // d.s.p. markers — short downward arrow + label for nodes with no issue
  const dspG=g.append('g').attr('pointer-events','none');

  // Arrow marker definition
  svg.append('defs').append('marker')
    .attr('id','dsp-arrow').attr('viewBox','0 -4 8 8')
    .attr('refX',7).attr('refY',0)
    .attr('markerWidth',5).attr('markerHeight',5)
    .attr('orient','auto')
    .append('path').attr('d','M0,-3.5 L7,0 L0,3.5').attr('fill','#3a3220');

  data.nodes.filter(n=>n.issue==='no issue').forEach(n=>{
    const x=n.px+CW/2, y=n.py+CH;
    const lineLen=9;
    dspG.append('line')
      .attr('x1',x).attr('y1',y+1)
      .attr('x2',x).attr('y2',y+lineLen)
      .attr('stroke','#3a3220').attr('stroke-width',1.2)
      .attr('marker-end','url(#dsp-arrow)');
    dspG.append('text')
      .attr('x',x).attr('y',y+lineLen+3)
      .attr('text-anchor','middle').attr('dominant-baseline','hanging')
      .attr('font-family',"'Cormorant Garamond',Georgia,serif")
      .attr('font-style','italic').attr('font-size',8.5)
      .attr('fill','#3a3220')
      .text('d.s.p.');
  });

  // Tooltip
  const tip=document.getElementById('tip');
  const tn=document.getElementById('tn');
  const tl=document.getElementById('tl');
  const th=document.getElementById('th');

  cards.on('mouseenter',(event,d)=>{
    const rows=[];
    if(d.sobriquet)  rows.push(`"${d.sobriquet}"`);
    if(d.designation) rows.push(d.designation);
    if(d.birth_line) rows.push(d.birth_line);
    if(d.reign) rows.push(`Reign: ${d.reign}`);
    if(d.marriage) rows.push(`m. ${d.marriage}`);
    if(d.is_excluded) rows.push('Excluded from succession');
    if(d.issue==='no issue') rows.push('d.s.p. — died without issue');
    tn.textContent=d.name;
    tl.innerHTML=rows.map(r=>`<div>${r}</div>`).join('');
    th.textContent=`House of ${d.house}`;
    tip.classList.add('on');
  })
  .on('mousemove',event=>{
    const tw=tip.offsetWidth, tth=tip.offsetHeight;
    let tx=event.clientX+16, ty=event.clientY-tth/2;
    if(tx+tw>window.innerWidth-8) tx=event.clientX-tw-16;
    ty=Math.max(8,Math.min(ty,window.innerHeight-tth-8));
    tip.style.left=tx+'px'; tip.style.top=ty+'px';
  })
  .on('mouseleave',()=>tip.classList.remove('on'))
  .on('click',(event,d)=>{
    event.stopPropagation();
    const rel=new Set([d.id]);
    data.edges.forEach(e=>{
      if(e.from===d.id) rel.add(e.to);
      if(e.to===d.id)   rel.add(e.from);
    });
    cards.classed('dim',n=>!rel.has(n.id));
  });

  svg.on('click',()=>cards.classed('dim',false));

  // Legend: each house is a button that filters the chart
  let legFilter=null;
  const legEl=document.getElementById('legend');
  const legItems={};
  function setLegendState(name){
    legFilter=name;
    Object.entries(legItems).forEach(([n,b])=>b.setAttribute('aria-pressed',n===name?'true':'false'));
  }
  Object.entries(data.house_colours).forEach(([name,c])=>{
    const item=document.createElement('button');
    item.type='button';
    item.className='leg';
    item.setAttribute('aria-pressed','false');
    item.innerHTML=`<span class="swatch" aria-hidden="true" style="background:${c.member};border-color:${c.border}"></span><span>${name}</span>`;
    item.addEventListener('click',()=>{
      if(legFilter===name){ cards.classed('dim',false); setLegendState(null); announce('Showing all houses.'); }
      else { cards.classed('dim',n=>n.house!==name); setLegendState(name); announce(`Showing the House of ${name} only.`); }
    });
    legItems[name]=item;
    legEl.appendChild(item);
  });

  // Controls
  const zBy=f=>svg.transition().duration(reduceMotion?0:300).call(zoom.scaleBy,f);
  const zTo=t=>svg.transition().duration(reduceMotion?0:700).call(zoom.transform,t);
  const zMove=(dx,dy)=>svg.transition().duration(reduceMotion?0:200).call(zoom.translateBy,dx,dy);

  function fitAll(){
    const {w:vw, h:vh}=viewSize();
    const tw=maxX-minX, th=maxY-minY;
    const sc=Math.min(vw/tw,vh/th)*.88;
    zTo(d3.zoomIdentity.translate((vw-tw*sc)/2-minX*sc,(vh-th*sc)/2-minY*sc).scale(sc));
  }

  function goWindsor(){
    const ws=data.nodes.filter(n=>n.house==='Windsor');
    const wxs=ws.map(n=>n.px), wys=ws.map(n=>n.py);
    const cx=(Math.min(...wxs)+Math.max(...wxs))/2+CW/2;
    const cy=(Math.min(...wys)+Math.max(...wys))/2+CH/2;
    const sc=1.1, {w:vw, h:vh}=viewSize();
    zTo(d3.zoomIdentity.translate(vw/2-cx*sc,vh/2-cy*sc).scale(sc));
  }

  document.getElementById('bin').addEventListener('click',()=>zBy(1.5));
  document.getElementById('bout').addEventListener('click',()=>zBy(0.67));
  document.getElementById('bfit').addEventListener('click',fitAll);
  document.getElementById('bw').addEventListener('click',goWindsor);
  window.addEventListener('resize',()=>svg.attr('width',viewSize().w).attr('height',viewSize().h));

  // With the chart focused: arrow keys pan, + and - zoom, 0 fits everything
  tree.addEventListener('keydown',e=>{
    if(e.target!==tree) return;
    const k=d3.zoomTransform(svg.node()).k, step=120/k;
    const move={ ArrowLeft:[step,0], ArrowRight:[-step,0], ArrowUp:[0,step], ArrowDown:[0,-step] }[e.key];
    if(move){ e.preventDefault(); zMove(move[0],move[1]); }
    else if(e.key==='+'||e.key==='='){ e.preventDefault(); zBy(1.5); }
    else if(e.key==='-'||e.key==='_'){ e.preventDefault(); zBy(0.67); }
    else if(e.key==='0'){ e.preventDefault(); fitAll(); }
  });

  setTimeout(goWindsor,150);
}

// ── Text version: the same people, as a table (the chart itself is drawn in SVG) ─
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function buildTextVersion(data){
  const byId={}; data.nodes.forEach(n=>{ byId[n.id]=n; });
  const parents={}, children={};
  data.edges.forEach(e=>{
    if(!byId[e.from]||!byId[e.to]) return;
    const label=byId[e.from].name+(e.type==='primary'?'':' (dashed link)');
    const child=byId[e.to].name+(e.type==='primary'?'':' (dashed link)');
    (parents[e.to]=parents[e.to]||[]).push(label);
    (children[e.from]=children[e.from]||[]).push(child);
  });
  const people=data.nodes.slice().sort((a,b)=>(a.generation-b.generation)||(a.column-b.column));
  const rows=people.map(d=>{
    const details=[];
    if(d.designation) details.push(d.designation);
    if(d.birth_line) details.push(d.birth_line);
    if(d.reign) details.push('Reign: '+d.reign);
    if(d.marriage) details.push('m. '+d.marriage);
    if(d.is_excluded) details.push('Excluded from succession');
    if(d.issue==='no issue') details.push('Died without issue');
    return `<tr><th scope="row">${esc(d.name)}${d.sobriquet?` <em>(${esc(d.sobriquet)})</em>`:''}</th>`+
      `<td>${esc(d.house)}</td><td>${details.map(esc).join('; ')}</td>`+
      `<td>${(parents[d.id]||[]).map(esc).join('; ')}</td><td>${(children[d.id]||[]).map(esc).join('; ')}</td></tr>`;
  }).join('');
  document.getElementById('royal-text-body').innerHTML=
    '<div class="royal-table-wrap"><table class="royal-table"><caption class="sr-only">Everyone on the chart, from Alfred the Great to Charles III, in generation order</caption>'+
    '<thead><tr><th scope="col">Person</th><th scope="col">House</th><th scope="col">Details</th><th scope="col">Parents</th><th scope="col">Children</th></tr></thead>'+
    `<tbody>${rows}</tbody></table></div>`;

  // "Text version" link in the header opens the list
  const details=document.getElementById('royal-text');
  const link=document.querySelector('.royal-skip');
  if(link) link.addEventListener('click',()=>{ details.open=true; });
  if(location.hash==='#royal-text') details.open=true;
}
