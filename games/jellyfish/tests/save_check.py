from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1280,'height':721})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def instrument(route):
        source=(root/'js/game.js').read_text(encoding='utf-8')
        source=source.replace('requestAnimationFrame(loop);','/* manual test clock */')
        source=source.replace('  // --- Start ---','  window.saveCheck={G,loop,beginPlaying,restartGame,dropJellyfish,createJellyfishBody,addJellyfishItem,triggerMerge};\n  // --- Start ---')
        route.fulfill(body=source,content_type='text/javascript')
    page.route('**/js/game.js',instrument)
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    page.wait_for_function("window.saveCheck?.G.phase==='title'")
    page.evaluate('''() => {
      const api=saveCheck;api.beginPlaying();api.G.score=123;api.G.clipX=1200;api.G.dropLevel=3;api.G.nextLevel=5;
      for(const [level,x,y] of [[4,1000,1250],[2,1200,1100]]) {
        const body=api.createJellyfishBody(x,y,level);Matter.Body.setAngle(body,.3);
        const item=api.addJellyfishItem(body,level);Matter.Composite.add(api.G.engine.world,body);item.bodyInWorld=true;
        if(level===4)Matter.Sleeping.set(body,true);else {body.positionPrev.x=x-1;body.positionPrev.y=y-2;item.pendingDropImpact=true;}
      }
      api.loop(performance.now());
    }''')
    page.evaluate("window.dispatchEvent(new Event('pagehide'));saveCheck.restartGame()")
    assert page.evaluate("saveCheck.G.phase==='title' && saveCheck.G.items.length===0")
    saved=page.evaluate('SessionSave.read()')
    assert saved['score']==123 and saved['clipX']==1200 and len(saved['items'])==2
    assert saved['dropLevel']==3 and saved['nextLevel']==5
    assert page.evaluate("localStorage.getItem('jellyfish.records.v1')===null")
    page.reload();page.wait_for_function("saveCheck.G.phase==='title'")
    page.locator('#gameCanvas').click()
    assert page.evaluate("saveCheck.G.phase==='savechoice'")
    assert page.locator('#saveChoice').is_visible()
    assert page.locator('dialog[open]').count()==0
    page.wait_for_timeout(250)
    page.evaluate('saveCheck.loop(performance.now())')
    page.screenshot(path=str(root/'tests/save-choice-preview.png'))
    page.locator('#continueSave').click()
    assert page.evaluate("saveCheck.G.phase==='countdown'")
    page.evaluate('saveCheck.beginPlaying()')
    assert page.evaluate('saveCheck.G.score')==123
    restored=page.evaluate('saveCheck.G.items.map(i=>({level:i.level,x:i.body.position.x,y:i.body.position.y,angle:i.body.angle,sleeping:i.body.isSleeping,pendingDropImpact:!!i.pendingDropImpact}))')
    for before,after in zip(saved['items'],restored):
        for key in ['level','x','y','angle','sleeping','pendingDropImpact']:
            assert before[key]==after[key],(key,before,after)
    page.evaluate('saveCheck.loop(performance.now())')
    gear=page.locator('#settingsToggle').bounding_box()
    assert gear['x']>1200 and gear['y']>650,gear
    page.evaluate("window.dispatchEvent(new Event('pagehide'));saveCheck.restartGame()")
    page.locator('#gameCanvas').click()
    page.locator('#newGame').click()
    assert page.evaluate("saveCheck.G.phase==='countdown' && SessionSave.read()===null")
    page.evaluate('saveCheck.beginPlaying()')
    assert page.evaluate('saveCheck.G.score===0 && saveCheck.G.items.length===0')
    page.evaluate("saveCheck.G.dropLevel=2;saveCheck.G.nextLevel=5;saveCheck.dropJellyfish();window.dispatchEvent(new Event('pagehide'))")
    cooling=page.evaluate('SessionSave.read()')
    assert cooling['dropLevel'] is None and cooling['nextLevel']==5 and cooling['cooldownRemaining']>0
    page.evaluate("window.dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('SessionSave.read().nextLevel')==5
    page.reload();page.wait_for_function("saveCheck.G.phase==='title'")
    page.locator('#gameCanvas').click();page.locator('#continueSave').click()
    page.evaluate('saveCheck.beginPlaying()')
    assert page.evaluate('saveCheck.G.dropLevel===null && saveCheck.G.nextLevel===5 && !saveCheck.G.canDrop')
    page.wait_for_function('saveCheck.G.canDrop')
    assert page.evaluate('saveCheck.G.dropLevel')==5
    page.evaluate('saveCheck.restartGame();saveCheck.beginPlaying();SessionSave.clear()')
    page.evaluate('saveCheck.loop(performance.now())')
    page.set_viewport_size({'width':900,'height':800})
    page.wait_for_function("document.getElementById('gameCanvas').getBoundingClientRect().width < 950")
    page.evaluate('saveCheck.loop(performance.now())')
    gear=page.locator('#settingsToggle').bounding_box()
    stage=page.locator('#gameCanvas').bounding_box();scale=stage['width']/1280
    assert abs(gear['width']-46*scale)<.1 and abs(gear['height']-46*scale)<.1,gear
    assert abs(gear['x']-(stage['x']+stage['width']-58*scale))<.1,gear
    assert abs(gear['y']-(stage['y']+stage['height']-58*scale))<.1,gear
    page.set_viewport_size({'width':1280,'height':721})
    # Save a merge in progress: completed score and one resulting jellyfish.
    page.evaluate('''() => {
      const api=saveCheck;
      const a=api.createJellyfishBody(1100,1200,3),b=api.createJellyfishBody(1120,1200,3);
      for(const body of [a,b]) {const i=api.addJellyfishItem(body,3);Matter.Composite.add(api.G.engine.world,body);i.bodyInWorld=true;}
      api.triggerMerge(a,b);
    }''')
    page.evaluate("window.dispatchEvent(new Event('pagehide'));saveCheck.restartGame()")
    merged=page.evaluate('SessionSave.read()')
    assert len(merged['items'])==1 and merged['items'][0]['level']==4 and merged['score']>0
    # Lifecycle saves preserve unfinished progress without clicking Exit.
    page.evaluate("saveCheck.beginPlaying();saveCheck.G.score=456;window.dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('SessionSave.read().score')==456
    page.evaluate("saveCheck.G.score=457;saveCheck.loop(performance.now()+11000)")
    assert page.evaluate('SessionSave.read().score')==457
    # An expired danger deadline cannot be reset by reload or continuation.
    page.evaluate('''() => {
      saveCheck.G.overflowStart=performance.now()-2900;
      window.dispatchEvent(new Event('pagehide'));
      const saved=SessionSave.read();
      if(saved.overflowElapsed<2900 || !Number.isFinite(saved.dangerDeadline))throw new Error('Danger timer not saved');
      saved.dangerDeadline=Date.now()-100;
      SessionSave.write(saved);
    }''')
    page.reload();page.wait_for_function("saveCheck.G.phase==='title'")
    page.locator('#gameCanvas').click();page.locator('#continueSave').click()
    page.evaluate('saveCheck.beginPlaying()')
    assert page.evaluate("saveCheck.G.phase==='gameover' && SessionSave.read()===null")
    assert page.evaluate('saveCheck.G.ending.score')==457
    assert page.locator('#exitButton').count()==0
    assert page.evaluate('typeof window.JellyfishGame.save==="function" && typeof window.JellyfishGame.safeSaveAndExit==="undefined"')
    assert page.locator('button:not([tabindex="-1"])').count()==0
    assert page.evaluate("document.activeElement.tagName!=='BUTTON'")
    assert not errors,errors
    print('Passed: save and exit, refresh persistence, inline choice, exact restoration, settings placement, new game, merge in progress, no ranking record on exit, no button focus.')
    browser.close()
server.shutdown()
