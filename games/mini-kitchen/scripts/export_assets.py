import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '.tools/python'))
from psd_tools import PSDImage
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
psd = PSDImage.open(root / 'assets/game_page.psd')
out = root / 'assets/sprites'
out.mkdir(exist_ok=True)
manifest = {}
tiles = []
for i, layer in enumerate(psd.descendants()):
    if layer.is_group() or layer.name == 'real_sample': continue
    key = f'{i:03}_{layer.name}'
    im = layer.topil()
    if im is None: continue
    im.save(out / f'{key}.png')
    manifest[key] = {'src': f'assets/sprites/{key}.png', 'box': list(layer.bbox), 'name': layer.name}
    tile = Image.new('RGB', (240, 170), '#b5afa5')
    im.thumbnail((230, 135))
    tile.paste(im, ((240-im.width)//2, 20), im if im.mode=='RGBA' else None)
    ImageDraw.Draw(tile).text((5, 3), key, fill='black')
    tiles.append(tile)
sheet = Image.new('RGB', (1440, ((len(tiles)+5)//6)*170), 'white')
for i, tile in enumerate(tiles): sheet.paste(tile, ((i%6)*240,(i//6)*170))
sheet.save(root/'assets/layer-contact-sheet.jpg')
(root/'assets/sprites.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Exported {len(manifest)} layers')
