/* SAGE AFL power rankings: projects/sage.html (styles: style.css, .sage-page; data: assets/data/sage.json) */
(() => {
'use strict';

const DATA_URL = '/assets/data/sage.json';
let data = null;
let selectedRoundContext = null; // { year, round, roundname } of the rankings currently shown

const $ = id => document.getElementById(id);

const esc = s => String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Signed number with a real minus sign, which screen readers announce as "minus"
function signed(v, d = 3) {
    return (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(d);
}

// ── Fetch ───────────────────────────────────────────────────────────────────
async function loadData() {
    const loading = $('loading');
    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(res.status);
        data = await res.json();
        loading.hidden = true;
        render();
        if (!$('panel-graph').hidden) showGraph();
    } catch (e) {
        loading.hidden = true;
        $('meta-block').textContent = '';
        $('rankings-grid').innerHTML = '<li class="empty" role="alert">Could not load data. Try refreshing.</li>';
        console.error(e);
    }
}

// ── Tabs (arrow keys move between tabs, Home/End jump) ──────────────────────
const tabs = [...document.querySelectorAll('.sage-page [role="tab"]')];

function selectTab(btn, focus) {
    tabs.forEach(t => {
        const on = t === btn;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        $('panel-' + t.dataset.panel).hidden = !on;
    });
    if (focus) btn.focus();
    if (btn.dataset.panel === 'graph' && data) showGraph();
}

$('tabs').addEventListener('click', e => {
    const btn = e.target.closest('[role="tab"]');
    if (btn) selectTab(btn, false);
});

$('tabs').addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    selectTab(next, true);
});

// ── Render ──────────────────────────────────────────────────────────────────
function render() {
    renderMeta();
    if (data.current_round) {
        selectedRoundContext = {
            year: data.current_round.year,
            roundname: data.current_round.roundname,
            round: data.current_round.round
        };
    }
    renderRankings(data.power_rankings);
    renderPredictions(data.predictions || []);
    renderResults(data.game_records || []);
    initRankingsSelector();
    initResultsYearFilter();
}

function renderMeta() {
    const cr = data.current_round;
    const gen = new Date(data.generated);
    const fmt = gen.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    $('meta-block').innerHTML =
        (cr ? `<strong>${esc(cr.roundname)}, ${cr.year}</strong><br>` : '') +
        `Updated ${fmt}`;
}

// ── Power rankings ──────────────────────────────────────────────────────────
function renderRankings(rankings) {
    const grid = $('rankings-grid');
    if (!rankings || !rankings.length) {
        grid.innerHTML = '<li class="empty">No data.</li>';
        return;
    }
    const maxAbs = Math.max(...rankings.map(r => Math.abs(r.rating)), 0.01);
    grid.innerHTML = rankings.map((r, i) => {
        const pct = Math.abs(r.rating) / maxAbs * 100;
        const isNeg = r.rating < 0;
        return `
      <li>
        <button type="button" class="rank-card" style="animation-delay:${i * 30}ms"
                data-team="${esc(r.team)}" data-rank="${r.rank}" data-rating="${r.rating}" aria-haspopup="dialog">
          <span class="rank-num ${r.rank <= 3 ? 'top3' : ''}">${r.rank}</span>
          <span class="rank-main">
            <span class="rank-team">${esc(r.team)}</span>
            <span class="rank-bar-bg" aria-hidden="true"><span class="rank-bar-fill ${isNeg ? 'negative' : ''}" style="width:${pct}%"></span></span>
          </span>
          <span class="rank-rating ${isNeg ? 'neg' : 'pos'}">${signed(r.rating)}</span>
        </button>
      </li>`;
    }).join('');
}

$('rankings-grid').addEventListener('click', e => {
    const btn = e.target.closest('.rank-card');
    if (btn) openTeamPopup(btn.dataset.team, Number(btn.dataset.rank), Number(btn.dataset.rating));
});

