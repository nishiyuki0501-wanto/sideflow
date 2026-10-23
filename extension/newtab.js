let panelWindowId;
chrome.tabs.getCurrent().then(tab => { panelWindowId = tab?.windowId; });
document.getElementById('open-sidebar').addEventListener('click', () => {
  if (panelWindowId === undefined) return;
  chrome.sidePanel.open({ windowId: panelWindowId }).catch(() => {
    document.querySelector('#page-status').textContent = 'ツールバーのSideflowアイコンから開いてください';
  });
});
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

const pageTheme = document.querySelector('#page-theme');
const pageHeading = document.querySelector('#page-heading');
function applyPage(settings = {}) {
  const theme = ['blue', 'lavender', 'forest', 'dark'].includes(settings.theme) ? settings.theme : 'blue';
  document.documentElement.dataset.theme = theme;
  pageTheme.value = theme;
  pageHeading.value = settings.heading || '';
  document.querySelector('h1').textContent = settings.heading || '次のアイデアへ。';
}
chrome.storage.local.get('newtabAppearance').then(s => applyPage(s.newtabAppearance));
pageTheme.addEventListener('change', () => { document.documentElement.dataset.theme = pageTheme.value; });
document.querySelector('#save-page').addEventListener('click', async () => {
  const settings = { theme: pageTheme.value, heading: pageHeading.value.trim().slice(0,80) };
  try {
    await chrome.storage.local.set({ newtabAppearance: settings });
    applyPage(settings);
    document.querySelector('#page-status').textContent = '保存しました';
  } catch { document.querySelector('#page-status').textContent = '保存できませんでした'; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.newtabAppearance) applyPage(changes.newtabAppearance.newValue);
});
