export function readBookmarkBar(tree) {
  const roots = tree?.[0]?.children || [];
  const bar =
    roots.find(
      (node) => node.folderType === "bookmarks-bar" || node.id === "1",
    ) || roots[0];
  const clean = (nodes) =>
    nodes.flatMap((node) => {
      if (node.url)
        return /^https?:\/\//i.test(node.url)
          ? [{ id: node.id, title: node.title || node.url, url: node.url }]
          : [];
      const children = clean(node.children || []);
      return children.length
        ? [{ id: node.id, title: node.title || "Folder", children }]
        : [];
    });
  return clean(bar?.children || []);
}
export function countBookmarks(nodes) {
  return nodes.reduce(
    (sum, node) => sum + (node.url ? 1 : countBookmarks(node.children || [])),
    0,
  );
}