function initRankingsSelector() {
    const yearSel = $('rankings-year-select');
    const roundSel = $('rankings-round-select');
    const rounds = data.ratings_by_round || [];
    let yearRounds = [];

    const years = [...new Set(rounds.map(r => r.year))].sort((a, b) => b - a);
    yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    const currentYear = data.current_round ? data.current_round.year : years[0];
    if (currentYear !== undefined) yearSel.value = currentYear;

    function applyRoundSelection() {
        const r = yearRounds[Number(roundSel.value)];
        if (!r) return;
        selectedRoundContext = { year: r.year, roundname: r.roundname, round: r.round ?? null };
        const ranked = Object.entries(r.ratings)
            .sort((a, b) => b[1] - a[1])
            .map(([team, rating], i) => ({ rank: i + 1, team, rating }));
        $('rankings-label').textContent = `SAGE Ratings \u2014 ${r.roundname} ${r.year}`;
        renderRankings(ranked);
    }

    function populateRounds(year) {
        yearRounds = rounds.filter(r => r.year === parseInt(year)).reverse();
        roundSel.innerHTML = yearRounds.map((r, i) => `<option value="${i}">${esc(r.roundname)}</option>`).join('');
        roundSel.value = '0';
        applyRoundSelection();
    }

    yearSel.addEventListener('change', () => populateRounds(yearSel.value));
    roundSel.addEventListener('change', applyRoundSelection);
    populateRounds(currentYear);
}

// ── Predictions ─────────────────────────────────────────────────────────────
function confClass(pct) {
    if (pct >= 65) return 'high';
    if (pct >= 52) return 'mid';
    return 'low';
}

function fv(v) {
    if (v === undefined || v === null) return '—';
    return `<span class="val ${v >= 0 ? 'pos' : 'neg'}">${signed(v)}</span>`;
}

function restLabel(rest) {
    return rest ? ` Rest ${fv(rest)}` : '';
}

