from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import CatalogItem, Vendor, BundleItem, Asset
from ..security import require_roles

router = APIRouter(prefix="/catalogs", tags=["catalogs"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", dependencies=[Depends(require_roles("Admin", "AssetManager", "ProcurementManager"))])
def create_catalog_item(name: str, asset_class_id: int, threshold_value: float = 0, recommended_vendor_id: int | None = None, alternative_catalog_item_id: int | None = None, db: Session = Depends(get_db)):
    item = CatalogItem(name=name, asset_class_id=asset_class_id, threshold_value=threshold_value, approved=False, recommended_vendor_id=recommended_vendor_id, alternative_catalog_item_id=alternative_catalog_item_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/{catalog_id}/approve", dependencies=[Depends(require_roles("Admin", "AssetManager", "ProcurementManager"))])
def approve_catalog(catalog_id: int, approver_role: str, db: Session = Depends(get_db)):
    item = db.get(CatalogItem, catalog_id)
    if not item:
        raise HTTPException(404)
    item.approved = True
    item.approved_by_role = approver_role
    db.commit()
    db.refresh(item)
    return item


@router.post("/{bundle_id}/bundle-item", dependencies=[Depends(require_roles("Admin", "AssetManager", "ProcurementManager"))])
def add_to_bundle(bundle_id: int, catalog_item_id: int, db: Session = Depends(get_db)):
    db.add(BundleItem(bundle_id=bundle_id, catalog_item_id=catalog_item_id))
    db.commit()
    return {"ok": True}


@router.get("/",)
def list_catalogs(db: Session = Depends(get_db)):
    return db.scalars(select(CatalogItem)).all()


@router.get("/{catalog_id}/assets-count")
def count_assets_linked(catalog_id: int, db: Session = Depends(get_db)):
    # naive heuristic: assets with same asset_class
    item = db.get(CatalogItem, catalog_id)
    if not item:
        raise HTTPException(404)
    count = db.query(Asset).where(Asset.asset_class_id == item.asset_class_id).count()
    return {"count": count}

