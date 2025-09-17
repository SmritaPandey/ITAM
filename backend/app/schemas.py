from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel


class RoleOut(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role_name: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    role: RoleOut
    class Config:
        from_attributes = True


class LocationCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class LocationOut(BaseModel):
    id: int
    name: str
    parent_id: Optional[int]
    class Config:
        from_attributes = True


class AssetClassCreate(BaseModel):
    name: str
    description: Optional[str] = None


class AttributeDefinitionCreate(BaseModel):
    asset_class_id: int
    name: str
    data_type: str
    required: bool = False


class AssetCreate(BaseModel):
    tag: str
    name: str
    asset_class_id: int
    purchase_cost: float = 0
    purchase_date: Optional[date] = None
    warranty_end: Optional[date] = None
    vendor_id: Optional[int] = None
    location_id: Optional[int] = None
    assigned_user_id: Optional[int] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    location_id: Optional[int] = None
    assigned_user_id: Optional[int] = None
    warranty_end: Optional[date] = None


class AssetOut(BaseModel):
    id: int
    tag: str
    name: str
    status: str
    asset_class_id: int
    purchase_cost: float
    purchase_date: Optional[date]
    warranty_end: Optional[date]
    location_id: Optional[int]
    assigned_user_id: Optional[int]
    class Config:
        from_attributes = True


class LifecycleEventCreate(BaseModel):
    asset_id: int
    event_type: str
    details: Optional[str] = None
    by_user_id: Optional[int] = None


class LifecycleEventOut(BaseModel):
    id: int
    asset_id: int
    event_type: str
    details: Optional[str]
    at: datetime
    by_user_id: Optional[int]
    class Config:
        from_attributes = True


class BulkUpdateRequest(BaseModel):
    asset_ids: List[int]
    fields: AssetUpdate

