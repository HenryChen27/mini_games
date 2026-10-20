"""Verify DOM text and controls follow both viewport dimensions."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
out=root/'test-results/responsive';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page();errors=[];missing=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:missing.append(r.url) if r.status>=400 else None)
    reference=None
    for w,h in [(1706,784),(853,392),(640,360),(400,240),(1200,300),(390,844)]:
        page.set_viewport_size({'width':w,'height':h})
        page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
        page.wait_for_function('BonbonKitchen.getSession().ready')
        sizes=page.evaluate('''()=>Object.fromEntries(['.home-screen h1','.home-hint','.home-best','.home-start','#settings-toggle'].map(s=>[s,parseFloat(getComputedStyle(document.querySelector(s)).fontSize)]))''')
        if reference is None:reference=sizes
        if (w,h)==(853,392):
            for selector,size in sizes.items():assert abs(size/reference[selector]-.5)<.02,(selector,size,reference)
        assert sizes['.home-screen h1']<h*.2,(w,h,sizes)
        title=page.locator('.home-screen h1').bounding_box();hint=page.locator('.home-hint').bounding_box();best=page.locator('.home-best').bounding_box()
        assert title['y']+title['height']<=hint['y'] and hint['y']+hint['height']<=best['y']
        page.click('#settings-toggle')
        panel=page.locator('#settings-panel').bounding_box()
        assert panel['x']>=0 and panel['x']+panel['width']<=w+1 and panel['height']<h
        page.click('#settings-toggle');page.evaluate('showHelp()')
        assert page.locator('.guide-card').count()==6
        assert page.locator('#rules').bounding_box()['height']<=h*.91
        page.keyboard.press('Escape')
        page.screenshot(path=str(out/f'home-{w}x{h}.png'))
    assert not errors and not missing,(errors,missing)
    browser.close()
server.shutdown()
print('Passed: six window sizes, proportional fonts, bounded settings and guide, no missing assets.')
