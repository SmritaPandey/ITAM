from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import CatalogItem, PurchaseOrder, POLineItem

router = APIRouter(prefix="/reorder", tags=["reorder"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/check-and-po")
def check_and_po(catalog_item_id: int, quantity: int, unit_cost: float, db: Session = Depends(get_db)):
    item = db.get(CatalogItem, catalog_item_id)
    if not item:
        return {"ok": False}
    if item.stock_quantity <= item.reorder_point and item.reorder_vendor_id:
        po = PurchaseOrder(vendor_id=item.reorder_vendor_id, status="open")
        db.add(po)
        db.flush()
        db.add(POLineItem(po_id=po.id, catalog_item_id=item.id, quantity=quantity, unit_cost=unit_cost))
        db.commit()
        return {"po_id": po.id}
    return {"po_id": None}

