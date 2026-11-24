"""ЙХБ Bot: Cloudflare tunnel + server (webhook rejimi). Ishga tushirish: python start.py"""
import os, re, subprocess, sys, threading, time, pathlib, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = pathlib.Path(__file__).parent
BACKEND = BASE / "backend"
ENV_FILE = BACKEND / ".env"
CLOUDFLARED = BASE / "cloudflared.exe"
URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


def log(msg):
    print(f"[YXB] {msg}", flush=True)


def update_env(key, value):
    text = ENV_FILE.read_text(encoding="utf-8")
    line = f"{key}={value}"
    if re.search(rf"^{key}=.*$", text, re.M):
        text = re.sub(rf"^{key}=.*$", line, text, flags=re.M)
    else:
        text += f"\n{line}\n"
    ENV_FILE.write_text(text, encoding="utf-8")


def start_tunnel():
    proc = subprocess.Popen(
        [str(CLOUDFLARED), "tunnel", "--no-autoupdate", "--url", "http://localhost:8000"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
    )
    found = threading.Event()
    box = {}

    def drain():
        for line in proc.stderr:
            m = URL_RE.search(line)
            if m and not found.is_set():
                box["url"] = m.group(0)
                found.set()

    threading.Thread(target=drain, daemon=True).start()
    found.wait(45)
    return proc, box.get("url")


def wait_dns(url, timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(url + "/health", timeout=5)
            return True
        except Exception:
            time.sleep(2)
    return False


def start_server():
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=str(BACKEND),
    )


def main():
    if not CLOUDFLARED.exists():
        log(f"cloudflared.exe topilmadi: {CLOUDFLARED}")
        sys.exit(1)

    log("Cloudflare tunnel ochilmoqda...")
    tunnel, url = start_tunnel()
    if not url:
        log("Tunnel manzili olinmadi. Internetni tekshiring.")
        tunnel.terminate()
        sys.exit(1)
    log(f"HTTPS manzil: {url}")
    update_env("WEBAPP_URL", url)

    log("Server ishga tushirilmoqda...")
    server = start_server()
    if wait_dns(url):
        log("Tayyor! Telegramda botga /start yozing.")
    else:
        log("Server ishga tushdi, lekin tunnel hali javob bermayapti — 1 daqiqa kuting.")
    log("To'xtatish uchun shu oynani yoping yoki Ctrl+C bosing.")

    try:
        while True:
            time.sleep(2)
            if server.poll() is not None:
                log("Server to'xtadi, qayta ishga tushirilmoqda...")
                server = start_server()
            if tunnel.poll() is not None:
                log("Tunnel uzildi. start.py ni qayta ishga tushiring.")
                break
    except KeyboardInterrupt:
        pass
    finally:
        for p in (server, tunnel):
            try:
                p.terminate()
            except Exception:
                pass


if __name__ == "__main__":
    main()
