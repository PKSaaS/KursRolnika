// Kurs Rolnika — flashcards, notes and quizzes built from the course PDFs.
// COURSE_DATA (data.js) is an array of modules: {id, course, number, title, notes, flashcards, quiz}.
(function () {
  "use strict";

  const STORAGE_KEY = "kurs-rolnika-v1";
  const DAY = 86400000;
  const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
  const BATCH_SIZE = 10;
  const MODULE_QUIZ_SIZE = 10;
  const EXAM_SIZE = 40; // the real RL.03 written exam: 40 questions, 20 to pass
  const KNOWLEDGE_TEST_SIZE = 35; // Moodle "Test wiedzy": 35 graded questions, 60% to pass
  const KNOWLEDGE_TEST_PASS_PERCENT = 60;

  const modules = COURSE_DATA;
  const moduleById = Object.fromEntries(modules.map((m) => [m.id, m]));
  const courses = [...new Set(modules.map((m) => m.course))];

  // ---------- progress storage ----------
  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.cards && saved.quiz) return saved;
    } catch (e) { /* private mode or corrupt data: start fresh */ }
    return { cards: {}, quiz: {} };
  }
  const progress = loadProgress();
  progress.selftest = progress.selftest || {}; // best scores: "<moduleId>:practice" and "<moduleId>:test"
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) { /* storage unavailable */ }
  }

  const cardKey = (moduleId, index) => moduleId + ":" + index;
  function allCards(moduleIds) {
    return moduleIds.flatMap((id) => moduleById[id].flashcards.map((card, index) => ({ ...card, key: cardKey(id, index), moduleId: id })));
  }
  function gradeCard(key, knewIt) {
    const state = progress.cards[key] || { box: 0 };
    const box = knewIt ? Math.min(state.box + 1, BOX_INTERVAL_DAYS.length - 1) : 0;
    progress.cards[key] = { box, due: Date.now() + BOX_INTERVAL_DAYS[box] * DAY };
    saveProgress();
  }
  const isLearned = (key) => (progress.cards[key]?.box || 0) >= 2;
  const isDue = (key) => progress.cards[key] && progress.cards[key].due <= Date.now();
  function moduleMastery(module) {
    const learned = module.flashcards.filter((_, i) => isLearned(cardKey(module.id, i))).length;
    return Math.round((learned / module.flashcards.length) * 100);
  }
  const dueCards = () => allCards(modules.map((m) => m.id)).filter((c) => isDue(c.key));

  // ---------- helpers ----------
  const view = document.getElementById("view");
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  const COURSE_SHORT_NAMES = {
    "Teoria BHP": "BHP",
    "Podstawy produkcji roślinnej": "Produkcja roślinna",
    "Uprawa roślin": "Uprawa roślin",
    "Podstawy produkcji zwierzęcej": "Podst. prod. zwierzęcej",
    "Produkcja zwierzęca": "Produkcja zwierzęca",
    "Technika w rolnictwie": "Technika",
    "Rolnictwo ekologiczne": "Rolnictwo ekologiczne",
    "Biologiczne podstawy chowu i hodowli zwierząt": "Biol. podst. chowu",
    "Technologiczne podstawy chowu i hodowli zwierząt": "Technol. podst. chowu",
  };
  // Past CKE exam papers have no notes: only a full-length test and one flashcard per question.
  const isExamPaper = (m) => m.notes.length === 0;
  const unitName = (m) => (isExamPaper(m) ? "Arkusz " : "Moduł ") + m.number;
  const moduleLabel = (m) => (isExamPaper(m) ? "Egzamin CKE" : COURSE_SHORT_NAMES[m.course] || m.course) + " · " + unitName(m);

  function setNav(name) {
    document.querySelectorAll(".topnav button").forEach((b) => b.classList.toggle("on", b.dataset.go === name));
    const due = dueCards().length;
    const badge = document.getElementById("dueBadge");
    badge.hidden = due === 0;
    badge.textContent = due;
    window.scrollTo(0, 0);
  }

  // ---------- home ----------
  function renderHome() {
    setNav("home");
    const totalCards = modules.reduce((n, m) => n + m.flashcards.length, 0);
    const learned = Object.keys(progress.cards).filter(isLearned).length;
    const quizScores = Object.values(progress.quiz);
    const average = quizScores.length ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) + "%" : "–";

    view.innerHTML = `
      <section class="hero">
        <h1>Kurs Rolnika</h1>
        <p>Notatki, fiszki i testy z modułów kursu. Ucz się po 10 fiszek, a aplikacja sama przypomni, co powtórzyć.</p>
        <div class="stats">
          <div class="stat"><b>${learned}/${totalCards}</b><span>fiszek opanowanych</span></div>
          <div class="stat"><b>${dueCards().length}</b><span>do powtórki dziś</span></div>
          <div class="stat"><b>${average}</b><span>średni wynik testów</span></div>
        </div>
      </section>
      ${courses.map((course) => {
        const list = modules.filter((m) => m.course === course);
        return `<section class="course">
          <h2>${escapeHtml(course)} <small>${list.length} ${isExamPaper(list[0]) ? (list.length < 5 ? "arkusze" : "arkuszy") : list.length === 1 ? "moduł" : list.length < 5 ? "moduły" : "modułów"}</small></h2>
          <div class="grid">${list.map((m) => {
            const mastery = moduleMastery(m);
            const best = progress.quiz[m.id];
            return `<button class="mod" data-module="${m.id}">
              <span class="num">${escapeHtml(unitName(m))}</span>
              <span class="t">${escapeHtml(m.title)}</span>
              <span class="meta">${m.flashcards.length} fiszek · ${m.quiz.length} pytań${best != null ? " · test: " + best + "%" : ""}</span>
              <span class="bar"><i style="width:${mastery}%"></i></span>
            </button>`;
          }).join("")}</div>
        </section>`;
      }).join("")}`;
    view.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => go("module/" + b.dataset.module)));
  }

  // ---------- module ----------
  function renderModule(id, tab) {
    const module = moduleById[id];
    if (!module) return go("home");
    setNav("");
    const tabs = [["notes", "📖 Notatki"], ["cards", "🃏 Fiszki"], ["quiz", "✅ Test"], ["selftest", "📝 Moodle"]]
      .filter(([key]) => (key !== "notes" || !isExamPaper(module)) && (key !== "selftest" || hasMoodleQuestions(module)));
    const current = tab || tabs[0][0];
    view.innerHTML = `
      <button class="back" data-go="home">← Wszystkie moduły</button>
      <div class="mod-head"><span class="num" style="color:var(--wheat);font-weight:800;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(moduleLabel(module))}</span>
      <h1>${escapeHtml(module.title)}</h1></div>
      <div class="tabs">
        ${tabs.map(([key, label]) =>
          `<button data-tab="${key}" class="${key === current ? "on" : ""}">${label}</button>`).join("")}
      </div>
      <div id="tabBody"></div>`;
    view.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => go("module/" + id + "/" + b.dataset.tab)));
    const body = document.getElementById("tabBody");
    if (current === "notes") renderNotes(module, body);
    if (current === "cards") startFlashcards(body, allCards([id]), unitName(module));
    if (current === "quiz") startQuiz(body, shuffle(module.quiz.map((q) => ({ ...q, moduleId: id }))).slice(0, isExamPaper(module) ? module.quiz.length : MODULE_QUIZ_SIZE), id);
    if (current === "selftest") renderSelftestMenu(module, body);
  }

  // Optional pictures (course PDF figures, videocast slides): section.images [{src, caption}], card.img, question.img.
  const figureHtml = (src, caption) => `<figure class="pic"><img src="${escapeHtml(src)}" alt="${escapeHtml(caption || "")}" loading="lazy">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;

  function renderNotes(module, body) {
    body.innerHTML = module.notes.map((section) => `
      <div class="section"><h3>${escapeHtml(section.heading)}</h3>
      <ul>${section.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      ${(section.images || []).map((image) => figureHtml(image.src, image.caption)).join("")}</div>`).join("") +
      `<div class="actions"><button class="btn primary" id="toCards">Przejdź do fiszek →</button></div>`;
    body.querySelector("#toCards").addEventListener("click", () => go("module/" + module.id + "/cards"));
  }

  // ---------- flashcards ----------
  // Picks a batch: due cards first, then never-seen cards, then the rest (weakest box first).
  function pickBatch(cards) {
    const due = cards.filter((c) => isDue(c.key));
    const unseen = cards.filter((c) => !progress.cards[c.key]);
    const rest = cards.filter((c) => progress.cards[c.key] && !isDue(c.key)).sort((a, b) => progress.cards[a.key].box - progress.cards[b.key].box);
    return [...shuffle(due), ...unseen, ...rest].slice(0, BATCH_SIZE);
  }

  function startFlashcards(body, cards, title) {
    if (!cards.length) {
      body.innerHTML = `<p class="empty">Brak fiszek do powtórki. Wróć później albo ucz się nowych z modułów. 🌱</p>`;
      return;
    }
    const batch = pickBatch(cards);
    let queue = batch.slice();
    let known = 0;

    function show() {
      if (!queue.length) {
        body.innerHTML = `<div class="result"><div class="big">${known}/${batch.length}</div>
          <p>Seria zakończona. Fiszki oznaczone „Nie wiem” wrócą jutro w powtórkach.</p>
          <div class="actions"><button class="btn primary" id="again">Kolejne ${BATCH_SIZE} fiszek</button></div></div>`;
        body.querySelector("#again").addEventListener("click", () => startFlashcards(body, cards, title));
        setNav(location.hash.startsWith("#review") ? "review" : "");
        return;
      }
      const card = queue[0];
      const done = batch.length - queue.length;
      body.innerHTML = `
        <div class="fc-top"><span>${escapeHtml(title)}</span><span style="white-space:nowrap">${done + 1} / ${batch.length}</span></div>
        <div class="fc-wrap"><div class="fc${card.img ? " has-img" : ""}" id="fc">
          <div class="face front">${card.img ? `<img class="fc-img" src="${escapeHtml(card.img)}" alt="">` : ""}<div class="q">${escapeHtml(card.front)}</div><span class="hint">Dotknij, aby odwrócić</span></div>
          <div class="face back"><div>${escapeHtml(card.back)}</div><span class="hint">${escapeHtml(moduleLabel(moduleById[card.moduleId]))}</span></div>
        </div></div>
        <div class="actions">
          <button class="btn bad" id="no" disabled>✗ Nie wiem</button>
          <button class="btn good" id="yes" disabled>✓ Wiem</button>
        </div>`;
      const fc = body.querySelector("#fc");
      const no = body.querySelector("#no");
      const yes = body.querySelector("#yes");
      fc.addEventListener("click", () => {
        fc.classList.toggle("flip");
        no.disabled = yes.disabled = false;
      });
      no.addEventListener("click", () => { gradeCard(card.key, false); queue = [...queue.slice(1), card]; show(); });
      yes.addEventListener("click", () => { gradeCard(card.key, true); known++; queue = queue.slice(1); show(); });
    }
    show();
  }

  // ---------- quiz ----------
  function startQuiz(body, questions, scoreKey) {
    let index = 0;
    let correct = 0;
    const mistakes = [];

    function show() {
      if (index >= questions.length) {
        const percent = Math.round((correct / questions.length) * 100);
        if (scoreKey) {
          progress.quiz[scoreKey] = Math.max(progress.quiz[scoreKey] || 0, percent);
          saveProgress();
        }
        body.innerHTML = `<div class="result"><div class="big">${percent}%</div>
          <p>${correct} z ${questions.length} poprawnych odpowiedzi.</p>
          <div class="actions"><button class="btn primary" id="retry">Nowy test</button></div></div>
          ${mistakes.length ? `<h3>Do poprawy</h3>` + mistakes.map((q) => `<div class="hit"><div class="from">${escapeHtml(moduleLabel(moduleById[q.moduleId]))}</div>
            <b>${escapeHtml(q.q)}</b><br>✓ ${escapeHtml(q.options[q.answer])}<div class="from" style="margin-top:4px">${escapeHtml(q.explain)}</div></div>`).join("") : ""}`;
        body.querySelector("#retry").addEventListener("click", () => route());
        return;
      }
      const q = questions[index];
      const order = shuffle(q.options.map((_, i) => i));
      body.innerHTML = `
        <div class="fc-top" style="max-width:none;margin-bottom:10px"><span>Pytanie ${index + 1} / ${questions.length}</span><span>✓ ${correct}</span></div>
        <div class="qcard">
          ${q.img ? figureHtml(q.img, "") : ""}<div class="qtxt">${escapeHtml(q.q)}</div>
          <div class="opts">${order.map((optionIndex, position) =>
            `<button class="opt" data-i="${optionIndex}"><b>${"ABCD"[position]}</b><span>${escapeHtml(q.options[optionIndex])}</span></button>`).join("")}</div>
          <div id="after"></div>
        </div>`;
      body.querySelectorAll(".opt").forEach((button) => button.addEventListener("click", () => {
        const chosen = Number(button.dataset.i);
        const right = chosen === q.answer;
        if (right) correct++; else mistakes.push(q);
        body.querySelectorAll(".opt").forEach((b) => {
          b.disabled = true;
          if (Number(b.dataset.i) === q.answer) b.classList.add("ok");
        });
        if (!right) button.classList.add("bad");
        body.querySelector("#after").innerHTML = `
          <div class="explain">${right ? "✓ Dobrze! " : "✗ Poprawna odpowiedź: <b>" + escapeHtml(q.options[q.answer]) + "</b>. "}${escapeHtml(q.explain)}
          <span class="src">${escapeHtml(moduleLabel(moduleById[q.moduleId]))}</span></div>
          <div class="actions"><button class="btn primary" id="next">${index + 1 < questions.length ? "Dalej →" : "Wynik"}</button></div>`;
        body.querySelector("#next").addEventListener("click", () => { index++; show(); });
      }));
    }
    show();
  }

  // ---------- Moodle self-evaluation and knowledge test ----------
  // Questions copied from the course's Moodle quizzes, as {q, options, answers: [indices], multi?, img?}:
  // module.selftest = "Samoewaluacja" (ungraded), module.knowledgetest = "Test wiedzy" (the graded test's own questions).
  const hasMoodleQuestions = (m) => (m.selftest || []).length + (m.knowledgetest || []).length > 0;

  function renderSelftestMenu(module, body) {
    const selftest = (module.selftest || []).map((q) => ({ ...q, moduleId: module.id }));
    const knowledgetest = (module.knowledgetest || []).map((q) => ({ ...q, moduleId: module.id }));
    // Test wiedzy uses the real test's questions; without them, a random draw from Samoewaluacja.
    const testQuestions = knowledgetest.length ? knowledgetest : selftest;
    const testSize = Math.min(KNOWLEDGE_TEST_SIZE, testQuestions.length);
    const modes = [
      selftest.length && { key: "practice", title: "Samoewaluacja", button: "Rozpocznij",
        about: `wszystkie ${selftest.length} pytań, wynik po każdej odpowiedzi.`,
        start: () => startMoodleTest(body, selftest, { instant: true, scoreKey: module.id + ":practice", module }) },
      knowledgetest.length && { key: "testpractice", title: "Test wiedzy – nauka", button: "Rozpocznij",
        about: `wszystkie ${knowledgetest.length} pytań z Testu wiedzy, wynik po każdej odpowiedzi.`,
        start: () => startMoodleTest(body, knowledgetest, { instant: true, scoreKey: module.id + ":testpractice", module }) },
      { key: "test", title: "Test wiedzy", button: "Rozpocznij test",
        about: `${testSize} pytań${knowledgetest.length ? " z prawdziwego testu" : " losowych"}, wyniki dopiero na końcu, zaliczenie od ${KNOWLEDGE_TEST_PASS_PERCENT}%.`,
        start: () => startMoodleTest(body, shuffle(testQuestions).slice(0, testSize), { instant: false, scoreKey: module.id + ":test", module }) },
    ].filter(Boolean);
    body.innerHTML = `
      <p style="color:var(--muted)">Pytania z platformy Moodle. Zaznacz wszystkie poprawne odpowiedzi, gdy pytanie ma ich kilka.</p>
      ${modes.map((mode) => {
        const best = progress.selftest[module.id + ":" + mode.key];
        return `<div class="hit" style="cursor:default"><b>${mode.title}</b> – ${mode.about}
          ${best != null ? `<div class="from">Najlepszy wynik: ${best}%</div>` : ""}
          <div class="actions" style="justify-content:flex-start"><button class="btn primary" data-mode="${mode.key}">${mode.button}</button></div></div>`;
      }).join("")}`;
    modes.forEach((mode) => body.querySelector(`[data-mode="${mode.key}"]`).addEventListener("click", mode.start));
  }

  function startMoodleTest(body, questions, { instant, scoreKey, module }) {
    let index = 0;
    let correct = 0;
    const mistakes = [];
    const sameAnswers = (chosen, q) => chosen.length === q.answers.length && chosen.every((i) => q.answers.includes(i));
    const answerText = (q) => q.answers.map((i) => q.options[i]).join(" · ");

    function finish() {
      const percent = Math.round((correct / questions.length) * 100);
      progress.selftest[scoreKey] = Math.max(progress.selftest[scoreKey] || 0, percent);
      saveProgress();
      const verdict = instant ? "" : percent >= KNOWLEDGE_TEST_PASS_PERCENT
        ? `<p style="font-weight:700;color:var(--green)">✓ Zaliczony (próg ${KNOWLEDGE_TEST_PASS_PERCENT}%)</p>`
        : `<p style="font-weight:700;color:var(--red)">✗ Niezaliczony – potrzeba ${KNOWLEDGE_TEST_PASS_PERCENT}%</p>`;
      body.innerHTML = `<div class="result"><div class="big">${percent}%</div>${verdict}
        <p>${correct} z ${questions.length} poprawnych odpowiedzi.</p>
        <div class="actions"><button class="btn primary" id="menu">Wróć do wyboru</button></div></div>
        ${mistakes.length ? `<h3>Do poprawy</h3>` + mistakes.map((q) => `<div class="hit">${q.img ? figureHtml(q.img, "") : ""}
          <b style="white-space:pre-line">${escapeHtml(q.q)}</b><br>✓ ${escapeHtml(answerText(q))}</div>`).join("") : ""}`;
      body.querySelector("#menu").addEventListener("click", () => renderSelftestMenu(module, body));
    }

    function show() {
      if (index >= questions.length) return finish();
      const q = questions[index];
      const isTrueFalse = q.options.length === 2 && q.options[0] === "Prawda";
      const order = isTrueFalse ? [0, 1] : shuffle(q.options.map((_, i) => i));
      const chosen = new Set();
      body.innerHTML = `
        <div class="fc-top" style="max-width:none;margin-bottom:10px"><span>Pytanie ${index + 1} / ${questions.length}</span><span>${instant ? "✓ " + correct : ""}</span></div>
        <div class="qcard">
          ${q.img ? figureHtml(q.img, "") : ""}<div class="qtxt" style="white-space:pre-line">${escapeHtml(q.q)}</div>
          ${q.multi ? `<p class="from" style="color:var(--muted);margin:0 0 8px">Wybierz jedną lub więcej odpowiedzi.</p>` : ""}
          <div class="opts">${order.map((optionIndex, position) =>
            `<button class="opt" data-i="${optionIndex}"><b>${q.multi ? "☐" : "ABCDEFGHI"[position]}</b><span>${escapeHtml(q.options[optionIndex])}</span></button>`).join("")}</div>
          <div id="after"></div>
          <div class="actions"><button class="btn primary" id="next" disabled>${instant ? "Sprawdź" : index + 1 < questions.length ? "Dalej →" : "Zakończ test"}</button></div>
        </div>`;
      const next = body.querySelector("#next");
      const optionButtons = [...body.querySelectorAll(".opt")];
      optionButtons.forEach((button) => button.addEventListener("click", () => {
        const i = Number(button.dataset.i);
        if (!q.multi) chosen.clear();
        if (chosen.has(i)) chosen.delete(i); else chosen.add(i);
        optionButtons.forEach((b) => {
          const on = chosen.has(Number(b.dataset.i));
          b.classList.toggle("picked", on);
          if (q.multi) b.querySelector("b").textContent = on ? "☑" : "☐";
        });
        next.disabled = chosen.size === 0;
      }));
      next.addEventListener("click", () => {
        if (next.dataset.checked) { index++; return show(); }
        const right = sameAnswers([...chosen], q);
        if (right) correct++; else mistakes.push(q);
        if (!instant) { index++; return show(); }
        optionButtons.forEach((b) => {
          const i = Number(b.dataset.i);
          b.disabled = true;
          if (q.answers.includes(i)) b.classList.add("ok"); else if (chosen.has(i)) b.classList.add("bad");
        });
        body.querySelector("#after").innerHTML = `<div class="explain">${right ? "✓ Dobrze!" : "✗ Poprawna odpowiedź: <b>" + escapeHtml(answerText(q)) + "</b>"}</div>`;
        next.dataset.checked = "1";
        next.textContent = index + 1 < questions.length ? "Dalej →" : "Wynik";
      });
    }
    show();
  }

  // ---------- review, exam, search ----------
  function renderReview() {
    setNav("review");
    view.innerHTML = `<h1>Powtórki</h1><p style="color:var(--muted)">Fiszki z wszystkich modułów, które czekają na powtórkę według harmonogramu (1, 2, 4, 8, 16 dni).</p><div id="tabBody"></div>`;
    startFlashcards(document.getElementById("tabBody"), dueCards(), "Powtórka");
  }

  let examCourse = "all";
  function renderExam() {
    setNav("exam");
    view.innerHTML = `<h1>Egzamin próbny</h1>
      <p style="color:var(--muted)">${EXAM_SIZE} losowych pytań, jak na prawdziwym egzaminie RL.03 (zdajesz od 50%).</p>
      <div class="chips">${[["all", "Cały kurs"], ...courses.map((c) => [c, c])].map(([key, label]) =>
        `<button class="chip ${key === examCourse ? "on" : ""}" data-c="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join("")}</div>
      <div id="tabBody"></div>`;
    view.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => { examCourse = b.dataset.c; renderExam(); }));
    const pool = modules.filter((m) => examCourse === "all" || m.course === examCourse)
      .flatMap((m) => m.quiz.map((q) => ({ ...q, moduleId: m.id })));
    startQuiz(document.getElementById("tabBody"), shuffle(pool).slice(0, EXAM_SIZE), null);
  }

  function renderSearch() {
    setNav("search");
    view.innerHTML = `<h1>Szukaj</h1><div class="search"><input id="q" type="search" placeholder="np. płodozmian, azot, Państwowa Inspekcja Pracy…" autofocus></div><div id="hits"></div>`;
    const input = document.getElementById("q");
    const hits = document.getElementById("hits");
    const index = modules.flatMap((m) => [
      ...m.flashcards.map((c) => ({ m, title: c.front, text: c.back })),
      ...m.notes.flatMap((s) => s.points.map((p) => ({ m, title: s.heading, text: p }))),
    ]);
    const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
    function highlight(text, term) {
      const safe = escapeHtml(text);
      const at = normalize(safe).indexOf(normalize(escapeHtml(term)));
      return at < 0 ? safe : safe.slice(0, at) + "<mark>" + safe.slice(at, at + term.length) + "</mark>" + safe.slice(at + term.length);
    }
    input.addEventListener("input", () => {
      const term = input.value.trim();
      if (term.length < 2) { hits.innerHTML = ""; return; }
      const needle = normalize(term);
      const found = index.filter((h) => normalize(h.title + " " + h.text).includes(needle)).slice(0, 60);
      hits.innerHTML = found.length ? found.map((h) => `<div class="hit"><div class="from">${escapeHtml(moduleLabel(h.m))} · ${escapeHtml(h.m.title)}</div>
        <b>${highlight(h.title, term)}</b><div>${highlight(h.text, term)}</div></div>`).join("") : `<p class="empty">Nic nie znaleziono.</p>`;
    });
    input.focus();
  }

  // ---------- routing ----------
  function go(path) {
    if (location.hash === "#" + path) route(); else location.hash = path;
  }
  function route() {
    const [page, id, tab] = location.hash.replace(/^#/, "").split("/");
    if (page === "module") return renderModule(id, tab);
    if (page === "review") return renderReview();
    if (page === "exam") return renderExam();
    if (page === "search") return renderSearch();
    renderHome();
  }
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-go]");
    if (target) go(target.dataset.go);
  });
  window.addEventListener("hashchange", route);
  route();
})();
