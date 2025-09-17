from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import LoanRecord, Asset

router = APIRouter(prefix="/loans", tags=["loans"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/checkout")
def checkout(asset_id: int, user_id: int, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset or asset.status not in ("in_stock", "assigned"):
        raise HTTPException(400, "Asset not available")
    lr = LoanRecord(asset_id=asset_id, user_id=user_id, status="open")
    asset.status = "loaned"
    db.add(lr)
    db.commit()
    return {"ok": True}


@router.post("/checkin")
def checkin(asset_id: int, db: Session = Depends(get_db)):
    lr = db.scalar(select(LoanRecord).where(LoanRecord.asset_id == asset_id, LoanRecord.status == "open"))
    if not lr:
        raise HTTPException(400, "No open loan")
    lr.status = "closed"
    lr.returned_at = datetime.utcnow()
    asset = db.get(Asset, asset_id)
    asset.status = "in_stock"
    db.commit()
    return {"ok": True}

