from pathlib import Path
import json
from playwright.sync_api import sync_playwright

out = Path('test-results/effects')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1706,'height':784})
    errors = []
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle')
    page.wait_for_function('ready')
    page.evaluate("""()=>{phase='playing';running=false;paused=true;overlay.style.display='none';
      for(let i=0;i<6;i++)Object.assign(game.pots[i],{state:'ready',dish:i<3?'soup':'beef',age:0});
      cookingFX.reset(game.pots);}
    """)
    checks = []
    for soup, beef in [('carrot','tomato'),('corn','potato')]:
        for t in [0,.2,.4,.65,.79,.82]:
            result = page.evaluate("""({soup,beef,t})=>{
              for(let i=0;i<6;i++)Object.assign(game.pots[i],{state:'ready',dish:i<3?'soup':'beef',age:0});
              cookingFX.reset(game.pots);
              for(let i=0;i<6;i++){const ingredient=i<3?soup:beef;game.cook(i,ingredient);cookingFX.add(i,ingredient);}
              cookingFX.sync(game.pots);cookingFX.update(t,game.pots);render(0);
              return game.pots.map((p,i)=>{const m=cookingFX.movieFrame(i,p);if(!m)return null;
                let clips=0;const original=ctx.clip;ctx.clip=()=>{clips++};
                try{cookingFX.pot(i,p)}finally{ctx.clip=original}
                if(clips)throw Error('Falling movie must not be clipped by the previous cookware');
                return {dest:m.dest,frame:m.frame};});
            }""",dict(soup=soup,beef=beef,t=t))
            assert all(result) if t<.8 else not any(result)
            if t<.8:
                assert all(all(abs(v)<10000 for v in row['dest']) for row in result)
                assert all(row['frame']==min(23,int(t*30)) for row in result)
            if t in [0,.4,.79,.82]:
                page.screenshot(path=str(out/f'{soup}-{beef}-{t:.2f}.png'))
            checks.append(dict(soup=soup,beef=beef,t=t,render=result))
        page.evaluate("""()=>{cookingFX.update(.01,game.pots);const saved=cookingFX.serialize();
          cookingFX.reset(game.pots);cookingFX.restore(saved,game.pots);
          if(JSON.stringify(cookingFX.serialize())!==JSON.stringify(saved))throw Error('Restore mismatch');} """)
    page.evaluate("""()=>{for(let i=0;i<6;i++)Object.assign(game.pots[i],{state:'ready',dish:i<3?'soup':'beef',age:0});
      cookingFX.reset(game.pots);game.cook(0,'corn');cookingFX.add(0,'corn');cookingFX.sync(game.pots);cookingFX.update(.35,game.pots);} """)
    frozen = page.evaluate('JSON.stringify(cookingFX.serialize())')
    page.wait_for_timeout(400)
    assert frozen == page.evaluate('JSON.stringify(cookingFX.serialize())')
    page.evaluate("""()=>{const s=cookingFX.serialize(),before=cookingFX.movieFrame(0);
      cookingFX.reset(game.pots);cookingFX.restore(s,game.pots);
      if(JSON.stringify(before)!==JSON.stringify(cookingFX.movieFrame(0)))throw Error('Active movie restore mismatch');} """)
    assert not errors, errors
    (out/'calibration-check.json').write_text(json.dumps(checks,indent=2),'utf-8')
    print('Passed: all 12 dish/burner placements, original frame timing, native finish, paused clock and mid-animation restore; no browser errors.')
    browser.close()
