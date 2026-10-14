import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import "fake-indexeddb/auto";
import {
  createAttempt,
  grade,
  statistics,
  newProfile,
  shuffle,
} from "../src/core.js";
import { saveProfile, listProfiles, saveProfiles } from "../src/db.js";
import { validateBackup } from "../src/backup.js";
const bank = JSON.parse(
  fs.readFileSync("content/approved-question-bank.json"),
).questions;
const lessons = JSON.parse(fs.readFileSync("content/lessons.json"));
const ids = lessons.map((l) => l.id);
const cardIds = new Set(bank.map((q) => q.id));
const sectionIds = new Set(lessons.flatMap((l) => l.sections.map((s) => s.id)));
test("100 exams have exactly ten unique approved questions per lesson and valid randomized option mappings", () => {
  const orders = new Set();
  for (let n = 0; n < 100; n++) {
    const a = createAttempt(bank, ids);
    assert.equal(a.items.length, 40);
    assert.equal(new Set(a.items.map((i) => i.questionId)).size, 40);
    for (const id of ids)
      assert.equal(
        a.items.filter(
          (i) => bank.find((q) => q.id === i.questionId).lessonId === id,
        ).length,
        10,
      );
    for (const i of a.items)
      assert.deepEqual([...i.order].sort(), [0, 1, 2, 3]);
    orders.add(JSON.stringify(a.items));
  }
  assert.equal(orders.size, 100);
});
test("grading uses original option indexes, treats unanswered as wrong, and leaves original attempt intact", () => {
  const a = createAttempt(bank, ["society"], "quiz", 5);
  a.answers[a.items[0].questionId] = bank.find(
    (q) => q.id === a.items[0].questionId,
  ).correctOptionIndex;
  const result = grade(a, bank);
  assert.equal(result.results.filter((r) => r.correct).length, 1);
  assert.equal(result.results.filter((r) => r.answer === null).length, 4);
  assert.equal(a.results, undefined);
});
test("mistake history persists after recovery and mastery derives only from attempts", () => {
  const p = newProfile("A");
  const a = createAttempt(bank, ["psychology"], "quiz", 5);
  p.attempts.push(grade(a, bank));
  for (const i of a.items)
    a.answers[i.questionId] = bank.find(
      (q) => q.id === i.questionId,
    ).correctOptionIndex;
  p.attempts.push(grade(a, bank));
  const s = statistics(p);
  assert.equal(s.mistakes.length, 5);
  assert.ok(s.mistakes.every((m) => m.resolved && m.count === 1));
  assert.equal(s.correct, 5);
  assert.equal(s.total, 10);
});
test("IndexedDB isolates profiles and persists active ordering, reading, preferences and reviews", async () => {
  const a = newProfile("One"),
    b = newProfile("Two");
  a.active = createAttempt(bank, ids);
  a.reading[lessons[0].sections[0].id] = true;
  a.flashReviews.push({
    cardId: bank[0].id,
    rating: "known",
    at: new Date().toISOString(),
  });
  a.preferences.theme = "dark";
  await saveProfiles([a, b]);
  const saved = await listProfiles();
  assert.deepEqual(
    saved.find((p) => p.id === a.id),
    a,
  );
  assert.deepEqual(
    saved.find((p) => p.id === b.id),
    b,
  );
  a.active.answers[a.active.items[0].questionId] = 2;
  await saveProfile(a);
  assert.equal(
    (await listProfiles()).find((p) => p.id === a.id).active.answers[
      a.active.items[0].questionId
    ],
    2,
  );
});
test("backup round trip preserves data, recomputes scores, assigns new IDs and rejects malformed imports", () => {
  const p = newProfile("Backup");
  p.active = createAttempt(bank, ids);
  p.attempts.push(grade(createAttempt(bank, ["society"], "quiz", 5), bank));
  const data = { format: "uts-study-hub", version: 1, profiles: [p] };
  const imported = validateBackup(data, bank, cardIds, sectionIds)[0];
  assert.notEqual(imported.id, p.id);
  assert.deepEqual(imported.active, p.active);
  assert.equal(imported.attempts[0].results.length, 5);
  const bad = structuredClone(data);
  bad.profiles[0].active.items[0].order = [0, 0, 0, 0];
  assert.throws(() => validateBackup(bad, bank, cardIds, sectionIds));
  const content = structuredClone(data);
  content.profiles[0].reading["unknown-topic"] = true;
  assert.throws(() => validateBackup(content, bank, cardIds, sectionIds));
});
test("shuffle never mutates input", () => {
  const input = [1, 2, 3];
  assert.deepEqual(
    shuffle(input, () => 0),
    [2, 3, 1],
  );
  assert.deepEqual(input, [1, 2, 3]);
});
