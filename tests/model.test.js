import test from "node:test";
import assert from "node:assert/strict";
import { resolveInput, flatten } from "../extension/model.js";
test("URLと検索語を解決し、実行可能なURLを拒否する", () => {
  assert.equal(resolveInput("example.com/path"), "https://example.com/path");
  assert.equal(resolveInput("https://example.com"), "https://example.com/");
  assert.equal(
    resolveInput("日本語の検索"),
    "https://www.google.com/search?q=%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E6%A4%9C%E7%B4%A2",
  );
  for (const value of [
    "",
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///etc/passwd",
    "ftp://example.com",
  ])
    assert.equal(resolveInput(value), null);
});
test("ブックマークをフォルダの深さに関わらず検索する", () => {
  assert.deepEqual(
    flatten([
      {
        children: [
          { id: "1", url: "https://a.test" },
          { children: [{ id: "2", url: "https://b.test" }] },
        ],
      },
    ]).map((n) => n.id),
    ["1", "2"],
  );
});

import { readBookmarkBar, countBookmarks } from "../src/bookmarks.js";
test("ブックマークバーの順序とフォルダを保持し、Webページを取り込む", () => {
  const tree = [
    {
      children: [
        {
          id: "1",
          children: [
            { id: "a", title: "A", url: "https://a.test" },
            {
              id: "f",
              title: "Folder",
              children: [
                { id: "b", title: "B", url: "https://b.test" },
                { id: "x", title: "bookmarklet", url: "javascript:alert(1)" },
              ],
            },
          ],
        },
        { id: "2", children: [{ id: "c", url: "https://other.test" }] },
      ],
    },
  ];
  const result = readBookmarkBar(tree);
  assert.equal(countBookmarks(result), 2);
  assert.deepEqual(
    result.map((n) => n.id),
    ["a", "f"],
  );
  assert.deepEqual(
    result[1].children.map((n) => n.id),
    ["b"],
  );
  assert.equal(tree[0].children[0].children[1].children.length, 2);
});

import { createGestureGate } from "../extension/gesture.js";
test("逆スワイプは待ち時間なく反応し、小さな揺れは無視する", () => {
  const consume = createGestureGate();
  assert.equal(consume(30, 0), 0);
  assert.equal(consume(30, 16), 1);
  assert.equal(consume(-3, 32), 0);
  assert.equal(consume(2, 48), 0);
  assert.equal(consume(-25, 64), 0);
  assert.equal(consume(-25, 80), -1);
  assert.equal(consume(60, 96), 1);
});
test("同方向の慣性は再発火せず、新しい加速には即反応する", () => {
  const consume = createGestureGate();
  assert.equal(consume(100, 0), 1);
  for (const [delta, time] of [[80,16],[50,32],[20,48],[8,64],[3,80]]) assert.equal(consume(delta,time),0);
  assert.equal(consume(60,96),1);
  assert.equal(consume(45,112),0);
  assert.equal(consume(60,220),1);
});
