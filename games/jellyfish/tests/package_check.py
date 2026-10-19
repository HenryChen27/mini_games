import argparse
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser();parser.add_argument('archive');args=parser.parse_args()
archive=Path(args.archive).resolve();destination=archive.parent/'smoke'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name in z.namelist():assert (destination/name).resolve().is_relative_to(destination.resolve())
    z.extractall(destination)
game=destination/'game'
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(game)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True);page=browser.new_page()
    errors=[];missing=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:missing.append(r.url) if r.status>=400 and 'favicon.ico' not in r.url else None)
    page.route('**/js/game.js',lambda route:route.fulfill(content_type='text/javascript',body=(game/'js/game.js').read_text(encoding='utf-8').replace('  // --- Start ---','  window.packageCheck={G};\n  // --- Start ---')))
    page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function("window.packageCheck?.G.phase==='title'")
    assert not errors and not missing,(errors,missing)
    assert page.evaluate("typeof JellyfishGame.save==='function' && JellyfishGame.save()===true")
    assert page.locator('#exitButton').count()==0
    page.locator('#gameCanvas').click();page.wait_for_function("packageCheck.G.phase==='playing'",timeout=15000)
    page.evaluate("""() => {
      const original=CONFIG.DEBUG.randomSpawnEnabled;
      CONFIG.DEBUG.randomSpawnEnabled=false;
      const id=packageCheck.G.nextId;
      for(const key of ['c','C'])document.body.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
      if(packageCheck.G.nextId!==id)throw new Error('Disabled shortcut generated fish');
      CONFIG.DEBUG.randomSpawnEnabled=true;
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'c',bubbles:true}));
      if(packageCheck.G.nextId!==id+10)throw new Error('Enabled shortcut did not generate ten fish');
      CONFIG.DEBUG.randomSpawnEnabled=original;
    }""")
    assert not errors and not missing,(errors,missing)
    browser.close()
server.shutdown()
print('Packaged game loads every asset, starts playing, and exposes the host save bridge.')
