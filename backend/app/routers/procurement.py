from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import PurchaseRequest, PurchaseOrder, POLineItem, CatalogItem, Asset
from ..security import require_roles

router = APIRouter(prefix="/procurement", tags=["procurement"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/pr", dependencies=[Depends(require_roles("Admin", "ProcurementManager"))])
def create_pr(requester_id: int, db: Session = Depends(get_db)):
    pr = PurchaseRequest(requester_id=requester_id, status="approved")
    db.add(pr)
    db.commit()
    db.refresh(pr)
    return pr


@router.post("/po", dependencies=[Depends(require_roles("Admin", "ProcurementManager"))])
def create_po(pr_id: int | None, vendor_id: int, items: list[dict], db: Session = Depends(get_db)):
    po = PurchaseOrder(pr_id=pr_id, vendor_id=vendor_id, status="open")
    db.add(po)
    db.flush()
    for it in items:
        db.add(POLineItem(po_id=po.id, catalog_item_id=it["catalog_item_id"], quantity=it["quantity"], unit_cost=it["unit_cost"]))
    db.commit()
    db.refresh(po)
    return po


@router.post("/po/{po_id}/deliver", dependencies=[Depends(require_roles("Admin", "ProcurementManager"))])
def deliver_po(po_id: int, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404)
    po.status = "delivered"
    # auto-create assets per line item quantity
    lines = db.scalars(select(POLineItem).where(POLineItem.po_id == po_id)).all()
    for li in lines:
        catalog = db.get(CatalogItem, li.catalog_item_id)
        for idx in range(li.quantity):
            tag = f"PO{po.id}-LI{li.id}-{idx+1}"
            asset = Asset(tag=tag, name=catalog.name, asset_class_id=catalog.asset_class_id, purchase_cost=li.unit_cost, status="in_stock")
            db.add(asset)
        # increase stock
        catalog.stock_quantity += li.quantity
    db.commit()
    return {"created_assets": sum(li.quantity for li in lines)}

