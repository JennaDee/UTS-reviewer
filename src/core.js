export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function createAttempt(bank, lessonIds, kind = "exam", count = 10) {
  const selected = lessonIds.flatMap((id) => {
    const pool = bank.filter((q) => q.lessonId === id);
    if (pool.length < count) throw Error("Insufficient approved questions");
    return shuffle(pool).slice(0, count);
  });
  return {
    id: crypto.randomUUID(),
    kind,
    startedAt: new Date().toISOString(),
    items: shuffle(selected).map((q) => ({
      questionId: q.id,
      order: shuffle(q.options.map((_, i) => i)),
    })),
    answers: {},
    position: 0,
  };
}
export function grade(attempt, bank) {
  const map = new Map(bank.map((q) => [q.id, q]));
  return {
    ...attempt,
    submittedAt: new Date().toISOString(),
    results: attempt.items.map((item) => {
      const q = map.get(item.questionId);
      return {
        questionId: q.id,
        lessonId: q.lessonId,
        topic: q.topic,
        answer: attempt.answers[q.id] ?? null,
        correct: attempt.answers[q.id] === q.correctOptionIndex,
      };
    }),
  };
}
export function statistics(profile) {
  const topics = {};
  const mistakes = {};
  let correct = 0,
    total = 0;
  for (const attempt of profile.attempts)
    for (const r of attempt.results) {
      const key = r.lessonId + "::" + r.topic;
      topics[key] ??= {
        lessonId: r.lessonId,
        topic: r.topic,
        correct: 0,
        total: 0,
      };
      topics[key].total++;
      total++;
      if (r.correct) {
        topics[key].correct++;
        correct++;
      } else {
        mistakes[r.questionId] ??= { questionId: r.questionId, count: 0 };
        mistakes[r.questionId].count++;
        mistakes[r.questionId].lastAt = attempt.submittedAt;
      }
      if (mistakes[r.questionId]) mistakes[r.questionId].resolved = r.correct;
    }
  return {
    correct,
    total,
    topics: Object.values(topics).sort(
      (a, b) => a.correct / a.total - b.correct / b.total,
    ),
    mistakes: Object.values(mistakes),
  };
}
export function newProfile(name) {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    attempts: [],
    active: null,
    flashReviews: [],
    reading: {},
    preferences: { theme: "light", fontSize: "normal", quizSize: 10 },
  };
}
