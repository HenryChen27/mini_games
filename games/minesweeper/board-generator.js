import {inspectCandidate} from './generation.js';
import {fallbackSeeds} from './generation-seeds.js';
export const guessChances=[0,.2,.4];
export function generateBoard({first,total,kind='logic',seed=Date.now()>>>0,budgetMs=60,maxAttempts=600}){
 const start=performance.now();let attempts=0;
 while(attempts<maxAttempts&&performance.now()-start<budgetMs){
  const candidate=inspectCandidate(first,total,(seed+attempts)>>>0);attempts++;
  if(candidate.analysis.kind===kind)return {...candidate,attempts,fallback:false,computeMs:performance.now()-start};
 }
 const candidate=inspectCandidate(first,total,fallbackSeeds[total][first][kind]);
 if(candidate.analysis.kind!==kind)throw Error('Invalid verified fallback');
 return {...candidate,attempts,fallback:true,computeMs:performance.now()-start};
}
