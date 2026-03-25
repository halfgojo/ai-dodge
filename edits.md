# Edits & Changes Log — AI Dodge (Order-to-Cash Context Graph)

---

## Session 1 — Initial Project Upload

### What was done
- Initialized a Git repository in `/Users/amanjoshi/Desktop/ai-dodge`
- Added remote origin: `https://github.com/halfgojo/ai-dodge.git`
- Staged and committed all 88 project files in one initial commit
- Pushed to GitHub on the `master` branch

### Files committed
- `backend/` — Full FastAPI backend (app, models, routers, graph engine, data loader)
- `frontend/` — React + Vite frontend (App.jsx, main.jsx, index.html, config files)
- `data/` — 7 CSV files (customers, products, orders, order_items, invoices, payments, shipments)
- `sap-o2c-data/` — SAP reference JSONL data files
- `.gitignore`

---

## Session 2 — Bug Fixes & Frontend Improvements

### Problems identified

#### 1. Graph failed to load (HTTP 500)
- **Root cause A**: Multiple stale backend processes were all bound to port 8000 simultaneously (PIDs 30113, 37278, 37660). This caused port conflicts and the proxy from Vite to the backend was hitting a dead process.
- **Root cause B**: The `id` column from the `order_items` SQLite table (an integer auto-increment primary key) was being unpacked into the NetworkX node attributes via `**d`. When `graph_to_dict()` later looped over node attributes to build the JSON response, it wrote `node["id"] = 1` (the DB integer), overwriting the correct graph node ID string `"OrderItem_ORD001_PROD001"`. This meant every OrderItem node had an integer ID in the response while all links still referenced the original string IDs — breaking the graph entirely.

#### 2. No node labels on the graph
- The `ForceGraph2D` component was using `nodeAutoColorBy="type"` but had no label rendering. Users saw only plain colored dots with no way to identify what each node was.

#### 3. No edge direction or edge labels
- Links had no directional arrows, making it impossible to tell the flow direction (e.g. Order → Invoice vs Invoice → Order).
- Edge relationship labels (PLACED, BILLED_VIA, SETTLED_BY, etc.) were not rendered on the canvas.

#### 4. Inconsistent dark theme
- The graph canvas background was `#f8f9fa` (near-white) while the rest of the UI was dark (`#0f1117`, `#13151f`). This created a jarring visual mismatch.

#### 5. No node type legend
- The `nodeAutoColorBy` prop assigned colors automatically but there was no legend explaining what color maps to what entity type.

#### 6. No subgraph expand functionality
- The node detail panel showed metadata on click but there was no way to expand a node's neighbourhood or zoom into a subgraph.

#### 7. No way to return from subgraph to full graph
- Once in a subgraph (if it existed), there was no reset/back button.

#### 8. Chat UX issues
- Messages did not auto-scroll to the latest message.
- No example queries shown to guide the user.
- No data table preview for query results — users had to mentally parse the response text to understand tabular data.

#### 9. Redundant `rowid` column in order_items query
- `builder.py` used `SELECT rowid, * FROM order_items` which returned both `rowid` and `id` as separate fields with the same value, polluting the node metadata.

---

### Changes made

#### `backend/app/graph/builder.py`

**Change 1 — Removed redundant `rowid` from order_items query**
```python
# Before
rows = await session.execute(text("SELECT rowid, * FROM order_items"))

# After
rows = await session.execute(text("SELECT * FROM order_items"))
```

**Change 2 — Fixed node ID overwrite in `graph_to_dict()`**
```python
# Before
for k, v in data.items():
    if k not in ("type", "label"):
        node[k] = v

# After
for k, v in data.items():
    if k not in ("type", "label", "id"):   # "id" excluded to protect graph node ID
        node[k] = v
```
This prevented the integer DB primary key from clobbering the string graph node ID (e.g. `"OrderItem_ORD001_PROD001"`).

---

#### `frontend/src/App.jsx` — Full rewrite

**Color palette**
- Replaced `nodeAutoColorBy="type"` (random colors) with an explicit `TYPE_COLORS` map:
  - Customer: `#6495ED` (cornflower blue)
  - Order: `#FFA07A` (light salmon)
  - Product: `#3CB371` (medium sea green)
  - OrderItem: `#DDA0DD` (plum)
  - Invoice: `#FF6347` (tomato)
  - Payment: `#40E0D0` (turquoise)
  - Shipment: `#FFD700` (gold)

