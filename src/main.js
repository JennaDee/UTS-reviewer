import "./style.css";
import bank from "../content/approved-question-bank.json";
import lessons from "../content/lessons.json";
import topicSections from "../content/topic-sections.json";
import {
  shuffle,
  createAttempt,
  grade,
  statistics,
  newProfile,
} from "./core.js";
import { listProfiles, saveProfile, saveProfiles } from "./db.js";
import { validateBackup } from "./backup.js";
const questions = bank.questions,
  qmap = new Map(questions.map((q) => [q.id, q]));
const cards = [
  ...questions.map((q) => ({
    id: q.id,
    lessonId: q.lessonId,
    title: q.topic,
    prompt: q.question,
    answer: q.options[q.correctOptionIndex] + ". " + q.explanation,
  })),
  ...lessons.flatMap((l) =>
    l.sections.flatMap((s) =>
      s.blocks.map((b, i) => ({
        id: s.id + "-card-" + i,
        lessonId: l.id,
        title: s.title,
        prompt: b.includes(":")
          ? b.slice(0, b.indexOf(":"))
          : "Recall this source concept",
        answer: b.endsWith(":") ? [b, s.blocks[i + 1] || ""].join(" ") : b,
      })),
    ),
  ),
];
let profiles = [],
  profile,
  view = "home",
  lessonId = lessons[0].id,
  resultId = null,
  deck = [],
  cardIndex = 0,
  revealed = false,
  notice = "",
  operationQueue = Promise.resolve(),
  pendingSaves = 0;
const app = document.querySelector("#app");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (label, action, data = "", cls = "") =>
  `<button class="${cls}" data-action="${action}" data-value="${esc(data)}">${label}</button>`;
const lesson = () => lessons.find((l) => l.id === lessonId);
const percent = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const date = (v) => new Date(v).toLocaleString();
const intro = (eyebrow, title, desc) =>
  `<div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="muted">${desc}</p></div>`;
