from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from .config import settings
from .models import Base

def _engine_args(url: str):
    """Neon/Render bergan postgres:// manzilini asyncpg formatiga keltiradi."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if not url.startswith("postgresql"):
        return url, {}
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    base, _, query = url.partition("?")
    params = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
    connect_args = {}
    if params.pop("sslmode", None) in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = True
    params.pop("channel_binding", None)
    if params:
        base += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    return base, {"connect_args": connect_args, "pool_pre_ping": True, "pool_recycle": 300}


_url, _extra = _engine_args(settings.DATABASE_URL)
engine = create_async_engine(_url, echo=False, future=True, **_extra)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_departments()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Seed ЙХБ tuzilmasi
# ---------------------------------------------------------------------------
async def seed_departments():
    from sqlalchemy import select, text
    from .models import Department

    async with AsyncSessionLocal() as session:
        # check if already seeded
        result = await session.execute(select(Department).limit(1))
        if result.scalars().first():
            return

        ROOT_DEPTS = [
            # (sort, code, name, read_only_broadcast)
            (1,  "FOYDALANISH",   "Фойдаланиш булими",                        False),
            (2,  "KAPITAL",       "Капитал таъмирлаш булими",                  False),
            (3,  "ISHLAB",        "Ишлаб чикариш техника булими",              False),
            (4,  "SUNIY",         "Сунъий иншоотлар булими",                   False),
            (5,  "REVIZOR",       "Ревизор",                                    False),
            (6,  "EKONOMIST",     "Экономист",                                  False),
            (7,  "PC",            "ПЧ",                                         False),  # parent
            (8,  "PMS",           "ПМС, ОПМС",                                  False),  # parent
            (9,  "RSP",           "РСП",                                         False),
            (10, "TELEGRAMMA",    "Телеграмма, приказ",                          True),
            (11, "PASS_POYEZD",   "Пасс поезд графиги",                          True),
            (12, "BOSHQALAR",     "Бошкалар",                                     False),
        ]

        PC_CHILDREN = [
            "ПЧ-1","ПЧ-2","ПЧ-3","ПЧ-4","ПЧ-5","ПЧ-6","ПЧ-7","ПЧ-8","ПЧ-9",
            "ПЧ-10","ПЧ-11","ПЧ-12","ПЧ-13","ПЧ-14","ПЧ-15","ПЧ-16",
            "ПЧ-18","ПЧ-25","ПЧ-26",
        ]
        PMS_CHILDREN = ["ОПМС-203","ПМС-279","ПМС-164","ПМС-166","ПМС-17"]

        parent_map = {}
        for sort, code, name, ro in ROOT_DEPTS:
            d = Department(sort_order=sort, code=code, name=name, read_only_broadcast=ro)
            session.add(d)
            parent_map[code] = d

        await session.flush()   # get ids

        for i, name in enumerate(PC_CHILDREN, start=1):
            code = name.replace("-", "_")
            d = Department(sort_order=i, code=code, name=name,
                           parent_id=parent_map["PC"].id)
            session.add(d)

        for i, name in enumerate(PMS_CHILDREN, start=1):
            code = name.replace("-", "_")
            d = Department(sort_order=i, code=code, name=name,
                           parent_id=parent_map["PMS"].id)
            session.add(d)

        await session.commit()

        # Admin foydalanuvchini avtomatik approved qilib qo'yish
        from .models import User, UserRole, RegistrationStatus
        for admin_tg_id in settings.admin_ids_list:
            res = await session.execute(select(User).where(User.telegram_id == admin_tg_id))
            if not res.scalars().first():
                admin_user = User(
                    telegram_id=admin_tg_id,
                    full_name="Bosh Admin",
                    position="Boshliq / Admin",
                    role=UserRole.admin,
                    reg_status=RegistrationStatus.approved,
                    department_id=parent_map["FOYDALANISH"].id,
                )
                session.add(admin_user)
        await session.commit()
