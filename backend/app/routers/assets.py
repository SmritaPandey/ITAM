from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..startup import SessionLocal
from ..models import Asset, LifecycleEvent, AuditLog
from ..schemas import AssetCreate, AssetOut, AssetUpdate, LifecycleEventCreate, LifecycleEventOut, BulkUpdateRequest
from ..utils import to_json

router = APIRouter(prefix="/assets", tags=["assets"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def audit(db: Session, entity: str, entity_id: int, action: str, before: Any, after: Any, by_user: str | None = None):
    log = AuditLog(entity=entity, entity_id=entity_id, action=action, before=to_json(before), after=to_json(after), by_user=by_user)
    db.add(log)


@router.post("/", response_model=AssetOut)
def create_asset(payload: AssetCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Asset).where(Asset.tag == payload.tag)):
        raise HTTPException(status_code=400, detail="Asset tag exists")
    asset = Asset(**payload.model_dump())
    db.add(asset)
    db.flush()
    db.add(LifecycleEvent(asset_id=asset.id, event_type="provisioned", details="Created"))
    audit(db, "Asset", asset.id, "create", None, asset.__dict__)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/", response_model=list[AssetOut])
def list_assets(db: Session = Depends(get_db)):
    return db.scalars(select(Asset)).all()


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Not found")
    return asset


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: int, payload: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Not found")
    before = asset.__dict__.copy()
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(asset, k, v)
    asset.updated_at = datetime.utcnow()
    audit(db, "Asset", asset.id, "update", before, asset.__dict__)
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/{asset_id}/lifecycle", response_model=LifecycleEventOut)
def add_lifecycle_event(asset_id: int, payload: LifecycleEventCreate, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Not found")
    ev = LifecycleEvent(asset_id=asset_id, event_type=payload.event_type, details=payload.details, by_user_id=payload.by_user_id)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.post("/bulk-update")
def bulk_update(payload: BulkUpdateRequest, db: Session = Depends(get_db)):
    updates = payload.fields.model_dump(exclude_unset=True)
    for aid in payload.asset_ids:
        asset = db.get(Asset, aid)
        if not asset:
            continue
        before = asset.__dict__.copy()
        for k, v in updates.items():
            setattr(asset, k, v)
        asset.updated_at = datetime.utcnow()
        audit(db, "Asset", asset.id, "update", before, asset.__dict__)
    db.commit()
    return {"updated": len(payload.asset_ids)}

