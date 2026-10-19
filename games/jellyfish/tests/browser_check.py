from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 721})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script('''
      window.startAudioEvents=[]; window.countdownLabels=[]; window.audioEvents=[];
      const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){
        audioEvents.push({url:this.src.split('/').at(-1),phase:window.physicsCheck?.G.phase,volume:this.volume});
        if(/start\\.mp3$/i.test(this.src)) startAudioEvents.push(window.physicsCheck?.G.phase);
        return play.call(this);
      };
      function watch(){
        if(window.physicsCheck?.G.phase==='countdown') {
          const label=OpeningScene.countdownLabel(performance.now()-physicsCheck.G.countdownStart);
          if(countdownLabels.at(-1)!==label)countdownLabels.push(label);
        }
        requestAnimationFrame(watch);
      }
      requestAnimationFrame(watch);
    ''')

    def instrument(route):
        source = (root / 'js/game.js').read_text(encoding='utf-8')
        source = source.replace('  // --- Start ---',
            '  window.physicsCheck = { G, createJellyfishBody, addJellyfishItem, drawInternalBreathing, backgroundMusic:()=>bgm };\n  // --- Start ---')
        route.fulfill(body=source, content_type='text/javascript')

    page.route('**/js/game.js', instrument)
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    page.wait_for_function("window.physicsCheck?.G.phase === 'title'", timeout=60000)
    page.screenshot(path=str(root / 'tests/title-preview.png'))
    assert page.evaluate("audioEvents.some(e=>/background.mp3/i.test(e.url)&&e.phase==='loading'&&Math.abs(e.volume-.2275)<.00001)")
    assert page.evaluate('''() => {
      const canvas=document.createElement('canvas');canvas.width=2559;canvas.height=1441;
      const ctx=canvas.getContext('2d');
      for(const progress of [.01,.3,.6,.99,1]) {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        OpeningScene.drawReveal(ctx,physicsCheck.G.assets,1000,progress);
        const data=ctx.getImageData(0,0,canvas.width,300).data;
        for(let i=0;i<data.length;i+=4*97) {
          if(data[i+3]!==255 || data[i]+data[i+1]+data[i+2]===0)return false;
        }
      }
      return true;
    }'''), 'background reveal must leave no transparent or black upper strip'
    page.locator('#gameCanvas').click()
    page.wait_for_function("physicsCheck.G.phase === 'transition'")
    assert page.evaluate('physicsCheck.G.bubbleTransition.bubbles.length') == 170
    assert page.evaluate('window.countdownLabels') == ['3','2','1','GO!']
    assert page.evaluate('window.startAudioEvents') == ['transition']
    assert page.evaluate("audioEvents.filter(e=>e.url==='timing.MP3').length") == 3
    assert page.evaluate("audioEvents.filter(e=>e.url==='whisper.MP3').length") == 1
    assert page.evaluate("audioEvents.find(e=>e.url==='whisper.MP3').phase") == 'countdown'
    assert page.evaluate('document.fonts.check(\'180px "JellyfishCountdown"\')')
    page.keyboard.press('Enter')
    assert page.evaluate('physicsCheck.G.items.length') == 0
    page.wait_for_timeout(850)
    page.screenshot(path=str(root / 'tests/bubble-transition-preview.png'))
    page.wait_for_function("physicsCheck.G.phase === 'playing'")
    assert page.evaluate('physicsCheck.G.bubbleTransition === null')
    assert page.evaluate('physicsCheck.backgroundMusic().loop && !physicsCheck.backgroundMusic().paused')
    print('Opening: 3,2,1,GO with Hanyi font; start audio only after GO; textured bubbles and clean transition.')
    start_x = page.evaluate('physicsCheck.G.clipX')
    page.keyboard.down('ArrowLeft')
    page.wait_for_timeout(200)
    page.keyboard.up('ArrowLeft')
    assert page.evaluate('physicsCheck.G.clipX') < start_x
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(300)
    page.keyboard.up('ArrowRight')
    assert page.evaluate('physicsCheck.G.clipX') > start_x
    page.keyboard.press('Enter')
    assert page.evaluate('physicsCheck.G.items.length') == 1
    assert page.evaluate("audioEvents.filter(e=>e.url==='click.MP3').length") == 1
    page.wait_for_function('physicsCheck.G.canDrop')
    page.keyboard.press('ArrowDown')
    assert page.evaluate('physicsCheck.G.items.length') >= 2
    page.evaluate('''() => {
      for (const item of physicsCheck.G.items) Matter.Composite.remove(physicsCheck.G.engine.world, item.body);
      physicsCheck.G.items = [];
      physicsCheck.G.merges = [];
    }''')
    results = page.evaluate('''() => {
      const results = [];
      for (let level = 1; level <= 11; level++) {
        const sprite = physicsCheck.G.assets.images['fish' + level];
        const w = sprite.width, h = sprite.height;
        const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(sprite,0,0);
        const original = ctx.getImageData(0,0,w,h).data;
        const item = { level, w, h, sprite, breathPhase:0 };
        const render = phase => {
          ctx.clearRect(0,0,w,h);
          ctx.save(); ctx.translate(w/2,h/2); item.breathPhase=phase;
          physicsCheck.drawInternalBreathing(ctx,item); ctx.restore();
          return ctx.getImageData(0,0,w,h).data;
        };
        const a=render(0), b=render(Math.PI/2);
        let changed=0, rimChanged=0;
        for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
          const radius=Math.hypot((x+.5-w/2)/(w/2),(y+.5-h/2)/(h/2));
          const i=(y*w+x)*4;
          for(let c=0;c<4;c++) {
            // Readback can round premultiplied transparent RGB by one unit.
            if(radius>.9 && (a[i+c]!==b[i+c] || Math.abs(a[i+c]-original[i+c])>2)) rimChanged++;
            if(radius<.7 && a[i+c]!==b[i+c]) changed++;
          }
        }
        results.push({level,changed,rimChanged});
      }
      return results;
    }''')
    assert all((r['changed']==0 if r['level']<=2 else r['changed']>0) and r['rimChanged']==0 for r in results), results
    print('Keyboard: left/right move; Enter/down drop. Levels 1–2 stay static; 3–11 animate with unchanged outer pixels.')
    page.evaluate('''() => {
      const api = physicsCheck;
      const layout = [[880,1340,4,0],[915,1190,3,0],[1045,1310,6,0],
        [1250,1250,7,.5],[1225,1380,1,0],[1310,1380,2,1.5],
        [1430,1340,3,0],[1525,1380,1,0],[1640,1280,7,0],[1735,1380,1,0]];
      for (const [x,y,level,angle] of layout) {
        const body = api.createJellyfishBody(x,y,level);
        Matter.Body.setAngle(body,angle);
        const item = api.addJellyfishItem(body,level);
        Matter.Composite.add(api.G.engine.world,body);
        item.bodyInWorld = true;
      }
    }''')
    page.wait_for_function('physicsCheck.G.items.every(i => i.body.isSleeping)', timeout=30000)
    positions = page.evaluate('JSON.stringify(physicsCheck.G.items.map(i => [i.body.position,i.body.angle]))')
    page.wait_for_timeout(3000)
    assert positions == page.evaluate('JSON.stringify(physicsCheck.G.items.map(i => [i.body.position,i.body.angle]))')
    page.screenshot(path=str(root / 'tests/game-preview.png'))
    count = page.evaluate('physicsCheck.G.items.length')
    gear = page.locator('#settingsToggle').bounding_box()
    assert gear['x'] > 1200 and gear['y'] > 650 and gear['width'] == 46, gear
    page.locator('#settingsToggle').click()
    assert page.locator('#settingsPanel').is_visible()
    page.locator('#musicVolume').evaluate("e=>{e.value=.12;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    page.locator('#effectsVolume').evaluate("e=>{e.value=.4;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    assert page.evaluate('Math.abs(physicsCheck.backgroundMusic().volume-.12)<.00001')
    assert page.locator('#effectsVolumeValue').inner_text() == '40%'
    clip_x = page.evaluate('physicsCheck.G.clipX')
    page.locator('#musicVolume').focus()
    page.keyboard.press('ArrowLeft')
    page.keyboard.press('ArrowDown')
    assert page.evaluate('physicsCheck.G.items.length') == count
    assert page.evaluate('physicsCheck.G.clipX') == clip_x
    page.locator('#settingsHeading').click()
    page.screenshot(path=str(root / 'tests/settings-preview.png'))
    page.locator('#restartButton').click()
    assert page.locator('#restartChoice').is_visible()
    page.locator('#cancelRestart').click()
    page.locator('#restartChoice').wait_for(state='hidden')
    assert page.evaluate("physicsCheck.G.phase==='playing'")
    page.locator('#restartButton').click()
    page.screenshot(path=str(root / 'tests/restart-choice-preview.png'))
    page.locator('#confirmRestart').click()
    page.wait_for_function("physicsCheck.G.phase==='countdown'")
    page.locator('#settingsPanel').wait_for(state='hidden')
    assert page.evaluate("physicsCheck.G.phase==='countdown' && physicsCheck.G.items.length===0")
    assert not page.locator('#settingsPanel').is_visible()
    assert page.evaluate('!physicsCheck.backgroundMusic().paused')
    assert page.evaluate("Math.abs(audioEvents.filter(e=>e.url==='timing.MP3').at(-1).volume-.22)<.00001")
    saved = page.evaluate("JSON.parse(localStorage.getItem('jellyfish.audioSettings'))")
    assert saved['effectsVolume'] == .4
    print('Settings: opens, updates both volumes, persists preferences, avoids keyboard drops and restarts cleanly.')
    assert not errors, errors
    print('Browser: assets load, mixed pile sleeps, positions unchanged for 3 seconds, no script errors')
    browser.close()
server.shutdown()
