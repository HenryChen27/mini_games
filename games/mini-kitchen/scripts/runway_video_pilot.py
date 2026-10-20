"""One original-keyframe video pilot. Default is offline; --submit costs credits.

No automatic POST retry: an uncertain submission must never create a second bill.
Existing task IDs are resumed instead of submitting again. Secrets stay out of files.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'assets/video-fx/keyframes-v1/request-manifest.json'
JOB = ROOT / '.tools/runway/corn-soup-task.json'
OUTPUT = ROOT / 'assets/video-fx/pilot-v1/corn-soup.mp4'


def secret():
    value = os.environ.get('RUNWAYML_API_SECRET', '')
    if not value and os.name == 'nt':
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as key:
                value = winreg.QueryValueEx(key, 'RUNWAYML_API_SECRET')[0]
        except FileNotFoundError:
            pass
    if not value:
        raise RuntimeError('Missing local RUNWAYML_API_SECRET. Run scripts/set_runway_key.ps1 locally; never paste the key in chat.')
    return value.strip()


def api(method, path, key, body=None):
    request = urllib.request.Request(
        'https://api.dev.runwayml.com' + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={'Authorization': 'Bearer ' + key,
                 'X-Runway-Version': '2024-11-06',
                 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Do not dump the request, headers, or arbitrary provider messages.
        raise RuntimeError(f'Runway HTTP {error.code}; no automatic resubmission.') from None


def prepare():
    from PIL import Image
    manifest = json.loads(MANIFEST.read_text('utf-8'))
    dish = next(job for job in manifest['jobs'] if job['dish'] == 'corn_soup')
    original_first = Image.open(ROOT / manifest['source_first']).convert('RGB')
    original_last = Image.open(ROOT / manifest['source_last']).convert('RGB')
    frames = []
    for position, source in [('first', original_first), ('last', original_last)]:
        path = ROOT / dish[position + '_frame']
        image = Image.open(path).convert('RGB')
        if image.tobytes() != source.crop(tuple(dish['source_crop'])).tobytes():
            raise RuntimeError(f'{position} frame does not match the original crop.')
        if position == 'last' and hashlib.sha256(image.tobytes()).hexdigest() != dish['last_pixels_sha256']:
            raise RuntimeError('Last frame checksum mismatch.')
        frames.append({'position': position, 'uri': 'data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode()})
    return {'model': 'kling3.0_standard', 'duration': 4, 'audio': False,
            'ratio': '960:960', 'cfgScale': 0.7,
            'promptText': dish['prompt'], 'promptImage': frames}


def save_job(data):
    JOB.parent.mkdir(parents=True, exist_ok=True)
    JOB.write_text(json.dumps(data, indent=2), 'utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--submit', action='store_true')
    args = parser.parse_args()
    payload = prepare()
    print('Original empty-cookware first frame and original finished last frame verified.')
    print('Pilot: corn soup only, Kling 3.0 Standard, 4 seconds, no audio; estimated 36 credits ($0.36 before tax).')
    if not args.submit:
        print('Offline validation only. No API call or charge.')
        return
    key = secret()
    if JOB.exists():
        job = json.loads(JOB.read_text('utf-8'))
        if not job.get('id'):
            raise RuntimeError('Prior submission has an uncertain outcome; inspect Runway tasks before doing anything else.')
        print('Resuming the existing task; no new generation request.')
    else:
        save_job({'state': 'submission_in_progress', 'model': payload['model']})
        task = api('POST', '/v1/image_to_video', key, payload)
        job = {'id': task['id'], 'state': 'submitted', 'model': payload['model']}
        save_job(job)
    for _ in range(120):
        task = api('GET', '/v1/tasks/' + job['id'], key)
        state = task['status']
        print('Task status:', state, flush=True)
        job['state'] = state
        save_job(job)
        if state == 'SUCCEEDED':
            OUTPUT.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(task['output'][0], timeout=120) as response:
                OUTPUT.write_bytes(response.read())
            print('Downloaded:', OUTPUT.relative_to(ROOT))
            print('Generated video still requires visual inspection before game integration.')
            return
        if state in ('FAILED', 'CANCELLED'):
            raise RuntimeError('Generation stopped: ' + state + '; no automatic replacement job.')
        time.sleep(10)
    print('Polling stopped. Run the same command to resume this task without a new charge.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, urllib.error.URLError) as error:
        raise SystemExit(str(error))
