from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
from PIL import Image

root = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 721})
    errors = []
    page.add_init_script('''
      window.endSounds=[];
      const originalPlay=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){endSounds.push(this.src.split('/').at(-1));return originalPlay.call(this);};
    ''')
    page.on('pageerror', lambda e: errors.append(str(e)))
    def instrument(route):
        source = (root/'js/game.js').read_text(encoding='utf-8')
        source = source.replace('requestAnimationFrame(loop);', '/* manual clock */')
        source = source.replace('  // --- Start ---', '  window.endCheck={G,loop,checkGameOver,finishGame,restartGame};\n  // --- Start ---')
        route.fulfill(body=source, content_type='text/javascript')
    page.route('**/js/game.js', instrument)
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    page.wait_for_function("window.endCheck?.G.phase==='title'")
    page.evaluate('''() => {
      localStorage.setItem('jellyfish.records.v1',JSON.stringify([{score:500,date:'2026-10-10'},{score:300,date:'2026-10-11'}]));
      endCheck.G.phase='playing';endCheck.G.score=800;endCheck.loop(performance.now());
    }''')
    assert page.locator('#gameplayRankToggle').inner_text()=='展开排行榜'
    assert not page.locator('#gameplayRankPanel').is_visible()
    page.locator('#gameplayRankToggle').click()
    assert page.locator('#gameplayRankToggle').inner_text()=='收起排行榜'
    assert page.locator('#gameplayRankPanel li').count()==3
    assert page.locator('#gameplayRankPanel li span').all_text_contents()==['500','300','—']
    page.keyboard.press('Space')
    assert page.locator('#gameplayRankToggle').inner_text()=='收起排行榜'
    assert page.evaluate("document.activeElement.tagName!=='BUTTON'")
    assert page.locator('#gameplayRankToggle').get_attribute('tabindex')=='-1'
    assert page.evaluate('endCheck.G.items.length')==0
    page.locator('#gameplayRankPanel h2').click()
    page.screenshot(path=str(root/'tests/gameplay-ranking-preview.png'))
    page.evaluate('''() => {
      endCheck.G.items=[{bodyInWorld:true,spawnTime:-10000,body:{bounds:{min:{y:0}}}}];
      endCheck.G.overflowStart=-10000;endCheck.checkGameOver();endCheck.G.items=[];
    }''')
    assert page.evaluate("endCheck.G.phase==='gameover' && endCheck.G.ending.newRecord")
    assert page.evaluate("endSounds.filter(s=>s==='ending.MP3').length===1 && !endSounds.includes('start.MP3')")
    assert len(page.evaluate("JSON.parse(localStorage.getItem('jellyfish.records.v1'))")) == 3
    page.evaluate('endCheck.finishGame(performance.now())')
    assert len(page.evaluate("JSON.parse(localStorage.getItem('jellyfish.records.v1'))")) == 3
    frames=[]
    for t in range(0, 2701, 100):
        page.evaluate('t=>endCheck.loop(endCheck.G.ending.start+t)', t)
        image=Image.open(__import__('io').BytesIO(page.screenshot())).convert('RGB').resize((960,541))
        frames.append(image)
        if t==1100: image.save(root/'tests/end-bubbles-preview.png')
    page.screenshot(path=str(root/'tests/results-preview.png'))
    frames[0].save(root/'tests/end-preview.gif',save_all=True,append_images=frames[1:],duration=100,loop=0)
    page.locator('#gameCanvas').click(position={'x':400,'y':100})
    assert page.evaluate("endCheck.G.phase==='gameover'")
    page.locator('#showRecords').click()
    assert page.locator('dialog').is_visible()
    assert page.locator('tbody tr').count()==3
    assert page.locator('tbody tr').first.inner_text().split()==['1','800',page.evaluate('endCheck.G.ending.records[0].date')]
    page.keyboard.press('ArrowDown')
    assert page.evaluate("endCheck.G.phase==='gameover'")
    page.screenshot(path=str(root/'tests/records-preview.png'))
    page.keyboard.press('Escape')
    page.locator('dialog').wait_for(state='hidden')
    page.locator('#playAgain').click()
    assert page.evaluate("endCheck.G.phase==='restarting' && endCheck.G.score===0")
    page.evaluate('endCheck.loop(endCheck.G.replay.start+800)')
    page.screenshot(path=str(root/'tests/restart-preview.png'))
    page.evaluate('endCheck.loop(endCheck.G.replay.start+1450)')
    assert page.evaluate("endCheck.G.phase==='countdown'")
    page.locator('#playAgain').wait_for(state='hidden')
    page.evaluate('''() => {
      const rows=Array.from({length:55},(_,i)=>({score:i,date:'2026-10-12'}));
      rows.push({score:-1,date:'bad'},null);
      localStorage.setItem('jellyfish.records.v1',JSON.stringify(rows));
      endCheck.G.phase='playing';endCheck.G.score=54;endCheck.finishGame(performance.now());
    }''')
    assert not page.evaluate('endCheck.G.ending.newRecord')
    rows=page.evaluate("JSON.parse(localStorage.getItem('jellyfish.records.v1'))")
    assert len(rows)==50 and rows[0]['score']==54 and rows[1]['score']==54
    assert all(rows[i]['score']>=rows[i+1]['score'] for i in range(49))
    page.reload();page.wait_for_function("window.endCheck?.G.phase==='title'")
    assert len(page.evaluate('EndScene.read()'))==50
    page.evaluate("localStorage.setItem('jellyfish.records.v1','broken')")
    assert page.evaluate('EndScene.read().length')==0
    assert not errors,errors
    print('Passed: overflow ending, bubbles and settlement, single save, record badge, top 3, modal controls, replay, sorted 50 records, equal scores, reload and malformed storage.')
    browser.close()
server.shutdown()
