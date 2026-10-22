const native = globalThis.chrome;
const inPage = Boolean(globalThis.__sideflowMount);
const listeners = new Set();
if (inPage)
  globalThis.__sideflowRefresh = () => {
    for (const listener of listeners) listener();
  };
if (inPage)
  native.runtime.onMessage.addListener((message) => {
    if (
      message.type === "sideflow-tabs-changed" &&
      globalThis.__sideflowIsVisible?.()
    )
      for (const listener of listeners) listener();
  });
const event = {
  addListener: (listener) => listeners.add(listener),
  removeListener: (listener) => listeners.delete(listener),
};
const proxy = (namespace, methods, events = []) =>
  Object.fromEntries([
    ...methods.map((method) => [
      method,
      async (...args) => {
        const result = await native.runtime.sendMessage({
          type: "sideflow-api",
          method: `${namespace}.${method}`,
          args,
        });
        if (!result?.ok)
          throw new Error(result?.error || "Chromeとの通信に失敗しました");
        return result.value;
      },
    ]),
    ...events.map((name) => [name, event]),
  ]);
export const browser = inPage
  ? {
      runtime: native.runtime,
      storage: native.storage,
      tabs: proxy(
        "tabs",
        [
          "query",
          "get",
          "update",
          "create",
          "remove",
          "group",
          "ungroup",
          "move",
        ],
        [
          "onCreated",
          "onRemoved",
          "onUpdated",
          "onActivated",
          "onMoved",
          "onAttached",
          "onDetached",
        ],
      ),
      tabGroups: proxy(
        "tabGroups",
        ["query", "update"],
        ["onCreated", "onRemoved", "onUpdated"],
      ),
      windows: proxy("windows", ["getCurrent"]),
      bookmarks: proxy("bookmarks", ["getTree"]),
    }
  : native;
