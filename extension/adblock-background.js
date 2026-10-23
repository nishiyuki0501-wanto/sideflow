import { buildAdRules, normalizeSites } from "./adblock.js";
let queue = Promise.resolve();
function enqueue(work) {
  const result = queue.then(work);
  queue = result.catch(console.error);
  return result;
}
async function apply(settings) {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.filter(r => r.id >= 10000 && r.id <= 10100).map(r => r.id),
    addRules: buildAdRules(settings),
  });
}
async function read() {
  const { adblock } = await chrome.storage.local.get("adblock");
  return adblock || { enabled: true, excludedSites: [] };
}
// Dynamic rules survive restarts; reconcile the bundled rules after updates too.
enqueue(async () => apply(await read()));
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !["sideflow-adblock-get", "sideflow-adblock-save"].includes(message.type)) return;
  enqueue(async () => {
    if (message.type.endsWith("-get")) return read();
    const settings = { enabled: Boolean(message.enabled), excludedSites: normalizeSites(message.sites) };
    const previous = await read();
    await apply(settings);
    try { await chrome.storage.local.set({ adblock: settings }); }
    catch (error) { await apply(previous); throw error; }
    return settings;
  }).then(settings => respond({ ok: true, settings }), error => respond({ ok: false, error: error.message }));
  return true;
});
