import pytest

from fastapi.testclient import TestClient

from src.app import app, activities


@pytest.fixture(autouse=True)
def reset_activities():
    # Work on a shallow copy for the test and restore after test
    original = {k: {**v, 'participants': list(v['participants'])} for k, v in activities.items()}
    yield
    activities.clear()
    activities.update(original)


def test_get_activities():
    client = TestClient(app)
    res = client.get('/activities')
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert 'Chess Club' in data


def test_signup_and_unregister_flow():
    client = TestClient(app)
    activity = 'Chess Club'
    email = 'test_student@example.com'

    # ensure not already in participants
    assert email not in activities[activity]['participants']

    # signup
    res = client.post(f"/activities/{activity}/signup?email={email}")
    assert res.status_code == 200
    assert email in activities[activity]['participants']

    # duplicate signup should fail
    res = client.post(f"/activities/{activity}/signup?email={email}")
    assert res.status_code == 400

    # unregister
    res = client.delete(f"/activities/{activity}/participants?email={email}")
    assert res.status_code == 200
    assert email not in activities[activity]['participants']


def test_unregister_missing_participant():
    client = TestClient(app)
    activity = 'Chess Club'
    missing = 'notfound@example.com'
    assert missing not in activities[activity]['participants']
    res = client.delete(f"/activities/{activity}/participants?email={missing}")
    assert res.status_code == 404


def test_capacity_limit():
    client = TestClient(app)
    # create a small temporary activity for testing
    activities['Tiny Class'] = {
        'description': 'Tiny',
        'schedule': 'Now',
        'max_participants': 2,
        'participants': []
    }
    activity = 'Tiny Class'
    # fill to capacity
    res = client.post(f"/activities/{activity}/signup?email=a@example.com")
    assert res.status_code == 200
    res = client.post(f"/activities/{activity}/signup?email=b@example.com")
    assert res.status_code == 200
    # next signup should fail with 400 (Activity is full)
    res = client.post(f"/activities/{activity}/signup?email=c@example.com")
    assert res.status_code == 400
    assert b'full' in res.content.lower() or res.json().get('detail') in ("Activity is full",)


def test_malformed_email_rejected():
    client = TestClient(app)
    activity = 'Chess Club'
    bad_emails = ['no-at-symbol', 'bad@', '@bad.com', 'space @a.com', 'a@b']
    for e in bad_emails:
        res = client.post(f"/activities/{activity}/signup?email={e}")
        assert res.status_code == 400
        assert 'Invalid email' in res.json().get('detail', '')
