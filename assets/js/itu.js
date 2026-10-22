(() => {
  "use strict";
  const root = document.querySelector(".itu-page");
  if (!root) return;

  const ITU_URL = "/assets/data/itu.csv";
  const ENTITY_URL = "/assets/data/cc.csv";
  const $ = (id) => document.getElementById(id);
  const slider = $("year-slider");
  const yearSelect = $("year-select");
  const yearDisplay = $("year-display");
  const listYear = $("list-year");
  const allocationList = $("allocation-list");
  const allocationSearch = $("allocation-search");
  const resultsMeta = $("results-meta");
  const showMore = $("show-more");
  const prefixSearch = $("prefix-search");
  const prefixSuggestions = $("prefix-suggestions");
  const prefixGo = $("prefix-go");
  const prefixHistory = $("prefix-history");
  const palette = ["#4d5792", "#397c78", "#b58a47", "#6f789d", "#b26f5b", "#5989a3", "#7d6b9e", "#8c8b58"];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let data = null;
  let currentYear = 2026;
  let visibleLimit = 40;
  let filteredAllocations = [];
  let activePrefix = "";
  let urlUpdatePending = false;

  // Small RFC-4180-style CSV reader: supports quoted fields and commas/newlines inside quotes.
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
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== '\r') field += ch;
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
    return { years, prefixes, entities };
  }

  const entityName = (code) => data.entities[code] || `Unknown entity (${code})`;
  const getAssignment = (prefix, year) => prefix.assignments[String(year)] || "";

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

  function updateUrl(changes = {}) {
    const params = new URLSearchParams(location.search);
    if (Object.hasOwn(changes, "year")) {
      if (changes.year == null) params.delete("year"); else params.set("year", String(changes.year));
    }
    if (Object.hasOwn(changes, "prefix")) {
      if (changes.prefix == null || changes.prefix === "") params.delete("prefix"); else params.set("prefix", String(changes.prefix).toUpperCase());
    }
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }

  function populateYears() {
    yearSelect.replaceChildren();
    data.years.slice().reverse().forEach(year => {
      const option = document.createElement("option");
      option.value = year; option.textContent = year;
      yearSelect.appendChild(option);
    });
    slider.min = String(data.years[0]);
    slider.max = String(data.years[data.years.length - 1]);
  }

  function renderYear(updateHistory = true) {
    currentYear = Number(slider.value);
    yearSelect.value = String(currentYear);
    yearDisplay.textContent = currentYear;
    listYear.textContent = currentYear;
    const active = data.prefixes.filter(prefix => getAssignment(prefix, currentYear));
    const entities = new Set(active.map(prefix => getAssignment(prefix, currentYear)));
    const changed = currentYear === data.years[0] ? null : data.prefixes.filter(prefix =>
      getAssignment(prefix, currentYear) !== getAssignment(prefix, currentYear - 1)
    ).length;
    $("allocation-count").textContent = active.length.toLocaleString("en-AU");
    $("entity-count").textContent = entities.size.toLocaleString("en-AU");
    $("year-change-count").textContent = changed == null ? "—" : changed.toLocaleString("en-AU");
    const query = allocationSearch.value.trim().toLocaleLowerCase();
    filteredAllocations = active.filter(prefix => {
      const code = getAssignment(prefix, currentYear);
      return prefix.prefix.toLowerCase().includes(query) || code.toLowerCase().includes(query) || entityName(code).toLowerCase().includes(query);
    });
    visibleLimit = 40;
    renderAllocationRows();
    if (updateHistory) updateUrl({ year: currentYear === 2026 ? null : currentYear });
  }

  function renderAllocationRows() {
    const shown = filteredAllocations.slice(0, visibleLimit);
    allocationList.innerHTML = shown.length ? shown.map(prefix => {
      const code = getAssignment(prefix, currentYear);
      return `<a class="itu-allocation-row" href="#by-prefix" data-prefix="${esc(prefix.prefix)}"><span class="itu-prefix-code">${esc(prefix.prefix)}</span><span class="itu-allocation-entity">${esc(entityName(code))}<small>Entity code: ${esc(code)}</small></span><span class="itu-row-arrow" aria-hidden="true">↗</span></a>`;
    }).join("") : `<div class="itu-empty-results">No allocations match that search in ${currentYear}.</div>`;
    resultsMeta.textContent = `${filteredAllocations.length.toLocaleString("en-AU")} allocation${filteredAllocations.length === 1 ? "" : "s"}${allocationSearch.value.trim() ? " matching your search" : ""}`;
    showMore.hidden = filteredAllocations.length <= visibleLimit;
    showMore.textContent = `Show more allocations (${Math.max(0, filteredAllocations.length - visibleLimit).toLocaleString("en-AU")} remaining)`;
  }

  function renderSuggestions() {
    const query = prefixSearch.value.trim().toUpperCase();
    if (!query) { prefixSuggestions.hidden = true; return; }
    const matches = data.prefixes.filter(prefix => prefix.prefix.includes(query)).sort((a, b) => {
      const ap = a.prefix === query ? 0 : a.prefix.startsWith(query) ? 1 : 2;
      const bp = b.prefix === query ? 0 : b.prefix.startsWith(query) ? 1 : 2;
      return ap - bp || a.prefix.localeCompare(b.prefix);
    }).slice(0, 8);
    prefixSuggestions.innerHTML = matches.map(prefix => {
      const runs = runsFor(prefix), latest = getAssignment(prefix, data.years[data.years.length - 1]);
      const latestCode = latest || (runs.length ? runs[runs.length - 1].code : "");
      return `<button type="button" role="option" data-prefix="${esc(prefix.prefix)}"><strong>${esc(prefix.prefix)}</strong><span>${esc(latestCode ? entityName(latestCode) : "No recorded allocation")}</span></button>`;
    }).join("");
    prefixSuggestions.hidden = !matches.length;
  }

  function showPrefix(prefixText, updateHistory = true) {
    const key = String(prefixText || "").trim().toUpperCase();
    const prefix = data.prefixes.find(item => item.prefix === key);
    if (!prefix) {
      prefixHistory.innerHTML = `<div class="itu-empty-results">No prefix “${esc(key)}” was found. Try a prefix listed in the annual explorer.</div>`;
      if (updateHistory) updateUrl({ prefix: key || null });
      return;
    }
    activePrefix = key;
    prefixSearch.value = key;
    prefixSuggestions.hidden = true;
    const runs = runsFor(prefix);
    const first = runs.length ? runs[0].start : null;
    const last = runs.length ? runs[runs.length - 1].end : null;
    const activeYears = Object.keys(prefix.assignments).length;
    const span = data.years[data.years.length - 1] - data.years[0] + 1;
    const segments = runs.map((run, i) => {
      const left = ((run.start - data.years[0]) / span) * 100;
      const width = ((run.end - run.start + 1) / span) * 100;
      const label = run.start === run.end ? String(run.start) : `${run.start}–${run.end}`;
      return `<button class="itu-timeline-segment" style="left:${left}%;width:${Math.max(width, .4)}%;background:${palette[i % palette.length]}" title="${esc(label)}: ${esc(entityName(run.code))}" aria-label="${esc(`${label}, ${entityName(run.code)}`)}" data-start="${run.start}" data-end="${run.end}" data-code="${esc(run.code)}"></button>`;
    }).join("");
    const periods = runs.map(run => `<div class="itu-period"><div class="itu-period-dates">${run.start === run.end ? run.start : `${run.start}–${run.end}`}</div><div><div class="itu-period-name">${esc(entityName(run.code))}<span class="itu-period-code">${esc(run.code)}</span></div><div class="itu-period-note">${run.start === run.end ? "Recorded for one year" : `${run.end - run.start + 1} consecutive years`}</div></div></div>`).join("");
    prefixHistory.innerHTML = `
      <div class="itu-history-top"><div><h3>${esc(key)}</h3><p>${first ? `Recorded from ${first} to ${last}` : "No recorded assignments"} · ${runs.length} allocation period${runs.length === 1 ? "" : "s"}</p></div><span class="itu-history-count">${activeYears} annual records</span></div>
      <div class="itu-timeline" role="group" aria-label="Timeline of ${esc(key)} allocations">
        <div class="itu-timeline-years"><span>${data.years[0]}</span><span>1936</span><span>1966</span><span>1996</span><span>${data.years[data.years.length - 1]}</span></div>
        <div class="itu-timeline-track">${segments}</div>
      </div>
      <div class="itu-periods">${periods || '<div class="itu-empty-results">No allocation periods recorded.</div>'}</div>`;
    prefixHistory.querySelectorAll(".itu-timeline-segment").forEach(button => button.addEventListener("click", () => {
      slider.value = button.dataset.start;
      allocationSearch.value = key;
      renderYear();
      document.querySelectorAll("[data-mode-link]").forEach(link => link.classList.toggle("selected", link.dataset.modeLink === "year"));
      $("by-year").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    if (updateHistory) updateUrl({ prefix: key });
  }

  allocationList.addEventListener("click", event => {
    const link = event.target.closest("[data-prefix]");
    if (!link) return;
    event.preventDefault();
    showPrefix(link.dataset.prefix);
    document.querySelectorAll("[data-mode-link]").forEach(a => a.classList.toggle("selected", a.dataset.modeLink === "prefix"));
    $("by-prefix").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  prefixSuggestions.addEventListener("click", event => {
    const button = event.target.closest("[data-prefix]");
    if (button) showPrefix(button.dataset.prefix);
  });
  slider.addEventListener("input", () => renderYear());
  yearSelect.addEventListener("change", () => { slider.value = yearSelect.value; renderYear(); });
  allocationSearch.addEventListener("input", () => renderYear(false));
  showMore.addEventListener("click", () => { visibleLimit += 40; renderAllocationRows(); });
  prefixSearch.addEventListener("input", renderSuggestions);
  prefixSearch.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); showPrefix(prefixSearch.value); }
  });
  prefixGo.addEventListener("click", () => showPrefix(prefixSearch.value));
  document.querySelectorAll("[data-mode-link]").forEach(link => link.addEventListener("click", () => {
    document.querySelectorAll("[data-mode-link]").forEach(item => item.classList.toggle("selected", item === link));
  }));

  Promise.all([
    fetch(ITU_URL).then(response => { if (!response.ok) throw new Error(`Could not load ITU data (${response.status}).`); return response.text(); }),
    fetch(ENTITY_URL).then(response => { if (!response.ok) throw new Error(`Could not load entity names (${response.status}).`); return response.text(); })
  ]).then(([ituText, entityText]) => {
    data = normaliseData(ituText, entityText);
    populateYears();
    const params = new URLSearchParams(location.search);
    const requestedYear = Number(params.get("year"));
    if (requestedYear >= data.years[0] && requestedYear <= data.years[data.years.length - 1]) slider.value = String(requestedYear);
    renderYear(false);
    const requestedPrefix = params.get("prefix");
    if (requestedPrefix) {
      showPrefix(requestedPrefix, false);
      document.querySelectorAll("[data-mode-link]").forEach(link => link.classList.toggle("selected", link.dataset.modeLink === "prefix"));
    }
  }).catch(error => {
    root.insertAdjacentHTML("afterbegin", `<p class="itu-load-error">The archive data could not be loaded. ${esc(error.message)} Check that both CSV files are present in <code>/assets/data/</code>.</p>`);
  });
})();
