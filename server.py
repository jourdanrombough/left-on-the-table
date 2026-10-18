#!/usr/bin/env python3
"""Left on the Table: local server.

Serves the scanner page and forwards a fixed list of DataForSEO endpoints using the credentials in your .env, so the
password never reaches the browser. Responses are cached on disk, so re-opening a scan you already ran is free.

    python3 server.py --env ~/DataForSEO/.env        # then open http://localhost:8765
"""
import argparse, base64, hashlib, json, os, re, threading, time, urllib.error, urllib.request, webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
API = "https://api.dataforseo.com/v3/"
CACHE = os.path.join(ROOT, "cache")
SCANS = os.path.join(ROOT, "scans")
CACHE_DAYS = 7
ALLOWED = {
    "dataforseo_labs/google/domain_rank_overview/live",
    "dataforseo_labs/google/ranked_keywords/live",
    "dataforseo_labs/google/keywords_for_site/live",
    "dataforseo_labs/google/related_keywords/live",
    "dataforseo_labs/google/keyword_suggestions/live",
    "dataforseo_labs/google/serp_competitors/live",
    "keywords_data/google_ads/search_volume/live",
    "serp/google/organic/live/advanced",
    "ai_optimization/claude/llm_responses/live",
    "ai_optimization/chat_gpt/llm_responses/live",
}
AUTH = None
LOCK = threading.Lock()
SPENT = {"total": 0.0, "calls": 0}


def load_env(path):
    path = os.path.expanduser(path)
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    login, pw = os.environ.get("DATAFORSEO_LOGIN"), os.environ.get("DATAFORSEO_PASSWORD")
    if not (login and pw) and os.path.exists(path):
        # also accept a file with just the login and password on two lines, or "login:password"
        bare = [l.strip().strip('"').strip("'") for l in open(path) if l.strip() and not l.strip().startswith("#") and "=" not in l]
        if len(bare) >= 2:
            login, pw = bare[0], bare[1]
        elif len(bare) == 1 and ":" in bare[0]:
            login, pw = bare[0].split(":", 1)
    if not (login and pw):
        raise SystemExit("No DataForSEO credentials found. Put DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in " + path)
    return "Basic " + base64.b64encode(f"{login}:{pw}".encode()).decode()


def dfs(endpoint, task=None):
    req = urllib.request.Request(API + endpoint, method="POST" if task is not None else "GET",
                                 data=json.dumps([task]).encode() if task is not None else None,
                                 headers={"Authorization": AUTH, "Content-Type": "application/json"})
    try:
        body = json.loads(urllib.request.urlopen(req, timeout=180).read())
    except urllib.error.HTTPError as e:
        return {"status_code": e.code, "status_message": f"HTTP {e.code}", "cost": 0, "result": None}
    except Exception as e:  # network error
        return {"status_code": 0, "status_message": str(e), "cost": 0, "result": None}
    t = (body.get("tasks") or [{}])[0]
    return {"status_code": t.get("status_code", body.get("status_code")), "status_message": t.get("status_message", body.get("status_message")),
            "cost": t.get("cost", 0) or 0, "result": t.get("result")}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def send_json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        if self.path.startswith("/api/health"):
            return self.send_json({"ok": True, "mode": "local", "spent": SPENT})
        if self.path.startswith("/api/balance"):
            r = dfs("appendix/user_data")
            try:
                return self.send_json({"balance": r["result"][0]["money"]["balance"]})
            except Exception:
                return self.send_json({"balance": None, "error": r.get("status_message")})
        if self.path.startswith("/api/scans"):
            out = []
            for f in sorted(os.listdir(SCANS), reverse=True) if os.path.isdir(SCANS) else []:
                if f.endswith(".json"):
                    try:
                        d = json.load(open(os.path.join(SCANS, f)))
                        out.append({"file": "scans/" + f, "domain": d.get("domain"), "keyword": d.get("keyword"),
                                    "location": (d.get("location") or {}).get("label"), "date": d.get("date"),
                                    "headline": d.get("headline")})
                    except Exception:
                        pass
            return self.send_json(out[:40])
        p = self.path.split("?")[0]
        if "/." in p or p.startswith("/cache") or p.endswith(".py") or p.endswith(".env"):
            return self.send_json({"error": "not found"}, 404)  # never serve .env, cache or source
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/dfs"):
            req = self.body()
            ep, task = req.get("endpoint", ""), req.get("task") or {}
            if ep not in ALLOWED:
                return self.send_json({"status_code": 403, "status_message": "Endpoint not allowed: " + ep}, 403)
            key = hashlib.sha1((ep + json.dumps(task, sort_keys=True)).encode()).hexdigest()
            path = os.path.join(CACHE, key + ".json")
            if not req.get("fresh") and os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_DAYS * 86400:
                r = json.load(open(path)); r["cached"] = True; r["cost_saved"] = r.get("cost", 0); r["cost"] = 0
                return self.send_json(r)
            t0 = time.time()
            r = dfs(ep, task)
            r["seconds"] = round(time.time() - t0, 2)
            with LOCK:
                SPENT["total"] = round(SPENT["total"] + (r.get("cost") or 0), 4); SPENT["calls"] += 1
            if r.get("status_code") == 20000:
                os.makedirs(CACHE, exist_ok=True)
                json.dump(dict(r, endpoint=ep, task=task), open(path, "w"))
            return self.send_json(r)
        if self.path.startswith("/api/save"):
            d = self.body()
            slug = re.sub(r"[^a-z0-9]+", "-", f'{d.get("domain","scan")}-{d.get("keyword") or "site"}-{(d.get("location") or {}).get("label","")}'.lower()).strip("-")[:80]
            os.makedirs(SCANS, exist_ok=True)
            name = f'{time.strftime("%Y%m%d-%H%M")}-{slug}.json'
            json.dump(d, open(os.path.join(SCANS, name), "w"))
            return self.send_json({"file": "scans/" + name})
        self.send_json({"error": "not found"}, 404)


def main():
    global AUTH
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", default=os.path.join(ROOT, ".env"))
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-open", action="store_true")
    a = ap.parse_args()
    AUTH = load_env(a.env)
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    url = f"http://localhost:{a.port}/"
    print(f"Left on the Table is running at {url}  (Ctrl+C to stop)")
    if not a.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
