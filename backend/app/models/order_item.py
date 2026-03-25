"""OrderItem ORM model — junction table between Orders and Products."""

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderItem(Base):
    __tablename__ = "order_items"

    # composite-ish key — use both as PK via a surrogate id
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.order_id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.product_id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=True)
    line_total: Mapped[float] = mapped_column(Float, nullable=True)

    # relationships
    order = relationship("Order", back_populates="order_items", lazy="selectin")
    product = relationship("Product", lazy="selectin")

    def __repr__(self):
        return f"<OrderItem {self.order_id}×{self.product_id} qty={self.quantity}>"
