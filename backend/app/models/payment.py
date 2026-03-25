"""Payment ORM model."""

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    payment_id: Mapped[str] = mapped_column(String, primary_key=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.invoice_id"), nullable=False)
    payment_date: Mapped[str] = mapped_column(String, nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=True)
    method: Mapped[str] = mapped_column(String, nullable=True)

    # relationships
    invoice = relationship("Invoice", back_populates="payments", lazy="selectin")

    def __repr__(self):
        return f"<Payment {self.payment_id} ${self.amount}>"
