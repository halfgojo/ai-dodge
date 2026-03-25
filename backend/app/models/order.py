"""Order ORM model."""

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    order_id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), nullable=False)
    order_date: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=True)

    # relationships
    customer = relationship("Customer", back_populates="orders", lazy="selectin")
    invoices = relationship("Invoice", back_populates="order", lazy="selectin")
    shipments = relationship("Shipment", back_populates="order", lazy="selectin")
    order_items = relationship("OrderItem", back_populates="order", lazy="selectin")

    def __repr__(self):
        return f"<Order {self.order_id} [{self.status}]>"
