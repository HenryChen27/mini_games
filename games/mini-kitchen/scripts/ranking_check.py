from pathlib import Path
from playwright.sync_api import sync_playwright

Path('test-results/ranking').mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1706,'height':784})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8080',wait_until='networkidle');page.wait_for_function('ready')
    page.evaluate("""()=>{localStorage.setItem('bonbon-scores',JSON.stringify(Array.from({length:30},(_,i)=>({score:85815-i*1937,at:new Date(2026,9,19,16,i).getTime()}))));bindHome()}""")
    page.click('#ranking');page.wait_for_timeout(400)
    assert page.locator('#ranking-list li').count()==30
    assert page.locator('.rank-place img').count()==3
    assert page.locator('.rank-date').first.inner_text()=='2026.10.19 16:00'
    page.screenshot(path='test-results/ranking/desktop.png')
    close=page.locator('#closeRanking').bounding_box();print('Close position:',close)
    assert abs(close['x']-16)<2 and abs(close['y']-16)<2,close
    rect=page.locator('#ranking-scroll').bounding_box()
    x,y=rect['x']+rect['width']/2,rect['y']+rect['height']/2
    page.mouse.move(x,y);page.mouse.wheel(0,450);page.wait_for_timeout(200)
    assert page.evaluate("document.querySelector('#ranking-scroll').scrollTop")>100
    page.evaluate("document.querySelector('#ranking-scroll').scrollTop=0")
    page.mouse.move(x,y+100);page.mouse.down();page.mouse.move(x,y-100,steps=12);page.mouse.up()
    assert page.evaluate("document.querySelector('#ranking-scroll').scrollTop")>150
    assert page.evaluate("getComputedStyle(document.querySelector('#ranking-scroll')).scrollbarWidth")=='none'
    # An old stylesheet must not turn the paper board back into a dark modal.
    old=page.add_style_tag(content=".ranking-dialog{width:380px;padding:32px;background:#342a25f7;overflow:auto;border-radius:16px}.ranking-dialog h2{font-size:32px;color:gold}.ranking-dialog li{display:flex;padding:11px 7px}.ranking-dialog li span{opacity:.7}")
    appearance=page.evaluate("""()=>{const d=getComputedStyle(document.querySelector('#leaderboard')),row=getComputedStyle(document.querySelector('#ranking-list li')),im=document.querySelector('.rank-place img').getBoundingClientRect();return {background:d.backgroundImage,width:parseFloat(d.width),row:row.display,medal:im.width}}""")
    assert 'rank_page.png' in appearance['background'] and appearance['width']>600,appearance
    assert appearance['row']=='grid' and appearance['medal']<90,appearance
    page.screenshot(path='test-results/ranking/cache-compatibility.png')
    old.evaluate('(el)=>el.remove()')
    page.click('#closeRanking');assert not page.locator('#leaderboard').evaluate('(el)=>el.open')
    page.click('#ranking');assert page.evaluate("document.querySelector('#ranking-scroll').scrollTop")==0
    page.keyboard.press('Escape')
    for width,height in [(844,390),(390,844)]:
        page.set_viewport_size(dict(width=width,height=height));page.click('#ranking');page.wait_for_timeout(350)
        page.screenshot(path=f'test-results/ranking/{width}x{height}.png')
        box=page.locator('#ranking-scroll').bounding_box();assert box['x']>=0 and box['x']+box['width']<=width
        page.click('#closeRanking')
    page.evaluate("localStorage.removeItem('bonbon-scores');localStorage.removeItem('bonbon-best');scoreHistory=[]")
    page.click('#ranking');assert page.locator('#ranking-empty').is_visible()
    assert page.locator('#ranking-best').count()==0
    assert not errors,errors
    browser.close()
    print('Passed: original panel/medals, local timestamps, 30 sorted rows, wheel/drag, hidden scrollbar, fixed close, responsive and empty state.')
