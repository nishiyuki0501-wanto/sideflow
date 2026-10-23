"""Package the built extension; no credentials or source files are included."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
manifest = json.loads((dist / 'manifest.json').read_text())
package = json.loads((root / 'package.json').read_text())
assert package['version'] == manifest['version'], 'Version mismatch'
for name in ['background.js', 'index.html', 'newtab.html', 'newtab.js', 'help.html']:
    assert (dist / name).is_file(), f'Missing {name}'
out = root / 'artifacts'
out.mkdir(exist_ok=True)
archive = out / f"sideflow-{manifest['version']}.zip"
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for file in sorted(dist.rglob('*')):
        if file.is_file():
            z.write(file, Path('sideflow-extension') / file.relative_to(dist))
(out / f'{archive.name}.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + '  ' + archive.name + '\n')
shutil.copyfile(archive, out / 'sideflow-chrome-extension.zip')
print(archive)
