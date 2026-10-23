import { test, expect, chromium, selectors } from "@playwright/test";
import path from "node:path";

await selectors.register("sideflow", () => ({
  query(root, selector) {
    return window.__sideflowTestRoot?.querySelector(selector) || null;
  },
  queryAll(root, selector) {
    return [...(window.__sideflowTestRoot?.querySelectorAll(selector) || [])];
  },
}));
async function bindClosedRoot(page, context) {
  await expect(page.locator("#sideflow-surface")).toHaveCount(1);
  const session = await context.newCDPSession(page);
  const { root } = await session.send("DOM.getDocument", {
    depth: -1,
    pierce: true,
  });
  function find(node) {
    if (node.attributes?.includes("sideflow-surface")) return node;
    for (const child of [
      ...(node.children || []),
      ...(node.shadowRoots || []),
    ]) {
      const hit = find(child);
      if (hit) return hit;
    }
  }
  const host = find(root);
  const shadow = host.shadowRoots[0];
  const { object } = await session.send("DOM.resolveNode", {
    nodeId: shadow.nodeId,
  });
  await session.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    functionDeclaration: "function(){window.__sideflowTestRoot=this;}",
  });
  await session.detach();
}

test("拡張: ホバー・スワイプ・ピン留め・配置・実タブグループ", async () => {
  test.setTimeout(60000);
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    executablePath: chromium.executablePath(),
    headless: true,
    viewport: { width: 1200, height: 850 },
    args: [
      "--window-size=1200,950",
      `--disable-extensions-except=${path.resolve("dist")}`,
      `--load-extension=${path.resolve("dist")}`,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 10000 }));
    await expect.poll(() => worker.evaluate(async () => (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick)).toBe(false);
    const globalPanel = await worker.evaluate(() => chrome.sidePanel.getOptions({}));
    expect(globalPanel.path).toBe("index.html");
    expect(globalPanel.enabled).toBe(true);
    await context.route("http://tabs.test/**", (route) => {
      const name = new URL(route.request().url()).pathname.slice(1) || "Main";
      return route.fulfill({
        contentType: "text/html",
        body: `<html><head><title>${name}</title></head><body style="margin:0;background:#f7f8fa;height:200vh"><h1 style="padding:50px">${name}</h1></body></html>`,
      });
    });
    await worker.evaluate(() =>
      chrome.storage.local.set({ setupComplete: true }),
    );
    const page = await context.newPage();
    await page.goto("http://tabs.test/Main");
    const host = page.locator("#sideflow-surface");
    await expect(page.locator("#sideflow-edge")).toHaveCount(1);
    console.info("extension: hover");
    // Hover reveal is temporary and closes after leaving.
    await page.mouse.move(1, 350);
    await expect(host).toHaveCSS("opacity", "1");
    await bindClosedRoot(page, context);
    const ui = page.locator("sideflow=div");
    expect(
      await page.evaluate(
        () => document.getElementById("sideflow-surface").shadowRoot,
      ),
    ).toBeNull();
    await expect(ui.getByRole("button", { name: "常時表示" })).toBeVisible();
    await page.mouse.move(100, 350);
    await page.mouse.move(600, 350);
    await expect(host).toHaveCSS("opacity", "0");
    console.info("extension: swipe");
    // Horizontal wheel gesture opens without a click, reverse gesture inside closes.
    await page.mouse.move(600, 300);
    await page.mouse.wheel(80, 0);
    await expect(host).toHaveCSS("opacity", "0");
    // A page that stops bubbling wheel events must not block reveal.
    await page.evaluate(() => document.addEventListener("wheel", e => e.stopPropagation(), { passive: true }));
    await page.mouse.wheel(-30, 23);
    await page.mouse.wheel(-30, 23);
    await expect(host).toHaveCSS("opacity", "1");
    await page.waitForTimeout(150);
    await page.mouse.wheel(-80, 0);
    await expect(host).toHaveCSS("opacity", "1");
    await page.mouse.wheel(3, 0);
    await page.mouse.wheel(-2, 0);
    await expect(host).toHaveCSS("opacity", "1");
    await page.mouse.wheel(60, 0);
    await expect(host).toHaveCSS("opacity", "0");
    await page.waitForTimeout(150);
    await page.mouse.wheel(80, 0);
    await expect(host).toHaveCSS("opacity", "0");
    await page.mouse.wheel(-60, 0);
    await expect(host).toHaveCSS("opacity", "1");
    await page.waitForTimeout(550); // gesture momentum cooldown
    await page.mouse.move(100, 300);
    await page.mouse.wheel(100, 0);
    await expect(ui.locator(".profile-button")).toContainText("Personal");
    expect(await ui.locator(".sidebar-scroll").evaluate(el => el.getAnimations().some(a => a.effect.getTiming().duration === 320))).toBe(true);
    // Momentum timing is covered with an explicit clock in model.test.js;
    // UI assertions may take longer than the 100 ms gap between strokes.
    await page.mouse.wheel(-100, 0);
    await expect(ui.locator(".profile-button")).toContainText("Work");
    await page.mouse.wheel(0, 100);
    await expect(ui.locator(".profile-button")).toContainText("Work");
    await page.waitForTimeout(280);
    await page.mouse.move(100, 25);
    await page.mouse.wheel(100, 0);
    await expect(host).toHaveCSS("opacity", "0");
    // Real wheel input inside an embedded document must reveal the top-level UI.
    await page.evaluate(() => {
      const frame = document.createElement("iframe");
      frame.id = "gesture-frame";
      frame.src = "http://tabs.test/Embedded";
      frame.style.cssText = "position:fixed;left:400px;top:200px;width:400px;height:250px";
      document.body.append(frame);
    });
    await expect(page.frameLocator("#gesture-frame").locator("body")).toBeVisible();
    await page.waitForTimeout(600);
    await page.mouse.move(600, 300);
    await page.mouse.wheel(-100, 0);
    await expect(host).toHaveCSS("opacity", "1");
    await page.evaluate(() => document.getElementById("gesture-frame").remove());
    await ui.getByRole("button", { name: "サイドバーを閉じる", exact: true }).click();
    await expect(host).toHaveCSS("opacity", "0");
    console.info("extension: pin persistence");
    // Toolbar message opens persistently; pin is saved across page navigation.
    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: "http://tabs.test/Main" });
      await chrome.tabs.sendMessage(tabs[0].id, { type: "sideflow-toggle" });
    });
    await expect(host).toHaveCSS("opacity", "1");
    await ui.getByRole("button", { name: "常時表示" }).click();
    await expect(ui.getByRole("button", { name: "常時表示" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.mouse.move(600, 350);
    await page.reload();
    await bindClosedRoot(page, context);
    await expect(host).toHaveCSS("opacity", "1");
    await expect(ui.getByRole("button", { name: "常時表示" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await ui.getByRole("button", { name: "右", exact: true }).click();
    await expect(ui.locator(".sidebar")).toHaveCSS("width", "260px");
    await expect
      .poll(() =>
        ui
          .locator(".sidebar")
          .boundingBox()
          .then((b) => b.x),
      )
      .toBe(940);

    await ui.getByRole("button", { name: "下ドック", exact: true }).click();

    await expect(ui.locator(".sidebar")).toHaveCSS("height", "156px");
    await page.reload();
    await bindClosedRoot(page, context);
    await expect(ui.locator(".sidebar")).toHaveCSS("height", "156px");
    await expect(
      ui.getByRole("button", { name: "下ドック", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await ui.getByRole("button", { name: "左", exact: true }).click();
    console.info("extension: right/bottom gestures");
    await ui.getByRole("button", { name: "Work", exact: true }).click();
    await ui.getByRole("button", { name: "Personal", exact: true }).click();
    await expect(ui.locator(".browser-shell")).toHaveCSS(
      "--theme-tint",
      "#e8dff0",
    );
    await page.bringToFront();
    await ui.getByRole("button", { name: "右", exact: true }).click();
    await expect(ui.locator(".sidebar")).toHaveCSS("width", "260px");
    await expect
      .poll(() =>
        ui
          .locator(".sidebar")
          .boundingBox()
          .then((b) => b.x),
      )
      .toBe(940);
    await expect
      .poll(() =>
        worker.evaluate(() =>
          chrome.storage.local.get("placement").then((s) => s.placement),
        ),
      )
      .toBe("right");
    await ui.getByRole("button", { name: "サイドバーを閉じる" }).click();
    await expect(host).toHaveCSS("opacity", "0");
    await expect
      .poll(() =>
        worker.evaluate(() =>
          chrome.storage.local
            .get("sidebarPinned")
            .then((s) => s.sidebarPinned),
        ),
      )
      .toBe(false);
    await page.mouse.move(600, 300);
    await page.mouse.wheel(-60, 0);
    await expect(host).toHaveCSS("opacity", "1");
    await page.waitForTimeout(550);
    await page.mouse.move(1100, 25);
    await page.mouse.wheel(100, 0);
    await expect(host).toHaveCSS("opacity", "0");
    await worker.evaluate(() =>
      chrome.storage.local.set({ placement: "bottom" }),
    );
    await expect(ui.locator(".sidebar")).toHaveCSS("height", "156px");
    await page.waitForTimeout(550);
    await page.mouse.move(600, 835);
    await page.mouse.wheel(0, -100);
    await expect(host).toHaveCSS("opacity", "1");
    await expect(
      ui.getByRole("button", { name: "下ドック", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: "artifacts/extension-dock.png" });
    await page.waitForTimeout(550);
    await page.mouse.move(400, 815);
    await page.mouse.wheel(0, 100);
    await expect(host).toHaveCSS("opacity", "0");
    // Bottom dock accepts both horizontal directions at the screen edge too.
    await page.waitForTimeout(150);
    await page.mouse.move(600, 845);
    await page.mouse.wheel(-80, 0);
    await expect(host).toHaveCSS("opacity", "1");
    await page.mouse.move(400, 815);
    await page.mouse.wheel(80, 0);
    await expect(host).toHaveCSS("opacity", "0");
    await expect(ui.locator(".error-toast")).toHaveCount(0);
    await worker.evaluate(async () => {
      const [t] = await chrome.tabs.query({ url: "http://tabs.test/Main" });
      await chrome.tabs.sendMessage(t.id, { type: "sideflow-toggle" });
    });
    await expect(host).toHaveCSS("opacity", "1");
    await ui.getByRole("button", { name: "左", exact: true }).click();
    await ui.getByRole("button", { name: "常時表示" }).click();
    console.info("extension: real tab groups");
    for (const name of ["Alpha-one", "Alpha-two", "Beta-one"]) {
      const extra = await context.newPage();
      await extra.goto(`http://tabs.test/${name}`);
    }
    await page.bringToFront();
    const ids = await worker.evaluate(async () => {
      const [a] = await chrome.tabs.query({
        url: "http://tabs.test/Alpha-one",
      });
      const [b] = await chrome.tabs.query({
        url: "http://tabs.test/Alpha-two",
      });
      const [c] = await chrome.tabs.query({ url: "http://tabs.test/Beta-one" });
      const ga = await chrome.tabs.group({ tabIds: [a.id, b.id] });
      await chrome.tabGroups.update(ga, { title: "Alpha", color: "yellow" });
      const gb = await chrome.tabs.group({ tabIds: [c.id] });
      await chrome.tabGroups.update(gb, { title: "Beta", color: "pink" });
      return { a: a.id, b: b.id, c: c.id, ga, gb };
    });
    await expect(ui.locator(".color-yellow .tab-row")).toHaveCount(2);
    await expect(ui.locator(".color-pink .tab-row")).toHaveCount(1);
    await ui
      .locator(".tab-row")
      .filter({ hasText: "Alpha-one" })
      .dragTo(ui.locator(".color-pink .group-heading"));
    await expect
      .poll(() =>
        worker.evaluate(
          (id) => chrome.tabs.get(id).then((t) => t.groupId),
          ids.a,
        ),
      )
      .toBe(ids.gb);
    await expect(ui.locator(".color-pink .tab-row")).toHaveCount(2);
    await expect(ui.locator(".sidebar")).toHaveAttribute("aria-busy", "false");
    await ui
      .locator(".color-pink .tab-row")
      .filter({ hasText: "Alpha-one" })
      .dragTo(
        ui.locator(".color-pink .tab-row").filter({ hasText: "Beta-one" }),
      );
    await expect
      .poll(() =>
        worker.evaluate(async (ids) => {
          const a = await chrome.tabs.get(ids.a);
          const c = await chrome.tabs.get(ids.c);
          return a.index < c.index;
        }, ids),
      )
      .toBe(true);
    await ui.getByRole("button", { name: "Beta-oneを閉じる" }).click();
    await expect(ui.locator(".color-pink .tab-row")).toHaveCount(1);
    await page.bringToFront();
    await ui.getByRole("button", { name: "右", exact: true }).click();
    await expect(ui.locator(".sidebar")).toHaveCSS("width", "260px");
    await expect
      .poll(() =>
        ui
          .locator(".sidebar")
          .boundingBox()
          .then((b) => b.x),
      )
      .toBe(940);
    await worker.evaluate(() => chrome.storage.local.set({ placement: "left", sidebarPinned: false }));
    const newTab = await context.newPage();
    await newTab.goto("chrome://newtab/");
    await expect(newTab.getByRole("heading", { name: "次のアイデアへ。" })).toBeVisible();
    await newTab.mouse.move(600, 300);
    await newTab.mouse.wheel(-100, 0);
    await expect(newTab.locator("#sideflow-surface")).toHaveCSS("opacity", "1");
    await bindClosedRoot(newTab, context);
    const newUi = newTab.locator("sideflow=div");
    await expect(newUi.locator(".error-toast")).toHaveCount(0);
    await expect(newUi.locator(".tab-row")).not.toHaveCount(0);
    await newTab.waitForTimeout(280);
    await newTab.mouse.wheel(100, 0);
    await expect(newTab.locator("#sideflow-surface")).toHaveCSS("opacity", "0");
    const toggleReply = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return chrome.runtime.sendMessage({ type: "sideflow-newtab-toggle", tabId: tab.id });
    });
    expect(toggleReply).toEqual({ ok: true });
    await expect(newTab.locator("#sideflow-surface")).toHaveCSS("opacity", "1");
    await newUi.getByRole("button", { name: "右", exact: true }).click();
    await expect(newTab.locator("#sideflow-surface")).toHaveCSS("right", "0px");
    await newUi.getByRole("button", { name: "下ドック", exact: true }).click();
    await expect(newTab.locator("#sideflow-surface")).toHaveCSS("height", "156px");
    await newUi.getByRole("button", { name: "サイドバーを閉じる", exact: true }).click();
    await newTab.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
    await expect(newTab.locator("#sideflow-surface")).toHaveCSS("opacity", "1");
  } finally {
    await context.close();
  }
});

test("初回セットアップ: ブックマークバーを非破壊で取り込み、フォルダと保存を維持", async () => {
  test.setTimeout(40000);
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    executablePath: chromium.executablePath(),
    headless: true,
    viewport: { width: 1200, height: 850 },
    args: [
      "--window-size=1200,950",
      `--disable-extensions-except=${path.resolve("dist")}`,
      `--load-extension=${path.resolve("dist")}`,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 10000 }));
    const original = await worker.evaluate(async () => {
      const folder = await chrome.bookmarks.create({
        parentId: "1",
        title: "Work Links",
      });
      await chrome.bookmarks.create({
        parentId: folder.id,
        title: "Mail",
        url: "http://127.0.0.1:5173/?imported=mail",
      });
      const design = await chrome.bookmarks.create({
        parentId: folder.id,
        title: "Design",
      });
      await chrome.bookmarks.create({
        parentId: design.id,
        title: "Figma",
        url: "http://127.0.0.1:5173/?imported=figma",
      });
      await chrome.bookmarks.create({
        parentId: "1",
        title: "Calendar",
        url: "http://127.0.0.1:5173/?imported=calendar",
      });
      return chrome.bookmarks.getTree();
    });
    await context.route("http://tabs.test/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Import test</title><h1>Test page</h1>",
      }),
    );
    const page = await context.newPage();
    await page.goto("http://tabs.test/Import");
    await page.mouse.move(1, 350);
    const host = page.locator("#sideflow-surface");
    await expect(host).toHaveCSS("opacity", "1");
    await bindClosedRoot(page, context);
    const ui = page.locator("sideflow=div");
    await expect(
      ui.getByRole("dialog", { name: "初回セットアップ" }),
    ).toBeVisible();
    await ui.getByRole("button", { name: "ブックマークバーを確認" }).click();
    await expect(ui.locator(".import-preview")).toContainText("Work Links");
    await expect(ui.locator(".import-preview .import-site-row")).toHaveCount(3);
    await expect(ui.locator(".import-preview .import-site-icon")).toHaveCount(3);
    await expect(ui.locator(".import-preview .import-site-title").filter({ hasText: "Figma" })).toHaveCount(1);

    await ui.getByRole("button", { name: "3件をインポート" }).click();
    await expect(ui.getByRole("dialog")).toHaveCount(0);
    await expect(ui.locator(".pinned-grid .imported-link")).toHaveCount(3);
    await expect(ui.locator(".imported-bookmarks")).toHaveCount(0);
    await ui.locator(".profile-button").click();
    await ui.locator(".profile-menu").getByRole("button", { name: "Personal" }).click();
    await expect(ui.locator(".pinned-grid .imported-link")).toHaveCount(0);
    await worker.evaluate(() => chrome.storage.local.set({ "bookmarks:Personal": [{ id: "personal-only", title: "Personal link", url: "https://example.org/personal" }] }));
    await expect(ui.locator(".pinned-grid .imported-link")).toHaveCount(1);
    await worker.evaluate(() => chrome.storage.local.set({ "bookmarks:Personal": Array.from({length: 8}, (_, i) => ({ id: `personal-${i}`, title: `Personal ${i}`, url: `https://example.org/${i}` })) }));
    await expect(ui.locator(".pinned-grid .imported-link")).toHaveCount(6);
    await ui.getByRole("button", { name: "もっと見る（残り2件）" }).click();
    await expect(ui.locator(".pinned-grid .imported-link")).toHaveCount(8);
    await ui.getByRole("button", { name: "折りたたむ", exact: true }).click();
    await expect(ui.locator(".pinned-grid .imported-link")).toHaveCount(6);

    await ui.locator(".profile-button").click();
    await ui.locator(".profile-menu").getByRole("button", { name: "Work" }).click();
    await expect(ui.locator(".pinned-grid .imported-link")).toHaveCount(3);
    await ui.locator("summary").filter({ hasText: "Work Links" }).click();
    await ui.locator("summary").filter({ hasText: "Design" }).click();
    await ui.getByRole("button", { name: "Figma", exact: true }).click();
    await expect
      .poll(() =>
        worker.evaluate(() =>
          chrome.tabs
            .query({ url: "http://127.0.0.1:5173/?imported=figma" })
            .then((ts) => ts.length),
        ),
      )
      .toBe(1);
    expect(await worker.evaluate(() => chrome.bookmarks.getTree())).toEqual(
      original,
    );
    await page.bringToFront();
    await page.reload();
    await bindClosedRoot(page, context);
    await expect(host).toHaveCSS("opacity", "1");
    await expect(ui.getByRole("dialog")).toHaveCount(0);
    await expect(ui.locator(".pinned-grid .imported-link")).toHaveCount(3);
    await expect(ui.locator(".imported-bookmarks")).toHaveCount(0);
    await expect(ui.locator(".error-toast")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("タブのクリックとタップで移動し、未ピン留めの表示状態を引き継ぐ", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium", executablePath: chromium.executablePath(), headless: true,
    viewport: { width: 1200, height: 850 }, hasTouch: true,
    args: [`--disable-extensions-except=${path.resolve("dist")}`, `--load-extension=${path.resolve("dist")}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.local.set({ setupComplete: true, sidebarPinned: false, profile: "Personal", placement: "right" }));
    await context.route("http://switch.test/**", route => route.fulfill({ contentType: "text/html", body: `<title>${new URL(route.request().url()).pathname.slice(1)}</title><h1>Page</h1>` }));
    const a = await context.newPage(); await a.goto("http://switch.test/Tab-A");
    const b = await context.newPage(); await b.goto("http://switch.test/Tab-B");
    await a.bringToFront();
    await a.mouse.move(1199, 350);
    await expect(a.locator("#sideflow-surface")).toHaveCSS("opacity", "1");
    await bindClosedRoot(a, context);
    const uiA = a.locator("sideflow=div");
    await uiA.locator(".tab-button").filter({ hasText: "Tab-B" }).click();
    await expect.poll(() => worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].url)).toBe("http://switch.test/Tab-B");
    await expect(b.locator("#sideflow-surface")).toHaveCSS("opacity", "1");
    await bindClosedRoot(b, context);
    const uiB = b.locator("sideflow=div");
    await expect(uiB.locator(".profile-button")).toContainText("Personal");
    await expect(b.locator("#sideflow-surface")).toHaveCSS("right", "0px");
    await uiB.locator(".tab-button").filter({ hasText: "Tab-A" }).tap();
    await expect.poll(() => worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].url)).toBe("http://switch.test/Tab-A");
    await expect(a.locator("#sideflow-surface")).toHaveCSS("opacity", "1");
    await a.reload();
    await expect(a.locator("#sideflow-surface")).toHaveCSS("opacity", "1");
    await bindClosedRoot(a, context);
    await a.locator("sideflow=div").getByRole("button", { name: "サイドバーを閉じる", exact: true }).click();
    await b.bringToFront();
    await expect(b.locator("#sideflow-surface")).toHaveCSS("opacity", "0");
  } finally { await context.close(); }
});

test("表示中はページと固定ヘッダーを左右・下ドックの外に収める", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium", executablePath: chromium.executablePath(), headless: true,
    viewport: { width: 1200, height: 850 },
    args: [`--disable-extensions-except=${path.resolve("dist")}`, `--load-extension=${path.resolve("dist")}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.local.set({ setupComplete: true, sidebarPinned: true }));
    await context.route("http://layout.test/**", route => route.fulfill({ contentType: "text/html", body:
      '<body style="margin:0"><header style="position:fixed;left:0;right:0;top:0;height:40px">Header</header><main style="height:2400px">Page</main></body>' }));
    const page = await context.newPage();
    await page.goto("http://layout.test/");
    const rect = selector => page.locator(selector).boundingBox();
    await expect.poll(async () => (await rect("body")).x).toBe(260);
    expect((await rect("header")).x).toBe(260);
    expect((await rect("body")).width).toBe(940);
    await worker.evaluate(() => chrome.storage.local.set({ placement: "right" }));
    await expect.poll(async () => (await rect("body")).x).toBe(0);
    expect((await rect("header")).width).toBe(940);
    await worker.evaluate(() => chrome.storage.local.set({ placement: "bottom" }));
    await expect.poll(async () => (await rect("body")).height).toBe(670);
    expect((await rect("body")).width).toBe(1200);
    await page.evaluate(() => document.body.scrollTop = 350);
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://layout.test/*" });
      await chrome.tabs.sendMessage(tab.id, { type: "sideflow-toggle" });
    });
    await expect(page.locator("#sideflow-page-layout")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(350);
    expect((await rect("header")).width).toBe(1200);
  } finally { await context.close(); }
});

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
