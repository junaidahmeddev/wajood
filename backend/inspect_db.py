import asyncio
from sqlalchemy import select
from app.database import async_session_maker
from app.models.missing_person import MissingPerson

async def main():
    async with async_session_maker() as db:
        result = await db.execute(select(MissingPerson))
        cases = result.scalars().all()
        print("====== CASES IN DATABASE ======")
        for c in cases:
            print(f"ID: {c.id}, Name: {c.full_name}, Photo: {c.photo_url}")
        print("===============================")

if __name__ == "__main__":
    asyncio.run(main())
