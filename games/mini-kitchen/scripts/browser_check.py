from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle')
    page.wait_for_function('ready')
    page.click('#start')
    page.wait_for_function('phase==="playing"')
    page.wait_for_timeout(100)
    box=page.locator('#canvas').bounding_box()
    assert box['width']==page.viewport_size['width'] and box['height']==page.viewport_size['height']
    assert page.evaluate('document.fullscreenElement===null')
    assert page.evaluate('getComputedStyle(canvas).objectFit')=='cover'
    assert page.evaluate('document.fonts.check("84px HuakangPOP", "0123456789:")')
    assert page.locator('#overlay').is_hidden()
    page.locator('#settings-toggle').hover()
    feedback=page.locator('#settings-toggle').evaluate('''(el)=>{el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));const animation=el.getAnimations()[0];animation.pause();animation.currentTime=112;return{filter:getComputedStyle(el).filter,scale:new DOMMatrix(getComputedStyle(el).transform).a}}''')
    assert feedback['scale']>1.02,feedback
    assert float(feedback['filter'].split('(')[1].split(')')[0])<.9,feedback
    page.locator('#settings-toggle').evaluate('(el)=>el.getAnimations()[0].play()')
    page.wait_for_timeout(300)
    assert page.locator('#settings-toggle').evaluate('(el)=>getComputedStyle(el).transform')=='none'
    poses=page.evaluate('''(()=>{const original=stamp,poses=[];stamp=(id,x)=>{if(id===98)poses.push({x,alpha:ctx.globalAlpha,dy:ctx.getTransform().f})};try{for(const [age,index] of [[0,0],[.2,4],[1,1]])drawOrder({slot:3,age,paper:98,dishes:[],done:[]},index);}finally{stamp=original}return poses})()''')
    assert len({p['x'] for p in poses})==1,poses
    assert poses[0]['dy']>poses[1]['dy']>poses[2]['dy']==0,poses
    assert poses[0]['alpha']==0<poses[1]['alpha']<poses[2]['alpha']==1,poses
    border=page.evaluate('''(()=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,180,180);circleProgress(90,90,.5);const pixel=Array.from(ctx.getImageData(156,90,1,1).data);ctx.restore();return pixel})()''')
    assert all(abs(a-b)<3 for a,b in zip(border,[64,55,44,217])),border
    def click(x,y):
        view=page.evaluate('(()=>{const {scale,ox,oy}=sceneView();return{scale,ox,oy}})()')
        page.mouse.click(box['x']+view['ox']+x*view['scale'],box['y']+view['oy']+y*view['scale'])
    for _ in range(3):click(1600,1900)
    assert page.evaluate('game.pots.slice(0,3).every(p=>p.state==="cooking")')
    click(1600,1900)
    assert page.evaluate('game.pots.filter(p=>p.state==="cooking").length')==3
    click(3250,1900)
    assert page.evaluate('game.pots[3].state')=='cooking'
    page.wait_for_timeout(3100)
    click(1150,1100);click(1150,1450);click(3750,1100)
    assert page.evaluate('game.pots[0].dish')=='corn_soup'
    assert page.evaluate('game.pots[1].dish')=='carrot_soup'
    assert page.evaluate('game.pots[3].dish')=='potato_beef'
    page.evaluate('''game.orders=[94,95,96,97,98].map((paper,i)=>({id:i+1,slot:i,paper,age:1+i*5,dishes:i===4?Array(6).fill('candy'):['rice','carrot_soup','beef'],done:i===4?Array(6).fill(false):[true,false,false]}));game.next=100;''')
    page.wait_for_timeout(80)
    page.screenshot(path='test-results/desktop.png')
    click(920,1900)
    assert page.evaluate('trashEffects.length')==0
    assert page.evaluate('target({x:920,y:1900})===undefined')
    page.evaluate('game.pots[3].state="burnt"')
    click(3220,930)
    assert page.evaluate('game.pots[3].state')=='empty'
    assert page.evaluate('trashEffects.length')==1
    page.wait_for_timeout(250)
    page.screenshot(path='test-results/trash-open.png')
    page.wait_for_timeout(850)
    assert page.evaluate('trashEffects.length')==0
    assert page.locator('#pause').count()==0
    t=page.evaluate('game.elapsed')
    page.keyboard.press('Space');page.wait_for_timeout(150)
    assert page.evaluate('game.elapsed')>t
    rule_x=page.evaluate('4200+hudShift(103)')
    click(rule_x,150)
    assert page.locator('#rules').is_visible()
    assert page.locator('.guide-card').count()==6
    page.click('#closeRules')
    page.wait_for_function('phase==="playing"&&!paused')
    page.evaluate('game.elapsed=59.99')
    page.wait_for_timeout(100)
    assert page.evaluate('game.frenzy')
    click(3250,1900)
    assert page.evaluate('game.pots[3].state')=='ready'
    page.evaluate('game.elapsed=89.99')
    page.wait_for_function('phase==="results"')
    assert page.locator('#restart').is_visible()
    page.click('#restart')
    page.wait_for_function('phase==="playing"')
    assert page.evaluate('game.score')==0
    assert page.evaluate('getComputedStyle(document.querySelector("#settings-toggle")).outlineStyle')=='none'
    page.evaluate('''game.storage=['soup','carrot_soup','corn_soup','beef','tomato_beef','potato_beef'];game.pots.forEach((p,i)=>Object.assign(p,{state:'ready',dish:i<3?'soup':'beef'}));game.orders=[{id:1,slot:0,paper:98,age:1,dishes:['soup'],done:[false]}];''')
    ids=page.evaluate('buildScene(0).filter(s=>s.id!==null).map(s=>s.id)')
    assert page.evaluate("buildScene(0).every((item,i,a)=>i===0||item.z>=a[i-1].z)"),ids
    assert ids.index(98)<ids.index(2)<ids.index(33)<ids.index(35)<ids.index(59)<ids.index(85)<ids.index(90)<ids.index(91)<ids.index(100)
    assert not any(i in ids for i in [86,87,88,92])
    page.evaluate('paused=true')
    page.locator('#overlay').evaluate('(el)=>el.style.display="none"')
    page.screenshot(path='test-results/cover-1440x900.png')
    for width,height in [(1920,1080),(1600,740),(844,390)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(100)
        page.screenshot(path=f'test-results/cover-{width}x{height}.png')
        assert page.evaluate('document.fullscreenElement===null')
        assert page.evaluate('''(()=>{const v=sceneView();const p=point({clientX:v.r.left+v.ox+1700*v.scale,clientY:v.r.top+v.oy+900*v.scale});return Math.abs(p.x-1700)<.001&&Math.abs(p.y-900)<.001})()''')
    page.set_viewport_size({'width':844,'height':390})
    page.wait_for_timeout(100)
    page.screenshot(path='test-results/mobile-landscape.png')
    page.set_viewport_size({'width':1440,'height':900})
    delivery=page.evaluate('''(()=>{
      game.reset();game.orders=[{id:999,slot:2,paper:95,age:2,dishes:['beef'],done:[false]}];game.pots[3]={type:'beef',dish:'beef',state:'ready',age:1};deliveryFlights=[];completedOrders=[];trashEffects=[];
      window.testTap=(x,y)=>{const v=sceneView();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:v.r.left+v.ox+x*v.scale,clientY:v.r.top+v.oy+y*v.scale,bubbles:true}))};
      paused=false;testTap(3220,930);paused=true;
      return{flights:deliveryFlights.length,completed:completedOrders.length,slot:deliveryFlights[0].target.slot,pot:game.pots[3].state,next:game.next};
    })()''')
    assert delivery['flights']==1 and delivery['completed']==1 and delivery['slot']==2,delivery
    assert delivery['pot']=='empty' and delivery['next']>=.7,delivery
    travel=page.evaluate('''(()=>{const original=stampIcon,poses=[];stampIcon=(id,x,y,w,h)=>poses.push({x:x+w/2,y:y+h/2});try{for(const t of [0,.19,.38]){deliveryFlights[0].t=t;drawDelivery(deliveryFlights[0])}}finally{stampIcon=original}deliveryFlights[0].t=.19;return poses})()''')
    assert travel[0]['y']>travel[1]['y']>travel[2]['y'],travel
    assert travel[0]['x']>travel[1]['x']>travel[2]['x'],travel
    page.screenshot(path='test-results/delivery.png')
    groups=page.evaluate('''(()=>{const results=[];for(const [base,food] of [[75,76],[78,79],[81,82]]){press(food);pressEffects.find(p=>p.id===base).t=.14;const transforms=[];for(const id of [base,food])pressed(id,()=>transforms.push({matrix:Array.from(ctx.getTransform().toFloat64Array()),filter:ctx.filter}));results.push(transforms)}return results})()''')
    for pair in groups:
        assert pair[0]==pair[1] and pair[0]['matrix'][0]>page.evaluate('canvas.width/4702')*1.02,pair
    kettle=page.evaluate('''(()=>{paused=false;testTap(1600,1900);paused=true;pressEffects.find(p=>p.id===85).t=.14;let effect;pressed(85,()=>effect={scale:ctx.getTransform().a,filter:ctx.filter});const ids=buildScene(0).filter(s=>s.id!==null).map(s=>s.id);return{ids,effect}})()''')
    assert 85 in kettle['ids'] and 86 in kettle['ids'] and not any(i in kettle['ids'] for i in [87,88,92]),kettle
    assert kettle['effect']['scale']>page.evaluate('canvas.width/4702')*1.02 and kettle['effect']['filter']=='brightness(0.7)',kettle
    burnt=page.evaluate('''(()=>{deliveryFlights=[];completedOrders=[];game.orders=[];game.pots.forEach(p=>Object.assign(p,{state:'empty',dish:null}));game.pots[0].state='burnt';game.pots[0].age=18;game.pots[3].state='burnt';game.pots[3].age=18;const originalBar=bar,originalEllipse=ctx.ellipse,values=[];let smoke=0;bar=(x,y,h,f)=>values.push(f);ctx.ellipse=()=>smoke++;try{for(const s of buildScene(0))s.paint()}finally{bar=originalBar;ctx.ellipse=originalEllipse}return{values,smoke,ids:buildScene(0).filter(s=>s.id!==null).map(s=>s.id)}})()''')
    assert burnt['values']==[0,0] and burnt['smoke']==0 and 3 in burnt['ids'] and 40 in burnt['ids'],burnt
    discard=page.evaluate('''(()=>{game.storage[0]='soup';game.orders=[];deliveryFlights=[];trashEffects=[];paused=false;testTap(2250,970);paused=true;return{dish:game.storage[0],flights:deliveryFlights.length,lid:trashEffects.length}})()''')
    assert discard=={'dish':None,'flights':0,'lid':1},discard
    stored=page.evaluate('''(()=>{game.storage[3]='beef';game.orders=[{id:1001,slot:3,paper:96,age:1,dishes:['beef','rice'],done:[false,false]}];paused=false;testTap(2700,970);paused=true;return{dish:game.storage[3],slot:deliveryFlights[0].target.slot,index:deliveryFlights[0].target.index,x:deliveryFlights[0].source.x}})()''')
    assert stored['dish'] is None and stored['slot']==3 and stored['index']==0 and 2500<stored['x']<2900,stored
    page.evaluate('game.score=657;game.elapsed=39;pourEffects=[];render(0)')
    page.screenshot(path='test-results/header-aligned.png',clip={'x':0,'y':0,'width':1440,'height':115})
    hud=page.evaluate('''(()=>{const original=round;let box;round=(...args)=>box=args;try{drawScoreProgress()}finally{round=original}return box})()''')
    assert hud[0]==1695 and hud[1]==109 and hud[3]==12,hud
    page.evaluate('BonbonKitchen.start()')
    page.wait_for_function('phase==="playing"')
    page.click('#dev-autoplay')
    assert page.evaluate('BonbonDevAutoplay.enabled')
    assert page.locator('#dev-autoplay').get_attribute('aria-pressed')=='true'
    page.wait_for_function('game.completed>=1',timeout=10000)
    assert page.evaluate('game.served>0')
    page.screenshot(path='test-results/dev-autoplay.png')
    assert page.locator('#pause').count()==0
    page.click('#dev-autoplay')
    assert not page.evaluate('BonbonDevAutoplay.enabled')
    stopped=page.evaluate('({served:game.served,wasted:game.wasted,score:game.score})')
    page.wait_for_timeout(400)
    assert page.evaluate('({served:game.served,wasted:game.wasted,score:game.score})')==stopped
    assert not page.evaluate('BonbonDevAutoplay.step()')
    page.evaluate('BonbonDevAutoplay.dispose()')
    assert page.locator('#dev-autoplay').count()==0
    assert page.evaluate('typeof BonbonDevAutoplay')=='undefined'
    assert page.evaluate('typeof BonbonKitchen.performAction')=='function'
    assert not errors,errors
    print('Browser passed: aligned smaller HUD, original plus pouring kettle, preserved burnt soup, greedy toggle/start/stop/dispose, input feedback and gameplay. No page errors.')
    browser.close()
