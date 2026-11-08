/* World Capitals Quiz: projects/capitals.html (data: assets/data/cc.csv; flags: assets/images/flags/) */
  const STORAGE_MISS_KEY = "capitalsQuiz.missCounts"; // Imported from the previous version.
  const STORAGE_REVIEW_KEY = "capitalsQuiz.reviewData.v1";
  const REVIEW_DELAY_QUESTIONS = 4;
  const REVIEW_DELAY_MS = 6 * 60 * 60 * 1000;
  const RECENT_COUNTRY_LIMIT = 8;

  let capitalsData = [];
  let currentPair = null;
  let reviewData = {};
  let oldMissCounts = {};
  let sessionReviewQueue = {};
  let recentCountries = [];
  let missedThisSession = new Map();
  let isWaitingForNext = false;

  let score = 0;
  let totalAnswered = 0;
  let streak = 0;
  let bestStreak = 0;
  let spellingAccepted = 0;
  let skipped = 0;
  let answerShownAt = 0;

  const startScreen = document.getElementById("start-screen");
  const quizScreen = document.getElementById("quiz-screen");
  const resultsScreen = document.getElementById("results-screen");
  const startBtn = document.getElementById("start-btn");
  const loadErrorEl = document.getElementById("load-error");
  const countryEl = document.getElementById("country-name");
  const inputEl = document.getElementById("user-input");
  const formEl = document.getElementById("quiz-form");
  const feedbackEl = document.getElementById("feedback");
  const skipBtn = document.getElementById("skip-btn");
  const finishBtn = document.getElementById("finish-btn");
  const answeredCountEl = document.getElementById("answered-count");
  const correctCountEl = document.getElementById("correct-count");
  const streakCountEl = document.getElementById("streak-count");
  const resultScoreEl = document.getElementById("result-score");
  const resultSubEl = document.getElementById("result-sub");
  const missedPanel = document.getElementById("missed-panel");
  const missedListEl = document.getElementById("missed-list");
  const allCorrectMessage = document.getElementById("all-correct-message");
  const playAgainBtn = document.getElementById("play-again-btn");
  const skippedCountEl = document.getElementById("skipped-count");
  const submitBtn = document.getElementById("submit-btn");
  const resultsHeading = document.getElementById("results-heading");

  // ---------- Storage ----------
  function loadStorage() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_REVIEW_KEY));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) reviewData = parsed;
    } catch (_) {
      reviewData = {};
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_MISS_KEY));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) oldMissCounts = parsed;
    } catch (_) {
      oldMissCounts = {};
    }

    // Migrate records from the earlier version, which used country names as keys.
    const codeByName = new Map(capitalsData.map(item => [item.country.toLocaleLowerCase(), item.code]));
    for (const [oldKey, record] of Object.entries(reviewData)) {
      const code = codeByName.get(oldKey.toLocaleLowerCase());
      if (code && code !== oldKey && !reviewData[code]) reviewData[code] = record;
    }
    // Bring forward the older miss-count-only store as well.
    for (const [oldKey, count] of Object.entries(oldMissCounts)) {
      const code = codeByName.get(oldKey.toLocaleLowerCase()) || oldKey;
      if (!reviewData[code] && Number(count) > 0) {
        reviewData[code] = {
          attempts: 0,
          skips: 0,
          correct: 0,
          misses: Number(count) || 0,
          consecutiveCorrect: 0,
          lastSeen: 0,
          dueAt: 0,
          intervalDays: 0
        };
      }
    }
  }

  function saveReviewData() {
    try {
      localStorage.setItem(STORAGE_REVIEW_KEY, JSON.stringify(reviewData));
    } catch (_) {
      // The quiz remains playable if browser storage is unavailable or full.
    }
  }

  function getReviewRecord(country) {
    if (!reviewData[country] || typeof reviewData[country] !== "object") {
      reviewData[country] = {
        attempts: 0,
        skips: 0,
        correct: 0,
        misses: Number(oldMissCounts[country]) || 0,
        consecutiveCorrect: 0,
        lastSeen: 0,
        dueAt: 0,
        intervalDays: 0
      };
    }
    return reviewData[country];
  }

  // ---------- Load data ----------
  const CAPITALS_CSV_URL = "/assets/data/cc.csv";

  // Read CSV safely, including quoted names and quoted fields containing commas.
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

  function normaliseHeader(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function splitAcceptedAnswers(value) {
    return String(value || "").split(/[;|]/).map(answer => answer.trim()).filter(Boolean);
  }

  function loadCapitalsFromCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("The country code CSV is empty or has no data rows.");
    const headers = rows[0].map(normaliseHeader);
    const column = (...names) => headers.findIndex(header => names.includes(header));
    const codeIndex = column("code", "countrycode", "entitycode");
    const nameIndex = column("name", "country", "countryname", "entity", "entityname");
    const capitalIndex = column("capital", "primarycapital");
    const aliasesIndex = column("alternative", "alternatives", "capitalaliases", "capitalalternatives", "aliases", "alternativecapitals", "capitalalias");
    const difficultyIndex = column("difficulty", "level");
    if (codeIndex < 0 || nameIndex < 0 || capitalIndex < 0) {
      throw new Error("Expected CSV columns for Code, Name and Capital. CapitalAliases and Difficulty are optional.");
    }

    const seen = new Set();
    return rows.slice(1).map(row => {
      const code = (row[codeIndex] || "").trim().toUpperCase();
      const country = (row[nameIndex] || "").trim();
      const primary = (row[capitalIndex] || "").trim();
      const aliases = aliasesIndex < 0 ? [] : splitAcceptedAnswers(row[aliasesIndex]);
      const capital = [...new Set([primary, ...aliases].filter(Boolean))];
      if (!code || !country || !capital.length || seen.has(code)) return null;
      seen.add(code);
      return {
        code,
        country,
        capital,
        difficulty: difficultyIndex < 0 ? "" : (row[difficultyIndex] || "").trim()
      };
    }).filter(Boolean);
  }

  fetch(CAPITALS_CSV_URL)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then(text => {
      capitalsData = loadCapitalsFromCSV(text);
      if (!capitalsData.length) throw new Error("No entries with capital answers were found in cc.csv.");
      loadStorage();
      startBtn.disabled = false;
      startBtn.textContent = "Start quiz";
    })
    .catch(error => {
      startBtn.disabled = true;
      startBtn.textContent = "Unable to load quiz";
      loadErrorEl.textContent = "Couldn’t load capital data from /assets/data/cc.csv. Check that the CSV has Code, Name and Capital columns.";
      loadErrorEl.classList.remove("hidden");
      console.error("Failed to load capitals data:", error);
    });

  // ---------- Session flow ----------
  function questionsAsked() {
    return totalAnswered + skipped;
  }

  function startSession() {
    score = 0;
    totalAnswered = 0;
    skipped = 0;
    streak = 0;
    bestStreak = 0;
    spellingAccepted = 0;
    currentPair = null;
    sessionReviewQueue = {};
    recentCountries = [];
    missedThisSession = new Map();

    startScreen.classList.add("hidden");
    resultsScreen.classList.add("hidden");
    quizScreen.classList.remove("hidden");
    updateStats();
    nextQuestion();
  }

  function finishSession() {
    isWaitingForNext = true;
    quizScreen.classList.add("hidden");
    startScreen.classList.add("hidden");
    resultsScreen.classList.remove("hidden");
    resultsHeading.focus();

    const asked = questionsAsked();
    resultScoreEl.textContent = `${score}/${asked}`;
    const accuracy = asked ? Math.round((score / asked) * 100) : 0;
    const summary = [`${accuracy}% correct`];
    if (skipped) summary.push(`${skipped} skipped`);
    summary.push(`best streak ${bestStreak}`);
    if (spellingAccepted) summary.push(`${spellingAccepted} near-miss ${spellingAccepted === 1 ? "spelling" : "spellings"}`);
    resultSubEl.textContent = summary.join(" · ");

    missedListEl.replaceChildren();
    if (missedThisSession.size) {
      missedPanel.classList.remove("hidden");
      allCorrectMessage.classList.add("hidden");
      for (const [code, details] of missedThisSession) {
        const item = capitalsData.find(entry => entry.code === code);
        const row = document.createElement("div");
        row.className = "missed-item";
        const countrySpan = document.createElement("span");
        countrySpan.className = "missed-country";
        countrySpan.textContent = `${item ? item.country : code}${details.count > 1 ? ` (${details.count} misses)` : ""}`;
        const capitalSpan = document.createElement("span");
        capitalSpan.className = "missed-capital";
        capitalSpan.textContent = details.capital;
        row.append(countrySpan, capitalSpan);
        missedListEl.appendChild(row);
      }
    } else {
      missedPanel.classList.add("hidden");
      allCorrectMessage.classList.remove("hidden");
    }
  }

  function updateStats() {
    answeredCountEl.textContent = totalAnswered;
    correctCountEl.textContent = score;
    skippedCountEl.textContent = skipped;
    streakCountEl.textContent = streak;
  }

  // After an answer the result stays on screen until the person moves on (Next, or Enter).
  function showAnswerState() {
    isWaitingForNext = true;
    answerShownAt = Date.now();
    inputEl.readOnly = true;
    skipBtn.disabled = true;
    submitBtn.textContent = "Next question";
    inputEl.focus();
  }

  function nextQuestion() {
    isWaitingForNext = false;
    inputEl.value = "";
    inputEl.readOnly = false;
    skipBtn.disabled = false;
    submitBtn.textContent = "Submit answer";
    feedbackEl.replaceChildren();
    feedbackEl.className = "feedback";

    currentPair = pickNextCountry();
    if (!currentPair) {
      countryEl.textContent = "No countries available";
      return;
    }

    countryEl.replaceChildren();
    const flag = document.createElement("img");
    flag.className = "country-flag";
    flag.src = `/assets/images/flags/${currentPair.code.toLowerCase()}.svg`;
    flag.alt = "";
    flag.setAttribute("aria-hidden", "true");
    flag.addEventListener("error", () => flag.remove(), { once: true });
    countryEl.append(flag, document.createTextNode(currentPair.country));
    updateStats();
    inputEl.focus();
  }

  // ---------- Adaptive selection ----------
  function pickNextCountry() {
    const now = Date.now();
    const queued = Object.entries(sessionReviewQueue)
      .filter(([key, item]) => item.eligibleAfter <= questionsAsked() && key !== (currentPair && currentPair.code))
      .map(([key]) => capitalsData.find(item => item.code === key))
      .filter(Boolean);

    // A missed answer returns after several other questions, while it is still fresh.
    if (queued.length) {
      const chosen = weightedPick(queued, now, true);
      delete sessionReviewQueue[chosen.code];
      rememberCountry(chosen.code);
      return chosen;
    }

    let choices = capitalsData.filter(item => item.code !== (currentPair && currentPair.code));
    if (choices.length > RECENT_COUNTRY_LIMIT) {
      const notRecent = choices.filter(item => !recentCountries.includes(item.code));
      if (notRecent.length) choices = notRecent;
    }

    const chosen = weightedPick(choices.length ? choices : capitalsData, now, false);
    rememberCountry(chosen.code);
    return chosen;
  }

  function weightedPick(choices, now, isReviewPick) {
    const weights = choices.map(item => {
      const record = getReviewRecord(item.code);
      const misses = Math.max(0, Number(record.misses) || 0);
      const lastSeen = Number(record.lastSeen) || 0;
      const dueAt = Number(record.dueAt) || 0;
      const daysSinceSeen = lastSeen ? (now - lastSeen) / 86400000 : 30;
      const missWeight = Math.min(misses, 8) * 1.25;
      const dueWeight = dueAt && dueAt <= now ? 2.5 : 0;
      const staleWeight = Math.min(Math.max(daysSinceSeen - 3, 0) / 14, 2);
      // Every country retains a base chance; review history only changes frequency.
      return 1 + missWeight + dueWeight + staleWeight + (isReviewPick ? 1 : 0);
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let pick = Math.random() * totalWeight;
    for (let i = 0; i < choices.length; i++) {
      pick -= weights[i];
      if (pick <= 0) return choices[i];
    }
    return choices[choices.length - 1];
  }

  function rememberCountry(country) {
    recentCountries.push(country);
    if (recentCountries.length > RECENT_COUNTRY_LIMIT) recentCountries.shift();
  }

  // ---------- Answer matching ----------
  function sanitize(value) {
    return String(value)
      .trim()
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[łŁ]/g, "l")
      .replace(/[^a-z0-9]/g, "");
  }

  function editDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost
        );
      }
      previous = current;
    }
    return previous[b.length];
  }

  function typoTolerance(length) {
    if (length <= 4) return 0;
    if (length <= 9) return 1;
    return 2;
  }

  function matchAnswer(rawGuess, variants) {
    const guess = sanitize(rawGuess);
    if (!guess) return null;

    const cleanVariants = variants
      .filter(value => typeof value === "string")
      .map(value => ({ original: value, clean: sanitize(value) }))
      .filter(value => value.clean);

    const exact = cleanVariants.find(value => value.clean === guess);
    if (exact) return { type: "exact", answer: exact.original };

    let closest = null;
    for (const variant of cleanVariants) {
      const distance = editDistance(guess, variant.clean);
      const tolerance = typoTolerance(variant.clean.length);
      if (distance > 0 && distance <= tolerance && (!closest || distance < closest.distance)) {
        closest = { type: "typo", answer: variant.original, distance };
      }
    }
    return closest;
  }

  // ---------- Learning history ----------
  function recordCorrect(country) {
    const now = Date.now();
    const record = getReviewRecord(country);
    record.attempts = (Number(record.attempts) || 0) + 1;
    record.correct = (Number(record.correct) || 0) + 1;
    record.misses = Math.max(0, (Number(record.misses) || 0) - 1);
    record.consecutiveCorrect = (Number(record.consecutiveCorrect) || 0) + 1;
    record.lastSeen = now;

    // Correct recall progressively pushes the next scheduled review further out.
    const intervals = [1, 3, 7, 14, 30, 60];
    const index = Math.min(record.consecutiveCorrect - 1, intervals.length - 1);
    record.intervalDays = intervals[index];
    record.dueAt = now + record.intervalDays * 86400000;

    // A correct retry clears this session's pending review for the country.
    delete sessionReviewQueue[country];
    saveReviewData();
  }

  // ---------- Learning history ----------
  function recordCorrect(country) {
    const now = Date.now();
    const record = getReviewRecord(country);
    record.attempts = (Number(record.attempts) || 0) + 1;
    record.correct = (Number(record.correct) || 0) + 1;
    record.misses = Math.max(0, (Number(record.misses) || 0) - 1);
    record.consecutiveCorrect = (Number(record.consecutiveCorrect) || 0) + 1;
    record.lastSeen = now;

    // Correct recall progressively pushes the next scheduled review further out.
    const intervals = [1, 3, 7, 14, 30, 60];
    const index = Math.min(record.consecutiveCorrect - 1, intervals.length - 1);
    record.intervalDays = intervals[index];
    record.dueAt = now + record.intervalDays * 86400000;

    // A correct retry clears this session's pending review for the country.
    delete sessionReviewQueue[country];
    saveReviewData();
  }

  function recordIncorrect(country, wasSkipped = false) {
    const now = Date.now();
    const record = getReviewRecord(country);
    record.attempts = (Number(record.attempts) || 0) + 1;
    record.misses = (Number(record.misses) || 0) + 1;
    if (wasSkipped) record.skips = (Number(record.skips) || 0) + 1;
    record.consecutiveCorrect = 0;
    record.lastSeen = now;
    record.intervalDays = 0.25;
    record.dueAt = now + REVIEW_DELAY_MS;
    sessionReviewQueue[country] = { eligibleAfter: questionsAsked() + REVIEW_DELAY_QUESTIONS };
    saveReviewData();
  }

  function rememberMiss(country) {
    const existing = missedThisSession.get(country);
    if (existing) existing.count++;
    else missedThisSession.set(country, { capital: currentPair.capital[0], count: 1 });
  }

  // type: correct | close | incorrect | skipped. The detail block lists the primary answer, then any alternatives.
  function showFeedback(type, headline, primary, alternatives = []) {
    feedbackEl.replaceChildren();
    feedbackEl.className = `feedback ${type}`;
    const result = document.createElement("p");
    result.className = "feedback-result";
    result.textContent = headline;
    feedbackEl.appendChild(result);
    if (!primary) return;

    const list = document.createElement("dl");
    list.className = "feedback-detail";
    const addRow = (label, value) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const definition = document.createElement("dd");
      definition.textContent = value;
      row.append(term, definition);
      list.appendChild(row);
    };
    addRow("Correct answer", primary);
    if (alternatives.length) addRow("Also accepted", alternatives.join(", "));
    feedbackEl.appendChild(list);
  }

  function submitAnswer(rawGuess) {
    const result = matchAnswer(rawGuess, currentPair.capital);
    const [primary, ...alternatives] = currentPair.capital;
    const code = currentPair.code;

    totalAnswered++;
    if (result) {
      score++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      recordCorrect(code);
      if (result.type === "typo") {
        spellingAccepted++;
        showFeedback("close", "Not quite", primary, alternatives);
      } else if (result.answer !== primary) {
        showFeedback("correct", "Correct!", primary, alternatives);
      } else {
        showFeedback("correct", "Correct!");
      }
    } else {
      streak = 0;
      rememberMiss(code);
      recordIncorrect(code);
      showFeedback("incorrect", "Incorrect", primary, alternatives);
    }
    updateStats();
    showAnswerState();
  }

  formEl.addEventListener("submit", event => {
    event.preventDefault();
    if (isWaitingForNext) {
      if (Date.now() - answerShownAt > 300) nextQuestion();
      return;
    }
    const guess = inputEl.value.trim();
    if (guess) submitAnswer(guess);
  });

  skipBtn.addEventListener("click", () => {
    if (isWaitingForNext || !currentPair) return;
    const [primary, ...alternatives] = currentPair.capital;
    skipped++;
    streak = 0;
    rememberMiss(currentPair.code);
    recordIncorrect(currentPair.code, true);
    showFeedback("skipped", "Skipped", primary, alternatives);
    updateStats();
    showAnswerState();
  });

  startBtn.addEventListener("click", startSession);
  finishBtn.addEventListener("click", finishSession);
  playAgainBtn.addEventListener("click", startSession);
