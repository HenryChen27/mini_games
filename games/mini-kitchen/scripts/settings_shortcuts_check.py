from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('test-results/settings');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1706,'height':784})
    errors=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready')
    assert page.locator('#pause').count()==0
    assert page.evaluate("typeof BonbonKitchen.pause")=='undefined'
    page.click('#settings-toggle');assert page.locator('#settings-panel').is_visible()
    page.locator('#music-volume').fill('23');page.locator('#effects-volume').fill('67')
    assert page.evaluate('kitchenSound.volumes')=={'music':.23,'effects':.67}
    page.screenshot(path=str(out/'audio-panel.png'))
    page.click('#edit-keybindings');page.wait_for_function("phase==='keybindings'")
    assert page.evaluate('game.elapsed')==0
    def select(index):
        page.evaluate('(i)=>{const r=hitRect(hits[i]);BonbonSettings.select({x:r.x+r.w/2,y:r.y+r.h/2})}',index)
    select(0);page.keyboard.press('a');page.click('#save-keybindings')
    assert page.evaluate('BonbonSettings.state.editing')
    assert page.locator('#keybinding-hint').evaluate('(el)=>el.classList.contains("key-error")')
    assert page.evaluate('BonbonSettings.state.bindings["pot:0"]')=='KeyQ'
    page.screenshot(path=str(out/'conflict.png'))
    select(1);page.keyboard.press('q');page.screenshot(path=str(out/'key-preview.png'))
    page.click('#save-keybindings');assert page.evaluate('phase')=='home'
    assert page.evaluate('BonbonSettings.state.bindings["pot:0"]')=='KeyA'
    page.reload(wait_until='networkidle');page.wait_for_function('ready')
    assert page.evaluate('kitchenSound.volumes')=={'music':.23,'effects':.67}
    assert page.evaluate('BonbonSettings.state.bindings["pot:0"]')=='KeyA'
    page.click('#start');page.wait_for_function("phase==='playing'")
    cues=page.evaluate('kitchenSound.status.events')
    assert cues.count('timer')==3 and cues.count('start')==1,cues
    page.keyboard.press('Space');assert page.evaluate('game.pots[0].state')=='cooking'
    assert page.evaluate('kitchenSound.status.events.at(-1)')=='add_water'
    page.keyboard.press('a');assert page.evaluate('pressEffects.some(e=>e.id===2)')
    before=page.evaluate('game.elapsed');page.keyboard.press('Space');page.wait_for_timeout(200)
    assert page.evaluate('game.elapsed')>before and not page.evaluate('paused')
    page.click('#settings-toggle');before=page.evaluate('game.elapsed');page.wait_for_timeout(250)
    assert page.evaluate('game.elapsed')>before
    page.click('#edit-keybindings');assert page.evaluate('readSavedRun()!==null')
    saved=page.evaluate('JSON.stringify(game.serialize())');page.wait_for_timeout(250)
    assert saved==page.evaluate('JSON.stringify(game.serialize())')
    page.click('#cancel-keybindings');page.click('#start');assert page.locator('#continue-dialog').is_visible()
    page.click('#continue-run');page.wait_for_function("phase==='playing'")
    cues=page.evaluate('kitchenSound.status.events');assert cues.count('timer')==6 and cues.count('start')==2,cues
    mark=page.evaluate("""()=>{const original=ctx.drawImage,calls=[];ctx.drawImage=(im,...args)=>calls.push({src:im.src,alpha:ctx.globalAlpha});try{check(10,10,40)}finally{ctx.drawImage=original}return calls[0]}""")
    assert mark['src'].endswith('/correct.png') and abs(mark['alpha']-.58)<1e-6
    direction=page.evaluate("""()=>{const original=ctx.drawImage,positions=[];for(const dt of [.8,.65]){cookingFX.triggerBonbon();cookingFX.update(dt===.8?.8:1.45,game.pots);let first=null;ctx.drawImage=(im,...args)=>{if(!first&&im.width===192)first=args[0]+args[2]/2};try{cookingFX.celebration()}finally{ctx.drawImage=original}positions.push(first)}return positions}""")
    assert direction[1]<direction[0],direction
    assert not failed,failed
    assert not errors,errors
    mobile=browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
    phone=mobile.new_page();phone.goto('http://127.0.0.1:8080',wait_until='networkidle');phone.click('#settings-toggle')
    assert phone.locator('#music-volume').is_visible() and phone.locator('#edit-keybindings').is_hidden()
    browser.close()
    print('Passed: volume persistence, desktop-only shortcuts, isolated preview, conflict rejection/swap/save, real hotkeys, 321/GO for start+continue, no pause, correct alpha, outward steam and mobile settings.')
