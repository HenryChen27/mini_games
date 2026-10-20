from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle')
    page.wait_for_function('ready')
    def trace(at=None):
        return page.evaluate('''at=>{const original=draw,saved=phaseTime,items=[];if(at!==null)phaseTime=at;introPainted=false;draw=id=>items.push({id,alpha:ctx.globalAlpha,y:ctx.getTransform().f});try{render(0)}finally{draw=original;phaseTime=saved}return items}''',at)
    assert page.evaluate('phase')=='home'
    assert page.locator('.home-screen h1').inner_text()=='邦邦小厨房'
    assert page.locator('#ranking').is_visible()
    assert not any(word in page.locator('body').inner_text() for word in ['简单','困难','难度'])
    backgrounds=page.evaluate('''(()=>{const original=ctx.drawImage,src=[];ctx.drawImage=function(im,...args){src.push(im.src);return original.call(ctx,im,...args)};try{render(0)}finally{ctx.drawImage=original}return src})()''')
    assert len(backgrounds)==1 and backgrounds[0].endswith('/ending_background.png'),backgrounds
    page.screenshot(path='test-results/home.png')
    page.click('#ranking')
    assert page.locator('#leaderboard').is_visible()
    assert page.locator('#ranking-empty').is_visible()
    page.click('#closeRanking')
    page.evaluate('''window.countdownSeen=[];new MutationObserver(()=>{const text=document.querySelector('#countdown')?.textContent;if(text&&countdownSeen.at(-1)!==text)countdownSeen.push(text)}).observe(overlay,{childList:true,subtree:true,characterData:true})''')
    page.click('#start')
    assert page.evaluate('phase')=='launch'
    page.wait_for_function('phase==="intro"')
    assert page.evaluate('game.elapsed')==0 and page.evaluate('game.orders.length')==0
    assert not page.evaluate('BonbonKitchen.performAction({kind:"ingredient",value:"water"})')
    early=trace(.1)
    assert any(a['id']==2 and 0<a['alpha']<1 and a['y']<0 for a in early),early
    assert not any(a['id']==85 for a in early),early
    complete=trace(.9)
    assert any(a['id']==85 for a in complete)
    assert all(a['alpha']==1 and a['y']==0 for a in complete),complete
    page.screenshot(path='test-results/countdown.png')
    page.wait_for_function('phase==="playing"')
    assert page.evaluate('countdownSeen')==['3','2','1','GO!']
    assert page.evaluate('game.elapsed')<.3 and page.evaluate('game.orders.length')==1
    assert page.evaluate('document.fonts.check("100px IdentityV","时间到！金牌厨师")')
    page.evaluate('game.score=12345;game.elapsed=89.99')
    page.wait_for_function('phase==="timeup"')
    assert page.locator('#time-up').inner_text()=='时间到！'
    assert not page.evaluate('running')
    assert not page.evaluate('BonbonKitchen.performAction({kind:"ingredient",value:"water"})')
    assert page.locator('#dev-autoplay').is_hidden()
    page.wait_for_timeout(400)
    assert page.evaluate('BonbonCelebration.count')>100
    dimmed=page.evaluate('''(()=>{const original=ctx.fillRect;let color='';ctx.fillRect=function(x,y,w,h){if(w===4702&&h===2160)color=ctx.fillStyle;return original.call(ctx,x,y,w,h)};try{render(0)}finally{ctx.fillRect=original}return color})()''')
    assert '0.48' in dimmed,dimmed
    page.screenshot(path='test-results/time-up.png')
    page.wait_for_function('phase==="results"')
    page.wait_for_timeout(750)
    assert page.locator('.results h1').inner_text()=='金牌厨师'
    assert page.locator('#result-score').inner_text()=='12,345'
    assert page.locator('#restart').inner_text()=='再来一局'
    assert page.locator('.results-score-row img').get_attribute('src')=='assets/heart.png'
    assert 'button.png' in page.locator('#restart').evaluate('(el)=>getComputedStyle(el).backgroundImage')
    assert trace()==[]
    assert page.evaluate('BonbonCelebration.falling') and page.evaluate('BonbonCelebration.count')>0
    page.screenshot(path='test-results/results.png')
    page.evaluate('for(let i=0;i<200;i++)BonbonCelebration.update(.1)')
    assert page.evaluate('BonbonCelebration.count')>20
    page.click('#exit')
    page.wait_for_function('phase==="home"')
    page.click('#ranking')
    assert page.locator('#ranking-list li').count()==1
    assert page.locator('#ranking-list strong').inner_text()=='12345'
    page.click('#closeRanking')
    page.set_viewport_size({'width':844,'height':390})
    page.screenshot(path='test-results/home-mobile.png')
    page.click('#start')
    page.wait_for_function('phase==="playing"')
    assert page.evaluate('game.score')==0
    page.evaluate('game.score=321;game.elapsed=89.99')
    page.wait_for_function('phase==="results"')
    page.wait_for_timeout(750)
    page.screenshot(path='test-results/results-mobile.png')
    assert page.locator('#result-score').inner_text()=='321'
    page.click('#restart')
    page.wait_for_function('phase==="playing"')
    assert page.evaluate('game.score')==0 and page.evaluate('game.orders.length')==1
    page.reload(wait_until='networkidle')
    page.wait_for_function('ready')
    page.click('#ranking')
    assert page.locator('#ranking-list strong').all_inner_texts()==['12345','321']
    assert not errors,errors
    print('Scenes passed: reference home and assets, local ranking, fading transitions, 3/2/1/GO, tools ready within 0.9s, dimmed time-up burst, ending background, heart/button, looping ribbons and replay.')
    browser.close()
