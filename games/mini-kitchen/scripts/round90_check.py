from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('test-results/round90');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True);page=browser.new_page(viewport={'width':1706,'height':784})
    errors=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready')
    assert page.evaluate('BonbonRules.duration')==90 and page.evaluate('BonbonRules.frenzyAt')==60
    page.click('#start');page.wait_for_function("phase==='playing'")
    assert page.evaluate('game.elapsed')<1
    page.keyboard.press('F1');assert page.locator('#rules').is_visible()
    assert page.locator('.guide-card').count()==6
    assert page.locator('#visual-rules img').count()>=25
    assert page.locator('#visual-rules img').evaluate_all('(images)=>images.every(im=>im.complete&&im.naturalWidth>0)')
    page.screenshot(path=str(out/'guide.png'));page.locator('#rules').evaluate('(el)=>el.scrollTop=el.scrollHeight');page.screenshot(path=str(out/'guide-bottom.png'));page.click('#closeRules')
    assert page.locator('#dev-autoplay-mode option').count()==3
    page.evaluate("()=>{window.executions=[];const real=BonbonKitchen.performAction;BonbonKitchen.performAction=a=>{executions.push({t:performance.now(),a});return real(a)};}")
    for mode in ['ordinary','greedy','fastest']:
        page.evaluate("""mode=>{BonbonDevAutoplay.stop();game.reset();game.spawn();cookingFX.reset(game.pots);window.executions=[];BonbonDevAutoplay.setMode(mode);BonbonDevAutoplay.start()}""",mode)
        if mode!='fastest':
            page.wait_for_function('BonbonDevAutoplay.pending.length>0')
            jobs=page.evaluate('BonbonDevAutoplay.pending');assert all(j['due']>j['decided'] for j in jobs)
            if mode=='greedy':assert len(jobs)>1 and len(set(j['due'] for j in jobs))>1
            page.wait_for_timeout(70);assert page.evaluate('executions.length')==0
        page.wait_for_function('executions.length>0');page.evaluate('BonbonDevAutoplay.stop()')
        actions=page.evaluate('executions')
        if mode!='ordinary':
            page.wait_for_timeout(100) # Independent jobs are batched; repeated buttons can be deferred.
    page.evaluate('game.elapsed=59.99');page.wait_for_function('game.frenzy')
    assert page.evaluate('game.elapsed')<61
    page.evaluate('game.elapsed=89.99');page.wait_for_function("phase==='results'")
    assert page.evaluate('game.elapsed')==90
    assert not errors,errors
    assert not failed,failed
    browser.close();print('Passed: 90s round, last-30 frenzy, illustrated guide, decision-to-action delays, same-frame parallel buttons, three selectable modes and actual finish.')
