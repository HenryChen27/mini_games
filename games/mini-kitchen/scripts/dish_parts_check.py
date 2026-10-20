from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import io

out=Path('test-results');out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready')
    reconstruction=page.evaluate('''async()=>{
      const parts=await(await fetch('assets/fx/dish-parts.json')).json(),surface=document.createElement('canvas'),c=surface.getContext('2d',{willReadFrequently:true});
      const fx=BonbonCookingFX.create({ctx:c,layers:byId,images,potLayers,dishParts:parts,draw:()=>{throw Error('Unexpected fallback')}}),result=[];
      for(const [key,recipe] of Object.entries(parts)){
       const id=Number(key),i=potLayers.findIndex(m=>Object.values(m).includes(id)),a=layer(id),state={state:recipe.dish==='cooking'?'cooking':'ready',dish:recipe.dish==='cooking'?'soup':recipe.dish};
       [surface.width,surface.height]=recipe.size;c.setTransform(1,0,0,1,-a.box[0],-a.box[1]);fx.paintAssembled(i,state);
       const assembled=c.getImageData(0,0,...recipe.size).data;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,...recipe.size);c.drawImage(images[a.src],0,0);const original=c.getImageData(0,0,...recipe.size).data;
       let max=0,changed=0;for(let n=0;n<original.length;n++){const diff=Math.abs(assembled[n]-original[n]);max=Math.max(max,diff);if(diff)changed++;}
       result.push({id,max,changed,count:recipe.parts.length});
      }
      return result;
    }''')
    assert len(reconstruction)==18,reconstruction
    assert all(r['max']<=1 for r in reconstruction),reconstruction
    page.click('#start');page.wait_for_function('phase==="playing"')
    page.evaluate('''()=>{
      game.pots.forEach((p,i)=>Object.assign(p,{state:'ready',dish:i<3?'soup':'beef',age:2}));cookingFX.reset(game.pots);
      for(const value of ['corn','carrot','tomato','potato'])BonbonKitchen.performAction({kind:'ingredient',value});
      BonbonKitchen.pause();overlay.style.display='none';orderReveal=.35;
    }''')
    before=page.evaluate('cookingFX.partPoses(0,game.pots[0])')
    assert len(before)>=6 and {p['name'] for p in before}>={'corn','pepper_back','pepper_front'}
    assert all(p['y']<p['targetY'] for p in before),before
    frames=[]
    for n in range(72):
        page.evaluate('''()=>{cookingFX.update(1/18,game.pots);render(0)}''')
        frames.append(Image.open(io.BytesIO(page.screenshot(clip={'x':330,'y':245,'width':900,'height':380}))).convert('RGB'))
        if n==20:pose1=page.evaluate('cookingFX.partPoses(0,game.pots[0])')
        if n==22:pose2=page.evaluate('cookingFX.partPoses(0,game.pots[0])')
    assert all(p['alpha']==1 and abs(p['y']-p['targetY'])<4 for p in pose2),pose2
    assert all(abs(a['y']-b['y'])<1 for a,b in zip(pose1,pose2)),(pose1,pose2)
    end=page.evaluate('cookingFX.partPoses(0,game.pots[0])')
    assert any(abs(a['y']-b['y'])>1 for a,b in zip(end,pose2)),(end,pose2)
    assert max(p['y']-p['targetY'] for p in end)-min(p['y']-p['targetY'] for p in end)>1
    still=page.evaluate('cookingFX.partPoses(0,game.pots[0],{assembled:true,still:true})')
    assert all(p['x']==p['targetX'] and p['y']==p['targetY'] for p in still)
    frozen=page.evaluate('JSON.stringify(cookingFX.serialize())');page.wait_for_timeout(180)
    assert page.evaluate('JSON.stringify(cookingFX.serialize())')==frozen
    palette=frames[-1].resize((720,304)).quantize(colors=192)
    preview=[frame.resize((720,304)).quantize(palette=palette,dither=Image.Dither.NONE) for frame in frames]
    preview[0].save(out/'dish-assembly-preview.gif',save_all=True,append_images=preview[1:],duration=56,loop=0,optimize=True)
    sheet=Image.new('RGB',(1800,4*405),'#302a28');d=ImageDraw.Draw(sheet)
    for j,n in enumerate([0,2,5,8,11,15,20,60]):
        x=(j%2)*900;y=(j//2)*405;sheet.paste(frames[n],(x,y));d.text((x+12,y+382),f'{(n+1)/18:.2f}s',fill='white')
    sheet.save(out/'dish-assembly-frames.jpg')
    assert not errors,errors
    print('Passed: 18 exact assembled PSD frames; multi-part arrivals; stable handoff into independent idle bobbing; pause freezes all components.')
    print('Reconstruction differences:',reconstruction)
    browser.close()
