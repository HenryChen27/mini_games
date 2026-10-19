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
    def log_message(self, *args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1240,'height':760})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/tests/animation-preview.html')
    page.evaluate('window.previewReady')
    page.locator('button').click()
    frames=[]
    for frame in range(60):
        data=page.evaluate('''t=>{renderPreview(t,true);return canvas.toDataURL('image/png').split(',')[1]}''',frame/60)
        image=Image.open(BytesIO(base64.b64decode(data))).convert('RGB')
        frames.append(image)
    palette=frames[0].quantize(colors=256)
    frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
    frames[0].save(root/'tests/breathing-preview.gif',save_all=True,append_images=frames[1:],
        duration=50,loop=0,optimize=False,disposal=1)
    page.screenshot(path=str(root/'tests/breathing-preview.png'))
    assert not errors,errors
    print('Preview saved: tests/breathing-preview.gif and tests/animation-preview.html')
    browser.close()
server.shutdown()
