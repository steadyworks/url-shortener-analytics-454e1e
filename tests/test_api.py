import requests

BASE_BACKEND = "http://localhost:3001"


def test_nonexistent_slug_redirects_to_expired_page():
    """A slug that has never been created should redirect to the frontend /expired page."""
    r = requests.get(
        f"{BASE_BACKEND}/this-slug-does-not-exist-xyz-99999",
        allow_redirects=False,
    )
    assert r.status_code in (301, 302, 303, 307, 308), (
        f"Expected a redirect status code, got {r.status_code}"
    )
    location = r.headers.get("Location", "")
    assert "/expired" in location, (
        f"Expected redirect Location to contain '/expired', got: {location!r}"
    )
