"""Verify browser/API writes directly in Atlas, scoped to our disposable fixture."""
import json
import time
from pathlib import Path

import httpx
from bson import ObjectId

from app.config import Settings
from app.db import connect


def main():
    fixture = Path(__file__).resolve().parents[2] / 'tmp/web-acceptance-account.json'
    account = json.loads(fixture.read_text(encoding='utf-8'))
    assert account['email'].startswith('webcheck-') and account['email'].endswith('@example.com')
    uid = ObjectId(account['id'])
    settings = Settings()
    checks = []
    with connect(settings) as mongo, httpx.Client(base_url='http://127.0.0.1:8000/api/v1', timeout=30) as api:
        db = mongo[settings.mongo_database]
        # These values must have been submitted from the browser, not this script.
        profile = db.participant_profiles.find_one({'userId': uid})
        assert profile['displayName'] == 'Frontend Saved'
        assert profile['yearOfBirth'] == 2000 and profile['heightCm'] == 172.5
        checks.append('browser Save profile persisted in Atlas')
        response = api.post('/auth/login', json={k: account[k] for k in ('email', 'password')})
        response.raise_for_status()
        api.headers['Authorization'] = 'Bearer ' + response.json()['accessToken']
        loaded = api.get('/me/profile').json()
        assert loaded['displayName'] == profile['displayName']
        checks.append('new authenticated request reads saved profile')
        completed = db.walk_sessions.find_one({'userId': uid, 'status': 'completed'})
        assert completed
        for collection in ('media_assets', 'processing_jobs', 'gait_features', 'assessments', 'pose_chunks'):
            assert db[collection].count_documents({'userId': uid, 'sessionId': completed['_id']}) > 0
        checks.append('video metadata, job, features, report and pose records persisted')
        document = next(d for d in api.get('/consent-documents').json() if d['type'] == 'data_processing')
        api.post('/me/consents', json={'type': 'data_processing', 'documentVersion': document['version'], 'status': 'accepted'}).raise_for_status()
        response = api.post('/sessions', json={'angle': 'front', 'platform': 'web'},
                            headers={'Idempotency-Key': 'persistence-cancel-check'})
        response.raise_for_status()
        sid = response.json()['id']
        assert db.walk_sessions.find_one({'_id': ObjectId(sid)})['capture']['device']['platform'] == 'web'
        checks.append('session creation persisted')
        response = api.post(f'/sessions/{sid}/cancel')
        response.raise_for_status()
        assert db.walk_sessions.find_one({'_id': ObjectId(sid)})['status'] == 'cancelled'
        checks.append('cancel persisted')
        document = next(d for d in api.get('/consent-documents').json() if d['type'] == 'data_processing')
        response = api.post('/me/consents', json={'type': 'data_processing', 'documentVersion': document['version'], 'status': 'withdrawn'})
        response.raise_for_status()
        assert db.consents.find_one({'userId': uid, 'type': 'data_processing', 'documentVersion': document['version']})['status'] == 'withdrawn'
        blocked = api.post('/sessions', json={'angle': 'front'}, headers={'Idempotency-Key': 'must-be-rejected'})
        assert blocked.status_code == 409 and blocked.json()['detail']['code'] == 'CONSENT_REQUIRED'
        checks.append('withdrawal persisted and blocks new processing sessions')
        response = api.post('/me/consents', json={'type': 'data_processing', 'documentVersion': document['version'], 'status': 'accepted'})
        response.raise_for_status()
        response = api.delete(f'/sessions/{sid}')
        response.raise_for_status()
        for _ in range(30):
            if db.walk_sessions.find_one({'_id': ObjectId(sid)}) is None:
                break
            time.sleep(1)
        assert db.walk_sessions.find_one({'_id': ObjectId(sid)}) is None
        checks.append('delete request completed by worker in Atlas')
        response = api.post('/auth/logout')
        response.raise_for_status()
        assert api.get('/me/profile').status_code == 401
        checks.append('logout revokes authenticated access')
    print(json.dumps({'result': 'passed', 'database': settings.mongo_database, 'checks': checks}))


if __name__ == '__main__':
    main()
