import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import process from "node:process";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:4321";
const browserPath = process.env.AUDIT_BROWSER_PATH;
const routes = [
  ["/", "Home"],
  ["/about/", "About"],
  ["/programs/", "Programs"],
  ["/programs/education-support/", "Program"],
  ["/impact/", "Impact"],
  ["/transparency/", "Transparency"],
  ["/transparency/reports/donation-30000-rwf/", "Report"],
  ["/gallery/", "Gallery"],
  ["/gallery/sample-community-moments/", "Album"],
  ["/news/", "News"],
  ["/news/sample-learning-together/", "News post"],
  ["/get-involved/", "Get involved"],
  ["/donate/", "Donate"],
  ["/partner/", "Partner"],
  ["/volunteer/", "Volunteer"],
  ["/pray/", "Pray"],
  ["/contact/", "Contact"],
  ["/search/", "Search"],
  ["/404.html", "404"],
  ["/fr/", "French home"],
  ["/fr/donate/", "French Donate"],
  ["/rw/", "Kinyarwanda home"],
  ["/rw/donate/", "Kinyarwanda Donate"],
];

const browser = await chromium.launch({
  headless: true,
  ...(browserPath ? { executablePath: browserPath } : {}),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1365, height: 900 },
});
const page = await context.newPage();
const results = [];

try {
  for (const [path, name] of routes) {
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      const response = await page.goto(new URL(path, baseUrl).href, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(100);

      const headings = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll(
        (elements) => {
          let previousLevel = 0;
          const skipped = [];
          for (const element of elements) {
            const level = Number(element.tagName.slice(1));
            if (previousLevel && level > previousLevel + 1) {
              skipped.push(`${element.tagName}: ${element.textContent?.trim()}`);
            }
            previousLevel = level;
          }
          return {
            h1Count: document.querySelectorAll("h1").length,
            skipped,
          };
        },
      );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      results.push({
        path,
        name,
        theme,
        status: response?.status() ?? null,
        headings,
        violations: axe.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            html: node.html,
            summary: node.failureSummary,
            checks: node.any.map((check) => ({
              message: check.message,
              data: check.data,
            })),
          })),
        })),
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  const keyboardFocus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const style = getComputedStyle(active);
    return {
      tagName: active.tagName,
      className: active.className,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  const menu = page.locator("[data-menu-toggle]");
  await menu.click();
  const menuExpanded = await menu.getAttribute("aria-expanded");
  const menuFocusWithin = await page
    .locator("#primary-navigation a")
    .first()
    .evaluate((element) => element === document.activeElement);
  await page.keyboard.press("Escape");
  const menuClosedByEscape = (await menu.getAttribute("aria-expanded")) === "false";
  const slider = page.locator("[data-hero-slider]");
  const pause = slider.locator("[data-toggle]");
  const sliderPausedForReducedMotion =
    (await pause.getAttribute("aria-pressed")) === "true";
  await pause.click();
  await pause.click();
  const sliderPaused = await pause.getAttribute("aria-pressed");
  const reducedMotionTransition = await slider
    .locator("[data-slide]")
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  const videoPage = await context.newPage();
  await videoPage.setViewportSize({ width: 1365, height: 900 });
  await videoPage.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await videoPage.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: false, effectiveType: "4g" },
    });
  });
  await videoPage.route(`${baseUrl}/`, async (route) => {
    const response = await route.fetch();
    const html = (await response.text())
      .replace('data-slide-type="image"', 'data-slide-type="video"')
      .replace(
        '<div class="hero-slider__scrim"',
        '<video data-video data-video-src="/video-audit-fixture.mp4" data-video-poster="/images/design-placeholder.svg"></video><div class="hero-slider__scrim"',
      );
    await route.fulfill({ response, body: html });
  });
  await videoPage.goto(new URL("/", baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await videoPage.waitForTimeout(100);
  const wideVideoSources = await videoPage
    .locator("[data-hero-slider] [data-video]")
    .evaluateAll((videos) => videos.map((video) => video.getAttribute("src")));
  await videoPage.setViewportSize({ width: 390, height: 844 });
  await videoPage.goto(new URL("/", baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await videoPage.waitForTimeout(100);
  const mobileVideoSources = await videoPage
    .locator("[data-hero-slider] [data-video]")
    .evaluateAll((videos) => videos.map((video) => video.getAttribute("src")));
  await videoPage.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, effectiveType: "4g" },
    });
  });
  await videoPage.setViewportSize({ width: 1365, height: 900 });
  await videoPage.goto(new URL("/", baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await videoPage.waitForTimeout(100);
  const dataSaverVideoSources = await videoPage
    .locator("[data-hero-slider] [data-video]")
    .evaluateAll((videos) => videos.map((video) => video.getAttribute("src")));

  await page.goto(new URL("/contact/", baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(100);
  await page.locator('form[name="contact"] button[type="submit"]').click();
  const formErrors = await page
    .locator('form[name="contact"] [aria-invalid="true"]')
    .count();

  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto(new URL("/gallery/sample-community-moments/", baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  const trigger = page.locator("[data-lightbox-trigger]").first();
  await trigger.click();
  const lightboxOpen = await page.locator("[data-lightbox]").evaluate(
    (dialog) => dialog.open,
  );
  await page.locator("[data-lightbox-close]").click();
  const lightboxFocusReturned = await trigger.evaluate(
    (element) => element === document.activeElement,
  );

  console.log(
    JSON.stringify(
      {
        results,
        interactions: {
          menuExpanded,
          menuFocusWithin,
          menuClosedByEscape,
          sliderPausedForReducedMotion,
          sliderPaused,
          reducedMotionTransition,
          keyboardFocus,
          mobileVideoSources,
          dataSaverVideoSources,
          wideVideoSources,
          formErrors,
          lightboxOpen,
          lightboxFocusReturned,
        },
      },
      null,
      2,
    ),
  );
  const interactionProblems =
    menuExpanded !== "true" ||
    !menuFocusWithin ||
    !menuClosedByEscape ||
    !sliderPausedForReducedMotion ||
    sliderPaused !== "true" ||
    reducedMotionTransition !== "0s" ||
    keyboardFocus?.outlineStyle === "none" ||
    !(mobileVideoSources.length > 0 && mobileVideoSources.every((src) => !src)) ||
    !(dataSaverVideoSources.length > 0 &&
      dataSaverVideoSources.every((src) => !src)) ||
    !wideVideoSources.some(Boolean) ||
    formErrors === 0 ||
    !lightboxOpen ||
    !lightboxFocusReturned;
  if (
    interactionProblems ||
    results.some(
      (result) =>
        result.status !== 200 ||
        result.headings.h1Count !== 1 ||
        result.headings.skipped.length > 0 ||
        result.violations.length > 0,
    )
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
