from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('test-results/polish');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1706,'height':784})
    errors=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready&&BonbonSettings.state.outlineCount===22')
    assert page.locator('#sound').count()==0
    for score,title in [(0,'见习厨师'),(1999,'见习厨师'),(2000,'铜牌厨师'),(4999,'铜牌厨师'),(5000,'银牌厨师'),(7999,'银牌厨师'),(8000,'金牌厨师')]:
        assert page.evaluate('score=>chefTitle(score)',score)==title
    page.click('#start');page.wait_for_function("phase==='playing'")
    hints=page.evaluate("""()=>{const original=ctx.fillText,calls=[];ctx.fillText=(...args)=>calls.push(args);try{BonbonSettings.drawHints()}finally{ctx.fillText=original}return calls}""")
    assert len(hints)==22
    page.screenshot(path=str(out/'game-hints.png'))
    page.evaluate("()=>{window.actionTimes=[];window.realAction=BonbonKitchen.performAction;BonbonKitchen.performAction=a=>{actionTimes.push(performance.now());return realAction(a)};BonbonDevAutoplay.start()}")
    page.wait_for_timeout(1500);page.evaluate('BonbonDevAutoplay.stop()')
    times=page.evaluate('actionTimes');assert len(times)>=3,times
    assert any(b-a<30 for a,b in zip(times,times[1:])),times
    for elapsed,color in [(84.9,'#e5bd73'),(85,'#D1453A'),(89,'#D1453A')]:
        actual=page.evaluate("""elapsed=>{game.elapsed=elapsed;const original=hudNumber;let color;hudNumber=(...args)=>color=args[3];try{buildScene(0).find(s=>s.z===102.1).paint()}finally{hudNumber=original}return color}""",elapsed)
        assert actual==color,(elapsed,actual)
    bell=page.evaluate("""()=>{paused=true;const original=ctx.drawImage,result=[];for(const t of [.05,.2,.4]){cookingFX.triggerBonbon();cookingFX.update(t,game.pots);let alpha=0,vapor=0;ctx.drawImage=(im,...args)=>{if(im.src?.endsWith('/bell.png'))alpha=ctx.globalAlpha;if(im.width===192&&ctx.globalAlpha>0)vapor++};try{cookingFX.celebration()}finally{ctx.drawImage=original}result.push({alpha,vapor})}render(0);return result}""")
    assert bell[0]['alpha']<bell[1]['alpha']<bell[2]['alpha']<1,bell
    assert bell[1]['vapor']==28,bell
    page.screenshot(path=str(out/'bell-fade-vapor.png'))
    before=page.evaluate("kitchenSound.status.events.filter(n=>n==='start').length")
    page.evaluate("()=>{paused=false;game.score=5000;game.elapsed=89.99}")
    page.wait_for_function("phase==='results'")
    assert page.locator('.results h1').inner_text()=='银牌厨师'
    assert page.evaluate("kitchenSound.status.events.filter(n=>n==='start').length")==before+1
    page.screenshot(path=str(out/'silver-result.png'))
    assert not failed,failed
    assert not errors,errors
    mobile=browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True);phone=mobile.new_page();phone.goto('http://127.0.0.1:8080',wait_until='networkidle');phone.wait_for_function('ready');phone.evaluate("phase='playing'")
    assert phone.evaluate("()=>{let count=0;const original=ctx.fillText;ctx.fillText=()=>count++;try{BonbonSettings.drawHints()}finally{ctx.fillText=original}return count}")==0
    browser.close()
    print('Passed: bell fades and early vapor, 280–400ms autoplay, final-five red timer, no sound button, desktop-only hint labels, rank boundaries and one ending cue.')
