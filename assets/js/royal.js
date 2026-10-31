// Royal lineage rendered as semantic HTML and CSS Grid.
// Data: /assets/data/royal.json (nodes, edges, house_colours).
(() => {
  'use strict';

  const CARD_W = 172;
  const CARD_H = 108;
  const COL_STEP = 186;
  const GEN_STEP = 160;
  const GUTTER = 90;
  const MIN_SCALE = 0.035;
  const MAX_SCALE = 1.35;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const $ = id => document.getElementById(id);
  const page = $('royal-page');
  if (!page) return;

  const viewport = $('royal-viewport');
  const shell = $('royal-world-shell');
  const world = $('royal-world');
  const legend = $('royal-legend');
  const panel = $('royal-person-panel');
  const panelName = $('royal-person-name');
  const panelHouse = $('royal-person-house');
  const panelDetails = $('royal-person-details');
  const panelRelations = $('royal-person-relations');
  const status = $('royal-status');
  const error = $('royal-error');
  const list = $('royal-list');
  const viewButton = $('royal-view');
  const skipLink = $('royal-skip');
  const hint = $('royal-hint');
  const zoomGroup = $('royal-zoom-group');
  const zoomIn = $('royal-zoom-in');
  const zoomOut = $('royal-zoom-out');

  let data;
  let byId = new Map();
  let edgesByParent = new Map();
  let edgesByChild = new Map();
  let cards = new Map();
  let connectorElements = [];
  let listSections = [];
  let selectedId = null;
  let houseFilter = null;
  let savedView = null;
  let listView = false;
  let scale = 0.85;
  let worldWidth = 0;
  let worldHeight = 0;

  const announce = message => { status.textContent = message; };
  const safeText = value => value == null ? '' : String(value);

  // Pick whichever of the dark or light text colour has the higher contrast ratio
  function textColour(hex) {
    const value = String(hex || '#d9d0b8').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return '#111111';
    const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    const contrastDark = (luminance + 0.05) / (0.0056 + 0.05);   // #111111
    const contrastLight = (0.9 + 0.05) / (luminance + 0.05);     // #f8f3e8
    return contrastDark >= contrastLight ? '#111111' : '#f8f3e8';
  }

  function cardColour(person) {
    const colours = person.colours || {};
    if (person.state === 'excluded') return colours.excluded || colours.member || '#d9d0b8';
    if (person.state === 'reigning') return colours.reigning || colours.member || '#d9d0b8';
    return colours.member || '#d9d0b8';
  }

  function personLines(person) {
    const lines = [];
    if (person.sobriquet) lines.push({ text: person.sobriquet, className: 'royal-person-sobriquet' });
    if (person.is_sovereign && person.reign) {
      if (person.birth_line) lines.push({ text: person.birth_line, className: 'royal-person-detail' });
      lines.push({ text: person.reign, className: 'royal-person-detail' });
    } else {
      if (person.designation) lines.push({ text: person.designation, className: 'royal-person-detail' });
      if (person.birth_line) lines.push({ text: person.birth_line, className: 'royal-person-detail' });
      if (person.gender === 'F' && person.marriage) lines.push({ text: `m. ${person.marriage}`, className: 'royal-person-detail' });
    }
    return lines.slice(0, 4);
  }

  // Full text facts about a person, used by the details panel and the list view
  function personFacts(person) {
    const facts = [];
    if (person.sobriquet) facts.push(person.sobriquet);
    if (person.designation) facts.push(person.designation);
    if (person.birth_line) facts.push(person.birth_line);
    if (person.death_line) facts.push(person.death_line);
    if (person.reign) facts.push(`Reign: ${person.reign}`);
    if (person.marriage) facts.push(`Marriage: ${person.marriage}`);
    if (person.is_excluded) facts.push('Excluded from succession');
    if (person.issue === 'no issue') facts.push('Died without issue');
    return facts;
  }

  // The accessible name replaces the card's visible text, so it has to carry all of it
  function cardLabel(person) {
    const parts = [person.name];
    if (person.house) parts.push(`House of ${person.house}`);
    personLines(person).forEach(line => parts.push(line.text));
    if (person.issue === 'no issue') parts.push('died without issue');
    return parts.join(', ');
  }

  function addText(parent, text, className) {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = safeText(text);
    parent.appendChild(el);
    return el;
  }

  function buildIndex() {
    byId = new Map(data.nodes.map(person => [person.id, person]));
    edgesByParent = new Map();
    edgesByChild = new Map();
    data.edges.forEach(edge => {
      if (!byId.has(edge.from) || !byId.has(edge.to)) return;
      if (!edgesByParent.has(edge.from)) edgesByParent.set(edge.from, []);
      if (!edgesByChild.has(edge.to)) edgesByChild.set(edge.to, []);
      edgesByParent.get(edge.from).push(edge);
      edgesByChild.get(edge.to).push(edge);
    });
  }

  function edgeClass(edge) {
    return edge.type === 'primary' ? 'primary' : 'secondary';
  }

  function addConnector(edge, parent, child) {
    const parentX = GUTTER + (Number(parent.column) || 0) * COL_STEP + CARD_W / 2;
    const childX = GUTTER + (Number(child.column) || 0) * COL_STEP + CARD_W / 2;
    const parentY = ((Number(parent.generation) || 1) - 1) * GEN_STEP + CARD_H;
    const childY = ((Number(child.generation) || 1) - 1) * GEN_STEP;
    // For non-adjacent generations, route the horizontal branch just above the
    // child card. A midpoint can land halfway through an unrelated generation.
    const generationGap = (Number(child.generation) || 1) - (Number(parent.generation) || 1);
    const midY = generationGap > 1 ? childY - 16 : (parentY + childY) / 2;
    const typeClass = edgeClass(edge);

    const vertical = (x, y1, y2) => {
      if (y2 <= y1) return;
      const line = document.createElement('span');
      line.className = `royal-connector vertical ${typeClass}`;
      line.style.left = `${x - 0.75}px`;
      line.style.top = `${y1}px`;
      line.style.height = `${Math.max(1, y2 - y1)}px`;
      line.dataset.from = edge.from;
      line.dataset.to = edge.to;
      line.setAttribute('aria-hidden', 'true');
      world.appendChild(line);
      connectorElements.push(line);
    };
    const horizontal = document.createElement('span');
    horizontal.className = `royal-connector horizontal ${typeClass}`;
    horizontal.style.left = `${Math.min(parentX, childX)}px`;
    horizontal.style.top = `${midY - 0.75}px`;
    horizontal.style.width = `${Math.max(1.5, Math.abs(childX - parentX))}px`;
    horizontal.dataset.from = edge.from;
    horizontal.dataset.to = edge.to;
    horizontal.setAttribute('aria-hidden', 'true');
    world.appendChild(horizontal);
    connectorElements.push(horizontal);
    vertical(parentX, parentY, midY);
    vertical(childX, midY, childY);
  }

  function buildPersonCard(person) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `royal-person${person.is_sovereign ? ' sovereign' : ''}`;
    card.style.setProperty('--royal-column', String((Number(person.column) || 0) + 1));
    card.style.setProperty('--royal-generation', String(Number(person.generation) || 1));
    const background = cardColour(person);
    card.style.setProperty('--royal-card', background);
    card.style.setProperty('--royal-text', textColour(background));
    card.style.setProperty('--royal-border', person.colours?.border || '#555555');
    card.setAttribute('aria-label', cardLabel(person));
    card.dataset.personId = person.id;
    card.dataset.house = person.house || '';
    card.dataset.issue = person.issue || '';

    addText(card, person.name, 'royal-person-name');
    personLines(person).forEach(line => addText(card, line.text, line.className));
    card.addEventListener('click', () => showPerson(person.id, false));
    world.appendChild(card);
    cards.set(person.id, card);

    if (person.issue === 'no issue') {
      const marker = document.createElement('span');
      marker.className = 'royal-dsp';
      marker.style.left = `${GUTTER + (Number(person.column) || 0) * COL_STEP + CARD_W / 2 - 18}px`;
      marker.style.top = `${((Number(person.generation) || 1) - 1) * GEN_STEP + CARD_H - 7}px`;
      // The card's accessible name already says "died without issue"
      marker.setAttribute('aria-hidden', 'true');
      marker.innerHTML = '<span class="royal-dsp-arrow">↓</span><span>d.s.p.</span>';
      world.appendChild(marker);
    }
  }

  function buildGenerationLabels(maxGeneration) {
    for (let generation = 1; generation <= maxGeneration; generation++) {
      const label = document.createElement('span');
      label.className = 'royal-generation-label';
      label.style.top = `${(generation - 1) * GEN_STEP + CARD_H / 2}px`;
      label.textContent = `Gen ${generation}`;
      label.setAttribute('aria-hidden', 'true');
      world.appendChild(label);
    }
  }

  // Text version of the tree: one section per generation, relationships spelled out
  function buildList() {
    list.replaceChildren();
    listSections = [];
    const byGeneration = new Map();
    data.nodes.forEach(person => {
      const generation = Number(person.generation) || 1;
      if (!byGeneration.has(generation)) byGeneration.set(generation, []);
      byGeneration.get(generation).push(person);
    });

    [...byGeneration.keys()].sort((a, b) => a - b).forEach(generation => {
      const section = document.createElement('section');
      section.className = 'royal-list-generation';
      const heading = document.createElement('h2');
      heading.textContent = `Generation ${generation}`;
      const items = document.createElement('ul');
      items.className = 'royal-list-items';
      const elements = [];

      byGeneration.get(generation)
        .sort((a, b) => (Number(a.column) || 0) - (Number(b.column) || 0))
        .forEach(person => {
          const item = document.createElement('li');
          item.className = 'royal-list-item';
          item.dataset.house = person.house || '';
          item.style.setProperty('--royal-card', cardColour(person));
          item.style.setProperty('--royal-border', person.colours?.border || '#555555');
          addText(item, person.name, 'royal-list-name');
          if (person.house) addText(item, `House of ${person.house}`, 'royal-list-house');
          personFacts(person).forEach(fact => addText(item, fact, 'royal-list-fact'));
          const names = edges => edges.map(edge => byId.get(edge.from === person.id ? edge.to : edge.from)).filter(Boolean).map(p => p.name);
          const parents = names(edgesByChild.get(person.id) || []);
          const children = names(edgesByParent.get(person.id) || []);
          if (parents.length) addText(item, `Parents: ${parents.join(', ')}`, 'royal-list-fact');
          if (children.length) addText(item, `Children: ${children.join(', ')}`, 'royal-list-fact');
          items.appendChild(item);
          elements.push(item);
        });

      section.append(heading, items);
      list.appendChild(section);
      listSections.push({ el: section, items: elements });
    });
  }

  function buildLegend() {
    legend.replaceChildren();
    const houses = data.house_colours || {};
    Object.entries(houses).forEach(([house, colours]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'royal-legend-button';
      button.setAttribute('aria-pressed', 'false');
      const swatch = document.createElement('span');
      swatch.className = 'royal-legend-swatch';
      swatch.style.background = colours.member || '#d9d0b8';
      swatch.style.borderColor = colours.border || '#555';
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = house;
      button.append(swatch, label);
      button.addEventListener('click', () => toggleHouse(house));
      legend.appendChild(button);
    });
  }

  function updateLegendState() {
    legend.querySelectorAll('.royal-legend-button').forEach(button => {
      button.setAttribute('aria-pressed', button.textContent.trim() === houseFilter ? 'true' : 'false');
    });
  }

  function updateEmphasis() {
    const related = new Set();
    if (selectedId !== null) {
      related.add(selectedId);
      (edgesByParent.get(selectedId) || []).forEach(edge => related.add(edge.to));
      (edgesByChild.get(selectedId) || []).forEach(edge => related.add(edge.from));
    }
    cards.forEach((card, id) => {
      const isRelated = related.has(id);
      const isSelected = selectedId === id;
      const houseMatches = houseFilter === null || card.dataset.house === houseFilter;
      card.classList.toggle('selected', isSelected);
      card.classList.toggle('related', isRelated && !isSelected);
      card.classList.toggle('dim', !houseMatches || (selectedId !== null && !isRelated));
      if (isSelected) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    });
    connectorElements.forEach(line => {
      const from = line.dataset.from;
      const to = line.dataset.to;
      const fromPerson = byId.get(from);
      const toPerson = byId.get(to);
      const houseMatches = houseFilter === null || fromPerson?.house === houseFilter || toPerson?.house === houseFilter;
      const relationMatches = selectedId === null || related.has(from) && related.has(to);
      line.classList.toggle('dim', !houseMatches || !relationMatches);
      line.classList.toggle('related', selectedId !== null && related.has(from) && related.has(to));
    });
    // The list view follows the house filter
    listSections.forEach(section => {
      let visible = 0;
      section.items.forEach(item => {
        const show = houseFilter === null || item.dataset.house === houseFilter;
        item.hidden = !show;
        if (show) visible++;
      });
      section.el.hidden = visible === 0;
    });
  }

  function addDetail(text, extraClass = '') {
    if (!text) return;
    const row = document.createElement('div');
    row.className = `royal-detail-row${extraClass ? ` ${extraClass}` : ''}`;
    row.textContent = text;
    panelDetails.appendChild(row);
  }

  function relationGroup(title, edges, relatedIdKey) {
    if (!edges.length) return;
    const group = document.createElement('section');
    group.className = 'royal-relation-group';
    const heading = document.createElement('h3');
    heading.className = 'royal-relation-heading';
    heading.textContent = title;
    const items = document.createElement('div');
    items.className = 'royal-relation-list';
    edges.forEach(edge => {
      const id = edge[relatedIdKey];
      const person = byId.get(id);
      if (!person) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'royal-relation-link';
      button.textContent = `${person.name}${edge.type === 'primary' ? '' : ' · secondary link'}`;
      button.addEventListener('click', () => showPerson(id, true));
      items.appendChild(button);
    });
    if (items.childElementCount) group.append(heading, items);
    if (group.childElementCount) panelRelations.appendChild(group);
  }

  function showPerson(id, moveToPerson) {
    const person = byId.get(id);
    if (!person) return;
    selectedId = id;
    panelName.textContent = person.name;
    panelHouse.replaceChildren();
    if (person.house) {
      const swatch = document.createElement('span');
      swatch.className = 'royal-house-swatch';
      swatch.style.background = person.colours?.member || '#d9d0b8';
      swatch.style.borderColor = person.colours?.border || '#555555';
      swatch.setAttribute('aria-hidden', 'true');
      panelHouse.append(swatch, document.createTextNode(`House of ${person.house}`));
    }
    panelDetails.replaceChildren();
    panelRelations.replaceChildren();

    personFacts(person).forEach((fact, i) => addDetail(fact, person.sobriquet && i === 0 ? 'sobriquet' : ''));

    relationGroup('Parents', edgesByChild.get(id) || [], 'from');
    relationGroup('Children', edgesByParent.get(id) || [], 'to');
    panel.hidden = false;
    updateEmphasis();
    if (moveToPerson) scrollToPerson(id);
    // Moving focus to the heading makes screen readers read the person; it also
    // stops focus being lost when a relation button is rebuilt
    panelName.focus({ preventScroll: true });
  }

  function closePanel(restoreFocus = false) {
    const card = selectedId !== null ? cards.get(selectedId) : null;
    selectedId = null;
    panel.hidden = true;
    updateEmphasis();
    if (restoreFocus && card) card.focus();
  }

  function setScale(nextScale, centreX, centreY) {
    const oldScale = scale;
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    if (centreX === undefined) centreX = (viewport.scrollLeft + viewport.clientWidth / 2) / oldScale;
    if (centreY === undefined) centreY = (viewport.scrollTop + viewport.clientHeight / 2) / oldScale;
    scale = next;
    world.style.transform = `scale(${scale})`;
    shell.style.width = `${worldWidth * scale}px`;
    shell.style.height = `${worldHeight * scale}px`;
    viewport.scrollLeft = Math.max(0, centreX * scale - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, centreY * scale - viewport.clientHeight / 2);
    // aria-disabled keeps the button focusable, unlike the disabled attribute
    zoomIn.setAttribute('aria-disabled', String(scale >= MAX_SCALE));
    zoomOut.setAttribute('aria-disabled', String(scale <= MIN_SCALE));
  }

  function scrollToPerson(id) {
    const person = byId.get(id);
    if (!person) return;
    const x = GUTTER + (Number(person.column) || 0) * COL_STEP + CARD_W / 2;
    const y = ((Number(person.generation) || 1) - 1) * GEN_STEP + CARD_H / 2;
    viewport.scrollTo({
      left: Math.max(0, x * scale - viewport.clientWidth / 2),
      top: Math.max(0, y * scale - viewport.clientHeight / 2),
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }

  function houseBounds(house) {
    const members = data.nodes.filter(person => person.house === house);
    if (!members.length) return null;
    const xs = members.map(person => GUTTER + (Number(person.column) || 0) * COL_STEP);
    const ys = members.map(person => ((Number(person.generation) || 1) - 1) * GEN_STEP);
    const xe = members.map(person => GUTTER + (Number(person.column) || 0) * COL_STEP + CARD_W);
    const ye = members.map(person => ((Number(person.generation) || 1) - 1) * GEN_STEP + CARD_H);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xe), y2: Math.max(...ye) };
  }

  function toggleHouse(house) {
    closePanel();
    if (houseFilter === house) {
      houseFilter = null;
      updateLegendState();
      updateEmphasis();
      const restore = savedView;
      savedView = null;
      if (restore && !listView) {
        setScale(restore.scale, restore.centreX, restore.centreY);
        viewport.scrollLeft = restore.scrollLeft;
        viewport.scrollTop = restore.scrollTop;
      }
      announce('Showing all royal houses.');
      return;
    }
    if (houseFilter === null && !listView) {
      savedView = {
        scale,
        centreX: (viewport.scrollLeft + viewport.clientWidth / 2) / scale,
        centreY: (viewport.scrollTop + viewport.clientHeight / 2) / scale,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop
      };
    }
    houseFilter = house;
    updateLegendState();
    updateEmphasis();
    const bounds = houseBounds(house);
    if (bounds && !listView) {
      const width = Math.max(CARD_W, bounds.x2 - bounds.x1);
      const height = Math.max(CARD_H, bounds.y2 - bounds.y1);
      const fitScale = Math.min(MAX_SCALE, (viewport.clientWidth - 72) / width, (viewport.clientHeight - 96) / height);
      setScale(Math.max(MIN_SCALE, fitScale), (bounds.x1 + bounds.x2) / 2, (bounds.y1 + bounds.y2) / 2);
    }
    announce(`Showing the House of ${house}. Select the same house again to restore the previous view.`);
  }

  function fitAll() {
    houseFilter = null;
    savedView = null;
    selectedId = null;
    panel.hidden = true;
    updateLegendState();
    updateEmphasis();
    const fitScale = Math.min((viewport.clientWidth - 24) / worldWidth, (viewport.clientHeight - 24) / worldHeight);
    setScale(Math.max(MIN_SCALE, fitScale), worldWidth / 2, worldHeight / 2);
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    announce('Showing the whole family tree.');
  }

  function setListView(on) {
    listView = on;
    viewButton.setAttribute('aria-pressed', String(on));
    viewport.hidden = on;
    list.hidden = !on;
    skipLink.hidden = on;
    hint.hidden = on;
    zoomGroup.hidden = on;
    if (on) closePanel();
    announce(on ? 'Showing the family tree as a list, grouped by generation.' : 'Showing the family tree diagram.');
  }

  function buildTree() {
    const maxColumn = Math.max(...data.nodes.map(person => Number(person.column) || 0));
    const maxGeneration = Math.max(...data.nodes.map(person => Number(person.generation) || 1));
    const columns = maxColumn + 1;
    worldWidth = GUTTER + columns * COL_STEP;
    worldHeight = maxGeneration * GEN_STEP;

    world.style.width = `${columns * COL_STEP}px`;
    world.style.height = `${worldHeight}px`;
    world.style.gridTemplateColumns = `repeat(${columns}, ${COL_STEP}px)`;
    world.style.gridTemplateRows = `repeat(${maxGeneration}, ${GEN_STEP}px)`;
    world.style.setProperty('--royal-gutter', `${GUTTER}px`);
    world.style.setProperty('--royal-card-width', `${CARD_W}px`);
    world.style.setProperty('--royal-card-height', `${CARD_H}px`);
    world.style.setProperty('--royal-column-step', `${COL_STEP}px`);
    world.style.setProperty('--royal-generation-step', `${GEN_STEP}px`);

    buildGenerationLabels(maxGeneration);
    // Connectors sit behind cards; create them first, then add the person cards.
    data.edges.forEach(edge => {
      const parent = byId.get(edge.from);
      const child = byId.get(edge.to);
      if (parent && child) addConnector(edge, parent, child);
    });
    data.nodes.forEach(buildPersonCard);

    shell.style.width = `${worldWidth * scale}px`;
    shell.style.height = `${worldHeight * scale}px`;
    world.style.transform = `scale(${scale})`;
  }

  $('royal-panel-close').addEventListener('click', () => closePanel(true));
  zoomIn.addEventListener('click', () => setScale(scale * 1.25));
  zoomOut.addEventListener('click', () => setScale(scale / 1.25));
  $('royal-fit').addEventListener('click', fitAll);
  viewButton.addEventListener('click', () => setListView(!listView));

  // Escape closes the details panel from anywhere on the page and returns focus to the card
  page.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      closePanel(true);
    }
  });

  announce('Loading the family tree…');

  fetch('/assets/data/royal.json')
    .then(response => {
      if (!response.ok) throw new Error(`royal.json returned ${response.status}`);
      return response.json();
    })
    .then(json => {
      if (!Array.isArray(json.nodes) || !Array.isArray(json.edges)) throw new Error('The family tree data has an unexpected format.');
      data = json;
      buildIndex();
      buildTree();
      buildList();
      buildLegend();
      updateEmphasis();
      viewButton.disabled = false;
      announce(`Family tree loaded: ${data.nodes.length} people. A list view is available.`);

      // Begin at Ecgberht, rather than shrinking 1,100 years into an unreadable overview.
      const root = data.nodes.find(person => person.name === 'Ecgberht') || data.nodes.reduce((first, person) =>
        (Number(person.generation) || 1) < (Number(first.generation) || 1) ? person : first, data.nodes[0]);
      if (root) {
        setScale(0.85, GUTTER + (Number(root.column) || 0) * COL_STEP + CARD_W / 2, CARD_H / 2);
        viewport.scrollTop = 0;
      }
    })
    .catch(loadError => {
      console.error('Could not load the royal family tree:', loadError);
      announce('');
      error.textContent = 'The family tree data could not be loaded. Check that /assets/data/royal.json is available, then reload the page.';
      error.hidden = false;
    });
})();
