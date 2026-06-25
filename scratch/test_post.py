import requests

BASE_URL = "http://localhost:8000"

def get_token():
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "public@wajood.pk",
        "password": "Test1234!"
    })
    res.raise_for_status()
    return res.json()["access_token"]

def test_create_case(token):
    headers = {
        "Authorization": f"Bearer {token}"
    }
    data = {
        "full_name": "Ali Khan",
        "age": 25,
        "gender": "MALE",
        "last_seen_location": "Sadar Bazaar",
        "last_seen_city": "Lahore",
        "last_seen_date": "2026-06-24T12:00:00"
    }
    res = requests.post(f"{BASE_URL}/api/cases/", data=data, headers=headers)
    print("STATUS CODE:", res.status_code)
    try:
        print("RESPONSE:", res.json())
    except Exception:
        print("RESPONSE:", res.text)

if __name__ == "__main__":
    try:
        token = get_token()
        test_create_case(token)
    except Exception as e:
        print("Error:", e)
