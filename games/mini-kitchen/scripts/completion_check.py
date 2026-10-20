from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8080', wait_until='networkidle')
    page.wait_for_function('ready')
    page.click('#start')
    page.wait_for_function('phase==="playing"')
    result = page.evaluate('''()=>{
      game.orders[0].dishes=['rice'];game.orders[0].done=[false];
      const before=game.score;BonbonKitchen.performAction({kind:'instant',value:'rice'});
      BonbonKitchen.pause();const c=completedOrders[0];
      const pending=visibleScore();c.t=.9;let hearts=0;
      const original=ctx.drawImage;ctx.drawImage=function(im,...args){if(im===images['assets/heart.png'])hearts++;return original.call(ctx,im,...args)};
      try{render(0)}finally{ctx.drawImage=original}
      return {before,pending,score:game.score,award:c.award,hearts};
    }''')
    assert result['award'] > 0 and result['pending'] == result['before'], result
    assert result['hearts'] >= 3, result
    exit_box = page.locator('#exit').bounding_box()
    page.click('#exit')
    page.wait_for_function('phase==="home"')
    assert page.evaluate('!!JSON.parse(localStorage.getItem(saveKey)).effects.completedOrders.length')
    page.reload(wait_until='networkidle')
    page.wait_for_function('ready')
    page.click('#start')
    assert page.locator('#continue-dialog').is_visible()
    page.click('#continue-run')
    page.wait_for_function('phase==="playing"')
    page.evaluate('BonbonKitchen.pause()')
    assert page.evaluate('visibleScore()') == result['before']
    assert page.locator('#exit').bounding_box() == exit_box
    page.evaluate('BonbonKitchen.resume()')
    page.wait_for_function('visibleScore()===game.score')
    page.evaluate('BonbonKitchen.pause()')
    assert page.evaluate('visibleScore()') == result['score']
    assert page.evaluate('game.score') == result['score']
    page.screenshot(path='test-results/completion-credit.png')
    assert not errors, errors
    browser.close()
    print('Passed: golden order hearts, delayed score, save/reload during flight, exactly-once credit, fixed exit.')
