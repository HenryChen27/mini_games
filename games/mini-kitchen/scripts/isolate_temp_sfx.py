"""Suppress sustained harmonic music in the short temp clip, preserve transients.

This is spectral separation, not a claim of perfect music/SFX stem isolation.
The source is never overwritten. WAV avoids further lossy encoding for editing.
"""
from pathlib import Path
import json
import av
import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.signal import stft, istft
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'assets/temp.MP3'
with av.open(str(source)) as container:
    rate=container.streams.audio[0].codec_context.sample_rate
    audio=np.concatenate([f.to_ndarray() for f in container.decode(audio=0)],axis=1)
mono=audio.mean(axis=0)
frequencies,times,spectrum=stft(mono,fs=rate,nperseg=2048,noverlap=1792,boundary='zeros')
magnitude=np.abs(spectrum)
# Estimate music from the gaps between the three countdown bells. Unlike
# HPSS, sustained bell overtones are explicitly preserved.
gaps=((times>.6)&(times<.86))|((times>1.6)&(times<1.86))|((times>2.6)&(times<2.86))
background=np.percentile(magnitude[:,gaps]**2,25,axis=1)[:,None]
mask=np.sqrt(np.maximum(.25,1-.75*background/(magnitude**2+1e-16)))
mask=gaussian_filter(mask,sigma=(.65,.35))
for onset in [0,.929,1.927]:
    attack=(times>=max(0,onset-.035))&(times<=onset+.13)
    tail=(times>=max(0,onset-.035))&(times<=onset+.65)
    mask[:,attack]=np.maximum(mask[:,attack],.97)
    high=np.where(frequencies>=1750)[0];idx=np.where(tail)[0]
    mask[np.ix_(high,idx)]=np.maximum(mask[np.ix_(high,idx)],.94)
# Preserve the entire final start cue rather than mistaking its tonal rise
# for background melody. Slight music remains here in favor of intact SFX.
mask[:,times>=2.91]=np.maximum(mask[:,times>=2.91],.98)
_,clean=istft(spectrum*mask,fs=rate,nperseg=2048,noverlap=1792,boundary=True)
clean=clean[:audio.shape[1]].astype(np.float32)
assert len(clean)==audio.shape[1] and np.isfinite(clean).all()
result=np.repeat(clean[None,:],audio.shape[0],axis=0)
wav=ROOT/'assets/temp_sfx_v2.wav'
mp3=ROOT/'assets/temp_sfx_v2.mp3'
wavfile.write(wav,rate,result.T)
with av.open(str(mp3),'w') as output:
    stream=output.add_stream('libmp3lame',rate=rate);stream.layout='stereo';stream.bit_rate=192000
    frame=av.AudioFrame.from_ndarray(result,format='fltp',layout='stereo');frame.sample_rate=rate
    for packet in stream.encode(frame):output.mux(packet)
    for packet in stream.encode(None):output.mux(packet)
with av.open(str(mp3)) as check:
    count=sum(f.samples for f in check.decode(audio=0))
assert count==audio.shape[1],(count,audio.shape[1])
report={'source':source.name,'wav':wav.name,'mp3':mp3.name,'sample_rate':rate,
        'samples':len(clean),'seconds':len(clean)/rate,'source_preserved':True,
        'method':'gentle gap-estimated music reduction; three bell attacks/overtones and final start cue protected',
        'warning':'Some music intentionally remains to preserve bell tails and the start cue.'}
(ROOT/'test-results/audio/temp-separation-v2.json').write_text(json.dumps(report,indent=2),'utf-8')
print(json.dumps(report))
