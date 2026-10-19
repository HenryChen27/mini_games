from pathlib import Path
import re
import requests

sources = [
    ('countdown', 'https://freesound.org/people/Rudmer_Rotteveel/sounds/536422/'),
    ('go-whistle', 'https://freesound.org/people/SpliceSound/sounds/218318/'),
]
root = Path(__file__).resolve().parents[1]
for name, page in sources:
    response = requests.get(page, timeout=25)
    response.raise_for_status()
    urls = re.findall(r'https?://[^\s\"\x27<>]+\.(?:mp3|ogg)', response.text)
    urls = [u for u in urls if 'freesound.org' in u and '/previews/' in u]
    if not urls:
        raise RuntimeError(f'No public audio preview found: {page}')
    url = next((u for u in urls if '-hq.mp3' in u), urls[0])
    audio = requests.get(url, timeout=25)
    audio.raise_for_status()
    if len(audio.content) < 1000 or 'html' in audio.headers.get('Content-Type', ''):
        raise RuntimeError('Invalid audio response')
    target = root / 'assets/audio' / f'{name}.mp3'
    target.write_bytes(audio.content)
    print(name, len(audio.content), url)
