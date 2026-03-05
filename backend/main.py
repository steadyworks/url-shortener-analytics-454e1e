import json
import os
import random
import sqlite3
import string
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
import uvicorn

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
DB_PATH = os.path.join(os.path.dirname(__file__), "db.sqlite3")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            original_url TEXT NOT NULL,
            created_at TEXT NOT NULL,
            max_clicks INTEGER,
            expires_at TEXT,
            click_count INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS clicks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            link_id INTEGER NOT NULL,
            clicked_at TEXT NOT NULL,
            referer TEXT,
            country TEXT DEFAULT 'Unknown'
        )
    """)
    conn.commit()
    conn.close()


def generate_slug(length=6):
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=length))


def get_country(ip: str) -> str:
    private_prefixes = ("127.", "10.", "192.168.", "172.", "::1", "0.0.0.0")
    if not ip or any(ip.startswith(p) for p in private_prefixes):
        return "Unknown"
    try:
        import requests as req
        r = req.get(f"http://ip-api.com/json/{ip}?fields=country", timeout=2)
        if r.status_code == 200:
            data = r.json()
            return data.get("country") or "Unknown"
    except Exception:
        pass
    return "Unknown"


def parse_datetime_utc(s: str) -> datetime:
    """Parse a datetime string, treating naive datetimes as UTC."""
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


@app.post("/api/links")
async def create_link(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    url = (data.get("url") or "").strip()
    slug = (data.get("slug") or "").strip()
    max_clicks = data.get("max_clicks")
    expires_at = data.get("expires_at")

    if not url:
        return JSONResponse({"error": "URL is required"}, status_code=400)

    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return JSONResponse({"error": "Invalid URL"}, status_code=400)

    if max_clicks is not None:
        try:
            max_clicks = int(max_clicks)
        except (ValueError, TypeError):
            max_clicks = None

    conn = get_db()
    try:
        if not slug:
            for _ in range(20):
                candidate = generate_slug()
                if not conn.execute(
                    "SELECT 1 FROM links WHERE slug = ?", (candidate,)
                ).fetchone():
                    slug = candidate
                    break

        if not slug:
            return JSONResponse({"error": "Could not generate unique slug"}, status_code=500)

        now = datetime.now(timezone.utc).isoformat()
        try:
            conn.execute(
                "INSERT INTO links (slug, original_url, created_at, max_clicks, expires_at) VALUES (?, ?, ?, ?, ?)",
                (slug, url, now, max_clicks, expires_at),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            return JSONResponse(
                {"error": f"Slug '{slug}' already exists"}, status_code=409
            )

        return JSONResponse(
            {
                "slug": slug,
                "short_url": f"http://localhost:3001/{slug}",
                "url": url,
            }
        )
    finally:
        conn.close()


@app.get("/api/links/{slug}")
async def get_link_analytics(slug: str):
    conn = get_db()
    try:
        link = conn.execute(
            "SELECT * FROM links WHERE slug = ?", (slug,)
        ).fetchone()
        if not link:
            return JSONResponse({"error": "Not found"}, status_code=404)

        clicks = conn.execute(
            "SELECT clicked_at, referer, country FROM clicks WHERE link_id = ? ORDER BY clicked_at",
            (link["id"],),
        ).fetchall()
    finally:
        conn.close()

    total = len(clicks)

    daily: dict[str, int] = {}
    for click in clicks:
        day = click["clicked_at"][:10]
        daily[day] = daily.get(day, 0) + 1

    referrers: dict[str, int] = {}
    for click in clicks:
        ref = click["referer"]
        if ref:
            try:
                netloc = urlparse(ref).netloc
                domain = netloc if netloc else ref
            except Exception:
                domain = ref
        else:
            domain = "Direct"
        referrers[domain] = referrers.get(domain, 0) + 1

    geo: dict[str, int] = {}
    for click in clicks:
        country = click["country"] or "Unknown"
        geo[country] = geo.get(country, 0) + 1

    return JSONResponse(
        {
            "slug": slug,
            "original_url": link["original_url"],
            "click_count": total,
            "clicks_over_time": [
                {"date": d, "count": c} for d, c in sorted(daily.items())
            ],
            "referrers": [
                {"name": r, "count": c}
                for r, c in sorted(referrers.items(), key=lambda x: -x[1])
            ],
            "geo": [
                {"country": c, "count": cnt}
                for c, cnt in sorted(geo.items(), key=lambda x: -x[1])
            ],
        }
    )


@app.get("/{slug}")
async def redirect_link(slug: str, request: Request):
    now = datetime.now(timezone.utc)
    conn = get_db()
    try:
        link = conn.execute(
            "SELECT * FROM links WHERE slug = ?", (slug,)
        ).fetchone()

        if not link:
            return RedirectResponse(f"{FRONTEND_URL}/expired", status_code=302)

        if link["expires_at"]:
            try:
                expires = parse_datetime_utc(link["expires_at"])
                if now >= expires:
                    return RedirectResponse(f"{FRONTEND_URL}/expired", status_code=302)
            except ValueError:
                pass

        if link["max_clicks"] is not None and link["click_count"] >= link["max_clicks"]:
            return RedirectResponse(f"{FRONTEND_URL}/expired", status_code=302)

        ip = request.client.host if request.client else "unknown"
        referer = request.headers.get("referer") or request.headers.get("Referer") or None
        country = get_country(ip)

        clicked_at = now.isoformat()
        conn.execute(
            "INSERT INTO clicks (link_id, clicked_at, referer, country) VALUES (?, ?, ?, ?)",
            (link["id"], clicked_at, referer, country),
        )
        conn.execute(
            "UPDATE links SET click_count = click_count + 1 WHERE id = ?",
            (link["id"],),
        )
        conn.commit()

        return RedirectResponse(link["original_url"], status_code=302)
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    uvicorn.run(app, host="0.0.0.0", port=3001)
