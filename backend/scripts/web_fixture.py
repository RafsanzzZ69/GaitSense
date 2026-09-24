"""Create/remove one temporary account for local browser acceptance testing."""
import argparse
import json
import time
from pathlib import Path

import httpx
from bson import ObjectId

from app.config import Settings
from app.db import connect

FILE = Path(__file__).resolve().parents[2] / 'tmp' / 'web-acceptance-account.json'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['create', 'seed', 'cleanup'])
    args = parser.parse_args()
    with httpx.Client(base_url='http://127.0.0.1:8000', timeout=30) as api:
        if args.action == 'create':
            if FILE.exists():
                raise SystemExit('Existing fixture: clean it up before creating another')
            credentials = {'email': f'webcheck-{int(time.time())}@example.com',
                           'password': 'Temporary-browser-test-September-2026!'}
            response = api.post('/api/v1/auth/register', json={**credentials, 'displayName': 'Web Verification'})
            response.raise_for_status()
            data = response.json()
            FILE.parent.mkdir(parents=True, exist_ok=True)
            FILE.write_text(json.dumps({**credentials, 'id': data['user']['id']}), encoding='utf-8')
            print(json.dumps({'email': credentials['email'], 'id': data['user']['id']}))
        else:
            data = json.loads(FILE.read_text(encoding='utf-8'))
            login = api.post('/api/v1/auth/login', json={k: data[k] for k in ('email', 'password')})
            login.raise_for_status()
            headers = {'Authorization': 'Bearer ' + login.json()['accessToken']}
            if args.action == 'seed':
                for kind in ('terms', 'privacy', 'health_disclaimer', 'data_processing'):
                    response = api.post('/api/v1/me/consents', headers=headers, json={
                        'type': kind, 'documentVersion': '0.2.0', 'status': 'accepted'})
                    response.raise_for_status()
                response = api.post('/api/v1/sessions', headers={**headers, 'Idempotency-Key': 'browser-real-walk'}, json={'angle': 'front'})
                response.raise_for_status()
                session = response.json()
                sid = session['id']
                if session['status'] == 'created':
                    source = FILE.parents[1] / 'research/gaitsense_poc/videos/IMG_6836.MOV'
                    with source.open('rb') as video:
                        response = api.post(f'/api/v1/sessions/{sid}/video', headers=headers,
                                            files={'file': ('walking.MOV', video, 'video/quicktime')}, timeout=120)
                        response.raise_for_status()
                response = api.post(f'/api/v1/sessions/{sid}/process', headers=headers)
                response.raise_for_status()
                for _ in range(90):
                    response = api.get(f'/api/v1/sessions/{sid}', headers=headers)
                    response.raise_for_status()
                    session = response.json()
                    if session['status'] == 'completed':
                        print(json.dumps({'sessionId': sid, 'assessmentId': session['assessmentId'], 'status': 'completed'}))
                        return
                    if session['status'] == 'failed':
                        raise SystemExit('Fixture processing failed')
                    time.sleep(2)
                raise SystemExit('Fixture processing timed out')
            response = api.delete('/api/v1/me', headers=headers)
            response.raise_for_status()
            settings = Settings()
            with connect(settings) as client:
                db = client[settings.mongo_database]
                uid = ObjectId(data['id'])
                for _ in range(60):
                    if db.users.find_one({'_id': uid}) is None:
                        assert db.walk_sessions.count_documents({'userId': uid}) == 0
                        assert db.media_assets.count_documents({'userId': uid}) == 0
                        assert not list((settings.storage_path / str(uid)).rglob('*.video'))
                        FILE.unlink()
                        print('Browser fixture account and uploaded copies removed; original videos unchanged.')
                        return
                    time.sleep(2)
                raise SystemExit('Cleanup not completed; fixture retained for retry')


if __name__ == '__main__':
    main()
