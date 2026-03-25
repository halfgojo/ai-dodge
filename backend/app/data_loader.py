"""CSV data loader — reads CSVs from /data and inserts into SQLite on startup."""

import logging
from pathlib import Path

import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session, engine

logger = logging.getLogger(__name__)

# Map CSV filename → table name
CSV_TABLE_MAP = {
    "customers.csv": "customers",
    "products.csv": "products",
    "orders.csv": "orders",
    "order_items.csv": "order_items",
    "invoices.csv": "invoices",
    "payments.csv": "payments",
    "shipments.csv": "shipments",
}

# Load order matters: parents before children (FK constraints)
LOAD_ORDER = [
    "customers.csv",
    "products.csv",
    "orders.csv",
    "order_items.csv",
    "invoices.csv",
    "payments.csv",
    "shipments.csv",
]


async def _table_has_data(session: AsyncSession, table_name: str) -> bool:
    """Check if a table already has rows (skip reload)."""
    result = await session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
    count = result.scalar()
    return count > 0


async def load_csv_data():
    """Load all CSV files into SQLite. Skips tables that already have data."""
    data_dir = Path(settings.data_dir)

    if not data_dir.exists():
        logger.warning(f"Data directory not found: {data_dir}")
        return

    async with async_session() as session:
        for csv_file in LOAD_ORDER:
            csv_path = data_dir / csv_file
            table_name = CSV_TABLE_MAP[csv_file]

            if not csv_path.exists():
                logger.warning(f"CSV file not found: {csv_path}")
                continue

            # skip if already loaded
            if await _table_has_data(session, table_name):
                logger.info(f"Table '{table_name}' already has data — skipping")
                continue

            # read CSV with pandas
            df = pd.read_csv(csv_path)
            df = df.where(pd.notnull(df), None)  # convert NaN → None

            # insert rows via raw SQL (avoids ORM overhead for bulk load)
            columns = df.columns.tolist()
            placeholders = ", ".join([f":{col}" for col in columns])
            col_names = ", ".join(columns)

            insert_sql = text(
                f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders})"
            )

            rows = df.to_dict(orient="records")
            for row in rows:
                await session.execute(insert_sql, row)

            await session.commit()
            logger.info(f"Loaded {len(rows)} rows into '{table_name}' from {csv_file}")

    logger.info("CSV data loading complete")
