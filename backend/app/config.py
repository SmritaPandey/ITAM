from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://asset:assetpass@db:5432/assetdb"
    jwt_secret: str = "change_me"
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "assets"


settings = Settings()  # type: ignore[arg-type]

