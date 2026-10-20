"""Host close handshake: persistence failure, idempotence, freezing and restoration."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import sys
from playwright.sync_api import sync_playwright

root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True);page=browser.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
    page.wait_for_function('BonbonKitchen.getSession().ready')
    assert page.evaluate('BonbonKitchen.saveAll().ok')
    assert page.evaluate('BonbonKitchen.prepareToClose()')['readyToClose']
    assert page.evaluate('BonbonKitchen.prepareToClose()')['readyToClose']
    assert page.evaluate('BonbonKitchen.resume()')['ok']
    page.click('#start')
    assert page.evaluate('BonbonKitchen.prepareToClose()')['readyToClose']
    assert page.evaluate('Kitchen.isValidSave(JSON.parse(localStorage.getItem("bonbon-save-v1")).engine)')
    page.evaluate('BonbonKitchen.resume()')
    page.wait_for_function("BonbonKitchen.getSession().phase==='playing'")
    page.evaluate("BonbonKitchen.performAction({kind:'ingredient',value:'water'})")
    page.evaluate("()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='bonbon-save-v1')throw Error('quota test');return window.originalSet.call(this,k,v)}}")
    failed=page.evaluate('BonbonKitchen.prepareToClose()')
    assert not failed['ok'] and not failed['readyToClose'] and failed['error']=='quota test'
    assert page.evaluate('BonbonKitchen.getSession().running && !BonbonKitchen.getSession().hostSuspended')
    page.evaluate('()=>{Storage.prototype.setItem=window.originalSet}')
    result=page.evaluate('BonbonKitchen.prepareToClose()');assert result['ok'] and result['readyToClose']
    before=page.evaluate('({state:BonbonKitchen.getState(),fx:cookingFX.serialize(),time:phaseTime})')
    assert page.evaluate('kitchenSound.status.contextState')=='suspended'
    assert not page.evaluate("BonbonKitchen.performAction({kind:'ingredient',value:'raw_beef'})")
    assert page.evaluate('BonbonKitchen.prepareToClose()')==result
    page.wait_for_timeout(600)
    assert page.evaluate('({state:BonbonKitchen.getState(),fx:cookingFX.serialize(),time:phaseTime})')==before
    page.evaluate('BonbonKitchen.resume()')
    assert page.evaluate('BonbonKitchen.getSession().phase')=='resume-countdown'
    page.wait_for_timeout(500);assert page.evaluate('game.elapsed')==before['state']['elapsed']
    page.wait_for_function("BonbonKitchen.getSession().phase==='playing'")
    assert page.evaluate('kitchenSound.status.contextState')=='running'
    assert page.evaluate('BonbonKitchen.prepareToClose()')['readyToClose']
    saved=page.evaluate('JSON.parse(localStorage.getItem("bonbon-save-v1"))')
    page.reload(wait_until='networkidle');page.wait_for_function('BonbonKitchen.getSession().ready')
    page.click('#start');page.click('#continue-run')
    assert page.evaluate('game.elapsed')==saved['engine']['state']['elapsed']
    assert page.evaluate('game.pots')==saved['engine']['state']['pots']
    page.wait_for_function("BonbonKitchen.getSession().phase==='playing'")
    page.evaluate('game.elapsed=89.99');page.wait_for_function("BonbonKitchen.getSession().phase==='results'")
    rows=page.evaluate('JSON.parse(localStorage.getItem("bonbon-scores"))')
    assert page.evaluate('BonbonKitchen.prepareToClose()')['readyToClose']
    page.evaluate('BonbonKitchen.resume()');assert page.evaluate('BonbonKitchen.getSession().phase')=='results'
    assert page.evaluate('JSON.parse(localStorage.getItem("bonbon-scores"))')==rows
    assert not errors,errors
    browser.close()
server.shutdown()
print('Passed: save errors reject close, repeated close is safe, clock/effects/audio freeze, 321 resume, reload restores progress and completed scores remain unique.')
