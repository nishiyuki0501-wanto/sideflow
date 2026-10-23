// Small, bundled baseline: no remote lists or browsing-history collection.
export const adDomains = [
  "doubleclick.net", "googlesyndication.com", "googleadservices.com",
  "adnxs.com", "adsrvr.org", "adform.net", "advertising.com",
  "amazon-adsystem.com", "criteo.com", "criteo.net", "rubiconproject.com",
  "pubmatic.com", "openx.net", "casalemedia.com", "smartadserver.com",
  "taboola.com", "outbrain.com", "moatads.com", "adsymptotic.com", "yieldmo.com",
];
export function buildAdRules({ enabled = true, excludedSites = [] } = {}) {
  if (!enabled) return [];
  return [{ id: 10000, priority: 1, action: { type: "block" }, condition: {
    requestDomains: adDomains, domainType: "thirdParty",
    resourceTypes: ["sub_frame", "script", "image", "stylesheet", "font", "media", "xmlhttprequest", "ping", "other"],
  } }, ...excludedSites.map((domain, i) => ({
    id: 10001 + i, priority: 10, action: { type: "allowAllRequests" },
    condition: { requestDomains: [domain], resourceTypes: ["main_frame"] },
  }))];
}
export function normalizeSites(value) {
  const sites = [...new Set(String(value).split(/[\s,]+/).filter(Boolean).map(input => {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password)
      throw new Error("サイトのドメインを入力してください（例: example.com）");
    return url.hostname.toLowerCase();
  }))];
  if (sites.length > 100) throw new Error("除外サイトは100件までです");
  return sites;
}
