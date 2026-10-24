import unittest,tempfile,json,base64,sys
from pathlib import Path
from unittest.mock import patch
import package_release as builder
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=')
class IconPackageTests(unittest.TestCase):
 def test_catalog_archive_and_checksums_include_all_game_icons(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);games=[]
   for id in ('jellyfish','minesweeper','mini-kitchen'):
    source=root/'games'/id;(source/'assets').mkdir(parents=True);(source/'assets/icon.png').write_bytes(PNG);(source/'index.html').write_text('<html></html>')
    games.append(dict(id=id,name=id,version='1.0.0',path='games/'+id,archive=id+'.zip',runtime='system-webview'))
   (root/'games.json').write_text(json.dumps(dict(games=games)))
   compat=root/'compat';compat.mkdir();launcher=compat/'GameLauncher-windows-x64.zip';launcher.write_bytes(b'launcher')
   (compat/'native-desktop-games.json').write_text(json.dumps(dict(schema=2,id='jellyfish',launchers={'windows-x64':dict(size=launcher.stat().st_size,sha256=builder.digest(launcher))})))
   (compat/'desktop-games.json').write_text(json.dumps(dict(packages={})))
   with patch.object(builder,'ROOT',root),patch.object(sys,'argv',['package_release.py','--version','test','--compatibility-dir',str(compat)]):builder.main()
   out=root/'dist/mini-games-vtest';catalog=json.loads((out/'games.json').read_text());checksums=(out/'SHA256SUMS.txt').read_text()
   for game in games:
    id=game['id'];info=catalog['games'][id]['icon'];self.assertEqual(info['sha256'],builder.digest(out/(id+'-icon.png')));self.assertIn(id+'-icon.png',checksums)
    with builder.zipfile.ZipFile(out/game['archive']) as z:self.assertEqual(z.read('game/assets/icon.png'),PNG)
 def test_old_game_without_icon_remains_supported(self):
  with tempfile.TemporaryDirectory() as t:self.assertIsNone(builder.export_icon(Path(t),Path(t),'https://example.com','old'))
 def test_invalid_icon_is_rejected(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);(root/'assets').mkdir();(root/'assets/icon.png').write_bytes(b'wrong')
   with self.assertRaises(ValueError):builder.export_icon(root,root,'https://example.com','bad')
if __name__=='__main__':unittest.main()
