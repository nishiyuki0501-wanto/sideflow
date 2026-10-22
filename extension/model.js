export function resolveInput(value) {
  const input = value.trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    if (["https:", "http:"].includes(url.protocol)) return url.href;
    if (input.includes("://") || /^(javascript|data|file):/i.test(input))
      return null;
  } catch {}
  if (/^(localhost(:\d+)?|[\w-]+(?:\.[\w-]+)+)([/:?#].*)?$/.test(input))
    return `https://${input}`;
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}
export function flatten(nodes) {
  return nodes.flatMap((node) =>
    node.url ? [node] : flatten(node.children || []),
  );
}
