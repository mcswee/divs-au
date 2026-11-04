/* SAGE AFL power rankings: afl.html (styles: assets/css/sage.css; data: assets/data/sage.json) */
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

    // Value blocks: a dark block with lime (positive / favourite) or orange (negative / underdog) text.
    const tone = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
    const chip = (text, kind = '') => `<span class="chip${kind ? ' ' + kind : ''}">${text}</span>`;
    const signedChip = (v, d = 3) => chip(signed(v, d), tone(v));

    // Squiggle dates are the local time at the ground ("2026-09-26 14:30:00"). Safari won't read the
    // space, so it becomes a T, and the result is shown as the same wall-clock time.
    const parseLocal = s => new Date(String(s).replace(' ', 'T'));

    // One line of "working": a label, a plain-English explanation, and the value as a block
    const workingRow = (label, calc, valueHtml, extra = '') =>
        `<li class="working-row${extra ? ' ' + extra : ''}"><span class="working-text"><span class="working-label">${esc(label)}</span><span class="working-calc">${esc(calc)}</span></span>${valueHtml}</li>`;

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
        initResultsYearFilter();            // sets the year first, then draws the results for it
        initRankingsSelector();
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
          <span class="rank-num">${r.rank}</span>
          <span class="rank-main">
            <span class="rank-team">${esc(r.team)}</span>
            <span class="rank-bar-bg" aria-hidden="true"><span class="rank-bar-fill ${isNeg ? 'negative' : ''}" style="width:${pct / 2}%"></span></span>
          </span>
          ${signedChip(r.rating)}
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
    // The two teams' working: SAGE rating + head-to-head + venue record (+ short break) = team output,
    // then the surprise factor and the chance of winning that follow from it.
    function workingTeam(p, side) {
        const other = side === 'h' ? 'a' : 'h';
        const own = side === 'h' ? p.hteam : p.ateam;
        const opp = side === 'h' ? p.ateam : p.hteam;
        const f = key => p[`${side}_${key}`];
        const fmt = v => v.toFixed(3).replace('-', '\u2212');
        const rows = [
            workingRow('SAGE rating', `${own}'s rating so far this season`, signedChip(f('rating'))),
            workingRow('Head-to-head', `Average result of the last 11 games against ${opp}`, signedChip(f('r11'))),
            workingRow('Venue record', `Average result of the last 11 games at ${p.venue}`, signedChip(f('v11')))
        ];
        if (f('rest')) rows.push(workingRow('Short break', 'Fewer than 7 days since their last game', signedChip(f('rest'))));
        rows.push(workingRow('Team output', 'The rows above added together', signedChip(f('output')), 'total'));
        rows.push(workingRow('Surprise factor', `1 + tanh((${fmt(p[`${other}_output`])} \u2212 ${fmt(f('output'))}) \u00f7 30)`.replace('\u2212 \u2212', '+ '), chip(f('sf').toFixed(3))));
        const pct = f('pred');
        const opponentPct = p[`${other}_pred`];
        rows.push(workingRow('Chance to win', `1 \u2212 (${f('sf').toFixed(3)} \u00f7 2)`, chip(`${pct.toFixed(1)}%`, pct > opponentPct ? 'pos' : pct < opponentPct ? 'neg' : '')));
        return `<section class="working-team"><h4>${esc(own)}</h4><ul class="working-list">${rows.join('')}</ul></section>`;
    }

    function predictionCard(p) {
        const hFav = p.h_pred > p.a_pred;
        const aFav = p.a_pred > p.h_pred;
        const when = p.date ? parseLocal(p.date) : null;
        const day = when ? when.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
        const time = when ? when.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '';
        const team = (name, pct, fav, underdog) =>
            `<li class="pred-team${fav ? ' fav' : ''}"><span class="pred-name">${esc(name)}${fav ? '<span class="sr-only"> (favourite)</span>' : ''}</span>${chip(`${pct.toFixed(1)}%`, fav ? 'pos' : underdog ? 'neg' : '')}</li>`;
        const homeBar = hFav ? 'bar-lime' : aFav ? 'bar-orange' : 'bar-grey';
        const awayBar = aFav ? 'bar-lime' : hFav ? 'bar-orange' : 'bar-grey';
        const working = p.h_output !== undefined
            ? `<details class="pred-working"><summary>Show working</summary><div class="working-teams">${workingTeam(p, 'h')}${workingTeam(p, 'a')}</div></details>`
            : '';
        return `
      <li class="pred-card">
        <div class="pred-head">
          <p class="pred-when"><strong>${esc(day)}${time ? `, ${esc(time)}` : ''}</strong>${esc(p.venue || '')}</p>
          <span class="pred-chance-head">Win chance</span>
        </div>
        <ul class="pred-teams">${team(p.hteam, p.h_pred, hFav, aFav)}${team(p.ateam, p.a_pred, aFav, hFav)}</ul>
        <div class="pred-bar" aria-hidden="true"><div class="pred-bar-home ${homeBar}" style="width:${p.h_pred}%"></div><div class="pred-bar-away ${awayBar}"></div></div>
        ${working}
      </li>`;
    }

    function renderPredictions(preds) {
        const el = $('predictions-list');
        if (!preds.length) {
            el.innerHTML = '<p class="empty">No upcoming matches in data. Check back after the next update.</p>';
            return;
        }
        const byRound = new Map();
        preds.forEach(p => {
            const key = `${p.year}__${p.round}`;
            if (!byRound.has(key)) byRound.set(key, { roundname: p.roundname, year: p.year, games: [] });
            byRound.get(key).games.push(p);
        });
        // Each round is a collapsible bar; the first one starts open
        el.innerHTML = [...byRound.values()].map((rnd, i) => `
      <details class="pred-round"${i === 0 ? ' open' : ''}>
        <summary><h3>${esc(rnd.roundname)}, ${rnd.year}</h3><span class="pred-round-count">${rnd.games.length} ${rnd.games.length === 1 ? 'match' : 'matches'}</span></summary>
        <ul class="pred-list">${rnd.games.map(predictionCard).join('')}</ul>
      </details>`).join('');
    }



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
        renderResults(data.game_records || []);
    }

    function resultRow(g) {
        const hWon = g.hscore > g.ascore;
        const aWon = g.ascore > g.hscore;
        const { tipped, correct } = getTipResult(g);
        const icon = tipped === null ? SVG_DASH : (correct ? SVG_TICK : SVG_CROSS);
        const when = g.date ? parseLocal(g.date) : null;
        const day = when ? when.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
        const won = '<span class="sr-only"> (won)</span>';
        const delta = (name, v) => v == null ? '<span></span>' : `<span class="sr-only">${esc(name)} rating change </span>${signedChip(v)}`;
        const chance = Math.max(g.h_pred ?? 50, g.a_pred ?? 50);
        return `
      <li class="result-row">
        <div class="result-when"><strong>${esc(g.roundname || 'Round ' + g.round)}</strong>${esc(day)}${g.venue ? ` \u00b7 ${esc(g.venue)}` : ''}</div>
        <div class="result-match">
          <span class="result-team home${hWon ? ' won' : ''}">${esc(g.hteam)}${hWon ? won : ''}</span>
          <span class="result-score"><span class="${hWon ? 'won' : ''}">${g.hscore}</span><span aria-hidden="true">\u2013</span><span class="sr-only"> to </span><span class="${aWon ? 'won' : ''}">${g.ascore}</span></span>
          <span class="result-team away${aWon ? ' won' : ''}">${esc(g.ateam)}${aWon ? won : ''}</span>
          <span class="result-delta home">${delta(g.hteam, g.h_delta)}</span>
          <span aria-hidden="true"></span>
          <span class="result-delta away">${delta(g.ateam, g.a_delta)}</span>
        </div>
        <div class="result-tip">${icon}<span class="result-tip-text"><span class="tip-label">${tipped ? `Tipped ${esc(tipped)}` : 'No tip'}</span><span class="tip-chance">${tipped ? `${chance.toFixed(1)}% chance` : 'Even chance'}</span></span></div>
      </li>`;
    }

    function renderResults(records) {
        const list = $('results-list');
        const selectedYear = parseInt($('results-year-select').value) || null;

        // Newest first
        const filtered = [...records]
            .filter(g => !selectedYear || g.year === selectedYear)
            .reverse();

        if (!filtered.length) {
            list.innerHTML = '<li class="empty">No data.</li>';
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
        const pct = total > 0 ? ((correct / total) * 100).toFixed(1) : '\u2014';
        $('tips-summary').textContent =
            `Tipped ${correct} of ${total} correctly (${pct}%)${noTip > 0 ? `, ${noTip} with no tip` : ''}`;

        list.innerHTML = filtered.map(resultRow).join('');
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

        let html = `<div class="popup-rating"><span>SAGE rating</span>${signedChip(rating)}</div>`;

        if (lastGame) {
            const g = lastGame;
            const isHome = g.hteam === team;
            const opponent = isHome ? g.ateam : g.hteam;
            const own = isHome ? g.hscore : g.ascore;
            const opp = isHome ? g.ascore : g.hscore;
            const margin = own - opp;
            const verb = own > opp ? 'Won' : own < opp ? 'Lost' : 'Drew';
            const link = own > opp ? 'against' : own < opp ? 'to' : 'with';
            const when = g.date ? parseLocal(g.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            const delta = isHome ? g.h_delta : g.a_delta;
            const om = isHome ? g.h_outcome_multiple : g.a_outcome_multiple;
            const mc = isHome ? g.h_margin_component : g.a_margin_component;
            const cb = isHome ? g.h_century : g.a_century;
            const tb = isHome ? g.h_travel : g.a_travel;
            const sf = isHome ? g.h_sf : g.a_sf;

            html += `<section class="popup-last"><h3>Last game</h3>
          <p class="popup-last-result">${verb} ${own}\u2013${opp} ${link} ${esc(opponent)}<span>${esc(g.roundname)}${when ? `, ${esc(when)}` : ''}</span></p>`;

            if (om !== undefined) {
                const outcome = own > opp ? 'won (+1)' : own < opp ? 'lost (\u22121)' : 'drew (0)';
                html += `<ul class="working-list">
              ${workingRow('Result', `Surprise factor ${sf.toFixed(3)} \u00d7 ${outcome}`, signedChip(om))}
              ${workingRow('Margin', `${margin >= 0 ? '+' : '\u2212'}${Math.abs(margin)} points \u00f7 60`, signedChip(mc))}
              ${workingRow('Century bonus', `Scored ${own} points (${own >= 100 ? '100 or more' : 'under 100'})`, signedChip(cb))}
              ${workingRow('Travel bonus', tb > 0 ? `Played at ${g.venue}, away from home state or a remote venue` : 'Home state, not a remote venue', signedChip(tb))}
              ${workingRow('Rating change', 'The four rows above added together', signedChip(delta), 'total')}
            </ul>`;
            } else {
                html += `<ul class="working-list">${workingRow('Rating change', 'From that game', signedChip(delta), 'total')}</ul>`;
            }
            html += '</section>';
        }

        $('popup-team').textContent = team;
        $('popup-rank').textContent = `Rank ${rank} \u00b7 ${ctx.roundname || ''} ${ctxYear}`;
        $('popup-stats').innerHTML = html;

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
        'Adelaide': '#4a7abf',
        'Brisbane Lions': '#e0507a',
        'Carlton': '#5588cc',
        'Collingwood': '#c8c8c8',
        'Essendon': '#e85555',
        'Fremantle': '#7a70d0',
        'Geelong': '#5588bb',
        'Gold Coast': '#f07070',
        'Greater Western Sydney': '#f08050',
        'Hawthorn': '#d4a030',
        'Melbourne': '#cc4444',
        'North Melbourne': '#4488bb',
        'Port Adelaide': '#30b8d0',
        'Richmond': '#e8cc00',
        'St Kilda': '#e85555',
        'Sydney': '#e83355',
        'West Coast': '#4466cc',
        'Western Bulldogs': '#4488dd'
    };

    const ALL_TEAMS_LIST = Object.keys(TEAM_COLOURS);
    const PAD = { top: 20, right: 20, bottom: 36, left: 48 };

    // The AFL's finals series became a top 10 (a wildcard round) from 2026; before that it was a top 8
    const finalsSize = year => (year >= 2026 ? 10 : 8);
    const HIT_RADIUS = 24;          // how close (px) the pointer must be to a line to pick it
    const HIT_RADIUS_TOUCH = 44;
    const FONT = '"Inter", system-ui, sans-serif';

    let graphYear = null;
    let activeTeams = new Set();
    let highlightedTeam = null;     // chosen with the menu or shift-click
    let hoverPoint = null;          // { team, idx }: the line under the pointer or the keyboard
    let graphRounds = [];
    let graphInited = false;
    let layout = null;              // scales from the last draw, used to find the nearest line

    function showGraph() {
        if (!graphInited) initGraph();
        drawGraph();
    }

    function getTopN(year, n) {
        const yearRounds = (data.ratings_by_round || []).filter(r => r.year === year);
        if (!yearRounds.length) return (data.power_rankings || []).slice(0, n).map(r => r.team);
        const last = yearRounds[yearRounds.length - 1];
        return Object.entries(last.ratings)
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
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
        $('btn-top').addEventListener('click', () => {
            const year = graphYear || parseInt(slider.value);
            activeTeams.clear();
            getTopN(year, finalsSize(year)).forEach(t => activeTeams.add(t));
            refreshGraph();
        });

        buildToggles();
        buildHighlightSelect();
        setupCanvasEvents();
        $('graph-data').addEventListener('toggle', renderGraphTable);

        const startYear = parseInt(slider.value);
        getTopN(startYear, finalsSize(startYear)).forEach(t => activeTeams.add(t));
        loadGraphYear(startYear);
    }

    function loadGraphYear(year) {
        graphYear = year;
        graphRounds = (data.ratings_by_round || []).filter(r => r.year === year);
        highlightedTeam = null;
        hoverPoint = null;
        $('btn-top').textContent = `Top ${finalsSize(year)}`;
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
        layout = null;

        if (!graphRounds.length) {
            ctx.fillStyle = '#9aa3b2';
            ctx.font = `13px ${FONT}`;
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
        layout = { plotW, plotH, xScale, yScale };

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
            ctx.font = `11px ${FONT}`;
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
            ctx.font = `11px ${FONT}`;
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

        // The line under the pointer (or chosen from the menu) is drawn on top and the others fade back
        const focusTeam = hoverPoint?.team || highlightedTeam;
        activeTeams.forEach(team => {
            if (team === focusTeam) return;
            drawTeam(team, focusTeam ? 0.15 : 0.7, 1.5);
        });

        if (focusTeam && activeTeams.has(focusTeam)) {
            drawTeam(focusTeam, 1, 2.5);
            if (!hoverPoint) {
                const last = graphRounds[graphRounds.length - 1];
                const v = last?.ratings[focusTeam];
                if (v !== undefined) {
                    ctx.fillStyle = TEAM_COLOURS[focusTeam] || '#aaa';
                    ctx.font = `bold 12px ${FONT}`;
                    ctx.textAlign = 'right';
                    ctx.fillText(focusTeam, xScale(graphRounds.length - 1) - 6, yScale(v) - 8);
                }
            }
        }

        // A marker on the exact point being read
        if (hoverPoint) {
            const v = graphRounds[hoverPoint.idx]?.ratings[hoverPoint.team];
            if (v !== undefined) {
                ctx.beginPath();
                ctx.arc(xScale(hoverPoint.idx), yScale(v), 5, 0, Math.PI * 2);
                ctx.fillStyle = TEAM_COLOURS[hoverPoint.team] || '#aaa';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            }
        }
    }

    // Pointer and keyboard inspection: one team at one round, never the whole table
    function setupCanvasEvents() {
        const canvas = $('sage-graph');
        const tooltip = $('graph-tooltip');
        let keyboardPoint = null;

        // The active line closest to (x, y), judged between the rounds on either side of x
        function nearestLine(x, y, radius) {
            if (!layout || !graphRounds.length) return null;
            const n = graphRounds.length;
            const pos = Math.max(0, Math.min(1, (x - PAD.left) / layout.plotW)) * (n - 1);
            const i0 = Math.floor(pos);
            const i1 = Math.min(n - 1, i0 + 1);
            const t = pos - i0;
            let best = null;
            ALL_TEAMS_LIST.forEach(team => {
                if (!activeTeams.has(team)) return;
                const a = graphRounds[i0].ratings[team];
                const b = graphRounds[i1].ratings[team];
                if (a === undefined || b === undefined) return;
                const dist = Math.abs(layout.yScale(a + (b - a) * t) - y);
                if (!best || dist < best.dist) best = { team, dist };
            });
            return best && best.dist <= radius ? { team: best.team, idx: Math.round(pos) } : null;
        }

        function showPoint(point, px, py, announceIt) {
            const sameAsBefore = hoverPoint && hoverPoint.team === point.team && hoverPoint.idx === point.idx;
            hoverPoint = point;
            const round = graphRounds[point.idx];
            const v = round.ratings[point.team];
            const before = point.idx > 0 ? graphRounds[point.idx - 1].ratings[point.team] : undefined;

            tooltip.innerHTML =
                `<div class="tooltip-team"><span class="sw" style="background:${TEAM_COLOURS[point.team] || '#aaa'}"></span>${esc(point.team)}</div>` +
                `<div class="tooltip-round">${esc(roundLabel(round))} \u00b7 ${graphYear}</div>` +
                `<div class="tooltip-val ${tone(v)}">${signed(v)}</div>` +
                (before !== undefined ? `<div class="tooltip-change">${signed(v - before)} that round</div>` : '');

            const rect = canvas.getBoundingClientRect();
            const tw = 170, th = 86;
            let tx = px + 14;
            let ty = py - th - 10;
            if (tx + tw > rect.width) tx = px - tw - 14;
            if (ty < 4) ty = py + 16;
            tooltip.style.left = Math.max(4, tx) + 'px';
            tooltip.style.top = Math.max(4, ty) + 'px';
            tooltip.classList.add('visible');
            if (!sameAsBefore) drawGraph();

            if (announceIt) {
                const order = ALL_TEAMS_LIST.filter(t => activeTeams.has(t) && round.ratings[t] !== undefined)
                    .sort((a, b) => round.ratings[b] - round.ratings[a]);
                $('graph-live').textContent =
                    `${point.team}, ${roundLabel(round)} ${graphYear}: ${signed(v)}. Ranked ${order.indexOf(point.team) + 1} of ${order.length} shown.`;
            }
        }

        function hide() {
            tooltip.classList.remove('visible');
            if (hoverPoint) { hoverPoint = null; drawGraph(); }
        }

        function onPointer(e) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const point = nearestLine(x, y, e.pointerType === 'touch' ? HIT_RADIUS_TOUCH : HIT_RADIUS);
            if (point) showPoint(point, x, y, false);
            else hide();
        }

        canvas.addEventListener('pointermove', onPointer);
        canvas.addEventListener('pointerdown', onPointer);
        canvas.addEventListener('pointerleave', hide);
        canvas.addEventListener('blur', () => { keyboardPoint = null; hide(); });

        // Keyboard: left and right move between rounds, up and down between the teams shown
        function sortedAt(idx) {
            return ALL_TEAMS_LIST.filter(t => activeTeams.has(t) && graphRounds[idx].ratings[t] !== undefined)
                .sort((a, b) => graphRounds[idx].ratings[b] - graphRounds[idx].ratings[a]);
        }

        canvas.addEventListener('keydown', e => {
            const n = graphRounds.length;
            if (!n || !layout) return;
            let idx = keyboardPoint ? keyboardPoint.idx : n - 1;
            let order = sortedAt(idx);
            if (!order.length) return;
            let team = keyboardPoint && order.includes(keyboardPoint.team) ? keyboardPoint.team : order[0];
            if (e.key === 'ArrowRight') idx = Math.min(n - 1, idx + 1);
            else if (e.key === 'ArrowLeft') idx = Math.max(0, idx - 1);
            else if (e.key === 'Home') idx = 0;
            else if (e.key === 'End') idx = n - 1;
            else if (e.key === 'ArrowUp') team = order[Math.max(0, order.indexOf(team) - 1)];
            else if (e.key === 'ArrowDown') team = order[Math.min(order.length - 1, order.indexOf(team) + 1)];
            else return;
            e.preventDefault();
            order = sortedAt(idx);
            if (!order.includes(team)) team = order[0];
            if (!team) return;
            keyboardPoint = { team, idx };
            showPoint(keyboardPoint, layout.xScale(idx), layout.yScale(graphRounds[idx].ratings[team]), true);
        });

        window.addEventListener('resize', () => {
            if (!$('panel-graph').hidden) drawGraph();
        });
    }

    loadData();
})();