function renderPredictions(preds) {
    const el = $('predictions-list');
    if (!preds.length) {
        el.innerHTML = '<p class="empty">No upcoming matches in data. Check back after the next update.</p>';
        return;
    }

    const byRound = {};
    preds.forEach(p => {
        const key = `${p.year}__${p.round}`;
        if (!byRound[key]) byRound[key] = { roundname: p.roundname, year: p.year, games: [] };
        byRound[key].games.push(p);
    });

    let html = '';
    let i = 0;
    for (const key of Object.keys(byRound)) {
        const rnd = byRound[key];
        html += `<h3 class="section-label round-label">${esc(rnd.roundname)} ${rnd.year}</h3>`;
        rnd.games.forEach(p => {
            const hFav = p.h_pred >= p.a_pred;
            const date = p.date ? new Date(p.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
            const time = p.date ? new Date(p.date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '';
            const mathId = `math-${i}`;
            const hasMath = p.h_output !== undefined;

            let mathHtml = '';
            if (hasMath) {
                mathHtml = `
          <div class="pred-math" id="${mathId}" hidden>
            <div class="pred-math-inner">
              <div class="math-team-block">
                <div class="math-team-name">${esc(p.hteam)}</div>
                <div class="math-line">SAGE ${fv(p.h_rating)} R11 ${fv(p.h_r11)} V11 ${fv(p.h_v11)}${restLabel(p.h_rest)}</div>
                <div class="math-line">Output = <span class="eq">${fv(p.h_output)}</span></div>
                <div class="math-line">SF = 1 + tanh((${p.a_output?.toFixed(3)} \u2212 ${p.h_output?.toFixed(3)}) / 30)</div>
                <div class="math-line">SF = <span class="eq">${p.h_sf?.toFixed(3)}</span></div>
                <div class="math-result">1 \u2212 (${p.h_sf?.toFixed(3)} / 2) = ${p.h_pred.toFixed(1)}%</div>
              </div>
              <div class="math-team-block">
                <div class="math-team-name">${esc(p.ateam)}</div>
                <div class="math-line">SAGE ${fv(p.a_rating)} R11 ${fv(p.a_r11)} V11 ${fv(p.a_v11)}${restLabel(p.a_rest)}</div>
                <div class="math-line">Output = <span class="eq">${fv(p.a_output)}</span></div>
                <div class="math-line">SF = 1 + tanh((${p.h_output?.toFixed(3)} \u2212 ${p.a_output?.toFixed(3)}) / 30)</div>
                <div class="math-line">SF = <span class="eq">${p.a_sf?.toFixed(3)}</span></div>
                <div class="math-result">1 \u2212 (${p.a_sf?.toFixed(3)} / 2) = ${p.a_pred.toFixed(1)}%</div>
              </div>
            </div>
          </div>`;
            }

            html += `
        <article class="pred-card" style="animation-delay:${i * 40}ms" aria-label="${esc(p.hteam)} versus ${esc(p.ateam)}">
          <p class="pred-meta">
            <span>${date} ${time}</span>
            <span>${esc(p.venue || '')}</span>
          </p>
          <div class="pred-matchup">
            <div>
              <div class="pred-team home ${hFav ? 'fav' : ''}">${esc(p.hteam)}${hFav ? '<span class="sr-only"> (favourite)</span>' : ''}</div>
              <div class="pred-conf home ${confClass(p.h_pred)}"><strong>${p.h_pred.toFixed(1)}%</strong><span class="sr-only"> confidence</span></div>
            </div>
            <div class="pred-vs">vs</div>
            <div>
              <div class="pred-team away ${!hFav ? 'fav' : ''}">${esc(p.ateam)}${!hFav ? '<span class="sr-only"> (favourite)</span>' : ''}</div>
              <div class="pred-conf away ${confClass(p.a_pred)}"><strong>${p.a_pred.toFixed(1)}%</strong><span class="sr-only"> confidence</span></div>
            </div>
          </div>
          <div class="pred-bar" aria-hidden="true">
            <div class="pred-bar-h" style="width:${p.h_pred}%"></div>
            <div class="pred-bar-a"></div>
          </div>
          ${hasMath ? `<button type="button" class="pred-math-toggle" aria-expanded="false" aria-controls="${mathId}"><span class="arrow" aria-hidden="true">▶</span> <span class="label">Show working</span></button>` : ''}
          ${mathHtml}
        </article>`;
            i++;
        });
    }
    el.innerHTML = html;
}

$('predictions-list').addEventListener('click', e => {
    const btn = e.target.closest('.pred-math-toggle');
    if (!btn) return;
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !open);
    $(btn.getAttribute('aria-controls')).hidden = open;
    btn.querySelector('.label').textContent = open ? 'Show working' : 'Hide working';
});

// ── Results ─────────────────────────────────────────────────────────────────
const SVG_TICK = `<svg class="tip-svg tip-ok" viewBox="0 0 18 18" role="img" aria-label="Correct tip" focusable="false">
  <circle cx="9" cy="9" r="8.5"/>
  <polyline points="4.5,9.5 7.5,12.5 13.5,6" stroke="#0d0f12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

const SVG_CROSS = `<svg class="tip-svg tip-bad" viewBox="0 0 18 18" role="img" aria-label="Incorrect tip" focusable="false">
  <circle cx="9" cy="9" r="8.5"/>
  <line x1="5.5" y1="5.5" x2="12.5" y2="12.5" stroke="#0d0f12" stroke-width="2" stroke-linecap="round"/>
  <line x1="12.5" y1="5.5" x2="5.5" y2="12.5" stroke="#0d0f12" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const SVG_DASH = `<svg class="tip-svg tip-none" viewBox="0 0 18 18" role="img" aria-label="No tip" focusable="false">
  <circle cx="9" cy="9" r="8.5"/>
  <line x1="5" y1="9" x2="13" y2="9" stroke="#444" stroke-width="2" stroke-linecap="round"/>
</svg>`;

function getTipResult(g) {
    const hp = g.h_pred ?? 50;
    const ap = g.a_pred ?? 50;
    const isDraw = g.hscore === g.ascore;
    const hWon = g.hscore > g.ascore;

    if (hp === ap) return { tipped: null, correct: isDraw };
    const tipped = hp > ap ? g.hteam : g.ateam;
    const tippedWon = hp > ap ? hWon : !hWon && !isDraw;
    return { tipped, correct: tippedWon && !isDraw };
}

function initResultsYearFilter() {
    const sel = $('results-year-select');
    const years = [...new Set((data.game_records || []).map(g => g.year))].sort((a, b) => b - a);
    sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    sel.value = data.current_round ? data.current_round.year : years[0];
    sel.addEventListener('change', () => renderResults(data.game_records || []));
}

function deltaCell(v) {
    if (v === undefined || v === null) return '<td class="delta-pos">—</td>';
    return `<td class="${v >= 0 ? 'delta-pos' : 'delta-neg'}">${signed(v)}</td>`;
}

function renderResults(records) {
    const tbody = $('results-body');
    const selectedYear = parseInt($('results-year-select').value) || null;

    const filtered = [...records]
        .filter(g => !selectedYear || g.year === selectedYear)
        .reverse();

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty">No data.</td></tr>';
        $('tips-summary').textContent = '';
        return;
    }

    let correct = 0, total = 0, noTip = 0;
    filtered.forEach(g => {
        const { tipped, correct: c } = getTipResult(g);
        if (tipped === null) { noTip++; return; }
        total++;
        if (c) correct++;
    });
    const pct = total > 0 ? ((correct / total) * 100).toFixed(1) : '—';
    $('tips-summary').textContent =
        `${correct}/${total} correct (${pct}%)${noTip > 0 ? ' \u00b7 ' + noTip + ' no tip' : ''}`;

    tbody.innerHTML = filtered.map(g => {
        const hWon = g.hscore > g.ascore;
        const aWon = g.ascore > g.hscore;
        const { tipped, correct: tipCorrect } = getTipResult(g);
        const tipIcon = tipped === null ? SVG_DASH : (tipCorrect ? SVG_TICK : SVG_CROSS);
        const date = g.date ? new Date(g.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—';
        const won = '<span class="sr-only"> (won)</span>';

        return `
      <tr>
        <td class="num">${esc(g.roundname || 'R' + g.round)}</td>
        <td class="dv">${date}<br>${esc(g.venue || '')}</td>
        <td class="team-name ${hWon ? 'winner' : ''}">${esc(g.hteam)}${hWon ? won : ''}</td>
        <td class="num">${g.hscore}</td>
        ${deltaCell(g.h_delta)}
        <td class="num">${g.h_pred?.toFixed(1) ?? '—'}%</td>
        <td class="tip-result">${tipIcon}</td>
        <td class="num">${g.a_pred?.toFixed(1) ?? '—'}%</td>
        ${deltaCell(g.a_delta)}
        <td class="num">${g.ascore}</td>
        <td class="team-name ${aWon ? 'winner' : ''}">${esc(g.ateam)}${aWon ? won : ''}</td>
      </tr>`;
    }).join('');
}

// ── Team popup (native <dialog>: focus trap, Escape and focus return built in) ──
const popup = $('team-popup');

function openTeamPopup(team, rank, rating) {
    const ctx = selectedRoundContext || data.current_round || {};
    const ctxYear = ctx.year || new Date().getFullYear();
    const ctxRound = ctx.round;

    const eligibleGames = (data.game_records || []).filter(g =>
        (g.hteam === team || g.ateam === team) &&
        (g.year < ctxYear || (g.year === ctxYear && (ctxRound === null || ctxRound === undefined || g.round <= ctxRound)))
    );
    const lastGame = eligibleGames.length ? eligibleGames[eligibleGames.length - 1] : null;

    let statsHtml = `<dl class="popup-stats">
    <div class="popup-stat"><dt>SAGE Rating</dt><dd class="${rating >= 0 ? 'pos' : 'neg'}">${signed(rating, 4)}</dd></div>`;

    if (lastGame) {
        const isHome = lastGame.hteam === team;
        const opponent = isHome ? lastGame.ateam : lastGame.hteam;
        const delta = isHome ? lastGame.h_delta : lastGame.a_delta;
        const own = isHome ? lastGame.hscore : lastGame.ascore;
        const opp = isHome ? lastGame.ascore : lastGame.hscore;
        const result = own > opp ? 'W' : own < opp ? 'L' : 'D';

        statsHtml += `
    <div class="popup-stat"><dt>Last game</dt><dd>${result} vs ${esc(opponent)} &nbsp;${own} \u2013 ${opp}</dd></div>
    <div class="popup-stat"><dt>Round</dt><dd>${esc(lastGame.roundname)}</dd></div>
  </dl>`;

        const om = isHome ? lastGame.h_outcome_multiple : lastGame.a_outcome_multiple;
        const mc = isHome ? lastGame.h_margin_component : lastGame.a_margin_component;
        const cb = isHome ? lastGame.h_century : lastGame.a_century;
        const tb = isHome ? lastGame.h_travel : lastGame.a_travel;
        const sf = isHome ? lastGame.h_sf : lastGame.a_sf;

        const dv = v => {
            if (v === undefined || v === null) return '<dd>—</dd>';
            return `<dd class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${signed(v, 4)}</dd>`;
        };

        if (om !== undefined) {
            statsHtml += `
  <div class="delta-breakdown">
    <h3>Δ breakdown</h3>
    <dl class="delta-rows">
      <div class="delta-row"><dt>SF (${sf?.toFixed(4) ?? '—'}) \u00d7 outcome</dt>${dv(om)}</div>
      <div class="delta-row"><dt>Margin / 60</dt>${dv(mc)}</div>
      <div class="delta-row"><dt>Century bonus</dt>${dv(cb)}</div>
      <div class="delta-row"><dt>Travel bonus</dt>${dv(tb)}</div>
      <div class="delta-row total"><dt>Total Δ</dt>${dv(delta)}</div>
    </dl>
  </div>`;
        } else {
            statsHtml = statsHtml.replace('</dl>', `<div class="popup-stat"><dt>Last Δ</dt>${dv(delta)}</div></dl>`);
        }
    } else {
        statsHtml += '</dl>';
    }

    $('popup-team').textContent = team;
    $('popup-rank').textContent = `Rank ${rank} \u00b7 ${ctx.roundname || ''} ${ctxYear}`;
    $('popup-stats').innerHTML = statsHtml;

    if (typeof popup.showModal === 'function') popup.showModal();
    else popup.setAttribute('open', '');
}

$('popup-close').addEventListener('click', () => popup.close());

// Close on a click on the backdrop, but not in the dialog's own padding
popup.addEventListener('click', e => {
    if (e.target !== popup) return;
    const r = popup.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) popup.close();
});

