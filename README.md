# Understanding the Self · Study Hub

A standalone static learning website for one subject and exactly four lessons. No backend, authentication, administration, content editing, or AI service is included. All educational material lives in repository files.

## Run locally

Use Node.js 20.19+ (or a newer supported LTS release) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm test             # exam, grading, storage, backup tests
npm run test:e2e     # Chrome browser tests; Google Chrome must be installed
npm run build       # source coverage validation + production build
npm run preview     # serve dist locally
```

If Chrome is unavailable, install Playwright Chromium with `npx playwright install chromium` and remove `channel: 'chrome'` from `playwright.config.js`.

## Learning coverage

| Lesson | Source pages | Reader sections | Approved questions |
| --- | --- | --- | --- |
| Philosophical Perspectives of the Self | 1–5 | 12 | 40 |
| The Self, Society, and Culture | 5–7 | 6 | 25 |
| Anthropological Conceptualization of the Self | 7–9 | 5 | 25 |
| Psychological Perspectives of the Self | 9–11 | 8 | 30 |

The readers preserve the supplied PDF's wording, examples, classroom annotations, and nested concepts. Whitespace is normalized. The source document is bundled at `public/uts-source.pdf`. The content validator checks that all source words appear in their original order in the readers, excluding organizational lesson/module headings. The source's assertions and simplified descriptions are presented as course notes, not independently corrected textbook claims.

There are 261 flashcards: 120 question-bank cards and 141 source-note blocks. The approved questions and explanations are unchanged. Every comprehensive exam selects 10 unique questions from each lesson (40 total), shuffles question and answer order, and grades using stable original option indexes. Lesson quizzes offer 5, 10, 15, or 20 questions. Scores and explanations are shown only after submission in the study flow. Since this is a static review tool, answers exist in the downloaded application source; it is not a secure assessment system.

## Local profiles and backups

IndexedDB stores each profile's submitted quiz/exam attempts, active attempt and option order, flashcard review events, reading completion, and study preferences. Statistics and the Mistake Bank are derived from stored attempts. A later correct answer marks a missed question as recovered without removing its past errors. Weak-topic recommendations rank practiced topics by cumulative accuracy. Unpracticed topics have no invented score. Flashcard ratings are self-reported review history, separate from graded mastery.

Local storage remembers only the selected profile ID. Profiles are not authenticated accounts: anyone sharing this browser can select them. There is no secure profile privacy, server storage, or automatic synchronization between devices. Clearing site data, private browsing, or browser eviction can remove progress. A different origin (scheme, hostname, or port) has different storage. Keep the site in one active browser tab while studying to avoid concurrent edits to the same profile.

Use **Profiles & settings → Export backup** to download all profiles. **Import backup** validates data, recomputes grades from the approved bank, and creates additional profiles with new IDs. It never imports educational content or overwrites existing profiles. A backup can be moved to another device manually. Invalid or incompatible backups are rejected. Keep backups before changing content IDs or moving the site to a new URL.

## Developer-managed content

- `content/approved-question-bank.json`: the exact supplied question bank (stable question IDs).
- `content/source-pages.json`: extracted PDF text with source page numbers.
- `content/lessons.json`: four organized lesson readers with stable section IDs.
- `scripts/prepare-content.py`: regenerates reader structure from the extracted text.
- `scripts/validate-content.mjs`: checks coverage and question validity on every build.
- `src/core.js`: randomized attempts, grading, and derived statistics.
- `src/db.js`: IndexedDB transactions.
- `src/backup.js`: backup validation and import normalization.

Only repository maintainers update educational material through Git. Keep question and section IDs stable for existing progress. Source changes should be reviewed against the PDF and approved bank before release; do not add unsourced questions. Run the content validator, tests, and production build after changes. The browser has no educational content authoring controls.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project, including the lockfile and `.github/workflows/pages.yml`. Do not commit `node_modules` or `dist`.
2. In the repository's **Settings → Pages**, choose **GitHub Actions** as the build/deployment source.
3. Run the **Deploy static UTS Study Hub** workflow, or push to `main`.
4. Open the Pages URL reported by the deployment job.

The included workflow runs `npm ci`, unit tests, and the production build, then uploads `dist`. Vite's relative base (`./`) supports repository subpaths. The app does not require rewrite rules or environment variables.

## Deploy to Vercel

1. Push the project to a Git repository and import it in Vercel.
2. Select the **Vite** framework preset.
3. Set install command to `npm ci`, build command to `npm run build`, and output directory to `dist`.
4. Deploy. No database, server functions, secrets, or environment variables are needed.

`vercel.json` includes these build/output settings. Learner data stays in each visitor's browser. Deploying the site does not upload their progress.
