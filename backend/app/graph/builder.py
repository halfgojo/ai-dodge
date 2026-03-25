"""Graph engine — builds the O2C context graph from SQLite data.

Node ID format: "{EntityType}_{PrimaryKey}"  e.g. "Customer_CUST001"
Each node carries its full DB row as metadata.

Relationships:
  Customer  --[PLACED]------> Order
  Order     --[CONTAINS]----> OrderItem
  OrderItem --[REFERENCES]--> Product
  Order     --[BILLED_VIA]--> Invoice
  Invoice   --[SETTLED_BY]--> Payment
  Order     --[FULFILLED_BY]-> Shipment
"""

import logging
import traceback

import networkx as nx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# DB columns that must never overwrite the graph node "id" field
_PROTECTED_KEYS = {"id", "type", "label"}


async def build_full_graph(session: AsyncSession) -> nx.DiGraph:
    """Build the complete O2C context graph from all database tables.

    Raises on unrecoverable DB errors; logs and skips bad individual rows.
    """
    G = nx.DiGraph()

    try:
        # ── Customers ────────────────────────────────────────────────────────
        rows = await session.execute(text("SELECT * FROM customers"))
        customer_count = 0
        for r in rows.mappings():
            d = dict(r)
            try:
                nid = f"Customer_{d['customer_id']}"
                meta = {k: v for k, v in d.items() if k not in _PROTECTED_KEYS}
                G.add_node(nid, type="Customer", label=str(d["customer_id"]), **meta)
                customer_count += 1
            except Exception:
                logger.warning("Skipping bad customer row: %s\n%s", d, traceback.format_exc())
        logger.info("Loaded %d customer nodes", customer_count)

        # ── Products ─────────────────────────────────────────────────────────
        rows = await session.execute(text("SELECT * FROM products"))
        product_count = 0
        for r in rows.mappings():
            d = dict(r)
            try:
                nid = f"Product_{d['product_id']}"
                meta = {k: v for k, v in d.items() if k not in _PROTECTED_KEYS}
                G.add_node(nid, type="Product", label=str(d["product_id"]), **meta)
                product_count += 1
            except Exception:
                logger.warning("Skipping bad product row: %s\n%s", d, traceback.format_exc())
        logger.info("Loaded %d product nodes", product_count)

        # ── Orders + PLACED edges ─────────────────────────────────────────────
        rows = await session.execute(text("SELECT * FROM orders"))
        order_count = 0
        for r in rows.mappings():
            d = dict(r)
            try:
                nid = f"Order_{d['order_id']}"
                cid = f"Customer_{d['customer_id']}"
                meta = {k: v for k, v in d.items() if k not in _PROTECTED_KEYS}
                G.add_node(nid, type="Order", label=str(d["order_id"]), **meta)
                if cid in G:
                    G.add_edge(cid, nid, label="PLACED")
                else:
                    logger.warning("PLACED edge skipped — customer node missing: %s", cid)
                order_count += 1
            except Exception:
                logger.warning("Skipping bad order row: %s\n%s", d, traceback.format_exc())
        logger.info("Loaded %d order nodes", order_count)

        # ── OrderItems + CONTAINS / REFERENCES edges ──────────────────────────
        rows = await session.execute(text("SELECT * FROM order_items"))
        item_count = 0
        for r in rows.mappings():
            d = dict(r)
            try:
                nid = f"OrderItem_{d['order_id']}_{d['product_id']}"
                order_nid = f"Order_{d['order_id']}"
                prod_nid = f"Product_{d['product_id']}"
                meta = {k: v for k, v in d.items() if k not in _PROTECTED_KEYS}
                G.add_node(
                    nid,
                    type="OrderItem",
                    label=f"{d['order_id']}×{d['product_id']}",
                    **meta,
                )
                if order_nid in G:
                    G.add_edge(order_nid, nid, label="CONTAINS")
                else:
                    logger.warning("CONTAINS edge skipped — order node missing: %s", order_nid)
                if prod_nid in G:
                    G.add_edge(nid, prod_nid, label="REFERENCES")
                else:
                    logger.warning("REFERENCES edge skipped — product node missing: %s", prod_nid)
                item_count += 1
            except Exception:
                logger.warning("Skipping bad order_item row: %s\n%s", d, traceback.format_exc())
        logger.info("Loaded %d order-item nodes", item_count)

        # ── Invoices + BILLED_VIA edges ───────────────────────────────────────
        rows = await session.execute(text("SELECT * FROM invoices"))
        invoice_count = 0
        for r in rows.mappings():
            d = dict(r)
            try:
                nid = f"Invoice_{d['invoice_id']}"
                order_nid = f"Order_{d['order_id']}"
                meta = {k: v for k, v in d.items() if k not in _PROTECTED_KEYS}
                G.add_node(nid, type="Invoice", label=str(d["invoice_id"]), **meta)
                if order_nid in G:
                    G.add_edge(order_nid, nid, label="BILLED_VIA")
                else:
                    logger.warning("BILLED_VIA edge skipped — order node missing: %s", order_nid)
                invoice_count += 1
            except Exception:
                logger.warning("Skipping bad invoice row: %s\n%s", d, traceback.format_exc())
        logger.info("Loaded %d invoice nodes", invoice_count)

        # ── Payments + SETTLED_BY edges ───────────────────────────────────────
        rows = await session.execute(text("SELECT * FROM payments"))
        payment_count = 0
        for r in rows.mappings():
            d = dict(r)
            try:
                nid = f"Payment_{d['payment_id']}"
                inv_nid = f"Invoice_{d['invoice_id']}"
                meta = {k: v for k, v in d.items() if k not in _PROTECTED_KEYS}
                G.add_node(nid, type="Payment", label=str(d["payment_id"]), **meta)
                if inv_nid in G:
                    G.add_edge(inv_nid, nid, label="SETTLED_BY")
                else:
                    logger.warning("SETTLED_BY edge skipped — invoice node missing: %s", inv_nid)
                payment_count += 1
            except Exception:
                logger.warning("Skipping bad payment row: %s\n%s", d, traceback.format_exc())
        logger.info("Loaded %d payment nodes", payment_count)

        # ── Shipments + FULFILLED_BY edges ────────────────────────────────────
        rows = await session.execute(text("SELECT * FROM shipments"))
        shipment_count = 0
        for r in rows.mappings():
            d = dict(r)
            try:
                nid = f"Shipment_{d['shipment_id']}"
                order_nid = f"Order_{d['order_id']}"
                meta = {k: v for k, v in d.items() if k not in _PROTECTED_KEYS}
                G.add_node(nid, type="Shipment", label=str(d["shipment_id"]), **meta)
                if order_nid in G:
                    G.add_edge(order_nid, nid, label="FULFILLED_BY")
                else:
                    logger.warning("FULFILLED_BY edge skipped — order node missing: %s", order_nid)
                shipment_count += 1
            except Exception:
                logger.warning("Skipping bad shipment row: %s\n%s", d, traceback.format_exc())
        logger.info("Loaded %d shipment nodes", shipment_count)

    except Exception as exc:
        logger.error("Fatal error building graph:\n%s", traceback.format_exc())
        raise RuntimeError(f"Graph construction failed: {exc}") from exc

    logger.info(
        "Graph built successfully: %d nodes, %d edges",
        G.number_of_nodes(),
        G.number_of_edges(),
    )
    return G


