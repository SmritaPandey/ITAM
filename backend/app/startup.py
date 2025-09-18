from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings
from .models import Base, ensure_initial_roles, AssetClass
from .storage import ensure_bucket, ensure_fs
from sqlalchemy import select

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

async def on_startup():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_initial_roles(db)
        # Ensure default asset class exists for quick start
        if not db.scalar(select(AssetClass)):
            db.add(AssetClass(name="Generic", description="Default asset class"))
            db.commit()
    ensure_bucket()
    ensure_fs()

