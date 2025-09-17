from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import Vendor, Contract, ContractAsset, ContractPOLink, POLineItem

router = APIRouter(prefix="/vendors-contracts", tags=["vendors-contracts"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/vendor")
def create_vendor(name: str, rating: float = 0, contact: str | None = None, db: Session = Depends(get_db)):
    v = Vendor(name=name, rating=rating, contact=contact)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.post("/contract")
def create_contract(contract_number: str, vendor_id: int, db: Session = Depends(get_db)):
    c = Contract(contract_number=contract_number, vendor_id=vendor_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.post("/contract/{contract_id}/add-asset")
def contract_add_asset(contract_id: int, asset_id: int, db: Session = Depends(get_db)):
    ca = ContractAsset(contract_id=contract_id, asset_id=asset_id)
    db.add(ca)
    db.commit()
    return {"ok": True}


@router.post("/contract/{contract_id}/link-po-line")
def contract_link_po(contract_id: int, po_line_item_id: int, db: Session = Depends(get_db)):
    # ensure line exists
    if not db.get(POLineItem, po_line_item_id):
        return {"ok": False}
    link = ContractPOLink(contract_id=contract_id, po_line_item_id=po_line_item_id)
    db.add(link)
    db.commit()
    return {"ok": True}

