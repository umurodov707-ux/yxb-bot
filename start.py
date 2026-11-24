"""
ЙХБ Bot — Avtomatik ishga tushirish skripti
=============================================
Foydalanish:
    python start.py

Bu skript:
1. Cloudflare Tunnel ochadi (HTTPS URL oladi)
2. WEBAPP_URL ni avtomatik yangilaydi
3. FastAPI server + Telegram bot ni ishga tushiradi
"""
import subprocess, sys, os, re, threading, time, signal, pathlib

BASE = pathlib.Path(__file__).parent
BACKEND = BASE / "backend"
ENV_FILE = BACKEND / ".env"
CLOUDFLARED = BASE / "cloudflared.exe"

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
RESET  = "\033[0m"

def log(msg, color=GREEN):
    print(f"{color}[YXB] {msg}{RESET}")


def update_env(key: str, value: str):
    """Update a key=value pair in .env file."""
    text = ENV_FILE.read_text(encoding="utf-8")
    pattern = rf"^{key}=.*$"
    new_line = f"{key}={value}"
    if re.search(pattern, text, re.MULTILINE):
        text = re.sub(pattern, new_line, text, flags=re.MULTILINE)
    else:
        text += f"\n{new_line}"
    ENV_FILE.write_text(text, encoding="utf-8")
    log(f"{key} yangilandi: {value}", CYAN)


def get_tunnel_url(proc) -> str | None:
    """Read cloudflared output until we find the trycloudflare.com URL."""
    url_pattern = re.compile(r"https://[a-z0-9\-]+\.trycloudflare\.com")
    timeout = 30
    start = time.time()
    buffer = ""
    while time.time() - start < timeout:
        line = proc.stderr.readline()
        if not line:
            time.sleep(0.1)
            continue
        buffer += line
        m = url_pattern.search(buffer)
        if m:
            return m.group(0)
    return None


def start_server():
    """Start uvicorn server."""
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND)
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--host", "0.0.0.0", "--port", "8000", "--log-level", "warning"],
        cwd=str(BACKEND),
        env=env,
    )


def main():
    print(f"\n{CYAN}{'='*50}")
    print("   ЙХБ Bot — Ishga tushirilmoqda...")
    print(f"{'='*50}{RESET}\n")

    processes = []

    # 1. Cloudflare tunnel
    if CLOUDFLARED.exists():
        log("Cloudflare Tunnel ishga tushirilmoqda...", YELLOW)
        cf_proc = subprocess.Popen(
            [str(CLOUDFLARED), "tunnel", "--url", "http://localhost:8000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        processes.append(cf_proc)

        log("HTTPS URL kutilmoqda (~10 soniya)...", YELLOW)
        tunnel_url = get_tunnel_url(cf_proc)

        if tunnel_url:
            log(f"✅ Tunnel URL: {tunnel_url}", GREEN)
            update_env("WEBAPP_URL", tunnel_url)
            # Set env var for the current session too
            os.environ["WEBAPP_URL"] = tunnel_url
        else:
            log("⚠️  Tunnel URL topilmadi, eski WEBAPP_URL qoldirildi", YELLOW)
    else:
        log(f"⚠️  cloudflared.exe topilmadi: {CLOUDFLARED}", YELLOW)
        log("   WEBAPP_URL o'zgartirilmaydi", YELLOW)

    # 2. FastAPI + Bot
    log("FastAPI + Telegram Bot ishga tushirilmoqda...", YELLOW)
    server_proc = start_server()
    processes.append(server_proc)
    time.sleep(3)

    if server_proc.poll() is None:
        log("✅ Server port 8000 da ishlayapti", GREEN)
    else:
        log("❌ Server ishga tushmadi!", RED)
        sys.exit(1)

    # Print summary
    print(f"\n{CYAN}{'='*50}")
    print("   Bot muvaffaqiyatli ishga tushdi!")
    print(f"{'='*50}")
    print(f"  🌐 Server:    http://localhost:8000")
    print(f"  📚 Swagger:   http://localhost:8000/docs")
    webapp = os.environ.get("WEBAPP_URL", "WEBAPP_URL o'rnatilmagan")
    print(f"  📱 Mini App:  {webapp}")
    print(f"\n  Toxtatish uchun: Ctrl+C{RESET}\n")

    # Keep alive
    def cleanup(sig, frame):
        log("\nTo'xtatilmoqda...", YELLOW)
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    while True:
        time.sleep(1)
        # Restart server if it crashes
        if server_proc.poll() is not None:
            log("Server to'xtadi, qayta ishga tushirilmoqda...", YELLOW)
            server_proc = start_server()
            processes[-1] = server_proc
            time.sleep(3)


if __name__ == "__main__":
    main()
