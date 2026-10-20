"""Retain every observed order, its duplicates, and its phase in score.txt."""
import re,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
phases=[[],[]]
phase=0
for line in (root/'score.txt').read_text('utf-8').splitlines():
    if 'last 30sec' in line:phase=1
    if '=' not in line or line.startswith('==='):continue
    recipe=line.split('=')[0].strip().replace('corn soup*2_potato beef','corn soup*2+potato beef')
    dishes=[]
    for item in recipe.split('+'):
        match=re.fullmatch(r'([a-z ]+?)(?:\s*\*\s*(\d+))?',item.strip())
        if not match:raise ValueError(item)
        dishes.extend([match[1].strip().replace(' ','_')]*int(match[2] or 1))
    phases[phase].append(dishes)
data={'source':'score.txt','normal':phases[0],'frenzy':phases[1]}
(root/'order-profile.js').write_text('/* Generated from score.txt by scripts/build_order_profile.py. */\n(function(root){const profile='+json.dumps(data,ensure_ascii=False,indent=2)+';root.BonbonOrderProfile=profile;if(typeof module!=="undefined")module.exports=profile;})(typeof globalThis!=="undefined"?globalThis:this);\n','utf-8')
for name,orders in zip(['normal','frenzy'],phases):
    from collections import Counter
    print(name,len(orders),'orders',dict(Counter(d for o in orders for d in o)))
