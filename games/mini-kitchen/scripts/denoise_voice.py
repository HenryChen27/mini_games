"""Suppress continuous fire hiss with spectral denoising, preserving source.

PyAV's bundled FFmpeg filters work without a separate ffmpeg installation.
No resampling, channel downmix, silence trimming or timing changes.
"""
from pathlib import Path
import json
import av

ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'assets/audio/voice.MP3'
destination=ROOT/'assets/audio/voice_denoised_v2.mp3'
with av.open(str(source)) as src, av.open(str(destination),'w') as dst:
    stream=src.streams.audio[0]
    out=dst.add_stream('libmp3lame',rate=stream.codec_context.sample_rate)
    out.layout=stream.codec_context.layout.name
    out.bit_rate=192000
    graph=av.filter.Graph()
    first=next(src.decode(audio=0))
    start=graph.add_abuffer(sample_rate=first.sample_rate,format=first.format.name,
                           layout=first.layout.name,time_base=first.time_base)
    denoise=graph.add('afftdn','nr=22:nf=-24:tn=0:gs=8:ad=0.7')
    rumble1=graph.add('highpass','f=140:p=2')
    rumble2=graph.add('highpass','f=140:p=2')
    lowmid=graph.add('equalizer','f=220:t=o:w=2:g=-3')
    sink=graph.add('abuffersink')
    start.link_to(denoise);denoise.link_to(rumble1);rumble1.link_to(rumble2);rumble2.link_to(lowmid);lowmid.link_to(sink);graph.configure()
    samples=0

    def drain():
        global samples
        while True:
            try:
                frame=sink.pull()
            except (av.error.BlockingIOError,av.error.EOFError):
                break
            samples+=frame.samples
            for packet in out.encode(frame):
                dst.mux(packet)

    start.push(first);drain()
    # A fresh decoder iterator continues after the first frame already consumed.
    for frame in src.decode(audio=0):
        start.push(frame);drain()
    start.push(None);drain()
    for packet in out.encode(None):
        dst.mux(packet)
metadata={'source':str(source.relative_to(ROOT)),'output':str(destination.relative_to(ROOT)),
          'sample_rate':first.sample_rate,'channels':first.layout.name,
          'samples':samples,'duration_seconds':samples/first.sample_rate,
          'filter':'afftdn nr=22 nf=-24 tn=0 gs=8 ad=0.7; highpass 140Hz 2 poles x2; equalizer 220Hz width 2 octaves -3dB','source_preserved':True}
(ROOT/'test-results/audio').mkdir(parents=True,exist_ok=True)
(ROOT/'test-results/audio/denoise-v2.json').write_text(json.dumps(metadata,indent=2),'utf-8')
print(json.dumps(metadata))