// ── Season graph ────────────────────────────────────────────────────────────
// Colours are the brightened versions, because the graph keeps its dark background
const TEAM_COLOURS = {
    'Adelaide':               '#4a7abf',
    'Brisbane Lions':         '#e0507a',
    'Carlton':                '#5588cc',
    'Collingwood':            '#c8c8c8',
    'Essendon':               '#e85555',
    'Fremantle':              '#7a70d0',
    'Geelong':                '#5588bb',
    'Gold Coast':             '#f07070',
    'Greater Western Sydney': '#f08050',
    'Hawthorn':               '#d4a030',
    'Melbourne':              '#cc4444',
    'North Melbourne':        '#4488bb',
    'Port Adelaide':          '#30b8d0',
    'Richmond':               '#e8cc00',
    'St Kilda':               '#e85555',
    'Sydney':                 '#e83355',
    'West Coast':             '#4466cc',
    'Western Bulldogs':       '#4488dd'
};

const ALL_TEAMS_LIST = Object.keys(TEAM_COLOURS);
const PAD = { top: 20, right: 20, bottom: 36, left: 48 };

let graphYear = null;
let activeTeams = new Set();
let highlightedTeam = null;
let graphRounds = [];
let graphInited = false;
let graphHoverX = null;

function showGraph() {
    if (!graphInited) initGraph();
    drawGraph();
}

