import base64
from io import BytesIO
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from PIL import Image
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':960,'height':541})
    def instrument(route):
        s=(root/'js/game.js').read_text(encoding='utf-8')
        s=s.replace('requestAnimationFrame(loop);','/* manual preview clock */')
        s=s.replace('  // --- Start ---','  window.openingCheck={G,loop};\n  // --- Start ---')
        route.fulfill(body=s,content_type='text/javascript')
    page.route('**/js/game.js',instrument)
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    page.wait_for_function("window.openingCheck?.G.phase==='title'")
    page.locator('#gameCanvas').click()
    frames=[]
    for i in range(104):
        data=page.evaluate('''t=>{
          openingCheck.loop(openingCheck.G.countdownStart+t);
          return document.querySelector('#gameCanvas').toDataURL('image/png').split(',')[1];
        }''',i*50+1)
        image=Image.open(BytesIO(base64.b64decode(data))).convert('RGB').resize((960,541))
        frames.append(image)
        if i in [4,22,40,58,74,83,98]: image.save(root/f'tests/opening-frame-{i}.png')
    palette=frames[75].quantize(colors=256)
    frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
    frames[0].save(root/'tests/opening-preview.gif',save_all=True,append_images=frames[1:],
        duration=50,loop=0,optimize=False,disposal=1)
    print('Saved tests/opening-preview.gif')
    browser.close()
server.shutdown()
