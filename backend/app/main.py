"""FastAPI application factory — entry point for the O2C Context Graph backend."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.data_loader import load_csv_data

# Import all models so Base.metadata.create_all() sees them
from app.models import customer, product, order, order_item, invoice, payment, shipment  # noqa: F401

from app.routers.entities import (
    customers_router,
    products_router,
    orders_router,
    invoices_router,
    payments_router,
    shipments_router,
)
from app.routers.graph import graph_router
from app.routers.chat import chat_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables → load CSV data. Shutdown: cleanup."""
    logger.info(f"Starting {settings.app_name}...")

    # create tables
    await init_db()
    logger.info("Database tables created")

    # load CSV data
    await load_csv_data()
    logger.info("CSV data loaded")

    yield  # app is running

    logger.info("Shutting down...")


app = FastAPI(
    title=settings.app_name,
    description="Order-to-Cash Context Graph System — models the O2C lifecycle as a connected graph.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# register routers
app.include_router(customers_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(invoices_router)
app.include_router(payments_router)
app.include_router(shipments_router)
app.include_router(graph_router)
app.include_router(chat_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app_name": settings.app_name}