function getTop8(year) {
    const yearRounds = (data.ratings_by_round || []).filter(r => r.year === year);
    if (!yearRounds.length) return (data.power_rankings || []).slice(0, 8).map(r => r.team);
    const last = yearRounds[yearRounds.length - 1];
    return Object.entries(last.ratings)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([t]) => t);
}

function initGraph() {
    graphInited = true;
    const slider = $('year-slider');

    const years = [...new Set((data.ratings_by_round || []).map(r => r.year))].sort();
    if (years.length) {
        slider.min = years[0];
        slider.max = years[years.length - 1];
        slider.value = years[years.length - 1];
    }
    $('year-display').textContent = slider.value;

    slider.addEventListener('input', () => {
        $('year-display').textContent = slider.value;
        loadGraphYear(parseInt(slider.value));
    });

    $('btn-all-on').addEventListener('click', () => {
        ALL_TEAMS_LIST.forEach(t => activeTeams.add(t));
        refreshGraph();
    });
    $('btn-all-off').addEventListener('click', () => {
        activeTeams.clear();
        refreshGraph();
    });
    $('btn-top8').addEventListener('click', () => {
        activeTeams.clear();
        getTop8(graphYear || parseInt(slider.value)).forEach(t => activeTeams.add(t));
        refreshGraph();
    });

    buildToggles();
    buildHighlightSelect();
    setupCanvasEvents();
    $('graph-data').addEventListener('toggle', renderGraphTable);

    getTop8(parseInt(slider.value)).forEach(t => activeTeams.add(t));
    loadGraphYear(parseInt(slider.value));
}

