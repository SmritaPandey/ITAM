from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import AssetAttributeValue

router = APIRouter(prefix="/attributes", tags=["attributes"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/set")
def set_attr(asset_id: int, attribute_definition_id: int, value: str, source: str = "initial", db: Session = Depends(get_db)):
    row = db.scalar(select(AssetAttributeValue).where(AssetAttributeValue.asset_id == asset_id, AssetAttributeValue.attribute_definition_id == attribute_definition_id))
    if row:
        row.value = value
        row.source = source
    else:
        db.add(AssetAttributeValue(asset_id=asset_id, attribute_definition_id=attribute_definition_id, value=value, source=source))
    db.commit()
    return {"ok": True}


@router.get("/diff/{asset_id}")
def diff(asset_id: int, db: Session = Depends(get_db)):
    vals = db.scalars(select(AssetAttributeValue).where(AssetAttributeValue.asset_id == asset_id)).all()
    initial = {v.attribute_definition_id: v.value for v in vals if v.source == "initial"}
    discovery = {v.attribute_definition_id: v.value for v in vals if v.source == "discovery"}
    diffs = []
    for k, init_val in initial.items():
        if k in discovery and discovery[k] != init_val:
            diffs.append({"attribute_definition_id": k, "initial": init_val, "discovery": discovery[k]})
    return {"diffs": diffs}

