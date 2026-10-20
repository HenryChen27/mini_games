"""Cancel the actual matched BGM reference, keeping bell harmonics intact.

Unlike HPSS, this subtracts a time-aligned recording of the background track.
The original clip, its three bell cues and final start cue are never gated.
"""
from pathlib import Path
import json
import av
import numpy as np
from scipy.signal import butter,sosfiltfilt,correlate
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parents[1]
reference=next((ROOT/'assets/audio').glob('*（2）.mp3'))
rate=44100
def decode(path):
    with av.open(str(path)) as container:
        resampler=av.AudioResampler(format='fltp',layout='stereo',rate=rate)
        return np.concatenate([r.to_ndarray() for frame in container.decode(audio=0)
                               for r in resampler.resample(frame)],axis=1)

source=decode(ROOT/'assets/temp.MP3');original=source.mean(axis=0)
music=decode(reference);n=len(original)
band=butter(4,[150,1400],fs=rate,btype='bandpass',output='sos')
x=sosfiltfilt(band,original);m=sosfiltfilt(band,music,axis=1)
# Coarse normalized correlation followed by sample-accurate alignment.
a=x[::11];b=m.mean(axis=0)[::11];length=len(a)
correlation=correlate(b,a,mode='valid',method='fft')
energy=np.r_[0,np.cumsum(b*b)]
scores=correlation/np.maximum(1e-15,np.sqrt((energy[length:]-energy[:-length])*np.sum(a*a)))
coarse=int(np.argmax(scores))*11
if scores.max()<.65:
    raise RuntimeError('Reference does not match well enough for cancellation.')
lo=max(0,coarse-100);hi=min(m.shape[1],coarse+n+100)
offset=lo+int(np.argmax(correlate(m.mean(axis=0)[lo:hi],x,mode='valid',method='fft')))
time=np.arange(n)/rate
fit=time<2.87
for onset in [0,.929,1.927]:
    fit &= ~((time>=onset-.025)&(time<onset+.18))
template=m[:,offset:offset+n].T
gains=np.linalg.lstsq(template[fit],x[fit],rcond=None)[0]
clean=(original-gains@music[:,offset:offset+n]).astype(np.float32)
assert len(clean)==n and np.isfinite(clean).all() and np.max(np.abs(clean))<1
stereo=np.repeat(clean[None,:],2,axis=0)
wav=ROOT/'assets/temp_sfx_v3.wav';mp3=ROOT/'assets/temp_sfx_v3.mp3'
wavfile.write(wav,rate,stereo.T)
with av.open(str(mp3),'w') as output:
    stream=output.add_stream('libmp3lame',rate=rate);stream.layout='stereo';stream.bit_rate=192000
    frame=av.AudioFrame.from_ndarray(stereo,format='fltp',layout='stereo');frame.sample_rate=rate
    for packet in stream.encode(frame):output.mux(packet)
    for packet in stream.encode(None):output.mux(packet)
with av.open(str(mp3)) as check:
    assert sum(f.samples for f in check.decode(audio=0))==n
report={'method':'matched-reference waveform cancellation; no harmonic gating',
        'reference':str(reference.relative_to(ROOT)),'match':float(scores.max()),
        'offset_seconds':offset/rate,'channel_gains':gains.tolist(),
        'samples':n,'source_preserved':True,'peak':float(np.max(np.abs(clean)))}
(ROOT/'test-results/audio/temp-cancellation-v3.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
print('Reference match:',round(float(scores.max()),3),'offset:',round(offset/rate,6),'gains:',gains.tolist())
print('Saved temp_sfx_v3.wav and temp_sfx_v3.mp3; original duration verified.')