function loadGraphYear(year) {
    graphYear = year;
    graphRounds = (data.ratings_by_round || []).filter(r => r.year === year);
    highlightedTeam = null;
    graphHoverX = null;
    refreshGraph();
}

function refreshGraph() {
    updateToggles();
    renderGraphTable();
    drawGraph();
}

function buildToggles() {
    const wrap = $('team-toggles');
    wrap.innerHTML = ALL_TEAMS_LIST.map(team =>
        `<button type="button" class="team-toggle" data-team="${esc(team)}" aria-pressed="false">` +
        `<span class="sw" style="background:${TEAM_COLOURS[team]}" aria-hidden="true"></span>${esc(team)}</button>`
    ).join('');

    wrap.addEventListener('click', e => {
        const btn = e.target.closest('.team-toggle');
        if (!btn) return;
        const team = btn.dataset.team;
        if (e.shiftKey || e.metaKey) {
            highlightedTeam = highlightedTeam === team ? null : team;
            if (highlightedTeam) activeTeams.add(team);
        } else if (activeTeams.has(team)) {
            activeTeams.delete(team);
            if (highlightedTeam === team) highlightedTeam = null;
        } else {
            activeTeams.add(team);
        }
        refreshGraph();
    });
}

function buildHighlightSelect() {
    const sel = $('highlight-select');
    sel.innerHTML = '<option value="">None</option>' +
        ALL_TEAMS_LIST.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    sel.addEventListener('change', () => {
        highlightedTeam = sel.value || null;
        if (highlightedTeam) activeTeams.add(highlightedTeam);
        refreshGraph();
    });
}

function updateToggles() {
    document.querySelectorAll('.team-toggle').forEach(btn => {
        const team = btn.dataset.team;
        btn.setAttribute('aria-pressed', activeTeams.has(team));
        btn.classList.toggle('highlighted', highlightedTeam === team);
    });
    $('highlight-select').value = highlightedTeam || '';
}

