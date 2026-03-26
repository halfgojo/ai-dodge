# Dodge AI — Context Graph System

Dodge AI is an intelligent Graph Visualization Agent designed to navigate and interpret complex Order-to-Cash (O2C) datasets. Through conversational AI, users can ask natural language questions ("Which products have the most billing documents?") and instantly receive both plain-English insights and a fully interactive visualization mapping out the backend relationships.

For this Hackathon submission, the system combines a **React** frontend for rich visualization, a **FastAPI** backend for robust routing, **SQLite** for lightning-fast relational queries, and an agentic **LLM integration** (powered by Gemini/Groq) to intelligently generate and execute SQL.

## 🚀 Working Demo & Deployment
Since the project is a unified Python web service (FastAPI serving pre-built React static files), deploying it is exceptionally easy:

**Local Run Instructions (No Authentication Required):**
1. Clone the repository.
2. In the `backend` directory, add your LLM API Key to `.env` (`GROQ_API_KEY` or `GEMINI_API_KEY`).
3. Run `npm install && npm run build` in the `frontend` directory.
4. Run `pip install -r requirements.txt` and `uvicorn main:app --port 8000` in the `backend` directory.
5. Visit `http://localhost:8000` to interact with the agent.

*(To deploy to a cloud provider like Render as a single web service, simply set the build command to install both Node and Python dependencies, build the frontend, and run the FastAPI server).*

---

## 🏗 Architectural Decisions

We opted for a **Unified Full-Stack Architecture**, where a single FastAPI backend serves both the API endpoints (`/chat`, `/graph`) and the compiled static frontend files (`frontend/dist/`). 
* **Seamless Deployment:** A single server footprint. We don't need separate frontend/backend hosting.
* **React + HTML5 Canvas (`react-force-graph-2d`):** Chosen for rendering up to 1000+ nodes and edges smoothly using WebGL/Canvas forces, avoiding DOM overhead.
* **FastAPI:** Python's leading asynchronous framework. Ideal for orchestrating data parsing, Pandas manipulation, and LLM network requests concurrently without blocking.

---

## 🗄 Database Strategy

**Choice: Local in-memory/file-based SQLite.**

While graph databases (Neo4j) are typically used for visualization, they carry significant overhead. For an O2C tabular dataset encompassing millions of relationships (Customers → Orders → Shipments → Invoices → Payments), **SQLite** provides distinct advantages:
1. **Zero Configuration:** Data is instantly ingested from raw `.jsonl` dumps into structured relational tables using `pandas.to_sql`.
2. **Deterministic Querying for LLMs:** LLMs excel at generating standard SQL with `JOIN` operations. A structured SQLite schema ensures exactly correct counts and aggregations over broken business flows (e.g., using `LEFT JOIN` to find orders without payments).
3. **Immutability:** The database acts as a read-only source of truth queried on the fly.

---

## 🧠 LLM Prompting Strategy

Our agent generates highly accurate SQL despite the complexity of SAP schema tables by employing a **Constrained Context Injection Strategy**:

1. **Dynamic Schema Injection:** The SQLite table schemas (`PRAGMA table_info`) are loaded dynamically and injected directly into the system prompt on startup.
2. **Explicit Join Path Constraints:** O2C tables require specific stepping-stone joins. Our prompt explicitly instructs the LLM with `CRITICAL JOIN PATHS` (e.g., *Never join billing items directly to sales orders — always route through outbound_delivery_items*).
3. **Verified Few-Shot Examples:** By providing 3-4 highly complex, verified target queries in the prompt (e.g., tracing a full document flow), the LLM pattern-matches perfectly.
4. **Data Summarization Chain:** A two-step process: First, LLM generates SQL. Database runs the query. Then, a second LLM prompt formats the raw JSON result into conversational, non-technical plain text.

---

## 🛡 System Guardrails

To ensure safety and reliability during business usage:

1. **Read-Only Constraint Checks:** The Python execution engine strictly validates that the generated SQL starts with `SELECT` and blocks any destructive keywords (`DROP`, `DELETE`, `INSERT`, `UPDATE`).
2. **Off-Topic Detection:** The LLM prompt explicitly instructs the model to output the strict string `GUARDRAIL: off-topic` if a user asks about anything outside the O2C domain. The backend catches this flag and returns a polite redirect response.
3. **Conversational Shortcuts:** Simple generic inputs ("hi", "hello", "help") are short-circuited entirely before hitting the LLM, responding instantly with domain-specific suggested queries.
4. **Execution Retry Fallbacks:** If the generated SQL throws an SQLite syntax error, an automated inner retry loop feeds the error back to the LLM to correct its own join structure before gracefully falling back to a safe conversational apology.
