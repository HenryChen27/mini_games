"""Keep the runtime dependency closure; archive removed originals locally first."""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
keep = set()
def add(name):
    path = ROOT / name
    assert path.is_file(), name
    assert path.resolve().is_relative_to((ROOT / 'assets').resolve()), name
    keep.add(path)
def manifest(name):
    add(name)
    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key == 'src' and isinstance(item, str): add(item)
                else: walk(item)
        elif isinstance(value, list):
            for item in value: walk(item)
    walk(json.loads((ROOT / name).read_text(encoding='utf-8')))
for name in ['assets/sprites.json', 'assets/fx/dish-parts.json', 'assets/fx/generated/manifest-v1.json', 'assets/effects/runtime/manifest.json']:
    manifest(name)
add('assets/fx/shortcut-outlines.json')
for name in ['ending_background','heart','button','ranking','fire','bell','correct','settings','rank_page','1st','2nd','3rd']:
    add(f'assets/{name}.png')
for name in ['flame_atlas','steam_atlas','water']: add(f'assets/fx/{name}.png')
for path in (ROOT/'assets/guide').glob('*.webp'): add(path.relative_to(ROOT).as_posix())
for path in (ROOT/'assets/font').glob('*.ttf'): add(path.relative_to(ROOT).as_posix())
audio = (ROOT/'kitchen-audio.js').read_text(encoding='utf-8')
for name in re.findall(r"'([^']+)'", re.search(r'const names=\[(.*?)\]',audio).group(1)):
    add(f'assets/audio/{name}.MP3')
add('assets/audio/heating.MP3')
for name in re.findall(r"assets/audio/[^'`]+\.mp3",audio): add(name)
removed = sorted(p for p in (ROOT/'assets').rglob('*') if p.is_file() and p not in keep)
report = {'kept_files': len(keep), 'removed_files': len(removed), 'removed_bytes': sum(p.stat().st_size for p in removed),
          'runtime': sorted(p.relative_to(ROOT).as_posix() for p in keep),
          'removed': [p.relative_to(ROOT).as_posix() for p in removed]}
out=ROOT/'.local-backup';out.mkdir(exist_ok=True)
(out/'asset-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print({k:v for k,v in report.items() if k not in ['runtime','removed']})
if args.apply and removed:
    backup=out/'unused-assets-before-cleanup.zip'
    assert not backup.exists(), 'Do not overwrite an existing backup'
    with zipfile.ZipFile(backup,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for path in removed: z.write(path,path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(backup) as z:
        assert z.testzip() is None
        for path in removed:
            assert hashlib.sha256(z.read(path.relative_to(ROOT).as_posix())).digest()==hashlib.sha256(path.read_bytes()).digest()
    for path in removed:
        assert path.resolve().is_relative_to((ROOT/'assets').resolve())
        path.unlink()
    for path in sorted((ROOT/'assets').rglob('*'),key=lambda p:len(p.parts),reverse=True):
        if path.is_dir() and not any(path.iterdir()): path.rmdir()
    print('Archived, verified, and removed unused assets.')
