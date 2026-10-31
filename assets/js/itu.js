(() => {
  "use strict";
  const root = document.querySelector(".itu-page");
  if (!root) return;

  const ITU_URL = "/assets/data/itu.csv";
  const ENTITY_URL = "/assets/data/cc.csv";
  // Country/entity SVGs use their cc.csv code as a lowercase filename, e.g. au.svg.
  // If the site's flag filenames differ, add code-to-filename overrides here.
  const FLAG_BASE = "/assets/images/flags/";
  const FLAG_OVERRIDES = {};
  const $ = id => document.getElementById(id);
  const slider = $("year-slider");
  const yearSelect = $("year-select");
  const yearDisplay = $("year-display");
  const listHeading = $("list-heading");
  const listDescription = $("list-description");
  const allocationList = $("allocation-list");
  const resultsMeta = $("results-meta");
  const showMore = $("show-more");
  const globalSearch = $("itu-global-search");
  const searchResults = $("itu-search-results");
  const prefixHistory = $("prefix-history");
  const statusEl = $("itu-status");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  // Every colour here is at least 3:1 against the light timeline track
  const palette = ["#4d5792", "#397c78", "#9a7230", "#6f789d", "#b26f5b", "#5989a3", "#7d6b9e", "#7a7a45"];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let data = null;
  let ready = false;
  let currentYear = 2026;
  let visibleLimit = 50;
  let filteredAllocations = [];
  let activePrefix = "";
  let activeEntity = "";
  let searchItems = [];
  let activeOption = -1;
  let announceTimer;

  // Debounced announcement, so dragging the slider or typing doesn't read out every step
  function announce(message, delay = 600) {
    clearTimeout(announceTimer);
    statusEl.textContent = "";
    announceTimer = setTimeout(() => { statusEl.textContent = message; }, delay);
  }

  // Scroll to a section and move keyboard/screen reader focus to its heading
  function goTo(section, focusTarget) {
    section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  // CSV reader supporting quoted fields and escaped quotes.
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    text = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== "\r") field += ch;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell.trim() !== ""));
  }

  function normaliseData(ituText, entityText) {
    const rows = parseCSV(ituText);
    if (rows.length < 2) throw new Error("The ITU CSV appears to be empty.");
    const years = rows[0].slice(1).map(v => Number(v.trim())).filter(Number.isFinite);
    if (!years.length) throw new Error("Could not find year columns in the ITU CSV.");
    const prefixes = rows.slice(1).map(row => {
      const prefix = (row[0] || "").trim().toUpperCase();
      if (!prefix) return null;
      const assignments = {};
      years.forEach((year, i) => {
        const code = (row[i + 1] || "").trim().toUpperCase();
        if (code) assignments[String(year)] = code;
      });
      return { prefix, assignments };
    }).filter(Boolean).sort((a, b) => a.prefix.localeCompare(b.prefix));
    const entities = {};
    parseCSV(entityText).forEach(row => {
      const code = (row[0] || "").trim().toUpperCase();
      const name = (row[1] || "").trim();
      if (code && name) entities[code] = name;
    });
    // Keep prefixes with at least one real allocation anywhere in the record.
    // ZZ is the dataset's unallocated marker, not an allocated entity.
    const allocatedPrefixes = prefixes.filter(prefix => years.some(year => {
      const code = prefix.assignments[String(year)];
      return code && code !== "ZZ";
    }));
    return { years, prefixes: allocatedPrefixes, entities };
  }

  const entityName = code => data.entities[code] || `Unknown entity (${code})`;
  const rawAssignment = (prefix, year) => prefix.assignments[String(year)] || "";
  const getAssignment = (prefix, year) => {
    const code = rawAssignment(prefix, year);
    return code === "ZZ" ? "" : code;
  };
  const flagPath = code => FLAG_BASE + (FLAG_OVERRIDES[code] || `${String(code).toLowerCase()}.svg`);
  const flagMarkup = code => `<img class="itu-entity-flag" src="${esc(flagPath(code))}" alt="" aria-hidden="true" loading="lazy" data-flag-code="${esc(code)}">`;
  const codeBadge = code => `<span class="itu-entity-code">${esc(code)}</span>`;
  const historyIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>`;

  function updateUrl(changes = {}) {
    const params = new URLSearchParams(location.search);
    ["year", "prefix", "entity"].forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(changes, key)) return;
      const value = changes[key];
      if (value == null || value === "") params.delete(key);
      else params.set(key, key === "year" ? String(value) : String(value).toUpperCase());
    });
    // The default year is represented by the absence of a year parameter.
    if (Number(params.get("year")) === data.years[data.years.length - 1]) params.delete("year");
    const query = params.toString();
    try { history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`); } catch (_) { /* Local preview files may not permit URL updates. */ }
  }

  function populateYears() {
    yearSelect.replaceChildren();
    data.years.slice().reverse().forEach(year => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
    slider.min = String(data.years[0]);
    slider.max = String(data.years[data.years.length - 1]);
  }

  function setSelectedMode(mode) {
    document.querySelectorAll("[data-mode-link]").forEach(link => {
      if (link.dataset.modeLink === mode) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  function renderYear(updateHistory = true) {
    currentYear = Number(slider.value);
    yearSelect.value = String(currentYear);
    yearDisplay.textContent = currentYear;
    activeEntity = "";
    const active = data.prefixes.filter(prefix => getAssignment(prefix, currentYear));
    filteredAllocations = active;
    listHeading.textContent = `Allocations in ${currentYear}`;
    listDescription.textContent = "Prefixes allocated in this year.";
    visibleLimit = 50;
    renderAllocationRows();
    if (updateHistory) updateUrl({ year: currentYear === data.years[data.years.length - 1] ? null : currentYear, entity: null });
  }

  function renderEntityPrefixes(code, updateHistory = true) {
    activeEntity = code;
    activePrefix = "";
    const entityPrefixes = data.prefixes.filter(prefix => data.years.some(year => getAssignment(prefix, year) === code));
    filteredAllocations = entityPrefixes;
    listHeading.textContent = `${entityName(code)} prefixes`;
    listDescription.textContent = "Prefixes allocated to this entity in one or more years.";
    resultsMeta.textContent = `${entityPrefixes.length.toLocaleString("en-AU")} prefix${entityPrefixes.length === 1 ? "" : "es"} in the historical record`;
    visibleLimit = 50;
    renderAllocationRows();
    if (updateHistory) updateUrl({ entity: code, prefix: null });
  }

  function renderAllocationRows() {
    const shown = filteredAllocations.slice(0, visibleLimit);
    allocationList.innerHTML = shown.length ? shown.map(prefix => {
      const currentCode = activeEntity ? activeEntity : getAssignment(prefix, currentYear);
      const label = activeEntity ? entityName(activeEntity) : entityName(currentCode);
      const range = activeEntity ? firstLastForEntity(prefix, activeEntity) : null;
      const secondary = activeEntity && range ? `<span class="itu-entity-range">${range.first === range.last ? range.first : `${range.first}–${range.last}`}</span>` : "";
      return `<li><a class="itu-allocation-row" href="#by-prefix" data-prefix="${esc(prefix.prefix)}"><span class="itu-prefix-code">${esc(prefix.prefix)}</span><span class="itu-allocation-entity">${flagMarkup(currentCode)}<span class="itu-entity-name">${esc(label)}</span>${codeBadge(currentCode)}${secondary}</span><span class="itu-history-link">${historyIcon}<span>See prefix history</span></span></a></li>`;
    }).join("") : `<li class="itu-empty-results">No allocations recorded${activeEntity ? ` for ${esc(entityName(activeEntity))}` : ` in ${currentYear}`}.</li>`;
    if (!activeEntity) {
      const represented = new Set(filteredAllocations.map(prefix => getAssignment(prefix, currentYear)).filter(Boolean)).size;
      resultsMeta.textContent = `${filteredAllocations.length.toLocaleString("en-AU")} allocated prefix${filteredAllocations.length === 1 ? "" : "es"} across ${represented.toLocaleString("en-AU")} entit${represented === 1 ? "y" : "ies"}`;
    }
    showMore.hidden = filteredAllocations.length <= visibleLimit;
    showMore.textContent = `Show more allocations (${Math.max(0, filteredAllocations.length - visibleLimit).toLocaleString("en-AU")} remaining)`;
    if (ready) announce(resultsMeta.textContent);
  }

  function firstLastForEntity(prefix, code) {
    const years = data.years.filter(year => getAssignment(prefix, year) === code);
    return years.length ? { first: years[0], last: years[years.length - 1] } : null;
  }

  // ── Search combobox ─────────────────────────────────────────────────────────
  function closeSearch() {
    searchResults.hidden = true;
    globalSearch.setAttribute("aria-expanded", "false");
    globalSearch.removeAttribute("aria-activedescendant");
    activeOption = -1;
  }

  function setActiveOption(index) {
    const options = [...searchResults.querySelectorAll("[data-search-index]")];
    options.forEach((option, i) => option.setAttribute("aria-selected", String(i === index)));
    activeOption = index;
    if (index >= 0 && options[index]) {
      globalSearch.setAttribute("aria-activedescendant", options[index].id);
      options[index].scrollIntoView({ block: "nearest" });
    } else {
      globalSearch.removeAttribute("aria-activedescendant");
    }
  }

  function renderSearchResults() {
    const query = globalSearch.value.trim().toLocaleLowerCase();
    if (!query) {
      closeSearch();
      searchItems = [];
      activeEntity = "";
      renderYear(false);
      prefixHistory.innerHTML = `<div class="itu-empty-state"><p>Choose a radio prefix from the search results or annual list to see its allocation history.</p></div>`;
      activePrefix = "";
      updateUrl({ entity: null, prefix: null });
      return;
    }
    const prefixMatches = data.prefixes.map(prefix => {
      const latest = [...data.years].reverse().map(year => getAssignment(prefix, year)).find(Boolean) || "";
      return { type: "prefix", code: prefix.prefix, name: latest ? entityName(latest) : "No recorded allocation", prefix };
    }).filter(item => item.code.toLocaleLowerCase().includes(query) || item.name.toLocaleLowerCase().includes(query))
      .sort((a, b) => matchRank(a.code, query) - matchRank(b.code, query) || a.code.localeCompare(b.code)).slice(0, 8);
    const entityMatches = Object.entries(data.entities).map(([code, name]) => ({ type: "entity", code, name }))
      .filter(item => item.code.toLocaleLowerCase().includes(query) || item.name.toLocaleLowerCase().includes(query))
      .sort((a, b) => matchRank(a.code, query) - matchRank(b.code, query) || a.name.localeCompare(b.name)).slice(0, 8);
    searchItems = [...prefixMatches, ...entityMatches];

    const sections = [];
    if (prefixMatches.length) sections.push(`<div role="group" aria-labelledby="itu-group-prefix"><div class="itu-search-group-label" id="itu-group-prefix">Radio prefixes</div>${prefixMatches.map((item, i) => `<div class="itu-search-result" role="option" id="itu-option-${i}" aria-selected="false" data-search-index="${i}"><span class="itu-search-result-code">${esc(item.code)}</span><span class="itu-search-result-main"><span class="itu-search-result-name">${esc(item.name)}</span><span class="itu-search-result-type">Radio prefix</span></span></div>`).join("")}</div>`);
    if (entityMatches.length) sections.push(`<div role="group" aria-labelledby="itu-group-entity"><div class="itu-search-group-label" id="itu-group-entity">Countries and entities</div>${entityMatches.map((item, i) => { const n = prefixMatches.length + i; return `<div class="itu-search-result" role="option" id="itu-option-${n}" aria-selected="false" data-search-index="${n}"><span class="itu-search-result-code">${esc(item.code)}</span><span class="itu-search-result-main">${flagMarkup(item.code)}<span class="itu-search-result-name">${esc(item.name)}</span><span class="itu-search-result-type">Entity code</span></span></div>`; }).join("")}</div>`);
    searchResults.innerHTML = sections.join("") || `<div class="itu-search-empty" role="option" aria-disabled="true">No prefixes or entities match “${esc(globalSearch.value.trim())}”.</div>`;
    searchResults.hidden = false;
    globalSearch.setAttribute("aria-expanded", "true");
    globalSearch.removeAttribute("aria-activedescendant");
    activeOption = -1;
    announce(searchItems.length ? `${searchItems.length} result${searchItems.length === 1 ? "" : "s"} available` : "No results");
  }

  function matchRank(value, query) {
    const lower = value.toLocaleLowerCase();
    return lower === query ? 0 : lower.startsWith(query) ? 1 : lower.includes(query) ? 2 : 3;
  }

  function chooseSearchItem(index) {
    const item = searchItems[index];
    if (!item) return;
    closeSearch();
    globalSearch.value = item.code;
    if (item.type === "prefix") {
      showPrefix(item.code);
      setSelectedMode("prefix");
      goTo($("by-prefix"), prefixHistory.querySelector("h3"));
    } else {
      renderEntityPrefixes(item.code);
      setSelectedMode("year");
      goTo($("by-year"), listHeading);
    }
  }

  // ── Prefix history ──────────────────────────────────────────────────────────
  function runsFor(prefix) {
    const runs = [];
    let start = null, lastYear = null, lastCode = null;
    for (const year of data.years) {
      const code = getAssignment(prefix, year);
      if (code && code === lastCode && lastYear === year - 1) {
        lastYear = year;
        continue;
      }
      if (start !== null) runs.push({ start, end: lastYear, code: lastCode });
      start = code ? year : null;
      lastYear = code ? year : null;
      lastCode = code || null;
    }
    if (start !== null) runs.push({ start, end: lastYear, code: lastCode });
    return runs;
  }

  function showPrefix(prefixText, updateHistory = true) {
    const key = String(prefixText || "").trim().toUpperCase();
    const prefix = data.prefixes.find(item => item.prefix === key);
    if (!prefix) {
      prefixHistory.innerHTML = `<div class="itu-empty-results"><h3 tabindex="-1">No prefix “${esc(key)}” was found.</h3></div>`;
      if (updateHistory) updateUrl({ prefix: key || null, entity: null });
      return;
    }
    activePrefix = key;
    activeEntity = "";
    const runs = runsFor(prefix);
    const first = runs.length ? runs[0].start : null;
    const last = runs.length ? runs[runs.length - 1].end : null;
    const span = data.years[data.years.length - 1] - data.years[0] + 1;
    const segments = runs.map((run, i) => {
      const left = ((run.start - data.years[0]) / span) * 100;
      const width = ((run.end - run.start + 1) / span) * 100;
      const label = run.start === run.end ? String(run.start) : `${run.start}–${run.end}`;
      return `<button class="itu-timeline-segment" style="left:${left}%;width:${Math.max(width, .4)}%;background:${palette[i % palette.length]}" title="${esc(label)}: ${esc(entityName(run.code))}" aria-label="${esc(`${entityName(run.code)}, ${label}. Show allocations for ${run.start}`)}" data-start="${run.start}" data-code="${esc(run.code)}"></button>`;
    }).join("");
    const periods = runs.map(run => `<div class="itu-period"><div class="itu-period-dates">${run.start === run.end ? run.start : `${run.start}–${run.end}`}</div><div><div class="itu-period-name">${flagMarkup(run.code)}<span>${esc(entityName(run.code))}</span>${codeBadge(run.code)}</div><div class="itu-period-note">${run.start === run.end ? "Recorded for one year" : `${run.end - run.start + 1} consecutive years`}</div></div></div>`).join("");
    const ticks = [0, .25, .5, .75, 1].map(position => Math.round(data.years[0] + (data.years[data.years.length - 1] - data.years[0]) * position));
    prefixHistory.innerHTML = `
      <div class="itu-history-top"><div><h3 tabindex="-1">${esc(key)}</h3><p>${first ? `Recorded from ${first} to ${last}` : "No recorded assignments"} · ${runs.length} allocation period${runs.length === 1 ? "" : "s"}</p></div></div>
      <div class="itu-timeline" role="group" aria-label="Timeline of ${esc(key)} allocations">
        <div class="itu-timeline-years" aria-hidden="true">${ticks.map(year => `<span>${year}</span>`).join("")}</div>
        <div class="itu-timeline-track">${segments}</div>
      </div>
      <div class="itu-periods">${periods || '<div class="itu-empty-results">No allocation periods recorded.</div>'}</div>`;
    prefixHistory.querySelectorAll(".itu-timeline-segment").forEach(button => button.addEventListener("click", () => {
      activePrefix = key;
      slider.value = button.dataset.start;
      renderYear();
      setSelectedMode("year");
      goTo($("by-year"), listHeading);
    }));
    if (updateHistory) updateUrl({ prefix: key, entity: null });
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  searchResults.addEventListener("click", event => {
    const option = event.target.closest("[data-search-index]");
    if (option) chooseSearchItem(Number(option.dataset.searchIndex));
  });

  allocationList.addEventListener("click", event => {
    const link = event.target.closest("[data-prefix]");
    if (!link) return;
    event.preventDefault();
    globalSearch.value = link.dataset.prefix;
    closeSearch();
    showPrefix(link.dataset.prefix);
    setSelectedMode("prefix");
    goTo($("by-prefix"), prefixHistory.querySelector("h3"));
  });

  root.addEventListener("error", event => {
    if (event.target instanceof HTMLImageElement && event.target.matches("[data-flag-code]")) event.target.hidden = true;
  }, true);

  globalSearch.addEventListener("input", renderSearchResults);
  globalSearch.addEventListener("keydown", event => {
    const open = !searchResults.hidden;
    const count = searchItems.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!globalSearch.value.trim()) return;
      event.preventDefault();
      if (!open) renderSearchResults();
      if (!searchItems.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveOption(activeOption === -1 ? (step === 1 ? 0 : searchItems.length - 1) : (activeOption + step + searchItems.length) % searchItems.length);
    } else if (event.key === "Enter" && open && count) {
      event.preventDefault();
      chooseSearchItem(activeOption >= 0 ? activeOption : 0);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        closeSearch();
      } else if (globalSearch.value) {
        // Chrome's clear button is hidden site-wide, so a second Escape clears the field
        event.preventDefault();
        globalSearch.value = "";
        renderSearchResults();
      }
    }
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".itu-global-search-wrap")) closeSearch();
  });

  slider.addEventListener("input", () => { activeEntity = ""; renderYear(); });
  yearSelect.addEventListener("change", () => { slider.value = yearSelect.value; activeEntity = ""; renderYear(); });
  showMore.addEventListener("click", () => {
    const previous = visibleLimit;
    visibleLimit += 50;
    renderAllocationRows();
    // The button may disappear, so move focus to the first newly added row
    allocationList.querySelectorAll("a")[previous]?.focus();
  });
  document.querySelectorAll("[data-mode-link]").forEach(link => link.addEventListener("click", () => setSelectedMode(link.dataset.modeLink)));

  // ── Load ────────────────────────────────────────────────────────────────────
  const dataPromise = window.ITU_CSV_TEXT != null && window.CC_CSV_TEXT != null
    ? Promise.resolve([window.ITU_CSV_TEXT, window.CC_CSV_TEXT])
    : Promise.all([
      fetch(ITU_URL).then(response => { if (!response.ok) throw new Error(`Could not load ITU data (${response.status}).`); return response.text(); }),
      fetch(ENTITY_URL).then(response => { if (!response.ok) throw new Error(`Could not load entity names (${response.status}).`); return response.text(); })
    ]);

  dataPromise.then(([ituText, entityText]) => {
    data = normaliseData(ituText, entityText);
    populateYears();
    const params = new URLSearchParams(location.search);
    const requestedYear = Number(params.get("year"));
    if (requestedYear >= data.years[0] && requestedYear <= data.years[data.years.length - 1]) slider.value = String(requestedYear);
    renderYear(false);
    const requestedPrefix = params.get("prefix");
    const requestedEntity = params.get("entity");
    if (requestedPrefix) {
      globalSearch.value = requestedPrefix.toUpperCase();
      showPrefix(requestedPrefix, false);
      setSelectedMode("prefix");
    } else if (requestedEntity && data.entities[requestedEntity.toUpperCase()]) {
      globalSearch.value = requestedEntity.toUpperCase();
      renderEntityPrefixes(requestedEntity.toUpperCase(), false);
    }
    ready = true;
  }).catch(error => {
    root.insertAdjacentHTML("afterbegin", `<p class="itu-load-error" role="alert">The archive data could not be loaded. ${esc(error.message)} Check that both CSV files are present in <code>/assets/data/</code>.</p>`);
  });
})();
