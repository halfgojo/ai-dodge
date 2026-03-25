"""Shipment ORM model."""

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id: Mapped[str] = mapped_column(String, primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.order_id"), nullable=False)
    ship_date: Mapped[str] = mapped_column(String, nullable=True)
    delivery_date: Mapped[str] = mapped_column(String, nullable=True)
    carrier: Mapped[str] = mapped_column(String, nullable=True)
    tracking_number: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)

    # relationships
    order = relationship("Order", back_populates="shipments", lazy="selectin")

    def __repr__(self):
        return f"<Shipment {self.shipment_id} [{self.status}]>"
