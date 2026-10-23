import "./adblock-background.js";

// Chrome owns the panel and resizes the page viewport without DOM changes.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-sidebar" && tab?.windowId !== undefined)
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
});