def graph_to_dict(G: nx.DiGraph) -> dict:
    """Serialize graph to { nodes: [...], links: [...] } format.

    Guarantees:
      - Every node has id (string), type (string), label (string)
      - DB fields never overwrite the graph node id
      - Every link's source and target exist in the node id set
      - Invalid nodes / dangling edges are skipped and logged
    """
    node_ids: set[str] = set()
    nodes: list[dict] = []

    # ── Nodes ────────────────────────────────────────────────────────────────
    for raw_id, data in G.nodes(data=True):
        try:
            nid = str(raw_id)
            ntype = data.get("type") or "Unknown"
            nlabel = data.get("label") or nid

            if not nid or not ntype:
                logger.warning("Skipping node with missing id/type: raw_id=%r data=%r", raw_id, data)
                continue

            node: dict = {"id": nid, "type": str(ntype), "label": str(nlabel)}

            # Attach metadata — never overwrite id/type/label
            for k, v in data.items():
                if k not in _PROTECTED_KEYS:
                    node[k] = v

            node_ids.add(nid)
            nodes.append(node)

        except Exception:
            logger.warning("Skipping malformed node raw_id=%r:\n%s", raw_id, traceback.format_exc())

    # ── Links ────────────────────────────────────────────────────────────────
    links: list[dict] = []
    skipped_links = 0

    for raw_src, raw_tgt, data in G.edges(data=True):
        try:
            src = str(raw_src) if raw_src is not None else None
            tgt = str(raw_tgt) if raw_tgt is not None else None

            if not src or not tgt:
                logger.warning("Skipping edge with null endpoint: src=%r tgt=%r", raw_src, raw_tgt)
                skipped_links += 1
                continue

            if src not in node_ids:
                logger.warning("Skipping edge — source not in node set: %r", src)
                skipped_links += 1
                continue

            if tgt not in node_ids:
                logger.warning("Skipping edge — target not in node set: %r", tgt)
                skipped_links += 1
                continue

            links.append({
                "source": src,
                "target": tgt,
                "label": str(data.get("label") or "RELATED"),
            })

        except Exception:
            logger.warning(
                "Skipping malformed edge src=%r tgt=%r:\n%s",
                raw_src, raw_tgt, traceback.format_exc(),
            )
            skipped_links += 1

    if skipped_links:
        logger.warning("Skipped %d invalid edge(s) during serialization", skipped_links)

    logger.info(
        "graph_to_dict: serialized %d nodes, %d links (skipped %d edges)",
        len(nodes), len(links), skipped_links,
    )

    return {"nodes": nodes, "links": links}


