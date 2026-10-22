document.getElementById('open-sidebar').addEventListener('click', () => globalThis.__sideflowController?.({ type: 'sideflow-open' }));
document.getElementById('search').addEventListener('submit', event => {
  event.preventDefault();
  const value = document.getElementById('query').value.trim();
  if (!value) return;
  let url;
  try {
    const candidate = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!/\s/.test(value) && candidate.hostname.includes('.') && !/^[a-z]+:/i.test(value.replace(/^https?:/i, ''))) url = candidate.href;
  } catch {}
  location.assign(url || `https://www.google.com/search?q=${encodeURIComponent(value)}`);
});

chrome.tabs.getCurrent().then(tab => {
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type !== "sideflow-newtab-toggle" || message.tabId !== tab.id) return;
    globalThis.__sideflowController?.({ type: "sideflow-toggle" });
    respond({ ok: true });
  });
});
