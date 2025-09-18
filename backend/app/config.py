from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/asset.db"
    jwt_secret: str = "change_me"
    storage_backend: str = "filesystem"  # filesystem or s3
    attachments_dir: str = "./data/attachments"
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "assets"


settings = Settings()  # type: ignore[arg-type]

