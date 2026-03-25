"""Graph engine — builds the O2C context graph from SQLite data.

Node ID format: "{EntityType}_{PrimaryKey}" e.g. "Customer_CUST001"
Each node carries its full CSV row as metadata.

Confirmed edges:
  Customer → Order       : PLACED
  Order    → OrderItem   : CONTAINS
  OrderItem→ Product     : REFERENCES
  Order    → Shipment    : FULFILLED_BY
  Order    → Invoice     : BILLED_VIA
  Invoice  → Payment     : SETTLED_BY
"""

import networkx as nx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def build_full_graph(session: AsyncSession) -> nx.DiGraph:
    """Build the complete O2C context graph from all database tables."""
    G = nx.DiGraph()

    # ── Customer nodes ──
    rows = await session.execute(text("SELECT * FROM customers"))
    for r in rows.mappings():
        d = dict(r)
        G.add_node(f"Customer_{d['customer_id']}", type="Customer", label=d["customer_id"], **d)

    # ── Product nodes ──
    rows = await session.execute(text("SELECT * FROM products"))
    for r in rows.mappings():
        d = dict(r)
        G.add_node(f"Product_{d['product_id']}", type="Product", label=d["product_id"], **d)

    # ── Order nodes + PLACED edges ──
    rows = await session.execute(text("SELECT * FROM orders"))
    for r in rows.mappings():
        d = dict(r)
        G.add_node(f"Order_{d['order_id']}", type="Order", label=d["order_id"], **d)
        G.add_edge(f"Customer_{d['customer_id']}", f"Order_{d['order_id']}", label="PLACED")

    # ── OrderItem nodes + CONTAINS / REFERENCES edges ──
    rows = await session.execute(text("SELECT rowid, * FROM order_items"))
    for r in rows.mappings():
        d = dict(r)
        item_id = f"OrderItem_{d['order_id']}_{d['product_id']}"
        G.add_node(item_id, type="OrderItem", label=f"{d['order_id']}×{d['product_id']}", **d)
        G.add_edge(f"Order_{d['order_id']}", item_id, label="CONTAINS")
        G.add_edge(item_id, f"Product_{d['product_id']}", label="REFERENCES")

    # ── Invoice nodes + BILLED_VIA edges ──
    rows = await session.execute(text("SELECT * FROM invoices"))
    for r in rows.mappings():
        d = dict(r)
        G.add_node(f"Invoice_{d['invoice_id']}", type="Invoice", label=d["invoice_id"], **d)
        G.add_edge(f"Order_{d['order_id']}", f"Invoice_{d['invoice_id']}", label="BILLED_VIA")

    # ── Payment nodes + SETTLED_BY edges ──
    rows = await session.execute(text("SELECT * FROM payments"))
    for r in rows.mappings():
        d = dict(r)
        G.add_node(f"Payment_{d['payment_id']}", type="Payment", label=d["payment_id"], **d)
        G.add_edge(f"Invoice_{d['invoice_id']}", f"Payment_{d['payment_id']}", label="SETTLED_BY")

    # ── Shipment nodes + FULFILLED_BY edges ──
    rows = await session.execute(text("SELECT * FROM shipments"))
    for r in rows.mappings():
        d = dict(r)
        G.add_node(f"Shipment_{d['shipment_id']}", type="Shipment", label=d["shipment_id"], **d)
        G.add_edge(f"Order_{d['order_id']}", f"Shipment_{d['shipment_id']}", label="FULFILLED_BY")

    return G


def graph_to_dict(G: nx.DiGraph) -> dict:
    """Serialize graph to { nodes: [...], links: [...] } format."""
    nodes = []
    for node_id, data in G.nodes(data=True):
        node = {"id": node_id, "type": data.get("type", "Unknown"), "label": data.get("label", node_id)}
        # attach all remaining metadata
        for k, v in data.items():
            if k not in ("type", "label"):
                node[k] = v
        nodes.append(node)

    links = []
    for source, target, data in G.edges(data=True):
        links.append({
            "source": source,
            "target": target,
            "label": data.get("label", "RELATED"),
        })

    return {"nodes": nodes, "links": links}


def get_entity_subgraph(G: nx.DiGraph, entity_id: str, depth: int = 2) -> nx.DiGraph:
    """Extract a subgraph centered on a specific entity up to N hops."""
    if entity_id not in G:
        return nx.DiGraph()

    nodes = {entity_id}
    frontier = {entity_id}
    for _ in range(depth):
        next_frontier = set()
        for node in frontier:
            next_frontier.update(G.successors(node))
            next_frontier.update(G.predecessors(node))
        nodes.update(next_frontier)
        frontier = next_frontier

    return G.subgraph(nodes).copy()


def find_incomplete_chains(G: nx.DiGraph) -> list[dict]:
    """Find orders missing invoices, payments, or shipments."""
    issues = []
    order_nodes = [n for n, d in G.nodes(data=True) if d.get("type") == "Order"]

    for order_id in order_nodes:
        successors = list(G.successors(order_id))
        succ_types = {G.nodes[s].get("type") for s in successors}

        missing = []
        if "Invoice" not in succ_types:
            missing.append("invoice")
        if "Shipment" not in succ_types:
            missing.append("shipment")

        # check invoices for payments
        for s in successors:
            if G.nodes[s].get("type") == "Invoice":
                inv_succ_types = {G.nodes[t].get("type") for t in G.successors(s)}
                if "Payment" not in inv_succ_types:
                    missing.append(f"payment for {G.nodes[s].get('label', s)}")

        if missing:
            issues.append({
                "order_id": order_id,
                "status": G.nodes[order_id].get("status", "unknown"),
                "missing": missing,
            })

    return issues


def print_graph_summary(G: nx.DiGraph):
    """Print node/edge counts and sample nodes — for verification."""
    # node counts by type
    type_counts = {}
    for _, d in G.nodes(data=True):
        t = d.get("type", "Unknown")
        type_counts[t] = type_counts.get(t, 0) + 1

    # edge counts by label
    edge_counts = {}
    for _, _, d in G.edges(data=True):
        lbl = d.get("label", "UNKNOWN")
        edge_counts[lbl] = edge_counts.get(lbl, 0) + 1

    print("\n=== Node counts by type ===")
    for t, c in sorted(type_counts.items()):
        print(f"  {t}: {c}")
    print(f"  TOTAL: {G.number_of_nodes()}")

    print("\n=== Edge counts by relationship ===")
    for lbl, c in sorted(edge_counts.items()):
        print(f"  {lbl}: {c}")
    print(f"  TOTAL: {G.number_of_edges()}")

    # 2 example nodes
    print("\n=== 2 Example nodes with metadata ===")
    for i, (nid, data) in enumerate(G.nodes(data=True)):
        if i >= 2:
            break
        print(f"  {nid}: {dict(data)}")
