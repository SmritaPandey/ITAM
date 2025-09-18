import os
import boto3
from botocore.client import Config
from .config import settings


_s3 = None


def get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
    return _s3


def ensure_bucket():
    if settings.storage_backend != "s3":
        return
    s3 = get_s3()
    buckets = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
    if settings.s3_bucket not in buckets:
        s3.create_bucket(Bucket=settings.s3_bucket)


def ensure_fs():
    if settings.storage_backend == "filesystem":
        os.makedirs(settings.attachments_dir, exist_ok=True)

