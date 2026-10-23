import { cp, readFile, writeFile } from "node:fs/promises";
await cp("extension/background.js", "dist/background.js");
const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
manifest.permissions = [...new Set([...manifest.permissions, "tabGroups"])];
manifest.side_panel.default_path = "index.html";
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));

await cp("README.md", "dist/README.md");

for (const file of ["newtab.html", "newtab.css", "newtab.js", "help.html"]) await cp(`extension/${file}`, `dist/${file}`);

await cp("THIRD_PARTY_NOTICES.txt", "dist/THIRD_PARTY_NOTICES.txt");

for (const file of ["adblock.js", "adblock-background.js", "adblock.html", "adblock.css", "adblock-settings.js"]) await cp(`extension/${file}`, `dist/${file}`);
