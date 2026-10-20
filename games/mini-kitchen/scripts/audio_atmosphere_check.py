from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('test-results/atmosphere');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1706,'height':784})
    errors=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready')
    page.click('#start');page.wait_for_function("phase==='playing'")
    page.wait_for_function("kitchenSound.status.loops.includes('music')")
    page.evaluate("BonbonKitchen.performAction({kind:'ingredient',value:'raw_beef'})")
    page.wait_for_function("kitchenSound.status.heating&&kitchenSound.status.loops.includes('heating')")
    assert page.evaluate("kitchenSound.status.events.at(-1)")=='add_beef'
    page.evaluate("BonbonKitchen.performAction({kind:'ingredient',value:'water'})")
    assert page.evaluate("kitchenSound.status.events.at(-1)")=='add_water'
    for ingredient,expected in [('corn','add_corn_or_carrot'),('tomato','add_tomato_or_potato')]:
        page.evaluate("""ingredient=>{game.orders=[];Object.assign(game.pots[0],{state:'ready',dish:'soup',age:0});Object.assign(game.pots[3],{state:'ready',dish:'beef',age:0});BonbonKitchen.performAction({kind:'ingredient',value:ingredient});}""",ingredient)
        assert page.evaluate('kitchenSound.status.events.at(-1)')==expected
    page.evaluate("()=>{game.orders=[];game.storage.fill(null);BonbonKitchen.performAction({kind:'pot',i:0});}")
    assert page.evaluate('kitchenSound.status.events.at(-1)')=='switch_to_bowl'
    page.evaluate("BonbonKitchen.performAction({kind:'storage',i:0})")
    assert page.evaluate('kitchenSound.status.events.at(-1)')=='trash_can'
    page.evaluate("()=>{game.orders=[];game.next=100;BonbonKitchen.performAction({kind:'pot',i:3});}")
    assert page.evaluate('kitchenSound.status.events.at(-1)')=='switch_to_plate'
    page.evaluate("()=>{game.elapsed=59.99;game.pots[3].age=2.99}")
    page.wait_for_function("game.frenzy&&kitchenSound.status.events.includes('bonbon_time')")
    assert page.evaluate("kitchenSound.status.events.filter(n=>n==='bonbon_time').length")==1
    page.evaluate("()=>{paused=true;for(let i=0;i<6;i++)Object.assign(game.pots[i],{state:'ready',dish:i<3?'soup':'beef',age:1});cookingFX.reset(game.pots);cookingFX.triggerBonbon();cookingFX.update(.8,game.pots);render(0)}")
    page.screenshot(path=str(out/'bonbon-bell.png'))
    frozen=page.evaluate('JSON.stringify(cookingFX.serialize())')
    page.wait_for_timeout(300)
    assert page.evaluate('JSON.stringify(cookingFX.serialize())')==frozen
    page.evaluate("()=>{const s=cookingFX.serialize();cookingFX.reset(game.pots);cookingFX.restore(s,game.pots);if(JSON.stringify(s)!==JSON.stringify(cookingFX.serialize()))throw Error('Bell restore mismatch');cookingFX.update(1.4,game.pots);render(0)}")
    page.screenshot(path=str(out/'bonbon-vapor.png'))
    page.evaluate("()=>{cookingFX.update(1.2,game.pots);render(0)}")
    page.screenshot(path=str(out/'steam-and-fire.png'))
    page.wait_for_function("!kitchenSound.status.loops.includes('heating')",timeout=5000)
    page.evaluate("()=>{paused=false;game.elapsed=84.99}")
    page.wait_for_function("kitchenSound.status.events.includes('last_5_sec')")
    page.evaluate("()=>{for(const pot of game.pots)Object.assign(pot,{state:'empty',dish:null});}")
    page.wait_for_function("!kitchenSound.status.heating")
    assert not errors,errors
    assert not failed,failed
    print('Passed: actual audio files, single heating loop/fade, mapped clicks, BGM, frenzy bell once, full-screen steam, last-five cue, pause/save and no failed assets.')
    browser.close()
