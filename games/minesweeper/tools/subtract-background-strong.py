"""Subtract only_background from audio; preserve full recording timeline."""
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import gaussian_filter, median_filter
root=Path('assets/audio');mix,sr=sf.read(root/'audio.MP3',always_2d=True);bg,br=sf.read(root/'only_background.MP3',always_2d=True)
assert sr==br
low=signal.resample_poly(bg.mean(1),1,4);rate=sr/4
res=np.zeros_like(mix);reference=np.zeros_like(mix);weights=np.zeros(len(mix))
for start in range(0,len(mix),sr*2):
 end=min(start+sr*3,len(mix));n=end-start
 if n<sr//4:continue
 y=mix[start:end];x=signal.resample_poly(y.mean(1),1,4)
 c=signal.correlate(low,x,mode='valid',method='fft');e=signal.fftconvolve(low*low,np.ones(len(x)),mode='valid');norm=c/np.sqrt(np.maximum(e*np.dot(x,x),1e-20));pos=int(np.argmax(abs(norm)))*4
 best=(-1,pos)
 for d in range(-12,13):
  k=pos+d
  if k<8 or k+n+8>=len(bg):continue
  r=bg[k:k+n].mean(1)[::8];z=y.mean(1)[::8];score=abs(np.dot(r,z))/np.sqrt(np.dot(r,r)*np.dot(z,z)+1e-20)
  if score>best[0]:best=(score,k)
 score,pos=best
 design=np.column_stack([bg[np.clip(np.arange(pos+d,pos+d+n),0,len(bg)-1),ch] for ch in range(2) for d in range(-4,5)])
 A=design[::12];target=y[::12];coef=np.linalg.lstsq(A,target,rcond=1e-5)[0]
 for _ in range(4):
  err=np.sqrt(np.mean((target-A@coef)**2,axis=1));scale=np.median(err)+1e-9;w=np.minimum(1,1.5*scale/(err+1e-9));coef=np.linalg.lstsq(A*w[:,None],target*w[:,None],rcond=1e-5)[0]
 pred=design@coef;r=y-pred
 fade=min(sr//4,n//3);w=np.ones(n)
 if start:w[:fade]=np.linspace(0,1,fade)
 if end<len(mix):w[-fade:]=np.linspace(1,0,fade)
 res[start:end]+=r*w[:,None];reference[start:end]+=pred*w[:,None];weights[start:end]+=w
 print(f'{start/sr:.0f}s / {len(mix)/sr:.2f}s',flush=True)
res/=np.maximum(weights[:,None],1e-10);reference/=np.maximum(weights[:,None],1e-10)
# Stronger reference-guided suppression. Estimate musical leakage from many
# matching frames, then smooth the estimate along frequency and time.
clean=[]
for ch in range(2):
 _,_,z=signal.stft(res[:,ch],sr,nperseg=2048,noverlap=1536)
 _,_,b=signal.stft(reference[:,ch],sr,nperseg=2048,noverlap=1536)
 mag=abs(z);bm=abs(b)
 valid=bm>np.maximum(np.percentile(bm,25,axis=1,keepdims=True),1e-9)
 ratio=np.where(valid,mag/(bm+1e-10),np.nan)
 leakage=np.nanpercentile(ratio,55,axis=1,keepdims=True)
 leakage=gaussian_filter(np.nan_to_num(leakage),sigma=(2,0))
 expected=bm*leakage
 # Quiet residual statistics also cover MP3 artifacts where the reference
 # itself has almost no energy. No full-band hard mute is applied.
 stationary=np.percentile(mag,25,axis=1,keepdims=True)
 expected=np.maximum(expected,stationary)
 power_fraction=np.maximum(1-(1.9*expected/(mag+1e-10))**2,0)
 gain=np.clip(power_fraction**1.3,.003,1)
 gain=gaussian_filter(gain,sigma=(.65,.65))
 _,out=signal.istft(z*gain,sr,nperseg=2048,noverlap=1536)
 clean.append(out[:len(mix)])
clean=np.column_stack(clean);assert np.isfinite(clean).all()
output=root/'sfx_only_strong.wav';sf.write(output,clean,sr,subtype='PCM_24')
previous,ps=sf.read(root/'sfx_only.wav',always_2d=True)
assert ps==sr and previous.shape==clean.shape
step=int(sr*.1)
old=np.array([np.mean(previous[i:i+step]**2) for i in range(0,len(clean),step)])
new=np.array([np.mean(clean[i:i+step]**2) for i in range(0,len(clean),step)])
quiet=old<=np.percentile(old,30)
print('OUTPUT',output,'duration',len(clean)/sr,'peak',abs(clean).max(),flush=True)
print('Low-energy windows change dB:',10*np.log10((new[quiet].mean()+1e-20)/(old[quiet].mean()+1e-20)),flush=True)
print('Overall energy change dB:',10*np.log10(np.mean(clean**2)/np.mean(previous**2)),flush=True)
