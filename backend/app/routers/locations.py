from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..startup import SessionLocal
from ..models import Location
from ..schemas import LocationCreate, LocationOut

router = APIRouter(prefix="/locations", tags=["locations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=LocationOut)
def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    location = Location(name=payload.name, parent_id=payload.parent_id)
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("/", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db)):
    return db.scalars(select(Location)).all()

