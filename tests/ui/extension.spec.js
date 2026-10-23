import { test, expect, chromium } from "@playwright/test";
import path from "node:path";

test("広告ブロックの実通信・無効化・サイト除外・保存", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium", executablePath: chromium.executablePath(), headless: true,
    args: [`--disable-extensions-except=${path.resolve("dist")}`, `--load-extension=${path.resolve("dist")}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    await expect.poll(() => worker.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length)).toBe(1);
    const match = () => worker.evaluate(async () => chrome.declarativeNetRequest.testMatchOutcome({ url: "https://googleads.g.doubleclick.net/ad.js", initiator: "https://publisher.test", type: "script" }));
    expect((await match()).matchedRules.length).toBe(1);
    // Real requests to a blocked endpoint must fail before any network response.
    const page = await context.newPage();
    await context.route("https://publisher.test/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Publisher</h1>" }));
    await page.goto("https://publisher.test/");
    const failure = page.waitForEvent("requestfailed", { predicate: request => request.url().includes("doubleclick.net") });
    await page.evaluate(() => { const script = document.createElement("script"); script.src = "https://googleads.g.doubleclick.net/ad.js"; document.body.append(script); });
    expect((await failure).failure().errorText).toContain("ERR_BLOCKED_BY_CLIENT");
    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${id}/adblock.html`);
    await expect(settings.locator("#enabled")).toBeChecked();
    await settings.locator("#enabled").uncheck();
    await settings.getByRole("button", { name: "保存", exact: true }).click();
    await expect(settings.getByRole("status")).toContainText("保存しました");
    expect((await match()).matchedRules.length).toBe(0);
    await settings.reload();
    await expect(settings.locator("#enabled")).not.toBeChecked();
    await settings.locator("#enabled").check();
    await settings.locator("#sites").fill("https://publisher.test/path");
    await settings.getByRole("button", { name: "保存", exact: true }).click();
    await expect(settings.getByRole("status")).toContainText("保存しました");
    const allowed = await worker.evaluate(() => chrome.declarativeNetRequest.testMatchOutcome({ url: "https://publisher.test/", type: "main_frame" }));
    expect(allowed.matchedRules.some(rule => rule.ruleId === 10001)).toBe(true);
    await page.reload();
    // Fulfill allowed network requests locally, without contacting an ad service.
    await context.route("https://googleads.g.doubleclick.net/**", route => route.fulfill({ contentType: "text/javascript", body: "window.adRequestAllowed = true" }));
    await page.evaluate(() => { const script = document.createElement("script"); script.src = "https://googleads.g.doubleclick.net/ad.js"; document.body.append(script); });
    await expect.poll(() => page.evaluate(() => window.adRequestAllowed)).toBe(true);
  } finally { await context.close(); }
});

test("新規タブ: 4色テーマと見出しを保存し再読み込みと別タブに反映", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium", executablePath: chromium.executablePath(), headless: true,
    args: [`--disable-extensions-except=${path.resolve("dist")}`, `--load-extension=${path.resolve("dist")}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/newtab.html`);
    await page.getByText("ページをカスタマイズ", { exact: true }).click();
    const other = await context.newPage();
    await other.goto(`chrome-extension://${id}/newtab.html`);
    for (const theme of ["lavender", "forest", "dark", "blue"]) {
      await page.getByLabel("テーマ", { exact: true }).selectOption(theme);
      await page.getByLabel("見出し", { exact: true }).fill(`今日の ${theme} <script>`);
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("保存しました");
      await expect(other.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(other.locator("h1")).toHaveText(`今日の ${theme} <script>`);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("h1")).toHaveText(`今日の ${theme} <script>`);
      await expect(page.getByLabel("見出し", { exact: true })).toHaveValue(`今日の ${theme} <script>`);
      await page.getByText("ページをカスタマイズ", { exact: true }).click();
    }
    await page.getByLabel("見出し", { exact: true }).fill("   ");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("次のアイデアへ。");
    await page.screenshot({ path: "artifacts/sideflow-newtab.png", fullPage: true });
  } finally { await context.close(); }
});


test("標準サイドパネルをユーザー操作で開き、ページへ埋め込まない", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium", executablePath: chromium.executablePath(), headless: true,
    args: [`--disable-extensions-except=${path.resolve("dist")}`, `--load-extension=${path.resolve("dist")}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    await expect.poll(() => worker.evaluate(async () => (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick)).toBe(true);
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.permissions).not.toContain("scripting");
    expect((await worker.evaluate(() => chrome.sidePanel.getOptions({}))).path).toBe("index.html");
    await worker.evaluate(() => {
      globalThis.openedPanels = [];
      chrome.sidePanel.onOpened.addListener(info => globalThis.openedPanels.push(info));
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/newtab.html`);
    await page.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
    await expect.poll(() => worker.evaluate(() => globalThis.openedPanels.length)).toBeGreaterThan(0);
    await expect(page.locator("#sideflow-surface")).toHaveCount(0);
    await expect(page.locator("#sideflow-page-layout")).toHaveCount(0);
  } finally { await context.close(); }
});

test("標準パネル画面で実タブ操作と選択したブックマークの保存を維持", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium", executablePath: chromium.executablePath(), headless: true,
    args: [`--disable-extensions-except=${path.resolve("dist")}`, `--load-extension=${path.resolve("dist")}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    const originals = await worker.evaluate(async () => {
      await chrome.storage.local.set({ placement: "bottom" });
      const folder = await chrome.bookmarks.create({ parentId: "1", title: "Work links" });
      await chrome.bookmarks.create({ parentId: folder.id, title: "Keep", url: "https://example.org/keep" });
      await chrome.bookmarks.create({ parentId: folder.id, title: "Exclude", url: "https://example.org/exclude" });
      return chrome.bookmarks.getTree();
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/index.html`);
    await expect(page.locator(".browser-shell")).toHaveClass(/placement-left/);
    await expect(page.getByRole("group", { name: "表示位置" })).toHaveCount(0);
    await page.getByRole("button", { name: "ブックマークバーを確認" }).click();
    await expect(page.getByRole("checkbox", { name: "Keep", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Exclude", exact: true })).toBeChecked();
    await page.getByRole("checkbox", { name: "Exclude", exact: true }).uncheck();
    await page.getByRole("button", { name: "1件をインポート" }).click();
    await expect(page.locator(".pinned-grid .imported-link")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".pinned-grid .imported-link")).toHaveCount(1);
    expect(await worker.evaluate(() => chrome.bookmarks.getTree())).toEqual(originals);
    await context.route("https://native.test/**", route => route.fulfill({ contentType: "text/html", body: "<title>Native target</title><h1>Target</h1>" }));
    const tabId = await worker.evaluate(async () => (await chrome.tabs.create({ url: "https://native.test/", active: false })).id);
    await expect(page.getByRole("button", { name: /^(Native target|native\.test)$/, exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^(Native target|native\.test)$/, exact: true }).click();
    await expect.poll(() => worker.evaluate(id => chrome.tabs.get(id).then(t => t.active), tabId)).toBe(true);
    await expect(page.locator(".error-toast")).toHaveCount(0);
    await page.bringToFront();
    for (const width of [320, 480]) {
      await page.setViewportSize({ width, height: 850 });
      await expect(page.getByRole("complementary")).toHaveCSS("width", `${width}px`);
    }
    await page.screenshot({ path: "artifacts/sideflow-native-panel.png" });
  } finally { await context.close(); }
});
