"""API routers for O2C entities."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.schemas import (
    CustomerOut, OrderOut, InvoiceOut, PaymentOut, ShipmentOut, ProductOut, OrderItemOut,
)

# ── Customers ──
customers_router = APIRouter(prefix="/api/customers", tags=["Customers"])


@customers_router.get("", response_model=list[CustomerOut])
async def list_customers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM customers"))
    return [dict(row) for row in result.mappings()]


@customers_router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM customers WHERE customer_id = :id"), {"id": customer_id}
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return dict(row)


# ── Products ──
products_router = APIRouter(prefix="/api/products", tags=["Products"])


@products_router.get("", response_model=list[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM products"))
    return [dict(row) for row in result.mappings()]


# ── Orders ──
orders_router = APIRouter(prefix="/api/orders", tags=["Orders"])


@orders_router.get("", response_model=list[OrderOut])
async def list_orders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM orders"))
    return [dict(row) for row in result.mappings()]


@orders_router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM orders WHERE order_id = :id"), {"id": order_id}
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    return dict(row)


@orders_router.get("/{order_id}/items", response_model=list[OrderItemOut])
async def get_order_items(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM order_items WHERE order_id = :id"), {"id": order_id}
    )
    return [dict(row) for row in result.mappings()]


# ── Invoices ──
invoices_router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


@invoices_router.get("", response_model=list[InvoiceOut])
async def list_invoices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM invoices"))
    return [dict(row) for row in result.mappings()]


@invoices_router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM invoices WHERE invoice_id = :id"), {"id": invoice_id}
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return dict(row)


# ── Payments ──
payments_router = APIRouter(prefix="/api/payments", tags=["Payments"])


@payments_router.get("", response_model=list[PaymentOut])
async def list_payments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM payments"))
    return [dict(row) for row in result.mappings()]


# ── Shipments ──
shipments_router = APIRouter(prefix="/api/shipments", tags=["Shipments"])


@shipments_router.get("", response_model=list[ShipmentOut])
async def list_shipments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM shipments"))
    return [dict(row) for row in result.mappings()]
