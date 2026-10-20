from pathlib import Path
from playwright.sync_api import sync_playwright

Path('test-results').mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready')
    page.click('#start');page.wait_for_function('phase==="playing"')
    page.evaluate('''()=>{for(const value of ['water','raw_beef'])BonbonKitchen.performAction({kind:'ingredient',value});paused=true;overlay.style.display='none'}''')
    states=[]
    for dt in [0,.18,.24,.25,.3,.5]:
        states.append(page.evaluate('''dt=>{cookingFX.update(dt,game.pots);render(0);return canvas.toDataURL()}''',dt))
    assert len(set(states))==len(states)
    page.screenshot(path='test-results/water-and-steak.png')
    page.evaluate('''()=>{game.tick(3);cookingFX.update(.01,game.pots);render(0)}''')
    blend=page.evaluate('''()=>{const calls=[],original=draw;draw=id=>calls.push({id,alpha:ctx.globalAlpha});try{cookingFX.update(.3,game.pots);cookingFX.pot(3,game.pots[3]);}finally{draw=original}return calls}''')
    assert any(c['id']==37 for c in blend) and any(c['id']==36 and 0<c['alpha']<1 for c in blend),blend
    page.evaluate('''()=>{cookingFX.update(1,game.pots);paused=false;for(const value of ['corn','tomato'])BonbonKitchen.performAction({kind:'ingredient',value});paused=true;cookingFX.update(.22,game.pots);render(0)}''')
    page.screenshot(path='test-results/ingredients-falling.png')
    state=page.evaluate('JSON.stringify(cookingFX.serialize())')
    page.evaluate('''()=>{const saved=cookingFX.serialize();cookingFX.reset(game.pots);cookingFX.restore(saved,game.pots)}''')
    assert page.evaluate('JSON.stringify(cookingFX.serialize())')==state
    page.evaluate('''()=>{cookingFX.update(1,game.pots);game.pots[3].state='burnt';cookingFX.sync(game.pots);cookingFX.update(.5,game.pots)}''')
    burnt=page.evaluate('''()=>{const original=draw,calls=[];draw=id=>calls.push({id,alpha:ctx.globalAlpha});try{cookingFX.pot(3,game.pots[3])}finally{draw=original}return calls}''')
    assert any(c['id']==40 and 0<c['alpha']<1 for c in burnt),burnt
    page.evaluate('''()=>{cookingFX.update(1,game.pots);game.pots[3]={type:'beef',dish:'beef',state:'ready',age:2};cookingFX.reset(game.pots);render(0)}''')
    page.screenshot(path='test-results/steam-and-fire.png')
    page.click('#exit');page.wait_for_function('phase==="home"');page.click('#start');page.click('#continue-run')
    page.wait_for_function('phase==="resume-countdown"')
    frozen=page.evaluate('JSON.stringify({state:game.snapshot(),fx:cookingFX.serialize()})')
    assert page.evaluate('game.orders.length')>=1
    assert not page.evaluate('buildScene(0).some(i=>i.id>=94&&i.id<=98)')
    page.wait_for_timeout(1800)
    assert page.evaluate('JSON.stringify({state:game.snapshot(),fx:cookingFX.serialize()})')==frozen
    page.screenshot(path='test-results/continue-countdown.png')
    page.wait_for_function('phase==="playing"');page.wait_for_timeout(400)
    assert page.evaluate('buildScene(0).some(i=>i.id>=94&&i.id<=98)')
    assert not errors,errors
    print('Passed: saved-game 321 hides orders and freezes state/FX; water fill, ingredient falls, raw/cooked/burnt blends, persisted FX and rendering.')
    browser.close()