function roundLabel(r) {
    return r.roundname || 'Round ' + r.round;
}

// Text equivalent of the canvas, shown inside the "View graph data as a table" disclosure
function renderGraphTable() {
    const details = $('graph-data');
    if (!details.open) return;
    const teams = ALL_TEAMS_LIST.filter(t => activeTeams.has(t));
    $('graph-table-caption').textContent = `SAGE ratings by round, ${graphYear}`;

    if (!teams.length || !graphRounds.length) {
        $('graph-table-head').innerHTML = '';
        $('graph-table-body').innerHTML = '<tr><td class="empty">No teams selected or no data for this season.</td></tr>';
        return;
    }
    $('graph-table-head').innerHTML =
        '<tr><th scope="col">Round</th>' + teams.map(t => `<th scope="col" class="num">${esc(t)}</th>`).join('') + '</tr>';
    $('graph-table-body').innerHTML = graphRounds.map(r =>
        `<tr><th scope="row">${esc(roundLabel(r))}</th>` +
        teams.map(t => {
            const v = r.ratings[t];
            return `<td class="num">${v === undefined ? '—' : signed(v)}</td>`;
        }).join('') + '</tr>'
    ).join('');
}

function drawGraph() {
    const canvas = $('sage-graph');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    canvas.setAttribute('aria-label',
        `SAGE ratings graph for ${graphYear}: ${activeTeams.size} teams shown over ${graphRounds.length} rounds`);

    ctx.clearRect(0, 0, W, H);

    if (!graphRounds.length) {
        ctx.fillStyle = '#9aa3b2';
        ctx.font = '13px "Atkinson Hyperlegible Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No data for this season', W / 2, H / 2);
        return;
    }

    let yMin = Infinity, yMax = -Infinity;
    graphRounds.forEach(r => {
        ALL_TEAMS_LIST.forEach(team => {
            if (!activeTeams.has(team)) return;
            const v = r.ratings[team];
            if (v !== undefined) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
        });
    });
    if (!isFinite(yMin)) { yMin = -5; yMax = 5; }
    const pad = (yMax - yMin) * 0.12 || 1;
    yMin -= pad; yMax += pad;

    const xScale = i => PAD.left + (i / (graphRounds.length - 1 || 1)) * plotW;
    const yScale = v => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    const gridCount = 5;
    ctx.strokeStyle = '#1e2229';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridCount; i++) {
        const v = yMin + (yMax - yMin) * (i / gridCount);
        const y = yScale(v);
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + plotW, y);
        ctx.stroke();
        ctx.fillStyle = '#9aa3b2';
        ctx.font = '11px "Atkinson Hyperlegible Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(v.toFixed(1), PAD.left - 6, y + 4);
    }

    if (yMin < 0 && yMax > 0) {
        const y0 = yScale(0);
        ctx.strokeStyle = '#6b7280';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PAD.left, y0);
        ctx.lineTo(PAD.left + plotW, y0);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    const step = Math.ceil(graphRounds.length / 8);
    graphRounds.forEach((r, i) => {
        if (i % step !== 0 && i !== graphRounds.length - 1) return;
        ctx.fillStyle = '#9aa3b2';
        ctx.font = '11px "Atkinson Hyperlegible Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`R${r.round}`, xScale(i), H - PAD.bottom + 16);
    });

    const drawTeam = (team, alpha, lineWidth) => {
        ctx.strokeStyle = TEAM_COLOURS[team] || '#aaa';
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        graphRounds.forEach((r, i) => {
            const v = r.ratings[team];
            if (v === undefined) return;
            if (!started) { ctx.moveTo(xScale(i), yScale(v)); started = true; }
            else ctx.lineTo(xScale(i), yScale(v));
        });
        if (started) ctx.stroke();
        ctx.globalAlpha = 1;
    };

    activeTeams.forEach(team => {
        if (team === highlightedTeam) return;
        drawTeam(team, highlightedTeam ? 0.15 : 0.7, 1.5);
    });

    if (highlightedTeam && activeTeams.has(highlightedTeam)) {
        drawTeam(highlightedTeam, 1, 2.5);
        const last = graphRounds[graphRounds.length - 1];
        const v = last?.ratings[highlightedTeam];
        if (v !== undefined) {
            ctx.fillStyle = TEAM_COLOURS[highlightedTeam] || '#aaa';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(highlightedTeam, xScale(graphRounds.length - 1) - 6, yScale(v) - 8);
        }
    }

    if (graphHoverX !== null) {
        const hx = xScale(graphHoverX);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(hx, PAD.top);
        ctx.lineTo(hx, PAD.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// Pointer and keyboard inspection of a round
function setupCanvasEvents() {
    const canvas = $('sage-graph');
    const tooltip = $('graph-tooltip');

    function showAt(idx, px, py, announce) {
        const round = graphRounds[idx];
        if (!round) return;
        const rect = canvas.getBoundingClientRect();
        graphHoverX = idx;
        drawGraph();

        $('tooltip-round').textContent = `${roundLabel(round)} \u00b7 ${graphYear}`;
        const rows = ALL_TEAMS_LIST
            .filter(t => activeTeams.has(t))
            .map(t => ({ team: t, val: round.ratings[t] ?? null }))
            .filter(r => r.val !== null)
            .sort((a, b) => b.val - a.val);

        $('tooltip-rows').innerHTML = rows.map(r =>
            `<div class="tooltip-row" style="opacity:${r.team === highlightedTeam ? 1 : 0.85}">
        <span class="t-name">${esc(r.team)}</span>
        <span class="t-val ${r.val >= 0 ? 'pos' : 'neg'}">${signed(r.val)}</span>
      </div>`
        ).join('');

        const tw = 200, th = 40 + rows.length * 20;
        let tx = px + 14;
        let ty = py - 20;
        if (tx + tw > rect.width) tx = px - tw - 14;
        if (ty + th > rect.height) ty = rect.height - th - 10;
        tooltip.style.left = Math.max(4, tx) + 'px';
        tooltip.style.top = Math.max(4, ty) + 'px';
        tooltip.classList.add('visible');

        if (announce) {
            $('graph-live').textContent = rows.length
                ? `${roundLabel(round)} ${graphYear}: ` + rows.map(r => `${r.team} ${signed(r.val)}`).join(', ')
                : `${roundLabel(round)} ${graphYear}: no teams selected`;
        }
    }

    function hide() {
        tooltip.classList.remove('visible');
        graphHoverX = null;
        drawGraph();
    }

    canvas.addEventListener('pointermove', e => {
        if (!graphRounds.length) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const plotW = rect.width - PAD.left - PAD.right;
        const frac = Math.max(0, Math.min(1, (x - PAD.left) / plotW));
        showAt(Math.round(frac * (graphRounds.length - 1)), x, e.clientY - rect.top, false);
    });

    canvas.addEventListener('pointerleave', hide);
    canvas.addEventListener('blur', hide);

    canvas.addEventListener('keydown', e => {
        const n = graphRounds.length;
        if (!n) return;
        let idx = graphHoverX ?? n - 1;
        if (e.key === 'ArrowRight') idx = Math.min(n - 1, idx + 1);
        else if (e.key === 'ArrowLeft') idx = Math.max(0, idx - 1);
        else if (e.key === 'Home') idx = 0;
        else if (e.key === 'End') idx = n - 1;
        else return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const plotW = rect.width - PAD.left - PAD.right;
        showAt(idx, PAD.left + (idx / (n - 1 || 1)) * plotW, PAD.top + 20, true);
    });

    window.addEventListener('resize', () => {
        if (!$('panel-graph').hidden) drawGraph();
    });
}

loadData();
})();
