import { test, expect } from "@playwright/test";
const nav = (page, name) =>
  page
    .locator(".sidebar")
    .getByRole("button", {
      name: name.slice(name.indexOf(" ") + 1),
      exact: true,
    });
test("exam saves on refresh, reveals only after submission, and feeds mistakes and history", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "✎ Comprehensive exam").click();
  await page.getByRole("button", { name: "Start 40-question exam" }).click();
  await expect(
    page.getByRole("heading", { name: "Question 1 of 40" }),
  ).toBeVisible();
  await page.getByRole("radio").first().check();
  const question = await page.locator(".question h2").textContent();
  const options = await page.locator(".option").allTextContents();
  await page.reload();
  await expect(page.locator(".question h2")).toHaveText(question);
  expect(await page.locator(".option").allTextContents()).toEqual(options);
  await expect(page.getByRole("radio").first()).toBeChecked();
  await expect(page.getByText("Correct answer:", { exact: false })).toHaveCount(
    0,
  );
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Submit attempt" }).click();
  await expect(page.getByText("Correct answer:", { exact: false })).toHaveCount(
    40,
  );
  await nav(page, "↺ Mistake Bank").click();
  expect(await page.locator(".review").count()).toBeGreaterThanOrEqual(39);
  await nav(page, "▥ My progress").click();
  await expect(page.locator(".history > div")).toHaveCount(1);
  await page
    .locator(".history")
    .getByRole("button", { name: "Review", exact: true })
    .click();
  await expect(page.getByText("Correct answer:", { exact: false })).toHaveCount(
    40,
  );
});
test("reading, flashcards, settings, and profiles survive reload and remain isolated", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open lesson →" }).first().click();
  await page.getByRole("checkbox").first().check();
  await expect(page.getByRole("checkbox").first()).toHaveAttribute(
    "data-saved",
    "true",
  );
  await page.reload();
  await page.getByRole("button", { name: "Open lesson →" }).first().click();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.getByRole("button", { name: "Practice flashcards" }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: "I knew this" }).click();
  await nav(page, "⚙ Profiles & settings").click();
  await page.getByLabel("Reader text size").selectOption("large");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByLabel("New profile name").fill("Second learner");
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(
    page.getByText("Sections read", { exact: true }).locator(".."),
  ).toContainText("0");
  await page
    .getByLabel("Local learner profile")
    .selectOption({ label: "My study profile" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-font", "large");
  await expect(
    page.getByText("Sections read", { exact: true }).locator(".."),
  ).toContainText("1");
  await nav(page, "▥ My progress").click();
  await expect(
    page.getByText("Flashcard reviews", { exact: true }).locator(".."),
  ).toContainText("1");
});
test("backup exports and imports without replacing existing profiles; malformed backup is rejected", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "⚙ Profiles & settings").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.locator("#import").setInputFiles(path);
  await expect(page.locator(".notice[role=status]")).toContainText(
    "Imported 1 profile",
  );
  await expect(page.locator("#profile option")).toHaveCount(2);
  await page
    .locator("#import")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"wrong"}'),
    });
  await expect(page.locator(".notice[role=status]")).toContainText(
    "Invalid or incompatible",
  );
  await expect(page.locator("#profile option")).toHaveCount(2);
});
test("mobile layout and all four lesson readers are usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (let i = 0; i < 4; i++) {
    await nav(page, "▤ Lesson library").click();
    await page.getByRole("button", { name: "Open lesson →" }).nth(i).click();
    expect(await page.locator(".reading-section").count()).toBe(
      [12, 6, 5, 8][i],
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/mobile-reader.png",
    fullPage: false,
  });
});

test("desktop overview has no overflow or runtime errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your lesson library" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-overview.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("IndexedDB survives closing and reopening the browser", async () => {
  const { chromium } = await import("@playwright/test");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "uts-browser-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(directory, {
      channel: "chrome",
      headless: true,
    });
    let page = await context.newPage();
    await page.goto("http://127.0.0.1:5173");
    await nav(page, "✎ Comprehensive exam").click();
    await page.getByRole("button", { name: "Start 40-question exam" }).click();
    await page.getByRole("radio").first().check();
    await expect(
      page.getByText("1 answered · Progress saved automatically"),
    ).toBeVisible();
    const question = await page.locator(".question h2").textContent();
    await context.close();
    context = await chromium.launchPersistentContext(directory, {
      channel: "chrome",
      headless: true,
    });
    page = await context.newPage();
    await page.goto("http://127.0.0.1:5173");
    await expect(page.locator(".question h2")).toHaveText(question);
    await expect(page.getByRole("radio").first()).toBeChecked();
  } finally {
    await context?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
