import { test, expect } from "@playwright/test";
test("テーマ、折りたたみ、D&D、検索、永続化", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173");
  await expect(page.getByRole("complementary")).toHaveCSS("width", "260px");
  await expect(page.locator(".pinned-tile")).toHaveCount(3);
  await page.screenshot({
    path: "artifacts/sideflow-work.png",
    fullPage: true,
  });
  const group = page.getByRole("button", { name: "Website Eng" });
  await group.click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await group.click();
  await page.locator(".color-yellow").evaluate(async (el) => {
    await Promise.all(
      el.getAnimations({ subtree: true }).map((a) => a.finished),
    );
  });
  await page
    .locator(".tab-row")
    .filter({ hasText: "Website redesign" })
    .dragTo(page.locator(".color-pink .group-heading"));
  await expect(
    page
      .locator(".color-pink .tab-row")
      .filter({ hasText: "Website redesign" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Work", exact: true }).click();
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await expect(page.locator(".browser-shell")).toHaveCSS(
    "--theme-tint",
    "#e8dff0",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Personal", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".color-pink .tab-row")
      .filter({ hasText: "Website redesign" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "タブを検索" }).click();
  await page
    .getByPlaceholder("Search tabs or enter a URL…")
    .fill("Engineering");
  await expect(page.locator(".search-results>button")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("左右・下ドック切替と配置の保存", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "右", exact: true }).click();
  const sidebar = page.getByRole("complementary");
  const content = page.locator(".content-panel");
  expect((await sidebar.boundingBox()).x).toBeGreaterThan(
    (await content.boundingBox()).x,
  );
  await page.getByRole("button", { name: "下ドック", exact: true }).click();
  await expect(sidebar).toHaveCSS("height", "156px");
  expect((await sidebar.boundingBox()).y).toBeGreaterThan(
    (await content.boundingBox()).y,
  );
  await expect(sidebar).toHaveCSS("width", "1182px");
  await page.screenshot({
    path: "artifacts/sideflow-dock.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "下ドック", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "左", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "260px");
  expect((await sidebar.boundingBox()).x).toBeLessThan(
    (await content.boundingBox()).x,
  );
});

test("初期設定の応答がホバー待機中に届いても表示する", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173");
  await page.evaluate(() => {
    window.chrome = {
      runtime: {
        getURL: () => "data:text/css,",
        sendMessage: () => new Promise(resolve => { window.finishInitialSettings = resolve; }),
        onMessage: { addListener() {} },
      },
      storage: {
        local: { get: async () => ({}) },
        onChanged: { addListener() {} },
      },
    };
  });
  await page.addScriptTag({ path: "dist/content.js" });
  await page.locator("#sideflow-edge").dispatchEvent("pointerenter");
  await page.evaluate(() => window.finishInitialSettings({ visible: false, windowId: 1 }));
  await expect(page.locator("#sideflow-surface")).toHaveCSS("opacity", "1");
});
