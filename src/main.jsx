import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  Files,
  Plus,
  Search,
  X,
  PanelLeft,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Lock,
  MoreHorizontal,
  Globe,
  Check,
  Pin,
} from "lucide-react";
import "./style.css";
import { readBookmarkBar, countBookmarks } from "./bookmarks.js";
import { browser } from "./browser.js";
import { createGestureGate } from "../extension/gesture.js";
import { resolveInput } from "../extension/model.js";

const extension = Boolean(browser?.tabs?.query);
const overlay = Boolean(globalThis.__sideflowMount);
const themes = {
  Work: { tint: "#dbe8f4", accent: "#59799b", wash: "#edf3f9" },
  Personal: { tint: "#e8dff0", accent: "#8d6ca4", wash: "#f6f0fa" },
  Studio: { tint: "#dceadf", accent: "#658771", wash: "#f0f6f0" },
};
const initialGroups = [
  {
    id: "eng",
    title: "Website Eng",
    color: "yellow",
    tabs: [
      {
        id: 1,
        title: "Website redesign",
        url: "https://www.figma.com",
        brand: "figma",
      },
      {
        id: 2,
        title: "Engineering · Notion",
        url: "https://www.notion.so",
        brand: "notion",
      },
      {
        id: 3,
        title: "Linear — Website issues",
        url: "https://linear.app",
        brand: "linear",
      },
      {
        id: 4,
        title: "Pull requests · website",
        url: "https://github.com",
        brand: "github",
      },
    ],
  },
  {
    id: "marketing",
    title: "Spring Marketing",
    color: "pink",
    tabs: [
      {
        id: 5,
        title: "Spring launch campaign",
        url: "https://docs.google.com",
        brand: "docs",
      },
      {
        id: 6,
        title: "Campaign moodboard",
        url: "https://www.figma.com",
        brand: "figma",
      },
      {
        id: 7,
        title: "Marketing calendar",
        url: "https://calendar.google.com",
        brand: "calendar",
      },
    ],
  },
];
const defaultPins = [
  { title: "Gmail", url: "https://mail.google.com", brand: "gmail" },
  {
    title: "Google Calendar",
    url: "https://calendar.google.com",
    brand: "calendar",
  },
  { title: "Figma", url: "https://www.figma.com", brand: "figma" },
];
function Brand({ type, url }) {
  const [dataIcon, setDataIcon] = useState(null);
  useEffect(() => {
    if (!overlay || !url) return;
    let live = true;
    browser.runtime
      .sendMessage({ type: "sideflow-favicon", url })
      .then((result) => {
        if (live && result?.ok) setDataIcon(result.value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);
  if (dataIcon)
    return <img className="favicon" draggable={false} src={dataIcon} alt="" />;
  if (extension && !overlay) {
    const path = new URL(browser.runtime.getURL("/_favicon/"));
    path.searchParams.set("pageUrl", url);
    path.searchParams.set("size", "32");
    return <img className="favicon" src={path.href} alt="" />;
  }
  return (
    <span className={`brand-icon ${type || "web"}`} aria-hidden="true">
      {type === "figma" ? (
        <svg width="15" height="21" viewBox="0 0 18 27">
          <path fill="#f24e1e" d="M4.5 0h4.5v9H4.5a4.5 4.5 0 0 1 0-9" />
          <path fill="#ff7262" d="M9 0h4.5a4.5 4.5 0 0 1 0 9H9" />
          <path fill="#a259ff" d="M4.5 9H9v9H4.5a4.5 4.5 0 0 1 0-9" />
          <circle fill="#1abcfe" cx="13.5" cy="13.5" r="4.5" />
          <path fill="#0acf83" d="M4.5 18H9v4.5A4.5 4.5 0 1 1 4.5 18" />
        </svg>
      ) : type === "gmail" ? (
        <svg viewBox="0 0 24 20" width="25">
          <path
            d="M2 18V3l10 8L22 3v15"
            fill="none"
            stroke="#4285f4"
            strokeWidth="4"
          />
          <path
            d="M2 3l10 8L22 3"
            fill="none"
            stroke="#ea4335"
            strokeWidth="4"
          />
          <path d="M22 7v11" stroke="#34a853" strokeWidth="4" />
        </svg>
      ) : type === "calendar" ? (
        <b>31</b>
      ) : type === "notion" ? (
        <b>N</b>
      ) : type === "linear" ? (
        "◒"
      ) : type === "github" ? (
        "●"
      ) : type === "docs" ? (
        "▤"
      ) : (
        <Globe size={15} />
      )}
    </span>
  );
}
function BookmarkImportList({ nodes }) {
  return (
    <ul className="import-site-list">
      {nodes.map(node => (
        <li key={node.id}>
          {node.url ? (
            <div className="import-site-row" title={`${node.title}\n${node.url}`}>
              <span className="import-site-icon" aria-hidden="true"><Brand url={node.url} /></span>
              <span className="import-site-title">{node.title}</span>
            </div>
          ) : (
            <div className="import-site-folder">
              <div className="import-folder-label"><Files size={14} aria-hidden="true" /><span>{node.title}</span></div>
              <BookmarkImportList nodes={node.children || []} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function App() {
  const [profileBookmarks, setProfileBookmarks] = useState({});
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const profileGesture = useRef(createGestureGate());
  const [setupOpen, setSetupOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const pointerDrag = useRef(null);
  const suppressTabClick = useRef(false);
  const [placement, setPlacement] = useState("left");
  const [sidebarPinned, setSidebarPinned] = useState(false);
  function postParent(message) {
    if (overlay) globalThis.__sideflowController?.(message);
  }
  const [profile, setProfile] = useState("Work"),
    [menu, setMenu] = useState(false),
    [groups, setGroups] = useState(extension ? [] : initialGroups),
    [loose, setLoose] = useState(
      extension
        ? []
        : [
            {
              id: 8,
              title: "A little inspiration",
              url: "https://www.are.na",
              brand: "web",
            },
            {
              id: 9,
              title: "Read.cv — Explore",
              url: "https://read.cv",
              brand: "web",
            },
          ],
    ),
    [active, setActive] = useState(extension ? null : 1),
    [collapsed, setCollapsed] = useState({}),
    [drag, setDrag] = useState(null),
    [over, setOver] = useState(null),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(false),
    [error, setError] = useState(""),
    [pins, setPins] = useState(extension ? [] : defaultPins),
    [ready, setReady] = useState(false);
  const importedBookmarks = profileBookmarks[profile] || [];
  useEffect(() => setGalleryExpanded(false), [profile]);
  useEffect(() => {
    if (!extension) {
      try {
        const stored = JSON.parse(localStorage.getItem("sideflow-ui"));
        if (stored) {
          setProfileBookmarks(stored.profileBookmarks || { [stored.profile || "Work"]: stored.importedBookmarks || [] });
          setSidebarPinned(Boolean(stored.sidebarPinned));
          setProfile(stored.profile || "Work");
          setPlacement(stored.placement || "left");
          setCollapsed(stored.collapsed || {});
          setGroups(stored.groups || initialGroups);
          setLoose(stored.loose || []);
        }
      } catch {}
      setReady(true);
      return;
    }
    let disposed = false;
    async function load() {
      try {
        const win = await browser.windows.getCurrent();
        const tabs = await browser.tabs.query({ windowId: win.id });
        const gs = await browser.tabGroups.query({ windowId: win.id });
        if (disposed) return;
        setGroups(
          gs.map((g) => ({
            ...g,
            tabs: tabs.filter((t) => t.groupId === g.id),
          })),
        );
        setLoose(tabs.filter((t) => t.groupId === -1 && !t.pinned));
        setPins(tabs.filter((t) => t.pinned).map((t) => ({ ...t })));
        setActive(tabs.find((t) => t.active)?.id);
      } catch (e) {
        setError(e.message);
      }
    }
    Promise.all([
      load(),
      browser.storage.local
        .get([
          "profile",
          "collapsed",
          "placement",
          "sidebarPinned",
          "setupComplete",
          "importedBookmarks",
          ...Object.keys(themes).map(name => `bookmarks:${name}`),
        ])
        .then(async (s) => {
          const next = {};
          for (const name of Object.keys(themes)) {
            next[name] = s[`bookmarks:${name}`] || (name === (s.profile || "Work") ? s.importedBookmarks || [] : []);
          }
          setProfileBookmarks(next);
          if (s.importedBookmarks) {
            await browser.storage.local.set(Object.fromEntries(Object.entries(next).map(([name, value]) => [`bookmarks:${name}`, value])));
            await browser.storage.local.remove("importedBookmarks");
          }
          setSetupOpen(!s.setupComplete);
          setSidebarPinned(Boolean(s.sidebarPinned));
          setProfile(s.profile || "Work");
          setPlacement(s.placement || "left");
          setCollapsed(s.collapsed || {});
        }),
    ])
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
    const events = [
      browser.tabs.onCreated,
      browser.tabs.onRemoved,
      browser.tabs.onUpdated,
      browser.tabs.onActivated,
      browser.tabs.onMoved,
      browser.tabs.onAttached,
      browser.tabs.onDetached,
      browser.tabGroups.onCreated,
      browser.tabGroups.onUpdated,
      browser.tabGroups.onRemoved,
    ];
    events.forEach((e) => e.addListener(load));
    return () => {
      disposed = true;
      events.forEach((e) => e.removeListener(load));
    };
  }, []);
  useEffect(() => {
    if (!ready || extension) return;
    localStorage.setItem(
      "sideflow-ui",
      JSON.stringify({
        profile,
        collapsed,
        groups,
        loose,
        placement,
        sidebarPinned,
        profileBookmarks,
      }),
    );
  }, [
    profile,
    collapsed,
    groups,
    loose,
    placement,
    sidebarPinned,
    profileBookmarks,
    ready,
  ]);
  useEffect(() => {
    function key(e) {
      if (overlay && !globalThis.__sideflowIsVisible?.()) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
      if (e.key === "Escape") {
        if (!search && !menu) postParent({ type: "sideflow-close" });
        setSearch(false);
        setMenu(false);
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [search, menu]);
  useEffect(() => {

    function handleWheel(e) {
      if (e.ctrlKey || pointerDrag.current?.dragging) return;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2;
      const header = e.target.closest(".sidebar-header,.sidebar-footer");
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      if (horizontal && !header) {
        e.preventDefault();
        const gestureDirection = (globalThis.__sideflowConsumeGesture || profileGesture.current)(e.deltaX * scale);
        if (gestureDirection) {
          const names = Object.keys(themes);
          const next = names[(names.indexOf(profile) + (gestureDirection > 0 ? 1 : names.length - 1)) % names.length];
          const surface = globalThis.__sideflowMount || document.getElementById("root");
          if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
            const direction = gestureDirection > 0 ? 1 : -1;
            for (const node of surface.querySelectorAll(".sidebar-scroll,.profile-button")) {
              node.getAnimations().forEach(a => a.cancel());
              node.animate([
                { transform: `translateX(${direction * 36}px)`, opacity: 0.25 },
                { transform: "translateX(0)", opacity: 1 }
              ], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" });
            }
          }
          setProfile(next);
          saveSettings({ profile: next });

        }
        return;
      }
      if (!overlay || !header || (placement !== "bottom" && !horizontal)) return;
      e.preventDefault();
      postParent({
        type: "sideflow-wheel",
        dx: e.deltaX * scale,
        dy: e.deltaY * scale,
      });
    }
    function wheel(e) {
      handleWheel(e);

    }
    function enter() {
      postParent({ type: "sideflow-active" });
    }
    function leave() {
      postParent({ type: "sideflow-pointer-out" });
    }
    const surface = globalThis.__sideflowMount || document.getElementById("root");
    surface.addEventListener("wheel", wheel, { passive: false });
    surface.addEventListener("pointerenter", enter);
    surface.addEventListener("pointerleave", leave);
    return () => {
      surface.removeEventListener("wheel", wheel);
      surface.removeEventListener("pointerenter", enter);
      surface.removeEventListener("pointerleave", leave);
    };
  }, [placement, profile]);
  useEffect(() => {
    if (!extension) return;
    function changed(c, area) {
      if (area !== "local") return;
      if (c.setupComplete?.newValue) setSetupOpen(false);
      for (const name of Object.keys(themes)) {
        if (c[`bookmarks:${name}`]) setProfileBookmarks(prev => ({ ...prev, [name]: c[`bookmarks:${name}`].newValue || [] }));
      }
      if (c.profile && themes[c.profile.newValue])
        setProfile(c.profile.newValue);
      if (
        c.placement &&
        ["left", "right", "bottom"].includes(c.placement.newValue)
      )
        setPlacement(c.placement.newValue);
      if (c.sidebarPinned) setSidebarPinned(Boolean(c.sidebarPinned.newValue));
      if (c.collapsed) setCollapsed(c.collapsed.newValue || {});
    }
    browser.storage.onChanged.addListener(changed);
    return () => browser.storage.onChanged.removeListener(changed);
  }, []);
  async function safely(fn) {
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  }
  function activate(tab) {
    setActive(tab.id);
    if (extension)
      safely(() =>
        tab.id
          ? browser.tabs.update(tab.id, { active: true })
          : browser.tabs.create({ url: tab.url }),
      );
    setSearch(false);
  }
  function saveSettings(values) {
    if (extension)
      browser.storage.local.set(values).catch((e) => setError(e.message));
  }
  function toggle(id) {
    const next = { ...collapsed, [id]: !collapsed[id] };
    setCollapsed(next);
    saveSettings({ collapsed: next });
  }
  async function drop(e, target, index, dragId = drag?.id) {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    if (dragId == null) return;
    const source = [...groups.flatMap((g) => g.tabs), ...loose].find(
      (t) => t.id === dragId,
    );
    if (!source) return;
    setDrag(null);
    if (extension) {
      await safely(async () => {
        const original =
          target === null
            ? loose
            : groups.find((g) => g.id === target)?.tabs || [];
        const beforeId = original[index]?.id;
        if (beforeId === source.id) return;
        if (target === null) {
          if (source.groupId !== -1) await browser.tabs.ungroup(source.id);
        } else if (source.groupId !== target)
          await browser.tabs.group({ tabIds: source.id, groupId: target });
        const current = await browser.tabs.get(source.id);
        const all = await browser.tabs.query({ windowId: current.windowId });
        const before = all.find((t) => t.id === beforeId);
        if (before) {
          await browser.tabs.move(source.id, {
            index: before.index - (current.index < before.index ? 1 : 0),
          });
        } else {
          const candidates = all.filter(
            (t) =>
              t.id !== source.id &&
              (target === null
                ? t.groupId === -1 && !t.pinned
                : t.groupId === target),
          );
          const last = candidates.at(-1);
          if (last)
            await browser.tabs.move(source.id, {
              index: last.index + (current.index > last.index ? 1 : 0),
            });
        }
      });
      return;
    }
    setGroups((gs) =>
      gs.map((g) => {
        let tabs = g.tabs.filter((t) => t.id !== source.id);
        if (g.id === target)
          tabs.splice(Math.min(index, tabs.length), 0, source);
        return { ...g, tabs };
      }),
    );
    setLoose((ts) => {
      let list = ts.filter((t) => t.id !== source.id);
      if (target === null) list.splice(Math.min(index, list.length), 0, source);
      return list;
    });
  }
  async function previewBookmarks() {
    setImportBusy(true);
    try {
      setImportPreview(
        extension
          ? readBookmarkBar(await browser.bookmarks.getTree())
          : [
              {
                id: "sample-doc",
                title: "Documents",
                children: [
                  {
                    id: "sample-gmail",
                    title: "Gmail",
                    url: "https://mail.google.com",
                  },
                  {
                    id: "sample-figma",
                    title: "Figma",
                    url: "https://figma.com",
                  },
                ],
              },
            ],
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setImportBusy(false);
    }
  }
  function finishSetup(importNow) {
    if (importNow && importPreview) {
      setProfileBookmarks(prev => ({ ...prev, [profile]: importPreview }));
      saveSettings({ [`bookmarks:${profile}`]: importPreview, setupComplete: true });
    } else saveSettings({ setupComplete: true });
    setSetupOpen(false);
    setImportPreview(null);
  }
  function renderBookmarks(nodes) {
    return nodes.map((node) =>
      node.url ? (
        <button
          key={node.id}
          className="imported-link pinned-tile"
          aria-label={node.title}
          title={node.title}
          onClick={() => {
            const found = [
              ...groups.flatMap((g) => g.tabs),
              ...loose,
              ...pins,
            ].find((t) => t.url === node.url);
            if (found) activate(found);
            else if (extension)
              safely(() => browser.tabs.create({ url: node.url }));
            else {
              const tab = { id: Date.now(), title: node.title, url: node.url };
              setLoose((ts) => [...ts, tab]);
              setActive(tab.id);
            }
          }}
        >
          <Brand url={node.url} />

        </button>
      ) : (
        <details key={node.id} className="imported-folder">
          <summary>{node.title}</summary>
          <div className="bookmark-gallery">{renderBookmarks(node.children)}</div>
        </details>
      ),
    );
  }
  function tabRow(tab, group, index) {
    return (
      <div
        key={tab.id}
        role="listitem"
        data-drop-group={group ?? "loose"}
        data-drop-index={index}
        data-drop-tab={tab.id}
        onPointerDown={(e) => {
          if (e.button !== 0 || e.target.closest(".close-tab")) return;
          pointerDrag.current = {
            id: tab.id,
            x: e.clientX,
            y: e.clientY,
            dragging: false,
            target: null,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const current = pointerDrag.current;
          if (!current) return;
          if (
            !current.dragging &&
            Math.hypot(e.clientX - current.x, e.clientY - current.y) < 6
          )
            return;
          current.dragging = true;
          e.preventDefault();
          setDrag({ id: current.id });
          const hit = (globalThis.__sideflowShadow || document)
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest("[data-drop-group]");
          if (!hit) {
            current.target = null;
            setOver(null);
            return;
          }
          const target =
            hit.dataset.dropGroup === "loose"
              ? null
              : groups.find((g) => String(g.id) === hit.dataset.dropGroup)?.id;
          if (target === undefined) return;
          const list =
            target === null
              ? loose
              : groups.find((g) => g.id === target)?.tabs || [];
          current.target = {
            group: target,
            index:
              hit.dataset.dropIndex === undefined
                ? list.length
                : Number(hit.dataset.dropIndex),
          };
          setOver(
            hit.dataset.dropTab
              ? Number(hit.dataset.dropTab)
              : `group:${target}`,
          );
          const scroller =
            globalThis.__sideflowMount?.querySelector(".sidebar-scroll") ||
            document.querySelector(".sidebar-scroll");
          const bounds = scroller.getBoundingClientRect();
          if (placement === "bottom") {
            if (e.clientX > bounds.right - 25) scroller.scrollLeft += 12;
            else if (e.clientX < bounds.left + 25) scroller.scrollLeft -= 12;
          } else {
            if (e.clientY > bounds.bottom - 25) scroller.scrollTop += 12;
            else if (e.clientY < bounds.top + 25) scroller.scrollTop -= 12;
          }
        }}
        onPointerUp={(e) => {
          const current = pointerDrag.current;
          pointerDrag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (current?.dragging) {
            e.preventDefault();
            suppressTabClick.current = true;
            setTimeout(() => {
              suppressTabClick.current = false;
            }, 0);
            if (current.target)
              drop(e, current.target.group, current.target.index, current.id);
          }
          setDrag(null);
          setOver(null);
        }}
        onPointerCancel={() => {
          pointerDrag.current = null;
          setDrag(null);
          setOver(null);
        }}
        onLostPointerCapture={() => {
          pointerDrag.current = null;
          setDrag(null);
          setOver(null);
        }}
        onDragStart={(e) => e.preventDefault()}
        className={`tab-row group flex items-center ${active === tab.id ? "active" : ""} ${over === tab.id ? "drop-target" : ""} ${drag?.id === tab.id ? "dragging" : ""}`}
      >
        <button
          className="tab-button flex items-center min-w-0 flex-1 text-left"
          onClick={() => {
            if (!suppressTabClick.current) activate(tab);
          }}
          title={tab.title}
        >
          <Brand type={tab.brand} url={tab.url} />
          <span className="truncate">{tab.title || "New tab"}</span>
        </button>
        <button
          className="close-tab opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label={`${tab.title}を閉じる`}
          onClick={() =>
            extension
              ? safely(() => browser.tabs.remove(tab.id))
              : (setGroups((gs) =>
                  gs.map((g) => ({
                    ...g,
                    tabs: g.tabs.filter((t) => t.id !== tab.id),
                  })),
                ),
                setLoose((ts) => ts.filter((t) => t.id !== tab.id)))
          }
        >
          <X size={12} />
        </button>
      </div>
    );
  }
  async function newTab() {
    if (extension) return safely(() => browser.tabs.create({}));
    setSearch(true);
  }
  async function submit(e) {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    const url = resolveInput(value);
    if (!url) {
      setError("http / https のURLか検索語を入力してください");
      return;
    }
    if (extension) await safely(() => browser.tabs.create({ url }));
    else {
      const tab = { id: Date.now(), title: value, url };
      setLoose((ts) => [...ts, tab]);
      setActive(tab.id);
    }
    setSearch(false);
    setQuery("");
  }
  const theme = themes[profile] || themes.Work;
  const current = [...groups.flatMap((g) => g.tabs), ...loose, ...pins].find(
    (t) => t.id === active,
  );
  return (
    <div
      className={`browser-shell placement-${placement} ${extension ? "extension-mode" : ""} ${overlay ? "overlay-mode" : ""}`}
      style={{
        "--theme-tint": theme.tint,
        "--theme-accent": theme.accent,
        "--theme-wash": theme.wash,
      }}
    >
      <aside className="sidebar flex flex-col" aria-label="縦型タブサイドバー">
        <header className="sidebar-header flex items-center">
          <div className="traffic-lights flex" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="profile-wrap">
            <button
              className="profile-button flex items-center"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
            >
              {profile}
              <ChevronDown size={12} />
            </button>
            {menu && (
              <div className="profile-menu">
                {Object.keys(themes).map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setProfile(name);
                      saveSettings({ profile: name });
                      setMenu(false);
                    }}
                  >
                    <span
                      className="theme-dot"
                      style={{ background: themes[name].tint }}
                    />
                    {name}
                    {profile === name && <Check size={13} />}
                  </button>
                ))}
                <p>
                  テーマを切り替えます。Chromeのプロファイルは変わりません。
                </p>
              </div>
            )}
          </div>
          {(!extension || overlay) && (
            <button
              className={`pin-control icon-button ${sidebarPinned ? "is-pinned" : ""}`}
              aria-label="常時表示"
              aria-pressed={sidebarPinned}
              title="ピン留めして常時表示"
              onClick={() => {
                setSidebarPinned(!sidebarPinned);
                saveSettings({ sidebarPinned: !sidebarPinned });
              }}
            >
              <Pin size={14} />
            </button>
          )}
          {overlay && (
            <button
              className="icon-button overlay-close"
              aria-label="サイドバーを閉じる"
              onClick={() => postParent({ type: "sideflow-close" })}
            >
              <X size={15} />
            </button>
          )}
          <button
            className="inbox icon-button"
            aria-label="ブックマークを開く"
            onClick={() =>
              extension
                ? safely(() =>
                    browser.tabs.create({ url: "chrome://bookmarks/" }),
                  )
                : setSearch(true)
            }
          >
            <Inbox size={17} strokeWidth={1.6} />
          </button>
        </header>
        <div className="sidebar-scroll flex-1 overflow-y-auto">
          <div
            className="pinned-grid grid grid-cols-3"
            aria-label="ピン留めタブ"
          >
            {(galleryExpanded ? pins : pins.slice(0, 6)).map((p, i) => (
              <button
                key={p.id || i}
                className="pinned-tile flex items-center justify-center"
                title={p.title}
                aria-label={p.title}
                onClick={() => activate(p)}
              >
                <Brand type={p.brand} url={p.url} />
              </button>
            ))}
            {renderBookmarks(galleryExpanded ? importedBookmarks : importedBookmarks.slice(0, Math.max(0, 6 - pins.length)))}
            {extension && !pins.length && !importedBookmarks.length && (
              <button
                className="pin-empty col-span-3"
                onClick={() =>
                  safely(async () => {
                    const win = await browser.windows.getCurrent();
                    const [t] = await browser.tabs.query({
                      windowId: win.id,
                      active: true,
                    });
                    if (t) await browser.tabs.update(t.id, { pinned: true });
                  })
                }
              >
                ＋ 現在のタブをピン留め
              </button>
            )}
          </div>
          {pins.length + importedBookmarks.length > 6 && (
            <button className="gallery-toggle" aria-expanded={galleryExpanded} onClick={() => setGalleryExpanded(value => !value)}>
              {galleryExpanded ? "折りたたむ" : `もっと見る（残り${pins.length + importedBookmarks.length - 6}件）`}
              <ChevronDown size={13} style={{ transform: galleryExpanded ? "rotate(180deg)" : "none" }} />
            </button>
          )}
          <button
            className="documents flex items-center"
            onClick={() =>
              extension
                ? safely(() =>
                    browser.tabs.create({ url: "chrome://bookmarks/" }),
                  )
                : setSearch(true)
            }
          >
            <Files size={15} strokeWidth={1.6} />
            Documents
          </button>
          <button
            className="import-trigger"
            onClick={() => {
              setImportPreview(null);
              setSetupOpen(true);
            }}
          >
            ↓ ブックマークをインポート
          </button>
          <div className="tab-groups">
            {groups.map((g) => (
              <section
                key={g.id}
                data-drop-group={g.id}
                className={`tab-group color-${g.color} ${collapsed[g.id] ? "collapsed" : ""} ${over === `group:${g.id}` ? "group-drop" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => drop(e, g.id, g.tabs.length)}
              >
                <button
                  className="group-heading flex items-center w-full"
                  onClick={() => toggle(g.id)}
                  aria-expanded={!collapsed[g.id]}
                >
                  <ChevronRight
                    className="group-chevron"
                    size={14}
                    strokeWidth={2.4}
                  />
                  <span>{g.title || "Untitled group"}</span>
                  <span className="group-count">{g.tabs.length}</span>
                </button>
                <div className="group-body">
                  <div
                    className="group-body-inner"
                    inert={Boolean(collapsed[g.id])}
                    role="list"
                    aria-label={g.title}
                  >
                    {g.tabs.map((t, i) => tabRow(t, g.id, i))}
                    {!g.tabs.length && (
                      <div className="empty-group">タブをここにドロップ</div>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
          <div
            className="ungrouped"
            data-drop-group="loose"
            role="list"
            aria-label="グループなし"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(e, null, loose.length)}
          >
            {loose.map((t, i) => tabRow(t, null, i))}
            {drag && <div className="ungroup-drop">グループから外す</div>}
          </div>
          <button className="new-tab flex items-center" onClick={newTab}>
            <Plus size={17} strokeWidth={1.7} />
            New Tab<span>⌘ T</span>
          </button>
        </div>
        <footer className="sidebar-footer flex items-center justify-between">
          <button
            className="icon-button"
            onClick={() => setSearch(true)}
            aria-label="タブを検索"
          >
            <Search size={16} />
          </button>
          {!extension || overlay ? (
            <div
              className="placement-switch"
              role="group"
              aria-label="表示位置"
            >
              {[
                ["left", "左"],
                ["right", "右"],
                ["bottom", "下ドック"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={placement === value}
                  onClick={() => {
                    setPlacement(value);
                    saveSettings({ placement: value });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <span className="footer-dots">
              <i />
              <i />
              <i />
            </span>
          )}
          <button
            className="icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="テーマ設定"
          >
            <MoreHorizontal size={19} />
          </button>
        </footer>
      </aside>
      {!extension && (
        <main className="content-panel flex flex-col">
          <div className="content-toolbar flex items-center">
            <PanelLeft size={16} />
            <div className="toolbar-nav flex">
              <ArrowLeft size={15} />
              <ArrowRight size={15} />
              <RotateCw size={14} />
            </div>
            <div className="address flex items-center">
              <Lock size={11} />
              <span>
                {current?.url ? new URL(current.url).hostname : "sideflow.app"}
              </span>
            </div>
            <MoreHorizontal size={18} />
          </div>
          <div className="content-preview flex-1">
            <div className="preview-eyebrow">A LITTLE SPACE TO THINK</div>
            <h1>
              Good work starts
              <br />
              with a clear mind.
            </h1>
            <p>Your tabs, together. Your focus, uninterrupted.</p>
            <div className="preview-line" />
            <div className="preview-meta">
              <span>YOUR WORKSPACE</span>
              <span>{profile} / 01</span>
            </div>
            <div className="preview-card">
              <div className="preview-card-icon">◈</div>
              <div>
                <h2>{current?.title || "Make room for your next idea."}</h2>
                <p>Everything you need, right where it belongs.</p>
              </div>
              <ArrowRight size={18} />
            </div>
            <span className="preview-caption">
              SIDEFLOW — A QUIETER WAY TO BROWSE
            </span>
          </div>
        </main>
      )}
      {setupOpen && (
        <div className="search-backdrop">
          <section
            className="search-modal setup-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="初回セットアップ"
          >
            <h2>いつもの場所を、ここに。</h2>
            <p>
              Chromeのブックマークバーを、フォルダごと取り込めます。元のブックマークは変更しません。
            </p>
            {importPreview !== null ? (
              <>
                <div className="import-preview">
                  <BookmarkImportList nodes={importPreview} />
                  {!importPreview.length && (
                    <p>ブックマークバーにWebページがありません。</p>
                  )}
                </div>
                <button
                  className="setup-primary"
                  disabled={importBusy || !countBookmarks(importPreview)}
                  onClick={() => finishSetup(true)}
                >
                  {countBookmarks(importPreview)}件をインポート
                </button>
              </>
            ) : (
              <button
                className="setup-primary"
                disabled={importBusy}
                onClick={previewBookmarks}
              >
                {importBusy ? "読み込み中…" : "ブックマークバーを確認"}
              </button>
            )}
            <button className="setup-later" onClick={() => finishSetup(false)}>
              あとで
            </button>
          </section>
        </div>
      )}
      {search && (
        <div className="search-backdrop" onClick={() => setSearch(false)}>
          <div
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="タブ検索"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={submit} className="flex items-center">
              <Search size={17} />
              <input
                autoFocus
                placeholder="Search tabs or enter a URL…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setSearch(false)}
                aria-label="閉じる"
              >
                <X size={16} />
              </button>
            </form>
            <div className="search-results">
              {[...groups.flatMap((g) => g.tabs), ...loose]
                .filter((t) =>
                  (t.title || "").toLowerCase().includes(query.toLowerCase()),
                )
                .map((t) => (
                  <button key={t.id} onClick={() => activate(t)}>
                    <Brand type={t.brand} url={t.url} />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
            </div>
            <p>EnterでURLまたは検索を開く · Escで閉じる</p>
          </div>
        </div>
      )}
      {error && (
        <button className="error-toast" onClick={() => setError("")}>
          {error} ×
        </button>
      )}
    </div>
  );
}
if (window.top === window && !globalThis.__sideflowReactMounted) {
  globalThis.__sideflowReactMounted = true;
  createRoot(globalThis.__sideflowMount || document.getElementById("root")).render(<App />);
}
