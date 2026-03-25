"""Pydantic schemas for API request/response validation."""

from pydantic import BaseModel, ConfigDict


# ── Customer ──
class CustomerBase(BaseModel):
    customer_id: str
    name: str
    email: str | None = None
    segment: str | None = None
    region: str | None = None
    created_at: str | None = None


class CustomerOut(CustomerBase):
    class Config:
        from_attributes = True


# ── Product ──
class ProductBase(BaseModel):
    product_id: str
    name: str
    category: str | None = None
    unit_price: float | None = None


class ProductOut(ProductBase):
    class Config:
        from_attributes = True


# ── Order ──
class OrderBase(BaseModel):
    order_id: str
    customer_id: str
    order_date: str | None = None
    status: str | None = None
    total_amount: float | None = None


class OrderOut(OrderBase):
    class Config:
        from_attributes = True


# ── Invoice ──
class InvoiceBase(BaseModel):
    invoice_id: str
    order_id: str
    invoice_date: str | None = None
    due_date: str | None = None
    amount: float | None = None
    status: str | None = None


class InvoiceOut(InvoiceBase):
    class Config:
        from_attributes = True


# ── Payment ──
class PaymentBase(BaseModel):
    payment_id: str
    invoice_id: str
    payment_date: str | None = None
    amount: float | None = None
    method: str | None = None


class PaymentOut(PaymentBase):
    class Config:
        from_attributes = True


# ── Shipment ──
class ShipmentBase(BaseModel):
    shipment_id: str
    order_id: str
    ship_date: str | None = None
    delivery_date: str | None = None
    carrier: str | None = None
    tracking_number: str | None = None
    status: str | None = None


class ShipmentOut(ShipmentBase):
    class Config:
        from_attributes = True


# ── OrderItem ──
class OrderItemOut(BaseModel):
    id: int
    order_id: str
    product_id: str
    quantity: int | None = None
    line_total: float | None = None

    class Config:
        from_attributes = True


# ── Graph-specific schemas ──
class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # customer, order, invoice, payment, shipment, product
    
    model_config = ConfigDict(extra="allow")


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str  # e.g. PLACED, invoiced, paid, shipped, contains

    model_config = ConfigDict(extra="allow")


class GraphData(BaseModel):
    nodes: list[dict]  # Use dict to allow flexibility
    links: list[dict]
    metadata: dict = {}


# ── Common ──
class HealthCheck(BaseModel):
    status: str = "ok"
    app_name: str
    total_records: dict = {}
