chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
async function toggle(tab) {
  if (!tab?.id) return;
  try {
    if (tab.url === chrome.runtime.getURL("newtab.html") || /^chrome:\/\/newtab\/?$/.test(tab.url || "")) {
      const reply = await chrome.runtime.sendMessage({ type: "sideflow-newtab-toggle", tabId: tab.id });
      if (!reply?.ok) throw new Error("New tab override not active");
    } else await chrome.tabs.sendMessage(tab.id, { type: "sideflow-toggle" }, { frameId: 0 });
  } catch {
    // Do not silently substitute a native panel. Explain restricted pages.
    await chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
  }
}
chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-sidebar") toggle(tab);
});

const allowedMethods = new Set([
  "tabs.query",
  "tabs.get",
  "tabs.update",
  "tabs.create",
  "tabs.remove",
  "tabs.group",
  "tabs.ungroup",
  "tabs.move",
  "tabGroups.query",
  "tabGroups.update",
  "windows.getCurrent",
  "bookmarks.getTree",
]);
const faviconCache = new Map();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!sender.tab) return;
  if (message.type === "sideflow-frame-wheel" && sender.frameId !== 0) {
    if (Number.isFinite(message.dx) && Number.isFinite(message.dy))
      chrome.tabs.sendMessage(sender.tab.id, { type: message.type, dx: message.dx, dy: message.dy }, { frameId: 0 }).catch(() => {});
    return;
  }
  if (message.type === "sideflow-api") {
    if (!allowedMethods.has(message.method)) {
      respond({ ok: false, error: "Unsupported method" });
      return;
    }
    (async () => {
      const [namespace, method] = message.method.split(".");
      const args = message.args || [];
      if (message.method === "windows.getCurrent")
        return chrome.windows.get(sender.tab.windowId);
      if (
        message.method === "tabs.query" ||
        message.method === "tabGroups.query"
      )
        args[0] = { ...(args[0] || {}), windowId: sender.tab.windowId };
      if (message.method === "tabs.create")
        args[0] = { ...(args[0] || {}), windowId: sender.tab.windowId };
      return chrome[namespace][method](...args);
    })().then(
      (value) => respond({ ok: true, value }),
      (error) => respond({ ok: false, error: error.message }),
    );
    return true;
  }
  if (message.type === "sideflow-favicon") {
    (async () => {
      const url = message.url;
      if (typeof url !== "string" || !/^https?:/.test(url)) return null;
      if (faviconCache.has(url)) return faviconCache.get(url);
      const endpoint = new URL(chrome.runtime.getURL("/_favicon/"));
      endpoint.searchParams.set("pageUrl", url);
      endpoint.searchParams.set("size", "32");
      const result = await fetch(endpoint);
      if (!result.ok) return null;
      const blob = await result.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const data = `data:${blob.type || "image/png"};base64,${btoa(String.fromCharCode(...bytes))}`;
      if (faviconCache.size > 256) faviconCache.clear();
      faviconCache.set(url, data);
      return data;
    })().then(
      (value) => respond({ ok: true, value }),
      () => respond({ ok: false }),
    );
    return true;
  }
});
let broadcastTimer;
function broadcast() {
  clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(async () => {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs)
      if (/^https?:/.test(tab.url || ""))
        chrome.tabs
          .sendMessage(tab.id, { type: "sideflow-tabs-changed" })
          .catch(() => {});
  }, 40);
}
for (const event of [
  chrome.tabs.onCreated,
  chrome.tabs.onRemoved,
  chrome.tabs.onUpdated,
  chrome.tabs.onActivated,
  chrome.tabs.onMoved,
  chrome.tabs.onAttached,
  chrome.tabs.onDetached,
  chrome.tabGroups.onCreated,
  chrome.tabGroups.onUpdated,
  chrome.tabGroups.onRemoved,
])
  event.addListener(broadcast);

// Manifest scripts cover future navigations; install/update also attaches to existing pages.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.allSettled(tabs.map(tab => chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true }, files: ["content.js", "overlay.js"]
  })));
});
