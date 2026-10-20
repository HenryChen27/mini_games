from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('test-results/trash-fx');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1706,'height':784})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready')
    page.evaluate("()=>{phase='playing';running=false;paused=true;overlay.style.display='none';}")
    for dish,kind in [('beef','meat'),('corn_soup','soup')]:
        result=page.evaluate("""({dish})=>{game.orders=[];game.storage[0]=dish;running=true;paused=false;
          trashEffects=[];const before={time:game.elapsed,score:game.score,wasted:game.wasted};
          interact({kind:'storage',i:0});paused=true;running=false;
          return {before,after:{time:game.elapsed,score:game.score,wasted:game.wasted},empty:game.storage[0]===null,e:trashEffects[0]};} """,dict(dish=dish))
        assert result['empty'] and result['e']['kind']==kind,result
        assert result['e']['duration']==(1.2 if kind=='soup' else .65)
        assert result['before']['time']==result['after']['time']
        assert result['before']['score']==result['after']['score']
        assert result['after']['wasted']==result['before']['wasted']+1
        for t in ([.18,.42,.65,1.08] if kind=='soup' else [.12,.27,.4,.57]):
            page.evaluate('(t)=>{trashEffects[0].t=t;render(0)}',t)
            page.screenshot(path=str(out/f'{kind}-{t:.2f}.png'))
        page.evaluate("""()=>{const state=JSON.stringify(game.serialize()),clip=ctx.clip,original=draw;
          const pivots=[],translate=ctx.translate;ctx.translate=(...args)=>{pivots.push(args);return translate.apply(ctx,args)};
          try{for(let j=0;j<30;j++){drawTrashContents();drawTrashLid();}}finally{ctx.translate=translate}
          if(JSON.stringify(game.serialize())!==state)throw Error('Visual changed engine');
          if(!pivots.some(([x,y])=>x===1194&&Math.abs(y-1864.48)<.1))throw Error('Right hinge missing');} """)
    page.evaluate("""()=>{trashEffects=[];game.pots[0]={type:'soup',dish:'soup',state:'cooking',age:0};
      cookingFX.reset(game.pots);cookingFX.add(0,'water');cookingFX.update(.5,game.pots);render(0);} """)
    page.screenshot(path=str(out/'soft-water.png'))
    trajectory=page.evaluate("""()=>[0,.08,.16,.24,.32,.46].map(t=>trashMeatPose(t+.065))""")
    assert trajectory[1]['y']<trajectory[0]['y']
    assert abs(trajectory[-1]['x']-935)<1e-6 and abs(trajectory[-1]['y']-1840)<1e-6
    for a,b in zip(trajectory,trajectory[1:]):
        dt=b['t']-a['t']
        assert abs((b['x']-a['x'])/dt-a['vx'])<1e-6
        assert abs((b['vy']-a['vy'])/dt-7000)<1e-6
    assert not errors,errors
    browser.close()
    print('Passed: soup/meat discard visuals, PSD burnt beef, fixed right hinge, water render, no timer/score changes or rendering mutations.')
