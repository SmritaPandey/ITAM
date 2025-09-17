from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import AssetLink

router = APIRouter(prefix="/itil", tags=["itil-links"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/link")
def link(asset_id: int, itil_type: str, external_id: str, db: Session = Depends(get_db)):
    row = AssetLink(asset_id=asset_id, itil_type=itil_type, external_id=external_id)
    db.add(row)
    db.commit()
    return {"ok": True}


@router.get("/links/{asset_id}")
def list_links(asset_id: int, db: Session = Depends(get_db)):
    rows = db.scalars(select(AssetLink).where(AssetLink.asset_id == asset_id)).all()
    return [{"itil_type": r.itil_type, "external_id": r.external_id} for r in rows]

