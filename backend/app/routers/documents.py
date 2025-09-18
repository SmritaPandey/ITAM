from fastapi import APIRouter, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session
import uuid
from ..storage import get_s3
from ..config import settings
import os
from ..startup import SessionLocal
from ..models import Document

router = APIRouter(prefix="/documents", tags=["documents"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/")
async def upload_document(asset_id: int = Form(None), file: UploadFile = File(...), db: Session = Depends(get_db)):
    key = f"uploads/{uuid.uuid4()}-{file.filename}"
    if settings.storage_backend == "filesystem":
        path = os.path.join(settings.attachments_dir, key.replace("/", "_"))
        with open(path, "wb") as f:
            f.write(await file.read())
    else:
        s3 = get_s3()
        s3.upload_fileobj(file.file, settings.s3_bucket, key, ExtraArgs={"ContentType": file.content_type})
    doc = Document(asset_id=asset_id, filename=file.filename, content_type=file.content_type, s3_key=key)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "filename": doc.filename}

