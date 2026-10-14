import { grade } from "./core.js";
export function validateBackup(data, bank, cardIds, sectionIds) {
  const fail = () => {
    throw Error("Invalid or incompatible backup. No profiles were imported.");
  };
  if (
    data?.format !== "uts-study-hub" ||
    data.version !== 1 ||
    !Array.isArray(data.profiles) ||
    !data.profiles.length ||
    data.profiles.length > 100
  )
    fail();
  const qs = new Map(bank.map((q) => [q.id, q]));
  const text = (v) => typeof v === "string" && v.length < 200;
  const date = (v) => typeof v === "string" && Number.isFinite(Date.parse(v));
  function attempt(a, submitted = false) {
    if (
      !a ||
      !text(a.id) ||
      !["exam", "quiz"].includes(a.kind) ||
      !date(a.startedAt) ||
      !Array.isArray(a.items) ||
      a.items.length < 1 ||
      a.items.length > 120 ||
      !a.answers ||
      typeof a.answers !== "object"
    )
      fail();
    const seen = new Set();
    for (const i of a.items) {
      const q = qs.get(i.questionId);
      if (
        !q ||
        seen.has(q.id) ||
        !Array.isArray(i.order) ||
        i.order.length !== q.options.length ||
        new Set(i.order).size !== q.options.length ||
        i.order.some(
          (n) => !Number.isInteger(n) || n < 0 || n >= q.options.length,
        )
      )
        fail();
      seen.add(q.id);
    }
    for (const [id, n] of Object.entries(a.answers))
      if (
        !seen.has(id) ||
        !Number.isInteger(n) ||
        n < 0 ||
        n >= qs.get(id).options.length
      )
        fail();
    if (
      a.kind === "exam" &&
      (a.items.length !== 40 ||
        new Set(bank.map((q) => q.lessonId)).size !== 4 ||
        [...new Set(bank.map((q) => q.lessonId))].some(
          (l) =>
            a.items.filter((i) => qs.get(i.questionId).lessonId === l)
              .length !== 10,
        ))
    )
      fail();
    if (
      !Number.isInteger(a.position) ||
      a.position < 0 ||
      a.position >= a.items.length
    )
      fail();
    const clean = {
      id: a.id,
      kind: a.kind,
      startedAt: a.startedAt,
      items: a.items.map((i) => ({ questionId: i.questionId, order: i.order })),
      answers: a.answers,
      position: a.position,
    };
    if (submitted) {
      if (!date(a.submittedAt)) fail();
      return { ...grade(clean, bank), submittedAt: a.submittedAt };
    }
    return clean;
  }
  return data.profiles.map((p) => {
    if (
      !p ||
      !text(p.name) ||
      !p.name.trim() ||
      p.name.length > 50 ||
      !date(p.createdAt) ||
      !Array.isArray(p.attempts) ||
      !Array.isArray(p.flashReviews) ||
      !p.reading ||
      typeof p.reading !== "object" ||
      !["light", "dark"].includes(p.preferences?.theme) ||
      !["normal", "large"].includes(p.preferences?.fontSize) ||
      ![5, 10, 15, 20].includes(p.preferences?.quizSize)
    )
      fail();
    for (const r of p.flashReviews)
      if (
        !cardIds.has(r.cardId) ||
        !["again", "known"].includes(r.rating) ||
        !date(r.at)
      )
        fail();
    for (const [s, v] of Object.entries(p.reading))
      if (!sectionIds.has(s) || typeof v !== "boolean") fail();
    return {
      id: crypto.randomUUID(),
      name: p.name.trim().slice(0, 39) + " (imported)",
      createdAt: p.createdAt,
      attempts: p.attempts.map((a) => attempt(a, true)),
      active: p.active ? attempt(p.active) : null,
      flashReviews: p.flashReviews.map((r) => ({
        cardId: r.cardId,
        rating: r.rating,
        at: r.at,
      })),
      reading: p.reading,
      preferences: {
        theme: p.preferences.theme,
        fontSize: p.preferences.fontSize,
        quizSize: p.preferences.quizSize,
      },
    };
  });
}
