from pathlib import Path
import json
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
meta=json.loads((root/'assets/fx/generated/manifest-v1.json').read_text('utf-8'))
for name in meta['sources']:
    im=Image.open(root/'assets/fx/generated'/name)
    assert im.mode=='RGBA'
    alpha=np.asarray(im.getchannel('A'))
    assert (alpha==0).mean()>.25 and ((alpha>0)&(alpha<255)).any(),name
assert len(meta['ingredients']['rects'])==16
assert len(meta['thermal']['rects'])==16
assert len(meta['bases']['rects'])==4

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready')
    page.click('#start');page.wait_for_function('phase==="playing"')
    poses=page.evaluate('''()=>{
      game.pots.forEach((p,i)=>Object.assign(p,{state:'ready',dish:i<3?'soup':'beef',age:2}));cookingFX.reset(game.pots);
      for(const value of ['corn','carrot','tomato','potato'])BonbonKitchen.performAction({kind:'ingredient',value});
      BonbonKitchen.pause();overlay.style.display='none';orderReveal=.35;
      return [0,1,3,4].map(i=>({i,parts:cookingFX.partPoses(i,game.pots[i])}));
    }''')
    for dish in poses:
        assert all(p['modelIndex'] is not None for p in dish['parts']),dish
        heights=[part['y']+part['h'] for part in dish['parts']]
        assert max(heights)-min(heights)<1e-6,(dish['i'],heights)
    used=page.evaluate('''()=>{
      cookingFX.update(.3,game.pots);const original=ctx.drawImage,used=[];
      ctx.drawImage=function(im,...args){if(im.src?.includes('/generated/'))used.push(im.src);return original.call(ctx,im,...args)};
      try{render(0)}finally{ctx.drawImage=original}return [...new Set(used)];
    }''')
    assert any(src.endswith('ingredients-runtime-v1.png') for src in used),used
    assert any(src.endswith('thermal-runtime-v1.png') for src in used),used
    page.evaluate('''()=>{cookingFX.update(1,game.pots);render(0)}''')
    page.screenshot(path=str(root/'test-results/generated-fx-ready.png'))
    state=page.evaluate('JSON.stringify(cookingFX.serialize())')
    page.wait_for_timeout(200)
    assert page.evaluate('JSON.stringify(cookingFX.serialize())')==state
    page.evaluate('''()=>{const saved=cookingFX.serialize();cookingFX.reset(game.pots);cookingFX.restore(saved,game.pots);render(0)}''')
    assert page.evaluate('JSON.stringify(cookingFX.serialize())')==state
    assert not errors,errors
    browser.close()
print('Passed: 3 genuine RGBA model source sheets, runtime generated textures rendered, local relative launch planes, independent components and frozen/restored FX.')
