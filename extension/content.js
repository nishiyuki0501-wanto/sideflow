(() => {
  if (window.top !== window) {
    if (globalThis.__sideflowFrameListening) return;
    globalThis.__sideflowFrameListening = true;
    // Wheel events in embedded documents never bubble to the parent document.
    window.addEventListener("wheel", (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return;
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      chrome.runtime.sendMessage({ type: "sideflow-frame-wheel", dx: e.deltaX * scale, dy: e.deltaY * scale }).catch(() => {});
    }, { passive: true, capture: true });
    return;
  }
  if (globalThis.__sideflowMount?.isConnected) return;
  document.getElementById("sideflow-surface")?.remove();
  document.getElementById("sideflow-edge")?.remove();
  let placement = "left",
    pinned = false,
    visible = false,
    transient = false,
    surfaceHovered = false,
    suppressHover = false;
  let windowId = null, visibilityTouched = false;
  let hoverTimer,
    hideTimer;
  const consumeGesture = createGestureGate();
  globalThis.__sideflowConsumeGesture = consumeGesture;
  const host = document.createElement("div");
  host.id = "sideflow-surface";
  const shadow = host.attachShadow({ mode: "closed" });
  const mount = document.createElement("div");
  mount.style.cssText = "width:100%;height:100%";
  shadow.append(mount);
  globalThis.__sideflowMount = mount;
  globalThis.__sideflowShadow = shadow;
  globalThis.__sideflowIsVisible = () => visible;
  const rail = document.createElement("div");
  rail.id = "sideflow-edge";
  rail.setAttribute("aria-hidden", "true");
  const validPlacement = (value) =>
    ["left", "right", "bottom"].includes(value) ? value : "left";
  // Preserve the original page width: responsive grids can otherwise move
  // negatively positioned logos underneath the sidebar. Scale into the free area.
  const notionPage = /(^|\.)notion\.(so|com)$/.test(location.hostname);
  const pageStyle = document.createElement("style");
  pageStyle.id = "sideflow-page-layout";
  let pageReserved = false;
  const viewportRoots = new Set();
  function clearViewportRoots() {
    for (const root of viewportRoots) root.removeAttribute("data-sideflow-viewport-height");
    viewportRoots.clear();
  }
  function reservePage() {
    const body = document.body;
    if (!body) return;
    if (visible) {
      const x = pageReserved ? body.scrollLeft : window.scrollX;
      const y = pageReserved ? body.scrollTop : window.scrollY;
      const side = placement === "bottom" ? 0 : Math.min(260, innerWidth * .9);
      const bottom = placement === "bottom" ? Math.min(156, innerHeight * .7) + 24 : 0;
      const scale = (innerWidth - side) / innerWidth;
      const pageHeight = (innerHeight - bottom) / scale;
      // 100vh application roots do not inherit the compensated body height.
      // Stretch only roots that occupy exactly the original viewport height;
      // percentage-height descendants then follow naturally (e.g. Notion).
      clearViewportRoots();
      for (const root of body.children) {
        if (!["DIV", "MAIN", "SECTION"].includes(root.tagName)) continue;
        const height = parseFloat(getComputedStyle(root).height);
        if (Math.abs(height - innerHeight) < 1) {
          viewportRoots.add(root);
          root.setAttribute("data-sideflow-viewport-height", "");
        }
      }
      pageStyle.textContent = `
        html { overflow: hidden !important; }
        body { position: fixed !important; inset: 0 auto auto ${placement === "left" ? side : 0}px !important;
          width: ${innerWidth}px !important; height: ${pageHeight}px !important; min-width: 0 !important; min-height: 0 !important;
          max-width: none !important; max-height: none !important; margin: 0 !important;
          overflow: auto !important; transform: scale(${scale}) !important; transform-origin: top left !important;
          box-sizing: border-box !important; }
        body > [data-sideflow-viewport-height] {
          height: ${pageHeight}px !important; max-height: ${pageHeight}px !important;
        }
        ${notionPage ? `
          body { overflow: clip !important; }
          #notion-app .notion-frame {
            flex: 1 1 0% !important; height: auto !important; min-height: 0 !important;
          }
        ` : ""}
      `;
      if (!pageStyle.isConnected) document.documentElement.append(pageStyle);
      pageReserved = true;
      body.scrollTo(x, y);
    } else if (pageReserved) {
      const x = body.scrollLeft, y = body.scrollTop;
      pageStyle.remove();
      clearViewportRoots();
      pageReserved = false;
      window.scrollTo(x, y);
    }
  }
  document.addEventListener("DOMContentLoaded", reservePage, { once: true });
  window.addEventListener("resize", reservePage);
  window.addEventListener("load", reservePage, { once: true });
  if (document.body) new MutationObserver(() => {
    if (visible) reservePage();
  }).observe(document.body, { childList: true });
  function layout() {
    const bottom = placement === "bottom";
    const shift = visible
      ? "translate(0,0)"
      : bottom
        ? "translateY(calc(100% + 20px))"
        : `translateX(${placement === "right" ? "" : "-"}110%)`;
    host.style.cssText = `all:initial!important;position:fixed!important;z-index:2147483647!important;${bottom ? "bottom:12px!important;left:12px!important;width:calc(100% - 24px)!important;height:min(156px,70vh)!important;" : `top:0!important;${placement}:0!important;width:min(260px,90vw)!important;height:100vh!important;`}font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-size:13px!important;line-height:1.5!important;color:#414650!important;direction:ltr!important;border-radius:${bottom ? "16px" : "0"}!important;box-shadow:0 4px 40px #20334a30!important;backdrop-filter:blur(28px)!important;-webkit-backdrop-filter:blur(28px)!important;overflow:hidden!important;transform:${shift}!important;opacity:${visible ? 1 : 0}!important;pointer-events:${visible ? "auto" : "none"}!important;transition:${matchMedia("(prefers-reduced-motion: reduce)").matches ? "none" : "transform .22s ease,opacity .22s ease"}!important;`;
    host.inert = !visible;
    reservePage();
    rail.style.cssText = `all:initial!important;position:fixed!important;z-index:2147483646!important;${bottom ? "bottom:0!important;left:0!important;width:100%!important;height:5px!important;" : `top:0!important;${placement}:0!important;width:5px!important;height:100vh!important;`}background:transparent!important;`;
  }
  function show(value, temporary = false, persist = true) {
    clearTimeout(hoverTimer);
    clearTimeout(hideTimer);
    if (persist) visibilityTouched = true;
    visible = value;
    if (persist && !temporary) {
      visibilityTouched = true;
      chrome.runtime.sendMessage({ type: "sideflow-window-state-set", visible: value }).catch(() => {});
    }
    transient = value && temporary && !pinned;
    layout();
    if (value) globalThis.__sideflowRefresh?.();
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    if (transient && !pinned) hideTimer = setTimeout(() => show(false, false, false), 450);
  }
  function close() {
    suppressHover = true;
    pinned = false;
    chrome.storage.local.set({ sidebarPinned: false });
    show(false);
  }
  function wheel(dx, dy, inside = false) {
    if (placement !== "bottom" && Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
    const direction = consumeGesture(placement === "bottom" && !horizontal ? dy : dx);
    if (!direction) return;
    // macOS natural scrolling: fingers right/up produce negative wheel deltas.
    // Commands are directional, never a toggle; panel placement does not invert them.
    if (direction < 0) {
      if (!visible && !inside) show(true);
    } else if (visible) close();
  }
  globalThis.__sideflowController = (message) => {
    if (message.type === "sideflow-toggle") visible ? close() : show(true);
    if (message.type === "sideflow-open") show(true);
    if (message.type === "sideflow-close") close();
    if (message.type === "sideflow-wheel") wheel(message.dx, message.dy, true);
    if (message.type === "sideflow-active" && surfaceHovered)
      clearTimeout(hideTimer);
    if (message.type === "sideflow-pointer-out") scheduleHide();
  };
  host.addEventListener("pointerenter", () => {
    surfaceHovered = true;
    clearTimeout(hideTimer);
  });
  host.addEventListener("pointerleave", () => {
    surfaceHovered = false;
    scheduleHide();
  });
  rail.addEventListener("pointerenter", () => {
    if (!visible && !suppressHover)
      hoverTimer = setTimeout(() => show(true, true), 220);
  });
  rail.addEventListener("pointerleave", () => {
    clearTimeout(hoverTimer);
    suppressHover = false;
    scheduleHide();
  });
  document.documentElement.append(host, rail);
  layout();
  fetch(chrome.runtime.getURL("overlay.css"))
    .then((r) => r.text())
    .then((css) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [sheet];
    })
    .catch(console.error);
  Promise.all([
    chrome.storage.local.get(["placement", "sidebarPinned"]),
    chrome.runtime.sendMessage({ type: "sideflow-window-state-get" }).catch(() => ({})),
  ]).then(([s, state]) => {
    windowId = state?.windowId ?? null;
    placement = validPlacement(s.placement);
    pinned = Boolean(s.sidebarPinned);
    // Initial storage/message responses may arrive during the hover delay.
    // Applying the saved state must not cancel that pending user interaction.
    if (!visibilityTouched) {
      visible = state?.visible ?? pinned;
      if (visible) clearTimeout(hoverTimer);
    }
    layout();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.placement) {
      placement = validPlacement(changes.placement.newValue);
      layout();
    }
    if (changes.sidebarPinned) {
      pinned = Boolean(changes.sidebarPinned.newValue);
      if (pinned) show(true);
      else transient = visible;
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "sideflow-window-state" && message.windowId === windowId && typeof message.visible === "boolean") {
      visibilityTouched = true;
      show(message.visible, false, false);
    }
    if (message.type === "sideflow-toggle") visible ? close() : show(true);
    if (message.type === "sideflow-frame-wheel" && placement !== "bottom") wheel(message.dx, message.dy);
    if (message.type === "sideflow-ping") return;
  });
  window.addEventListener(
    "pointermove",
    (e) => {
      const away =
        placement === "bottom"
          ? e.clientY < innerHeight - 24
          : placement === "right"
            ? e.clientX < innerWidth - 24
            : e.clientX > 24;
      if (away) suppressHover = false;
      if (!visible) return;
      const rect = host.getBoundingClientRect();
      surfaceHovered =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (surfaceHovered) clearTimeout(hideTimer);
      else scheduleHide();
    },
    { passive: true },
  );
  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.composedPath().includes(host)) return;
      const edge =
        placement === "bottom"
          ? e.clientY > innerHeight - 24
          : placement === "right"
            ? e.clientX > innerWidth - 24
            : e.clientX < 24;
      if (
        (edge || placement !== "bottom") &&
        (placement === "bottom" ||
          Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2)
      ) {
        e.preventDefault();
        const scale =
          e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
        wheel(e.deltaX * scale, e.deltaY * scale);
      }
    },
    { passive: false, capture: true },
  );
})();
