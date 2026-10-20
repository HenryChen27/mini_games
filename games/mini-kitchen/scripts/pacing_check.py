from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle')
    page.wait_for_function('ready')
    page.click('#start')
    page.wait_for_function('phase==="intro"&&phaseTime>1')
    page.evaluate('''()=>{window.staticDraws=0;window.originalDraw=draw;draw=(...args)=>{staticDraws++;return originalDraw(...args)}}''')
    page.wait_for_timeout(800)
    assert page.evaluate('staticDraws')==0
    page.evaluate('draw=originalDraw')
    page.wait_for_function('phase==="playing"')
    page.click('#exit');page.wait_for_function('phase==="home"');page.click('#start');page.click('#continue-run')
    page.wait_for_function('phase==="resume-countdown"')
    frozen=page.evaluate('JSON.stringify(game.snapshot())')
    assert page.evaluate('phase')=='resume-countdown'
    page.wait_for_timeout(2300)
    assert page.evaluate('JSON.stringify(game.snapshot())')==frozen
    assert not page.evaluate('BonbonKitchen.performAction({kind:"ingredient",value:"water"})')
    page.wait_for_function('phase==="playing"')
    page.evaluate('paused=true')
    metrics=page.evaluate('''()=>{
      const bench=()=>{const begin=performance.now();for(let i=0;i<8;i++){render(0);ctx.getImageData(0,0,1,1)}return (performance.now()-begin)/8};
      const optimized=bench();canvas.width=4702;canvas.height=2160;ctx.setTransform(1,0,0,1,0,0);const native=bench();fitRenderSurface();
      const hearts=[];for(const award of [90,240,480]){game.orders[0].dishes=['rice'];game.orders[0].done=[false];const target=game.serve('rice').target;resultEffects({ok:true,award,dish:'rice',target},{kind:'instant',value:'rice'});hearts.push(completedOrders.at(-1).heartSizes)}
      const anchors=Object.values(icons).map(id=>{const a=layer(id);return {id,center:a.iconCenter,box:a.iconBox}});
      return {optimized,native,hearts,anchors};
    }''')
    assert [len(sizes) for sizes in metrics['hearts']]==[3,6,11],metrics
    assert all(90<=size<=135 for sizes in metrics['hearts'] for size in sizes)
    assert all(a['center'] for a in metrics['anchors'])
    page.evaluate('''()=>{completedOrders=[];deliveryFlights=[];game.orders=Array.from({length:5},(_,i)=>({id:i+1,slot:i,paper:94+i,age:1,dishes:[['soup','carrot_soup','corn_soup'],['beef','tomato_beef','potato_beef'],['rice','bread','soup'],['corn_soup','beef','rice'],Array(6).fill('candy')][i],done:Array(i===4?6:3).fill(false)}));render(0)}''')
    page.locator('#overlay').evaluate('(el)=>el.style.display="none"')
    page.screenshot(path='test-results/centered-orders.png')
    assert not errors,errors
    print('Passed: cached intro, 3-second frozen resume, score-based randomized hearts, body anchors. Render ms/frame:',round(metrics['native'],2),'->',round(metrics['optimized'],2))
    browser.close()
