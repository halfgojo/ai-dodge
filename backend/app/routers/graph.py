"""Graph API router — endpoints for graph queries and analysis."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.graph.builder import build_full_graph, graph_to_dict, get_entity_subgraph, find_incomplete_chains
from app.schemas.schemas import GraphData

graph_router = APIRouter(prefix="/api/graph", tags=["Graph"])


@graph_router.get("/full", response_model=GraphData)
async def get_full_graph(db: AsyncSession = Depends(get_db)):
    """Return the complete O2C context graph."""
    G = await build_full_graph(db)
    return graph_to_dict(G)


@graph_router.get("/entity/{entity_id}", response_model=GraphData)
async def get_entity_graph(
    entity_id: str,
    depth: int = Query(default=2, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
):
    """Return a subgraph centered on a specific entity."""
    G = await build_full_graph(db)
    subgraph = get_entity_subgraph(G, entity_id, depth=depth)

    if subgraph.number_of_nodes() == 0:
        raise HTTPException(status_code=404, detail=f"Entity '{entity_id}' not found in graph")

    return graph_to_dict(subgraph)


@graph_router.get("/incomplete-chains")
async def get_incomplete_chains(db: AsyncSession = Depends(get_db)):
    """Find orders with missing invoices, payments, or shipments."""
    G = await build_full_graph(db)
    issues = find_incomplete_chains(G)
    return {
        "total_issues": len(issues),
        "issues": issues,
    }


@graph_router.get("/stats")
async def get_graph_stats(db: AsyncSession = Depends(get_db)):
    """Return summary statistics about the O2C graph."""
    G = await build_full_graph(db)

    type_counts = {}
    for _, data in G.nodes(data=True):
        node_type = data.get("type", "unknown")
        type_counts[node_type] = type_counts.get(node_type, 0) + 1

    link_counts = {}
    for _, _, data in G.edges(data=True):
        lbl = data.get("label", "unknown")
        link_counts[lbl] = link_counts.get(lbl, 0) + 1

    return {
        "total_nodes": G.number_of_nodes(),
        "total_links": G.number_of_edges(),
        "nodes_by_type": type_counts,
        "links_by_label": link_counts,
    }
