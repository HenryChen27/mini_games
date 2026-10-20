"""Prepare lossless, individual video keyframes from the user's own collage.
This does not generate images/videos or call a paid service.
"""
from pathlib import Path
from PIL import Image
import hashlib,json

root=Path(__file__).resolve().parents[1]
source=root/'assets'/'新建文件夹'
first=Image.open(source/'before.png').convert('RGB')
last=Image.open(source/'after.png').convert('RGB')
assert first.size==last.size==(3000,750)
out=root/'assets/video-fx/keyframes-v1';out.mkdir(parents=True,exist_ok=True)
names=['carrot_soup','corn_soup','tomato_beef','potato_beef']
descriptions={
 'corn_soup':'A golden corn slice, red chili segments and the small pale kernels',
 'carrot_soup':'The orange carrot pieces, green leek leaves and small green peas',
 'tomato_beef':'The beef pieces, purple onion and red tomato slice',
 'potato_beef':'The browned beef pieces, golden potato pieces and small garnish',
}
manifest={'version':1,'status':'prepared_not_generated','provider_connection':'not_confirmed',
 'source_first':'assets/新建文件夹/before.png','source_last':'assets/新建文件夹/after.png',
 'source_last_sha256':hashlib.sha256((source/'after.png').read_bytes()).hexdigest(),
 'pilot_only':'corn_soup','max_initial_jobs':1,
 'preferred_capability':'image-to-video with explicit first and last keyframes',
 'model_candidate':'kling3.0_standard; confirm availability through connected video tools before use',
 'duration_target_seconds':4,'audio':False,'jobs':[]}
for i,name in enumerate(names):
    x=i*750;y=0;box=(x,y,x+750,y+750)
    folder=out/name;folder.mkdir(exist_ok=True)
    a=first.crop(box);b=last.crop(box)
    a.save(folder/'first.png');b.save(folder/'last.png')
    assert Image.open(folder/'last.png').tobytes()==last.crop(box).tobytes()
    # A separate finished-frame loop can be requested after the assembly pilot.
    # Each dish is generated alone, preventing lower-row cross-panel occlusion.
    prompt=(f'Locked camera, same original hand-painted game artwork and fixed cookware. '
      f'Begin with the completely empty cookware shown in the FIRST frame. '
      f'Animate only the transformation between the supplied FIRST and LAST frames. '
      f'{descriptions[name]} enter from a short local height above this vessel, '
      f'Each piece starts about half a vessel-opening width above its own rim, with small height and timing variations. '
      f'Fall with natural downward acceleration, disappear correctly behind the front rim, '
      f'and settle into the final dish as its actual component ingredients. '
      f'The sauce or broth gathers continuously inside the vessel during the landing; '
      f'the finished dish must not pop in as a separate overlay. '
      f'Keep the original pot body, rim, handle, perspective, lighting and white background fixed. '
      f'Small liquid ripples and a gentle settling bob only; no dramatic splashes. '
      f'Finish assembly within the first three seconds, then hold the supplied LAST frame for the final second. '
      f'No redesigned food, no new props, no camera motion, no text. The LAST frame is the original artwork, not a style reference.')
    manifest['jobs'].append({'dish':name,'status':'prepared',
      'first_frame':str((folder/'first.png').relative_to(root)).replace('\\','/'),
      'last_frame':str((folder/'last.png').relative_to(root)).replace('\\','/'),
      'source_crop':list(box),'size':[750,750],
      'last_pixels_sha256':hashlib.sha256(b.tobytes()).hexdigest(),'prompt':prompt})
(out/'request-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf-8')
print('Prepared 4 independent first/last frame pairs. All last-frame pixels exactly match crops from the user original. No video generation performed.')
