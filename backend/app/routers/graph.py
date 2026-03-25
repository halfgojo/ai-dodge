"""Graph API router — endpoints for graph queries and analysis."""

import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.graph.builder import (
    build_full_graph,
    find_incomplete_chains,
    get_entity_subgraph,
    graph_to_dict,
)
from app.schemas.schemas import GraphData

logger = logging.getLogger(__name__)

graph_router = APIRouter(prefix="/api/graph", tags=["Graph"])


@graph_router.get("/full", response_model=GraphData)
async def get_full_graph(db: AsyncSession = Depends(get_db)):
    """Return the complete O2C context graph."""
    try:
        G = await build_full_graph(db)
    except Exception as exc:
        logger.error("build_full_graph raised an exception:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Graph construction failed: {str(exc)}",
        ) from exc

    try:
        result = graph_to_dict(G)
    except Exception as exc:
        logger.error("graph_to_dict raised an exception:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Graph serialization failed: {str(exc)}",
        ) from exc

    # ── Validation ───────────────────────────────────────────────────────────
    node_ids: set[str] = set()
    bad_nodes = 0
    for node in result["nodes"]:
        nid = node.get("id")
        if not nid or not isinstance(nid, str):
            logger.error("Node missing string id: %r", node)
            bad_nodes += 1
            continue
        if not node.get("type"):
            logger.error("Node missing type: %r", node)
            bad_nodes += 1
            continue
        if not node.get("label"):
            logger.error("Node missing label: %r", node)
            bad_nodes += 1
            continue
        node_ids.add(nid)

    bad_links = 0
    for link in result["links"]:
        src = link.get("source")
        tgt = link.get("target")
        if not src or src not in node_ids:
            logger.error("Link source missing or not in nodes: %r", link)
            bad_links += 1
        if not tgt or tgt not in node_ids:
            logger.error("Link target missing or not in nodes: %r", link)
            bad_links += 1

    if bad_nodes or bad_links:
        logger.warning(
            "Graph validation: %d bad node(s), %d bad link endpoint(s) detected",
            bad_nodes, bad_links,
        )
    else:
        logger.info(
            "Graph validation passed: %d nodes, %d links — all IDs are strings and all edges are valid",
            len(result["nodes"]), len(result["links"]),
        )

    logger.info(
        "GET /api/graph/full → %d nodes, %d links",
        len(result["nodes"]), len(result["links"]),
    )
    return result


@graph_router.get("/entity/{entity_id}", response_model=GraphData)
async def get_entity_graph(
    entity_id: str,
    depth: int = Query(default=2, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
):
    """Return a subgraph centred on a specific entity."""
    try:
        G = await build_full_graph(db)
    except Exception as exc:
        logger.error("build_full_graph failed for entity %r:\n%s", entity_id, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Graph construction failed: {str(exc)}") from exc

    subgraph = get_entity_subgraph(G, entity_id, depth=depth)

    if subgraph.number_of_nodes() == 0:
        raise HTTPException(status_code=404, detail=f"Entity '{entity_id}' not found in graph")

    try:
        result = graph_to_dict(subgraph)
    except Exception as exc:
        logger.error("graph_to_dict failed for subgraph of %r:\n%s", entity_id, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Subgraph serialization failed: {str(exc)}") from exc

    logger.info(
        "GET /api/graph/entity/%s?depth=%d → %d nodes, %d links",
        entity_id, depth, len(result["nodes"]), len(result["links"]),
    )
    return result


@graph_router.get("/incomplete-chains")
async def get_incomplete_chains(db: AsyncSession = Depends(get_db)):
    """Find orders with missing invoices, payments, or shipments."""
    try:
        G = await build_full_graph(db)
    except Exception as exc:
        logger.error("build_full_graph failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Graph construction failed: {str(exc)}") from exc

    issues = find_incomplete_chains(G)
    logger.info("GET /api/graph/incomplete-chains → %d issues", len(issues))
    return {"total_issues": len(issues), "issues": issues}


@graph_router.get("/stats")
async def get_graph_stats(db: AsyncSession = Depends(get_db)):
    """Return summary statistics about the O2C graph."""
    try:
        G = await build_full_graph(db)
    except Exception as exc:
        logger.error("build_full_graph failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Graph construction failed: {str(exc)}") from exc

    type_counts: dict[str, int] = {}
    for _, data in G.nodes(data=True):
        t = data.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1

    link_counts: dict[str, int] = {}
    for _, _, data in G.edges(data=True):
        lbl = data.get("label", "unknown")
        link_counts[lbl] = link_counts.get(lbl, 0) + 1

    stats = {
        "total_nodes": G.number_of_nodes(),
        "total_links": G.number_of_edges(),
        "nodes_by_type": type_counts,
        "links_by_label": link_counts,
    }
    logger.info("GET /api/graph/stats → %s", stats)
    return stats
