"""Verify both downloadable archives, catalog checksums, and browser flows."""
import argparse
import hashlib
import json
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('release_dir', type=Path)
args = parser.parse_args()
release = args.release_dir.resolve()
catalog = json.loads((release / 'games.json').read_text(encoding='utf-8'))
destination = release / 'smoke'
for game_id, game in catalog['games'].items():
    archive = release / game['url'].rsplit('/', 1)[1]
    assert archive.stat().st_size == game['size']
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == game['sha256']
    target = destination / game_id
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for name in z.namelist():
            assert (target / name).resolve().is_relative_to(target.resolve())
            assert not name.endswith(('.mp4', '.test.js')) and '/tests/' not in name
        assert json.loads(z.read('package.json'))['id'] == game_id
        z.extractall(target)
for line in (release / 'SHA256SUMS.txt').read_text().splitlines():
    sha, name = line.split('  ', 1)
    assert hashlib.sha256((release / name).read_bytes()).hexdigest() == sha


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(destination)))
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(reduced_motion='reduce')
    errors, missing = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda r: missing.append(r.url) if r.status >= 400 and 'favicon.ico' not in r.url else None)
    app = destination / 'minesweeper/game/app.js'
    instrumented = app.read_text(encoding='utf-8') + '\nwindow.smoke={get board(){return board;},get state(){return state;}};'
    page.route('**/minesweeper/game/app.js', lambda route: route.fulfill(body=instrumented, content_type='text/javascript'))
    page.goto(base + '/minesweeper/game/')
    page.wait_for_function('!!window.MinesweeperGame')
    page.locator('[data-level="0"]').click()
    page.wait_for_function("smoke.state==='playing'")
    page.locator('.cell[data-index="27"]').click()
    page.wait_for_function("smoke.state==='playing' && smoke.board[27].mine===false")
    assert page.evaluate('MinesweeperGame.saveAll().ok')
    result = page.evaluate('MinesweeperGame.prepareToClose()')
    assert result['ok'] and result['readyToClose']
    page.evaluate('MinesweeperGame.resume()')
    page.wait_for_function("smoke.state==='playing'")
    mine = page.evaluate('smoke.board.findIndex(cell=>cell.mine)')
    page.locator(f'.cell[data-index="{mine}"]').click()
    page.wait_for_function("smoke.state==='lost'")
    page.locator('#ending').wait_for(state='visible', timeout=20000)
    assert not errors and not missing, (errors, missing)
    print('Minesweeper: loads, generates a safe first click, saves, resumes, and shows loss result.')
    page.goto(base + '/jellyfish/game/')
    page.wait_for_function("typeof JellyfishGame!=='undefined'")
    page.wait_for_timeout(1500)
    assert page.evaluate('JellyfishGame.save()')
    assert page.evaluate("CONFIG.PHYSICS.backend==='planck' && !CONFIG.DEBUG.randomSpawnEnabled")
    page.locator('#gameCanvas').click()
    page.wait_for_timeout(6000)
    assert not errors and not missing, (errors, missing)
    print('Jellyfish: loads all assets, retains Planck physics and disabled C shortcut, and starts normally.')
    if 'mini-kitchen' in catalog['games']:
        page.goto(base + '/mini-kitchen/game/')
        page.wait_for_function('window.BonbonKitchen?.getSession().ready')
        assert page.evaluate('BonbonRules.duration===90 && BonbonRules.frenzyAt===60')
        assert page.locator('#dev-autoplay').count()==0
        page.locator('#start').click()
        page.wait_for_function("BonbonKitchen.getSession().phase==='playing'")
        page.wait_for_timeout(1500)
        page.keyboard.press('F1')
        assert page.locator('.guide-card').count()==6
        assert page.locator('#visual-rules img').evaluate_all('(items)=>items.every(im=>im.complete&&im.naturalWidth>0)')
        page.keyboard.press('Escape')
        assert page.evaluate("BonbonKitchen.performAction({kind:'ingredient',value:'water'})")
        page.wait_for_timeout(3200)
        assert page.evaluate("BonbonKitchen.getState().pots.some(p=>p.state==='ready')")
        assert not errors and not missing, (errors, missing)
        print('Kitchen: packaged assets/audio load, guide works, 90-second session cooks normally, developer bot excluded.')
    browser.close()
server.shutdown()
print('All package and catalog checks passed.')
