import {writeFileSync} from 'node:fs';
import {inspectCandidate} from '../generation.js';
const seeds={};let checked=0;
for(const total of [8,11,15]){
 seeds[total]=[];
 for(let first=0;first<64;first++){
  const found={};let seed=1+first*100003+total*10000019;
  for(let tries=0;tries<100000;tries++,seed++){
   const {analysis}=inspectCandidate(first,total,seed);checked++;
   if(analysis.kind!=='blocked'&&found[analysis.kind]===undefined)found[analysis.kind]=seed;
   if(found.logic!==undefined&&found['one-guess']!==undefined)break;
  }
  if(found.logic===undefined||found['one-guess']===undefined)throw Error(`Missing fallback ${total}/${first}`);
  seeds[total].push(found);
 }
}
writeFileSync('generation-seeds.js','// Offline-verified seeds; layouts are rebuilt and rechecked before use.\nexport const fallbackSeeds='+JSON.stringify(seeds)+';\n');
console.log('Verified fallback seeds for 192 opening/difficulty combinations; candidates checked:',checked);