function progress(l) {
  return percent(
    l.sections.filter((s) => profile.reading[s.id]).length,
    l.sections.length,
  );
}
function shell(content) {
  document.documentElement.dataset.theme = profile.preferences.theme;
  document.documentElement.dataset.font = profile.preferences.fontSize;
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="#home"><span class="brand-mark">u.</span><span>Understanding<br><strong>the Self</strong></span></a><p class="nav-label">YOUR STUDY SPACE</p><nav>${[
    ["home", "⌂", "Overview"],
    ["lessons", "▤", "Lesson library"],
    ["flashcards", "▱", "Flashcards"],
    ["exam", "✎", "Comprehensive exam"],
    ["mistakes", "↺", "Mistake Bank"],
    ["stats", "▥", "My progress"],
    ["settings", "⚙", "Profiles & settings"],
  ]
    .map(([v, icon, label]) =>
      button(
        `<span aria-hidden="true">${icon}</span> ${label}`,
        "nav",
        v,
        view === v ? "nav active" : "nav",
      ),
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom"><span class="local-dot"></span> <span id="save-status" role="status">Saved on this browser</span><p>One subject. A deeper understanding.</p></div></aside><div class="workspace"><header><span class="course-label">UTS <span>/</span> STUDY HUB</span><div class="header-actions">${button(profile.preferences.theme === "dark" ? "☀ Light" : "☾ Dark", "theme")}<label class="sr-only" for="profile">Local learner profile</label><select id="profile">${profiles.map((p) => `<option value="${p.id}" ${p.id === profile.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div></header><main id="main" tabindex="-1">${notice ? `<div role="status" class="notice">${esc(notice)}</div>` : ""}${content}</main><footer>Understanding the Self · Source-based study, at your own pace.<br>Local profiles are not accounts. No device synchronization or secure profile privacy.</footer></div>`;
}
function lessonCards() {
  return `<div class="lesson-grid">${lessons.map((l, i) => `<article class="lesson-card"><div class="card-top"><span class="lesson-number">0${i + 1}</span><span class="tag">${l.sourcePages}</span></div><h2>${esc(l.title)}</h2><p class="muted">${l.sections.length} sections · ${questions.filter((q) => q.lessonId === l.id).length} approved questions</p><div class="progress"><span style="width:${progress(l)}%"></span></div><div class="card-bottom"><small>${progress(l)}% read</small>${button("Open lesson →", "read", l.id, "text-button")}</div></article>`).join("")}</div>`;
}
function home() {
  const stats = statistics(profile);
  return `${intro("A LITTLE CURIOSITY, EVERY DAY", `Make time to<br><em>understand yourself.</em>`, "Explore the ideas that shape who we are. Read, recall, and put your understanding into practice.")}<div class="hero-banner"><div><span class="eyebrow">YOUR NEXT CHAPTER</span><h2>Four perspectives. One you.</h2><p>Start with the lessons, then discover what stays with you.</p>${button("Explore the lessons →", "nav", "lessons", "primary")}</div><div class="orbit" aria-hidden="true"><span>SELF</span><i></i><b></b></div></div><div class="stat-grid"><article><strong>${lessons.reduce((n, l) => n + l.sections.filter((s) => profile.reading[s.id]).length, 0)}<small> / 31</small></strong><span>Sections read</span></article><article><strong>${profile.attempts.length}</strong><span>Completed attempts</span></article><article><strong>${stats.total ? percent(stats.correct, stats.total) + "%" : "—"}</strong><span>Answer accuracy</span></article><article><strong>${stats.mistakes.filter((m) => !m.resolved).length}</strong><span>Mistakes to revisit</span></article></div>${profile.active ? `<div class="notice">You have a saved ${profile.active.kind}. ${button("Continue attempt →", "nav", "attempt")}</div>` : ""}<div class="section-heading"><h2>Your lesson library</h2><span>01 — 04</span></div>${lessonCards()}`;
}
function reader() {
  const l = lesson();
  return `${intro("LESSON " + (lessons.indexOf(l) + 1) + " · " + l.sourcePages, esc(l.title), "Full source notes, organized into readable sections. Mark each section as you finish it.")}<div class="toolbar">${button("Practice flashcards", "cards", l.id)}${button("Take lesson quiz", "quiz", l.id, "primary")}<a href="${import.meta.env.BASE_URL}uts-source.pdf#page=${l.sourcePages.match(/\d+/)[0]}" target="_blank" rel="noopener">View original PDF ↗</a></div><div class="reader-layout"><nav class="toc" aria-label="Lesson sections">${l.sections.map((s) => `<a href="#${s.id}">${profile.reading[s.id] ? "✓ " : ""}${esc(s.title)}</a>`).join("")}</nav><div class="reading">${l.sections.map((s) => `<section id="${s.id}" class="reading-section"><h2>${esc(s.title)}</h2>${s.blocks.map((b) => `<p>${esc(b).replaceAll(" ○ ", '<br><span class="bullet">↳</span> ').replaceAll(" ■ ", '<br><span class="bullet">•</span> ')}</p>`).join("")}<label class="read-check"><input type="checkbox" data-section="${s.id}" ${profile.reading[s.id] ? "checked" : ""}> I’ve read this section</label></section>`).join("")}</div></div>`;
}
function flashcards() {
  if (!deck.length)
    return `${intro("ACTIVE RECALL", "A small card. A lasting idea.", "Practice approved questions and every source-note block. Self-ratings are saved separately from quiz accuracy.")}<div class="lesson-grid">${lessons.map((l) => `<article class="panel"><h2>${l.title}</h2><p>${cards.filter((c) => c.lessonId === l.id).length} cards</p>${button("Study cards →", "cards", l.id, "primary")}</article>`).join("")}</div>`;
  const c = deck[cardIndex];
  return `${intro("FLASHCARDS · " + lesson().title, "Pause. Recall. Reveal.", `${cardIndex + 1} of ${deck.length} · ${profile.flashReviews.length} reviews recorded for this profile`)}<article class="flashcard"><span class="tag">${esc(c.title)}</span><h2>${esc(c.prompt)}</h2>${revealed ? `<div class="card-answer">${esc(c.answer)}</div>` : button("Reveal answer", "reveal", "", "primary")}</article><div class="toolbar centered">${revealed ? button("Review again", "rate", "again") + button("I knew this", "rate", "known", "primary") : ""}${button("Next card →", "nextcard")}${button("Choose lesson", "resetcards")}</div>`;
}
function exam() {
  return `${intro("BRING IT ALL TOGETHER", "Your comprehensive exam.", "40 questions. Four perspectives. A fresh mix every time.")}<article class="panel exam-intro"><h2>A balanced review of everything you’ve learned.</h2><div class="exam-breakdown">${lessons.map((l, i) => `<div><span>0${i + 1}</span><p>${l.title}</p><strong>10 questions</strong></div>`).join("")}</div><ul><li>Questions and answer choices are shuffled for each attempt.</li><li>Answers and explanations appear after submission.</li><li>Your answers save automatically. Refresh or return later to continue.</li><li>Unlimited retakes, with every completed attempt in your history.</li></ul>${profile.active ? button("Resume saved " + profile.active.kind, "nav", "attempt", "primary") : button("Start 40-question exam →", "startExam", "", "primary")}</article>`;
}
function attempt() {
  const a = profile.active;
  if (!a) {
    view = "exam";
    return exam();
  }
  const item = a.items[a.position],
    q = qmap.get(item.questionId),
    answered = Object.keys(a.answers).length;
  return `${intro(a.kind === "exam" ? "COMPREHENSIVE EXAM" : "LESSON QUIZ", `Question ${a.position + 1} of ${a.items.length}`, `${answered} answered · Progress saved automatically`)}<div class="progress"><span style="width:${percent(answered, a.items.length)}%"></span></div><article class="question panel"><span class="tag">${esc(lessons.find((l) => l.id === q.lessonId).title)}</span><h2>${esc(q.question)}</h2><fieldset><legend class="sr-only">Choose one answer</legend>${item.order.map((n, i) => `<label class="option ${a.answers[q.id] === n ? "selected" : ""}"><input type="radio" name="answer" value="${n}" ${a.answers[q.id] === n ? "checked" : ""}><span>${String.fromCharCode(65 + i)}</span>${esc(q.options[n])}</label>`).join("")}</fieldset><div class="toolbar">${a.position > 0 ? button("← Previous", "position", a.position - 1) : ""}${a.position < a.items.length - 1 ? button("Next →", "position", a.position + 1, "primary") : ""}${button("Submit attempt", "submit", "", "primary")}</div></article><div class="question-nav" aria-label="Question navigation">${a.items.map((i, n) => button(String(n + 1), "position", n, `${a.answers[i.questionId] !== undefined ? "answered" : ""} ${a.position === n ? "current" : ""}`)).join("")}</div><p class="muted">Unanswered questions count as incorrect. ${button("Discard this attempt", "discard", "", "text-button")}</p>`;
}
function result() {
  const a = profile.attempts.find((x) => x.id === resultId);
  if (!a) return statsPage();
  const score = a.results.filter((r) => r.correct).length;
  return `${intro("ATTEMPT REVIEW · " + date(a.submittedAt), `${score} / ${a.items.length} correct`, `${percent(score, a.items.length)}% accuracy · ${a.kind === "exam" ? "Comprehensive exam" : "Lesson quiz"}`)}<div class="toolbar">${button("View weak topics", "nav", "stats")}${button("Another attempt", "nav", a.kind === "exam" ? "exam" : "lessons", "primary")}</div>${a.results
    .map((r, i) => {
      const q = qmap.get(r.questionId);
      return `<article class="panel review ${r.correct ? "correct" : "incorrect"}"><span class="tag">${r.correct ? "Correct" : "Revisit"} · ${esc(q.topic)}</span><h2>${i + 1}. ${esc(q.question)}</h2><p>Your answer: ${r.answer === null ? "Unanswered" : esc(q.options[r.answer])}</p><p><strong>Correct answer: ${esc(q.options[q.correctOptionIndex])}</strong></p><p>${esc(q.explanation)}</p>${button("Read the source context →", "topic", q.lessonId + "::" + q.topic, "text-button")}<br><small>Source: ${esc(q.source.section)} · ${esc(q.source.pages)}</small></article>`;
    })
    .join("")}`;
}
function mistakes() {
  const ms = statistics(profile).mistakes;
  return `${intro("TURN MISTAKES INTO PROGRESS", "Your Mistake Bank.", `${ms.length} questions missed across completed attempts. A later correct answer marks a mistake as recovered; its history remains.`)}${
    !ms.length
      ? '<div class="empty">No mistakes yet. Complete a quiz or exam to find what needs practice.</div>'
      : ms
          .sort((a, b) => Number(a.resolved) - Number(b.resolved))
          .map((m) => {
            const q = qmap.get(m.questionId);
            return `<article class="panel review"><span class="tag">${m.resolved ? "Recovered" : "Needs practice"} · missed ${m.count} time${m.count === 1 ? "" : "s"}</span><h2>${esc(q.question)}</h2><details><summary>Review answer & explanation</summary><p><strong>${esc(q.options[q.correctOptionIndex])}</strong></p><p>${esc(q.explanation)}</p><small>${esc(q.source.pages)}</small></details><p>${esc(q.topic)} ${button("Review this topic →", "topic", q.lessonId + "::" + q.topic, "text-button")}</p></article>`;
          })
          .join("")
  }`;
}
function statsPage() {
  const s = statistics(profile);
  return `${intro("YOUR LEARNING, OVER TIME", "Progress with perspective.", "Topic mastery is the percentage of correct answers across submitted attempts. Unpracticed topics have no score.")}<div class="stat-grid"><article><strong>${s.total ? percent(s.correct, s.total) + "%" : "—"}</strong><span>Overall accuracy</span></article><article><strong>${profile.attempts.filter((a) => a.kind === "exam").length}</strong><span>Exams completed</span></article><article><strong>${profile.attempts.filter((a) => a.kind === "quiz").length}</strong><span>Quizzes completed</span></article><article><strong>${profile.flashReviews.length}</strong><span>Flashcard reviews</span></article></div><h2>Where to focus next</h2>${
    s.topics.some((t) => t.correct < t.total)
      ? s.topics
          .filter((t) => t.correct < t.total)
          .slice(0, 5)
          .map(
            (t) =>
              `<div class="recommendation"><div><strong>${esc(t.topic)}</strong><p>${t.total - t.correct} missed of ${t.total} answers · ${percent(t.correct, t.total)}% accuracy</p></div>${button("Review this topic →", "topic", t.lessonId + "::" + t.topic)}</div>`,
          )
          .join("")
      : '<p class="empty">No weak topics identified yet. Try a quiz to build your study recommendations.</p>'
  }<h2>Topic mastery</h2><div class="topic-grid">${lessons
    .map(
      (l) =>
        `<article class="panel"><h3>${l.title}</h3>${[
          ...new Set(
            questions.filter((q) => q.lessonId === l.id).map((q) => q.topic),
          ),
        ]
          .map((topic) => {
            const t = s.topics.find(
              (t) => t.lessonId === l.id && t.topic === topic,
            );
            return `<div class="topic-row"><span>${esc(topic)}</span><strong>${t ? percent(t.correct, t.total) + "% (" + t.total + ")" : "Not practiced"}</strong></div>`;
          })
          .join("")}</article>`,
    )
    .join("")}</div><h2>Attempt history</h2>${
    profile.attempts.length
      ? `<div class="history">${[...profile.attempts]
          .reverse()
          .map(
            (a) =>
              `<div><span><strong>${a.kind === "exam" ? "Comprehensive exam" : "Lesson quiz"}</strong><br><small>${date(a.submittedAt)}</small></span><span>${a.results.filter((r) => r.correct).length}/${a.items.length}</span>${button("Review", "result", a.id)}</div>`,
          )
          .join("")}</div>`
      : '<p class="empty">Your submitted quizzes and exams will appear here.</p>'
  }`;
}
function settings() {
  return `${intro("MAKE ROOM FOR YOUR OWN PACE", "Profiles & preferences.", "Profiles keep learning progress separate on this browser. They are local convenience features, not authenticated accounts.")}<div class="topic-grid"><section class="panel"><h2>Local learner profiles</h2><p>Anyone using this browser can switch profiles. Clearing browser data can erase progress. Export a backup regularly.</p><form id="new-profile"><label for="name">New profile name</label><input id="name" name="name" required maxlength="50" placeholder="e.g. Alex"><button class="primary">Create profile</button></form><h3>Backup your learning</h3><p>Exports include all local profiles, saved attempts, reading progress, flashcard history, and preferences. Import creates additional profiles without overwriting existing ones.</p>${button("Export backup", "export")}<label class="file-label">Import backup <input id="import" type="file" accept="application/json,.json"></label></section><section class="panel"><h2>Study preferences</h2><label for="font">Reader text size</label><select id="font"><option value="normal" ${profile.preferences.fontSize === "normal" ? "selected" : ""}>Standard</option><option value="large" ${profile.preferences.fontSize === "large" ? "selected" : ""}>Large</option></select><label for="quiz-size">Questions per lesson quiz</label><select id="quiz-size">${[5, 10, 15, 20].map((n) => `<option ${n === profile.preferences.quizSize ? "selected" : ""}>${n}</option>`).join("")}</select><p>Comprehensive exams always contain 40 questions.</p>${button("Switch to " + (profile.preferences.theme === "light" ? "dark" : "light") + " mode", "theme")}<h3>Content & sources</h3><p>Four lessons, 120 approved questions, ${cards.length} flashcards. Source notes are preserved, including examples and classroom annotations. Quiz explanations follow the approved bank.</p><a href="${import.meta.env.BASE_URL}uts-source.pdf" target="_blank" rel="noopener">Open original source PDF ↗</a><p>Educational content is maintained in project files by the repository owner.</p></section></div>`;
}
function render() {
  const draftName = document.querySelector("#name")?.value;
  const views = {
    home,
    lessons: () =>
      intro(
        "THE FOUNDATIONS",
        "Four ways of seeing the self.",
        "Work through all four source-based lessons, one concept at a time.",
      ) + lessonCards(),
    reader,
    flashcards,
    exam,
    attempt,
    result,
    mistakes,
    stats: statsPage,
    settings,
  };
  shell((views[view] || home)());
  if (draftName && document.querySelector("#name"))
    document.querySelector("#name").value = draftName;
}
async function persist() {
  pendingSaves++;
  const status = document.querySelector("#save-status");
  if (status) status.textContent = "Saving progress…";
  try {
    await saveProfile(profile);
    if (status) status.textContent = "Saved on this browser";
  } finally {
    pendingSaves--;
  }
}
window.addEventListener("beforeunload", (event) => {
  if (pendingSaves) {
    event.preventDefault();
    event.returnValue = "";
  }
});
function navigate(v) {
  view = v;
  notice = "";
  render();
  window.scrollTo(0, 0);
  document.querySelector("main")?.focus({ preventScroll: true });
}
function run(fn) {
  operationQueue = operationQueue.then(async () => {
    const snapshot = structuredClone(profiles),
      activeId = profile.id;
    try {
      await fn();
    } catch (e) {
      profiles = snapshot;
      profile = profiles.find((p) => p.id === activeId);
      notice =
        e.message ||
        "Could not save. Check browser storage and export your data.";
      render();
    }
  });
  return operationQueue;
}
app.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  run(async () => {
    const a = b.dataset.action,
      v = b.dataset.value;
    notice = "";
    if (a === "nav") navigate(v);
    if (a === "read") {
      lessonId = v;
      navigate("reader");
    }
    if (a === "topic") {
      const [id, topic] = v.split("::");
      lessonId = id;
      navigate("reader");
      document
        .getElementById(id + "-" + topicSections[id][topic])
        ?.scrollIntoView();
    }
    if (a === "theme") {
      profile.preferences.theme =
        profile.preferences.theme === "light" ? "dark" : "light";
      await persist();
      render();
    }
    if (a === "cards") {
      lessonId = v;
      deck = shuffle(cards.filter((c) => c.lessonId === v));
      cardIndex = 0;
      revealed = false;
      navigate("flashcards");
    }
    if (a === "resetcards") {
      deck = [];
      render();
    }
    if (a === "reveal") {
      revealed = true;
      render();
    }
    if (a === "nextcard" || a === "rate") {
      if (a === "rate") {
        profile.flashReviews.push({
          cardId: deck[cardIndex].id,
          rating: v,
          at: new Date().toISOString(),
        });
        await persist();
      }
      cardIndex = (cardIndex + 1) % deck.length;
      revealed = false;
      render();
    }
    if (a === "startExam" || a === "quiz") {
      if (profile.active) {
        notice =
          "Finish or discard your saved attempt before starting another.";
        view = "attempt";
        render();
        return;
      }
      profile.active = createAttempt(
        questions,
        a === "quiz" ? [v] : lessons.map((l) => l.id),
        a === "quiz" ? "quiz" : "exam",
        a === "quiz" ? profile.preferences.quizSize : 10,
      );
      await persist();
      navigate("attempt");
    }
    if (a === "position") {
      profile.active.position = Number(v);
      await persist();
      render();
    }
    if (a === "submit") {
      const missing =
        profile.active.items.length -
        Object.keys(profile.active.answers).length;
      if (
        !confirm(
          missing
            ? `Submit with ${missing} unanswered questions? They will count as incorrect.`
            : "Submit this attempt and reveal the answers?",
        )
      )
        return;
      const result = grade(profile.active, questions);
      profile.attempts.push(result);
      profile.active = null;
      await persist();
      resultId = result.id;
      navigate("result");
    }
    if (a === "discard") {
      if (
        confirm(
          "Discard this in-progress attempt? Completed attempts will remain.",
        )
      ) {
        profile.active = null;
        await persist();
        navigate("exam");
      }
    }
    if (a === "result") {
      resultId = v;
      navigate("result");
    }
    if (a === "export") {
      const blob = new Blob(
        [
          JSON.stringify(
            {
              format: "uts-study-hub",
              version: 1,
              exportedAt: new Date().toISOString(),
              profiles,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download =
        "uts-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
});
app.addEventListener("change", (e) =>
  run(async () => {
    const t = e.target;
    if (t.id === "profile") {
      profile = profiles.find((p) => p.id === t.value);
      localStorage.setItem("uts-active-profile", profile.id);
      deck = [];
      navigate("home");
      return;
    }
    if (t.name === "answer") {
      const id = profile.active.items[profile.active.position].questionId;
      profile.active.answers[id] = Number(t.value);
      await persist();
      render();
    }
    if (t.dataset.section) {
      profile.reading[t.dataset.section] = t.checked;
      await persist();
      t.dataset.saved = "true";
    }
    if (t.id === "font" || t.id === "quiz-size") {
      profile.preferences[t.id === "font" ? "fontSize" : "quizSize"] =
        t.id === "font" ? t.value : Number(t.value);
      await persist();
      render();
    }
    if (t.id === "import") {
      const file = t.files[0];
      if (!file) return;
      if (file.size > 20_000_000)
        throw Error("Backup is too large (maximum 20 MB).");
      const imported = validateBackup(
        JSON.parse(await file.text()),
        questions,
        new Set(cards.map((c) => c.id)),
        new Set(lessons.flatMap((l) => l.sections.map((s) => s.id))),
      );
      await saveProfiles(imported);
      profiles.push(...imported);
      notice = `Imported ${imported.length} profile(s). Select one in the profile menu.`;
      render();
    }
  }),
);
app.addEventListener("submit", (e) => {
  if (e.target.id !== "new-profile") return;
  e.preventDefault();
  run(async () => {
    const name = new FormData(e.target).get("name").trim();
    if (!name || name.length > 50)
      throw Error("Use a profile name between 1 and 50 characters.");
    const p = newProfile(name);
    await saveProfile(p);
    profiles.push(p);
    profile = p;
    localStorage.setItem("uts-active-profile", p.id);
    deck = [];
    navigate("home");
  });
});
window.addEventListener("hashchange", () => {
  if (location.hash === "#home") navigate("home");
});
async function initialize() {
  try {
    profiles = await listProfiles();
    if (!profiles.length) {
      const p = newProfile("My study profile");
      await saveProfile(p);
      profiles = [p];
    }
    profile =
      profiles.find(
        (p) => p.id === localStorage.getItem("uts-active-profile"),
      ) || profiles[0];
    view = profile.active ? "attempt" : "home";
    render();
  } catch (e) {
    app.innerHTML = `<main><h1>Browser storage is unavailable</h1><p>UTS Study Hub needs IndexedDB to save your learning. Enable site storage and reload.</p><p>${esc(e.message)}</p></main>`;
  }
}
initialize();
