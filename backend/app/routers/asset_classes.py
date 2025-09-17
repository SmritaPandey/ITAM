from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..startup import SessionLocal
from ..models import AssetClass, AttributeDefinition
from ..schemas import AssetClassCreate, AttributeDefinitionCreate
from ..security import require_roles

router = APIRouter(prefix="/asset-classes", tags=["asset-classes"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", dependencies=[Depends(require_roles("Admin", "AssetManager"))])
def create_class(payload: AssetClassCreate, db: Session = Depends(get_db)):
    if db.scalar(select(AssetClass).where(AssetClass.name == payload.name)):
        raise HTTPException(status_code=400, detail="Class exists")
    ac = AssetClass(name=payload.name, description=payload.description)
    db.add(ac)
    db.commit()
    db.refresh(ac)
    return {"id": ac.id, "name": ac.name}


@router.post("/attributes", dependencies=[Depends(require_roles("Admin", "AssetManager"))])
def add_attribute(payload: AttributeDefinitionCreate, db: Session = Depends(get_db)):
    ad = AttributeDefinition(**payload.model_dump())
    db.add(ad)
    db.commit()
    db.refresh(ad)
    return {"id": ad.id, "name": ad.name}


@router.get("/",)
def list_classes(db: Session = Depends(get_db)):
    return db.scalars(select(AssetClass)).all()