def get_entity_subgraph(G: nx.DiGraph, entity_id: str, depth: int = 2) -> nx.DiGraph:
    """Extract a subgraph centered on entity_id up to N hops (bi-directional BFS)."""
    if not entity_id or entity_id not in G:
        logger.warning("Entity not found in graph: %r", entity_id)
        return nx.DiGraph()

    visited: set[str] = {entity_id}
    frontier: set[str] = {entity_id}

    for hop in range(depth):
        next_frontier: set[str] = set()
        for node in frontier:
            next_frontier.update(G.successors(node))
            next_frontier.update(G.predecessors(node))
        new_nodes = next_frontier - visited
        if not new_nodes:
            logger.debug("BFS converged after %d hops", hop + 1)
            break
        visited.update(new_nodes)
        frontier = new_nodes

    sub = G.subgraph(visited).copy()
    logger.info("Subgraph for %r (depth=%d): %d nodes, %d edges", entity_id, depth, sub.number_of_nodes(), sub.number_of_edges())
    return sub


def find_incomplete_chains(G: nx.DiGraph) -> list[dict]:
    """Return orders that are missing invoices, shipments, or unpaid invoices."""
    issues: list[dict] = []
    order_nodes = [n for n, d in G.nodes(data=True) if d.get("type") == "Order"]

    for order_nid in order_nodes:
        successors = list(G.successors(order_nid))
        succ_types = {G.nodes[s].get("type") for s in successors}

        missing: list[str] = []
        if "Invoice" not in succ_types:
            missing.append("invoice")
        if "Shipment" not in succ_types:
            missing.append("shipment")

        for s in successors:
            if G.nodes[s].get("type") == "Invoice":
                inv_succ_types = {G.nodes[t].get("type") for t in G.successors(s)}
                if "Payment" not in inv_succ_types:
                    missing.append(f"payment for {G.nodes[s].get('label', s)}")

        if missing:
            issues.append({
                "order_id": order_nid,
                "status": G.nodes[order_nid].get("status", "unknown"),
                "missing": missing,
            })

    return issues
