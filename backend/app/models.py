from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Float,
    Boolean,
    Date,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship, Session


Base = declarative_base()


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    role = relationship("Role")


class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), unique=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    parent = relationship("Location", remote_side=[id])


class AssetClass(Base):
    __tablename__ = "asset_classes"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)


class AttributeDefinition(Base):
    __tablename__ = "attribute_definitions"
    id = Column(Integer, primary_key=True)
    asset_class_id = Column(Integer, ForeignKey("asset_classes.id"), nullable=False)
    name = Column(String(100), nullable=False)
    data_type = Column(String(50), nullable=False)  # string, number, date, boolean
    required = Column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("asset_class_id", "name", name="uq_attrdef_class_name"),)


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    tag = Column(String(100), unique=True, nullable=False)  # barcode/asset tag
    name = Column(String(200), nullable=False)
    asset_class_id = Column(Integer, ForeignKey("asset_classes.id"), nullable=False)
    asset_class = relationship("AssetClass")
    status = Column(String(50), default="in_stock")  # in_stock, assigned, loaned, retired, disposed
    purchase_cost = Column(Float, default=0)
    purchase_date = Column(Date, nullable=True)
    warranty_end = Column(Date, nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    useful_life_months = Column(Integer, nullable=True)
    remote_access_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class AssetAttributeValue(Base):
    __tablename__ = "asset_attribute_values"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    attribute_definition_id = Column(Integer, ForeignKey("attribute_definitions.id"), nullable=False)
    value = Column(Text, nullable=True)
    source = Column(String(20), default="initial")  # initial or discovery
    __table_args__ = (UniqueConstraint("asset_id", "attribute_definition_id", name="uq_asset_attr"),)


class LifecycleEvent(Base):
    __tablename__ = "lifecycle_events"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # provisioned, assigned, moved, maintained, retired, disposed
    details = Column(Text, nullable=True)
    at = Column(DateTime, default=datetime.utcnow)
    by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    entity = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False)  # create, update, delete
    before = Column(Text, nullable=True)
    after = Column(Text, nullable=True)
    at = Column(DateTime, default=datetime.utcnow)
    by_user = Column(String(100), nullable=True)


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    s3_key = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), unique=True, nullable=False)
    rating = Column(Float, default=0)
    contact = Column(String(200), nullable=True)


class Contract(Base):
    __tablename__ = "contracts"
    id = Column(Integer, primary_key=True)
    contract_number = Column(String(100), unique=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    terms = Column(Text, nullable=True)


class ContractAsset(Base):
    __tablename__ = "contract_assets"
    id = Column(Integer, primary_key=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    __table_args__ = (UniqueConstraint("contract_id", "asset_id", name="uq_contract_asset"),)


class CatalogItem(Base):
    __tablename__ = "catalog_items"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    asset_class_id = Column(Integer, ForeignKey("asset_classes.id"), nullable=False)
    approved = Column(Boolean, default=False)
    approved_by_role = Column(String(100), nullable=True)
    threshold_value = Column(Float, default=0)
    recommended_vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    alternative_catalog_item_id = Column(Integer, ForeignKey("catalog_items.id"), nullable=True)
    stock_quantity = Column(Integer, default=0)
    reorder_point = Column(Integer, default=0)
    reorder_vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)


class BundleItem(Base):
    __tablename__ = "bundle_items"
    id = Column(Integer, primary_key=True)
    bundle_id = Column(Integer, ForeignKey("catalog_items.id"), nullable=False)
    catalog_item_id = Column(Integer, ForeignKey("catalog_items.id"), nullable=False)


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"
    id = Column(Integer, primary_key=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), default="draft")  # draft, approved, ordered, received
    created_at = Column(DateTime, default=datetime.utcnow)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(Integer, primary_key=True)
    pr_id = Column(Integer, ForeignKey("purchase_requests.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    status = Column(String(50), default="open")  # open, delivered, closed
    created_at = Column(DateTime, default=datetime.utcnow)


class POLineItem(Base):
    __tablename__ = "po_line_items"
    id = Column(Integer, primary_key=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    catalog_item_id = Column(Integer, ForeignKey("catalog_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Float, nullable=False)


class ContractPOLink(Base):
    __tablename__ = "contract_po_links"
    id = Column(Integer, primary_key=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    po_line_item_id = Column(Integer, ForeignKey("po_line_items.id"), nullable=False)
    __table_args__ = (UniqueConstraint("contract_id", "po_line_item_id", name="uq_contract_po"),)


class CostRecord(Base):
    __tablename__ = "cost_records"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    cost_type = Column(String(50), nullable=False)  # purchase, maintenance, addon
    amount = Column(Float, nullable=False)
    at = Column(DateTime, default=datetime.utcnow)


class LoanRecord(Base):
    __tablename__ = "loan_records"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="open")  # open, closed
    loaned_at = Column(DateTime, default=datetime.utcnow)
    returned_at = Column(DateTime, nullable=True)
    due_date = Column(Date, nullable=True)


class AssetLink(Base):
    __tablename__ = "asset_links"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    itil_type = Column(String(50), nullable=False)  # incident, problem, change, etc.
    external_id = Column(String(100), nullable=False)
    __table_args__ = (UniqueConstraint("asset_id", "itil_type", "external_id", name="uq_asset_link"),)


class CMDBItem(Base):
    __tablename__ = "cmdb_items"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    ci_type = Column(String(100), nullable=False)


class CMDBRelationship(Base):
    __tablename__ = "cmdb_relationships"
    id = Column(Integer, primary_key=True)
    from_ci_id = Column(Integer, ForeignKey("cmdb_items.id"), nullable=False)
    to_ci_id = Column(Integer, ForeignKey("cmdb_items.id"), nullable=False)
    relation = Column(String(100), nullable=False)  # depends_on, connected_to


def ensure_initial_roles(db: Session) -> None:
    from sqlalchemy import select
    roles = ["Admin", "AssetManager", "ProcurementManager", "ContractManager", "CMDBManager", "StandardUser"]
    existing = {r.name for r in db.scalars(select(Role)).all()}
    for name in roles:
        if name not in existing:
            db.add(Role(name=name))
    db.commit()

