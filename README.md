# ЙХБ — Hujjatlar va Spravkalar

Telegram Bot + Mini App tizimi. ЙХБ (Yo'l xo'jaligi boshqarmasi) tuzilmasi uchun
iyerarxik, rollarga asoslangan hujjat va ma'lumot almashinuv platformasi.

---

## Tuzilma

```
.
├── backend/           # FastAPI + aiogram 3 (Python)
│   ├── app/
│   │   ├── config.py         # Sozlamalar (.env)
│   │   ├── models.py         # SQLAlchemy ORM modellari
│   │   ├── database.py       # DB init + seeding
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── crud.py           # DB operatsiyalari
│   │   ├── auth.py           # Telegram WebApp auth
│   │   ├── api/
│   │   │   ├── auth_router.py    # /auth/me, /auth/register
│   │   │   ├── departments.py    # /departments/tree, /flat
│   │   │   ├── records.py        # /records CRUD + broadcast
│   │   │   └── admin.py          # /admin/* (arizalar, xodimlar, svodka)
│   │   └── bot/
│   │       ├── handlers.py       # aiogram handlerlar
│   │       └── keyboards.py      # Inline klaviaturalar
│   ├── main.py               # FastAPI app + bot polling
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/          # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── api/              # axios client + barcha API calllar
│   │   ├── hooks/            # useAuth
│   │   ├── components/ui/    # RecordCard, NewRecordModal
│   │   ├── pages/
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── FeedPage.tsx
│   │   │   ├── PendingPage.tsx
│   │   │   └── admin/        # AdminPage, RequestsTab, UsersTab, SvodkaTab, BroadcastTab
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```

---

## Tezkor ishga tushirish

### 1. Local (dev) — SQLite

```bash
cd backend
cp .env.example .env
# .env da BOT_TOKEN, ADMIN_IDS, DEV_MODE=true o'rnating
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Dev rejimida brauzer consolida:
```js
localStorage.setItem('DEV_TG_ID', '123456789')  // o'z Telegram IDingiz
```

### 2. Docker Compose (PostgreSQL bilan)

```bash
cp backend/.env.example backend/.env
# .env ni tahrirlang: BOT_TOKEN, ADMIN_IDS
docker compose up --build
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- Swagger UI: http://localhost:8000/docs

---

## Bot sozlash

1. `@BotFather` da yangi bot yarating, tokenni oling.
2. `backend/.env` ga `BOT_TOKEN=...` qo'ying.
3. `ADMIN_IDS=` ga admin Telegram ID lari (vergul bilan).
4. `WEBAPP_URL=https://sizning-domen.uz` (HTTPS bo'lishi shart!).

Bot komandalar:
- `/start` — asosiy menyu + Mini App tugmasi.

---

## API qisqacha

| Method | URL | Tavsif |
|--------|-----|--------|
| GET | `/api/v1/auth/me` | Joriy foydalanuvchi |
| POST | `/api/v1/auth/register` | Ro'yxatdan o'tish |
| GET | `/api/v1/departments/tree` | Bo'limlar daraxti |
| GET | `/api/v1/records` | Yozuvlar lentasi |
| POST | `/api/v1/records` | Yangi yozuv (multipart) |
| POST | `/api/v1/records/broadcast` | Ko'p bo'limga yuborish |
| GET | `/api/v1/admin/requests` | Kutilayotgan arizalar |
| POST | `/api/v1/admin/requests/review` | Tasdiqlash/rad etish |
| GET | `/api/v1/admin/users` | Barcha xodimlar |
| GET | `/api/v1/admin/svodka` | Topshirish nazorati |

---

## Rollar

| Rol | Imkoniyatlar |
|-----|-------------|
| **Admin** | Barcha bo'limlar, xodimlar, arizalar, broadcast, svodka |
| **User** | Faqat o'z bo'limi lentasi, yozuv qo'shish, o'z yozuvlarini ko'rish |

---

## Bosqichma-bosqich joylashtirish (Production)

1. VPS/server oling (Ubuntu 22.04 tavsiya).
2. Docker + Docker Compose o'rnating.
3. HTTPS uchun nginx reverse proxy + Let's Encrypt sozlang.
4. `backend/.env` da `DATABASE_URL` PostgreSQL ga o'rnating.
5. `docker compose up -d --build`.
6. Telegram Webhook uchun: `POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://sizning-domen.uz/webhook/<TOKEN>`
