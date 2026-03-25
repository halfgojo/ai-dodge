"""Invoice ORM model."""

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    invoice_id: Mapped[str] = mapped_column(String, primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.order_id"), nullable=False)
    invoice_date: Mapped[str] = mapped_column(String, nullable=True)
    due_date: Mapped[str] = mapped_column(String, nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)

    # relationships
    order = relationship("Order", back_populates="invoices", lazy="selectin")
    payments = relationship("Payment", back_populates="invoice", lazy="selectin")

    def __repr__(self):
        return f"<Invoice {self.invoice_id} [{self.status}]>"