**Node rendering (`nodeCanvasObject`)**
- Replaced the default dot renderer with a custom canvas painter that draws a filled circle (radius 6) in the entity's color plus a text label below it.
- Label font size scales with zoom level (`12 / globalScale`, min 8px) so labels remain readable at all zoom levels.
- Selected node gets a white border ring.
- Unrelated nodes/links fade to 20% opacity when a node is selected (highlight mode).

**Edge rendering**
- Added `linkDirectionalArrowLength={5}` and `linkDirectionalArrowRelPos={1}` — arrows show flow direction.
- Added `linkCanvasObject` — renders edge relationship labels (PLACED, BILLED_VIA, etc.) at the link midpoint when zoomed in (globalScale ≥ 1.2).
- Highlighted links render in `#7b8fc4`, dimmed links in `#2a2d3a`.

**Graph background**
- Changed from `#f8f9fa` (white) to `#0d0f1a` (dark navy) to match the app's dark theme.

**Legend component**
- Added a `Legend` component fixed to the bottom-left of the graph panel.
- Shows a color swatch + label for each of the 7 entity types.

**Node detail panel (`NodeDetail`)**
- Retained metadata display.
- Added colored entity badge in panel header matching the node's type color.
- Added "Expand neighbourhood →" button that calls `GET /api/graph/entity/{id}?depth=2` and replaces the graph data with the subgraph result, then calls `zoomToFit()`.

**Subgraph toolbar**
- Added a toolbar at the top-left of the graph panel.
- Shows node/edge count and "(subgraph)" indicator when in subgraph view.
- Shows "← Full Graph" button when in subgraph mode; clicking it restores the full graph and calls `zoomToFit()`.

**Highlight on click**
- Clicking a node sets `highlightNodes` (the node + all direct neighbours) and `highlightLinks` (all connected edges).
- Clicking the background clears the highlight.

**Chat — auto-scroll**
- Added a `bottomRef` ref attached to a `<div>` at the end of the message list.
- `useEffect` calls `bottomRef.current.scrollIntoView({ behavior: 'smooth' })` whenever messages or loading state changes.

**Chat — example queries**
- The initial AI welcome message renders 4 clickable example query buttons:
  - "Which products have the most billing documents?"
  - "Show orders that are delivered but not billed"
  - "How many customers are in each segment?"
  - "Trace the full flow of ORD001"
- Clicking any example populates it directly as a query.

**Chat — data table**
- Added a `DataTable` component that renders query result rows as an HTML table.
- Each AI message with `data` rows shows a collapsible "Show data (N rows)" toggle.
- Table is scrollable (max-height 200px) and horizontally scrollable for wide result sets.

**Chat — send button state**
- Button background transitions between `#333` (disabled) and `#7B68EE` (enabled) using CSS transition.

---

### Process fixes

- Killed all stale processes on ports 8000, 5173, and 5174 using `lsof` + `kill`.
- Restarted backend: `uvicorn app.main:app --port 8000 --reload` from `backend/` with the venv.
- Restarted frontend: `npm run dev` from `frontend/` — confirmed running on `http://localhost:5173`.
- Verified graph endpoint: `GET /api/graph/full` returns 69 nodes, 72 links with correct string IDs.
- Verified chat endpoint: `POST /api/chat` with `{"query": "How many customers are there?"}` returns correct SQL + natural language answer.
- Confirmed frontend builds cleanly: `vite build` outputs 343 kB bundle with no errors.

---

## Architecture Overview (for reference)

| Layer | Technology | Role |
|---|---|---|
| Backend framework | FastAPI + uvicorn | REST API, lifespan startup hooks |
| Database | SQLite (aiosqlite) | Stores all O2C entities |
| ORM | SQLAlchemy (async) | Model definitions, table creation |
| Graph engine | NetworkX (DiGraph) | In-memory graph, BFS subgraph extraction |
| LLM | Groq (llama-3.3-70b-versatile) | SQL generation + natural language summary |
| Frontend | React 18 + Vite | SPA, dev proxy to backend |
| Graph viz | react-force-graph-2d (D3) | Force-directed graph rendering on canvas |

### Graph node types and relationships
```
Customer  --[PLACED]-->      Order
Order     --[CONTAINS]-->    OrderItem
OrderItem --[REFERENCES]--> Product
Order     --[BILLED_VIA]--> Invoice
Invoice   --[SETTLED_BY]--> Payment
Order     --[FULFILLED_BY]--> Shipment
```

### Chat pipeline
1. User sends natural language query to `POST /api/chat`
2. LLM call 1: generate SQL from query (guardrail: returns OFF_TOPIC if irrelevant)
3. Execute SQL against SQLite
4. LLM call 2: summarize query results into natural language
5. Return `{ response, sql, data }` to frontend

---

*Last updated: 25 March 2026*
