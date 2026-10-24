"""Run the unmodified native launcher's safe-exit transport against the game."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json,sys
from playwright.sync_api import sync_playwright

project=Path(__file__).resolve().parents[1]
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else project
bridge=(project/'tests/fixtures/launcher-safe-exit.js').read_text(encoding='utf-8')
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    def open_host(values=None):
        context=browser.new_context()
        context.add_init_script('window.messages=[];window.__jellyfishHostPost=m=>messages.push(m);'+bridge)
        if values:context.add_init_script('Object.entries('+json.dumps(values)+').forEach(([k,v])=>localStorage.setItem(k,v));')
        page=context.new_page();page.goto(url,wait_until='networkidle');page.wait_for_function('BonbonKitchen.getSession().ready')
        assert page.evaluate("typeof MinesweeperGame.prepareToClose==='function'")
        return context,page
    context,page=open_host()
    page.click('#start');page.wait_for_function("BonbonKitchen.getSession().phase==='playing'")
    assert page.evaluate("BonbonKitchen.performAction({kind:'ingredient',value:'water'})")
    page.evaluate("()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='jellyfish.bonbon.checkpoint-v1')throw Error('bridge quota');return realSet.call(this,k,v)}}")
    page.evaluate('__jellyfishHostSave(1)');failed=page.evaluate('messages.at(-1)')
    assert failed['saved'] is False and failed['reason']=='bridge quota'
    assert page.evaluate('!BonbonKitchen.getSession().hostSuspended')
    page.evaluate('()=>{Storage.prototype.setItem=window.realSet}')
    # Earlier launchers only discover JellyfishGame; exercise that branch too.
    page.evaluate('()=>{delete window.MinesweeperGame}')
    assert page.evaluate('JellyfishGame.save().saved')
    page.evaluate('__jellyfishHostSave(2)');message=page.evaluate('messages.at(-1)')
    assert message['saved'] is True and page.evaluate('BonbonKitchen.getSession().hostSuspended')
    values=json.loads(message['json']);assert list(values)==['jellyfish.bonbon.checkpoint-v1']
    checkpoint=json.loads(values['jellyfish.bonbon.checkpoint-v1'])
    assert all(name in checkpoint['values'] for name in ['bonbon-save-v1','bonbon-audio-v1','bonbon-keybindings-v1','bonbon-scores','bonbon-best'])
    saved=json.loads(checkpoint['values']['bonbon-save-v1']);elapsed=saved['engine']['state']['elapsed']
    page.wait_for_timeout(250);assert page.evaluate('game.elapsed')==elapsed
    context.close()
    context,page=open_host(values)
    page.click('#start');page.click('#continue-run')
    assert page.evaluate('game.elapsed')==elapsed
    assert page.evaluate('game.pots')==saved['engine']['state']['pots']
    page.wait_for_function("BonbonKitchen.getSession().phase==='playing'")
    page.evaluate('game.elapsed=89.99');page.wait_for_function("BonbonKitchen.getSession().phase==='results'")
    page.evaluate('__jellyfishHostSave(3)');last=page.evaluate('messages.at(-1)')
    assert last['saved'] is True
    ended=json.loads(json.loads(last['json'])['jellyfish.bonbon.checkpoint-v1'])
    assert ended['values']['bonbon-save-v1'] is None
    context.close();browser.close()
server.shutdown()
print('Passed: unmodified launcher recognizes API, rejects checkpoint failures, exports a nonempty save, restores in a fresh browser profile and clears finished runs.')
