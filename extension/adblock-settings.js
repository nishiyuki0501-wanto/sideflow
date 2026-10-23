const enabled = document.querySelector("#enabled"), sites = document.querySelector("#sites"), status = document.querySelector("#status"), save = document.querySelector("#save");
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || "設定を読み込めませんでした");
  return result.settings;
}
request({ type: "sideflow-adblock-get" }).then(settings => {
  enabled.checked = settings.enabled; sites.value = settings.excludedSites.join("\n"); save.disabled = false;
}).catch(error => status.textContent = error.message);
document.querySelector("form").addEventListener("submit", async event => {
  event.preventDefault(); save.disabled = true;
  try {
    const settings = await request({ type: "sideflow-adblock-save", enabled: enabled.checked, sites: sites.value });
    sites.value = settings.excludedSites.join("\n");
    status.textContent = "保存しました。対象ページを再読み込みしてください。";
  } catch (error) { status.textContent = error.message; }
  finally { save.disabled = false; }
});
