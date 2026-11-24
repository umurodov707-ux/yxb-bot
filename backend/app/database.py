from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from .config import settings
from .models import Base

engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
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
