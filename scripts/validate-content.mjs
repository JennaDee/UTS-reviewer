import fs from "node:fs";
import assert from "node:assert/strict";
const bank = JSON.parse(fs.readFileSync("content/approved-question-bank.json"));
const lessons = JSON.parse(fs.readFileSync("content/lessons.json"));
assert.equal(lessons.length, 4);
assert.equal(bank.questions.length, 120);
assert.equal(new Set(bank.questions.map((q) => q.id)).size, 120);
for (const l of lessons) {
  assert.ok(l.sections.length);
  assert.ok(bank.questions.filter((q) => q.lessonId === l.id).length >= 10);
  for (const s of l.sections) {
    assert.ok(s.title);
    assert.ok(s.blocks.length);
  }
}
for (const q of bank.questions) {
  assert.ok(lessons.some((l) => l.id === q.lessonId));
  assert.ok(q.question && q.explanation && q.topic && q.source.pages);
  assert.equal(q.options.length, 4);
  assert.ok(q.correctOptionIndex >= 0 && q.correctOptionIndex < 4);
}
// Every source word must appear in the lesson readers, except lesson/module headings.
const normalize = (s) =>
  s
    .replace(
      /MODULE\s+\d+:\s+(ANCIENT PHILOSOPHERS|MEDIEVAL TO MODERN PHILOSOPHERS|CONTEMPORARY PHILOSOPHERS)/g,
      "",
    )
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
const pages = JSON.parse(fs.readFileSync("content/source-pages.json"));
let source = pages.map((p) => p.text.replace(/\s+/g, " ")).join(" ");
for (const title of [
  "PHILOSOPHICAL PERSPECTIVES OF THE SELF",
  "THE SELF, SOCIETY, AND CULTURE",
  "ANTHROPOLOGICAL CONCEPTUALIZATION OF THE SELF",
  "PSYCHOLOGICAL PERSPECTIVES OF THE SELF",
])
  source = source.replace(title, "");
const reader = lessons
  .flatMap((l) => l.sections.flatMap((s) => [s.title, ...s.blocks]))
  .join(" ");
assert.equal(
  normalize(reader),
  normalize(source),
  "Reader must preserve all source words in order",
);
console.log(
  "Content validated: four lessons, 31 sections, 120 approved questions; all source words preserved.",
);
