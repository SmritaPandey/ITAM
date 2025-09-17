from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from ..config import settings
from ..startup import SessionLocal
from ..models import User, Role

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginIn(BaseModel):
    username: str
    password: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    now = datetime.utcnow()
    token = jwt.encode(
        {
            "sub": user.username,
            "uid": user.id,
            "role": user.role.name,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=12)).timestamp()),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    return TokenOut(access_token=token)

