from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import CMDBItem, CMDBRelationship

router = APIRouter(prefix="/cmdb", tags=["cmdb"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/item")
def create_ci(asset_id: int, ci_type: str, db: Session = Depends(get_db)):
    ci = CMDBItem(asset_id=asset_id, ci_type=ci_type)
    db.add(ci)
    db.commit()
    db.refresh(ci)
    return ci


@router.post("/rel")
def relate(from_ci_id: int, to_ci_id: int, relation: str, db: Session = Depends(get_db)):
    rel = CMDBRelationship(from_ci_id=from_ci_id, to_ci_id=to_ci_id, relation=relation)
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel


@router.get("/graph/{ci_id}")
def graph(ci_id: int, db: Session = Depends(get_db)):
    outgoing = db.scalars(select(CMDBRelationship).where(CMDBRelationship.from_ci_id == ci_id)).all()
    incoming = db.scalars(select(CMDBRelationship).where(CMDBRelationship.to_ci_id == ci_id)).all()
    return {"outgoing": [r.__dict__ for r in outgoing], "incoming": [r.__dict__ for r in incoming]}

