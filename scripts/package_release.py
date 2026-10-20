"""Build independent game/ packages and a shared release catalog (no dependencies)."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True, help='Collection release version; individual versions live in games.json')
    parser.add_argument('--compatibility-dir', type=Path, required=True, help='Previous desktop release assets (three launchers and two manifests)')
    args = parser.parse_args()
    output = ROOT / 'dist' / f'mini-games-v{args.version}'
    output.mkdir(parents=True, exist_ok=True)
    repository = 'HenryChen27/mini_games'
    base = f'https://github.com/{repository}/releases/download/mini-games-v{args.version}'
    catalog = {'schema': 1, 'version': args.version, 'games': {}}
    for game in json.loads((ROOT / 'games.json').read_text(encoding='utf-8'))['games']:
        source = ROOT / game['path']
        if game['id'] == 'jellyfish':
            files = [source / 'index.html']
            files += sorted((source / 'js').glob('*.js'))
            files += sorted((source / 'js').glob('*LICENSE*.txt'))
            files += sorted((source / 'css').glob('*.css'))
            files += sorted(p for p in (source / 'assets').rglob('*') if p.is_file()
                            and p.suffix.lower() in {'.png', '.mp3', '.wav', '.ttf', '.txt', '.md'} and p.name != '1.png')
        elif game['id'] == 'mini-kitchen':
            files = sorted(p for p in source.iterdir() if p.is_file() and
                           (p.suffix in {'.js', '.css', '.html'} and p.name != 'dev-autoplay.js'
                            or p.name in {'package.json', 'README.md'}))
            files += sorted(p for p in (source / 'assets').rglob('*') if p.is_file())
        else:
            files = sorted(p for p in source.iterdir() if p.is_file() and
                           (p.suffix in {'.js', '.css', '.html'} and not p.name.endswith('.test.js')
                            or p.name in {'package.json', 'server.mjs', 'README.md'}))
            # Keep only runtime artwork, not raw screenshots, reference photos or videos.
            excluded = {'home_raw.png', 'game_raw.png', 'succeed_raw.png', 'fail_raw.png',
                        'gamepage_2.png', '10\u670815\u65e5.png', '\u6d88\u9664\u7167\u7247\u6587\u5b57UI_2.png'}
            files += sorted(p for p in (source / 'assets').rglob('*') if p.is_file()
                            and p.suffix.lower() in {'.png', '.mp3', '.wav', '.ttf'} and p.name not in excluded)
        archive = output / game['archive']
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for file in files:
                name = 'game/' + file.relative_to(source).as_posix()
                if game['id'] == 'mini-kitchen' and file.name == 'index.html':
                    import re
                    html = file.read_text(encoding='utf-8')
                    html = re.sub(r'<!-- DEVELOPMENT ONLY:.*?--><script src="dev-autoplay\.js[^\"]*"></script>', '', html)
                    z.writestr(name, html)
                else:
                    z.write(file, name)
            z.writestr('package.json', json.dumps({k: game[k] for k in ['id', 'runtime', 'version']}))
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            assert 'game/index.html' in z.namelist()
            assert not any(n.endswith(('.mp4', '.test.js')) or '/tests/' in n for n in z.namelist())
        catalog['games'][game['id']] = {**{k: game[k] for k in ['id', 'name', 'version', 'runtime']},
                                        'entry': 'game/index.html', 'size': archive.stat().st_size,
                                        'sha256': digest(archive), 'url': base + '/' + archive.name}
        print(f"{game['id']}: {len(files)} files, {archive.stat().st_size} bytes")
    # Preserve the schema/filenames consumed by existing jellyfish hosts.
    previous = args.compatibility_dir
    native = json.loads((previous / 'native-desktop-games.json').read_text(encoding='utf-8-sig'))
    for platform, entry in native['launchers'].items():
        asset = previous / f'GameLauncher-{platform}.zip'
        assert asset.stat().st_size == entry['size'] and digest(asset) == entry['sha256']
        shutil.copy2(asset, output / asset.name)
        entry['url'] = base + '/' + asset.name
    native['game'] = {k: catalog['games']['jellyfish'][k] for k in ['version', 'size', 'sha256', 'url']}
    legacy = json.loads((previous / 'desktop-games.json').read_text(encoding='utf-8-sig'))
    legacy_assets = []
    for entry in legacy['packages'].values():
        name = entry['url'].rsplit('/', 1)[1]
        asset = previous / name
        if not asset.is_file():
            raise FileNotFoundError(f'Legacy package required before pruning old releases: {asset}')
        assert asset.stat().st_size == entry['size'] and digest(asset) == entry['sha256']
        target = output / name
        if asset.resolve() != target.resolve():
            shutil.copy2(asset, target)
        entry['url'] = base + '/' + name
        legacy_assets.append(name)
    for name, data in [('games.json', catalog), ('native-desktop-games.json', native), ('desktop-games.json', legacy)]:
        (output / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    assets = [g['archive'] for g in json.loads((ROOT / 'games.json').read_text(encoding='utf-8'))['games']]
    assets += [f'GameLauncher-{platform}.zip' for platform in native['launchers']]
    assets += ['games.json', 'native-desktop-games.json', 'desktop-games.json'] + legacy_assets
    (output / 'SHA256SUMS.txt').write_text(''.join(f'{digest(output / name)}  {name}\n' for name in sorted(assets)), encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
