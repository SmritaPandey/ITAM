from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from ..startup import SessionLocal
from ..models import CostRecord, Asset

router = APIRouter(prefix="/costs", tags=["costs"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/record")
def add_cost(asset_id: int, cost_type: str, amount: float, db: Session = Depends(get_db)):
    cr = CostRecord(asset_id=asset_id, cost_type=cost_type, amount=amount)
    db.add(cr)
    db.commit()
    return {"ok": True}


@router.get("/tco/{asset_id}")
def tco(asset_id: int, db: Session = Depends(get_db)):
    total = db.scalar(select(func.coalesce(func.sum(CostRecord.amount), 0)).where(CostRecord.asset_id == asset_id)) or 0
    return {"asset_id": asset_id, "tco": float(total)}


@router.get("/depreciation/{asset_id}")
def depreciation(asset_id: int, as_of: date | None = None, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset or not asset.purchase_date or not asset.useful_life_months or asset.purchase_cost is None:
        return {"nbv": None}
    # straight-line monthly
    from datetime import date as d
    as_of = as_of or d.today()
    months = (as_of.year - asset.purchase_date.year) * 12 + (as_of.month - asset.purchase_date.month)
    months = max(0, min(months, asset.useful_life_months))
    monthly = (asset.purchase_cost) / asset.useful_life_months
    accumulated = monthly * months
    nbv = max(0.0, asset.purchase_cost - accumulated)
    return {"asset_id": asset_id, "nbv": round(nbv, 2), "accumulated": round(accumulated, 2)}

