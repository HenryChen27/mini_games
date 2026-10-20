"""Stage the cleaned game in the multi-game repository, without local backups."""
import json
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
repo=ROOT/'.publish/mini_games'
dest=repo/'games/mini-kitchen'
dest.mkdir(parents=True,exist_ok=True)
for p in ROOT.iterdir():
    if p.is_file() and (p.suffix in {'.js','.css','.html','.txt','.bat'} or p.name in {'README.md','package.json','.gitignore'}):
        shutil.copy2(p,dest/p.name)
for folder in ['assets','tests','scripts']:
    shutil.copytree(ROOT/folder,dest/folder,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
package=json.loads((dest/'package.json').read_text(encoding='utf-8'));package['version']='1.5.0'
(dest/'package.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
title=''.join(map(chr,[37030,37030,23567,21416,25151]))
catalog=json.loads((repo/'games.json').read_text(encoding='utf-8'))
assert not any(g['id']=='mini-kitchen' for g in catalog['games'])
catalog['games'].append({'id':'mini-kitchen','name':title,'version':'1.5.0','path':'games/mini-kitchen','archive':'BonbonKitchen-game.zip','runtime':'system-webview'})
(repo/'games.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
index=(repo/'index.html').read_text(encoding='utf-8')
index=index.replace('</nav>',f'<a href="games/mini-kitchen/"><h2>{title}</h2><p>90s · '+''.join(map(chr,[28857,20987,28921,39274,65292,23436,25104,35746,21333]))+'</p><span class="version">1.5.0 · '+''.join(map(chr,[40736,26631,32,47,32,35302,23631,32,47,32,38190,30424]))+'</span></a></nav>')
(repo/'index.html').write_text(index,encoding='utf-8')
package=json.loads((repo/'package.json').read_text(encoding='utf-8'))
package['scripts']['test']+=' && npm --prefix games/mini-kitchen test'
package['scripts']['test:mini-kitchen']='npm --prefix games/mini-kitchen test'
(repo/'package.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
readme=(repo/'README.md').read_text(encoding='utf-8')
lines=readme.splitlines();last=next(i for i,l in enumerate(lines) if 'games/minesweeper](games/minesweeper)' in l)
lines.insert(last+1,f'| {title} | [games/mini-kitchen](games/mini-kitchen) | 1.5.0 |')
(repo/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(dest)
