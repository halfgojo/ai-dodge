import json
import logging
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from groq import Groq
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pathlib import Path
from app.database import get_db

env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
logger = logging.getLogger(__name__)

chat_router = APIRouter(prefix="/api/chat", tags=["Chat"])
groq_client = Groq()

MODEL = "llama-3.3-70b-versatile"

SCHEMA_CONTEXT = """
SQLite Database Schema for Order-to-Cash (O2C):

TABLE customers (customer_id TEXT, name TEXT, email TEXT, segment TEXT, region TEXT, created_at TEXT)
TABLE products (product_id TEXT, name TEXT, category TEXT, unit_price REAL)
TABLE orders (order_id TEXT, customer_id TEXT, order_date TEXT, status TEXT, total_amount REAL)
TABLE order_items (id INTEGER, order_id TEXT, product_id TEXT, quantity INTEGER, line_total REAL)
TABLE invoices (invoice_id TEXT, order_id TEXT, invoice_date TEXT, due_date TEXT, amount REAL, status TEXT)
TABLE payments (payment_id TEXT, invoice_id TEXT, payment_date TEXT, amount REAL, method TEXT)
TABLE shipments (shipment_id TEXT, order_id TEXT, ship_date TEXT, delivery_date TEXT, carrier TEXT, tracking_number TEXT, status TEXT)
"""

SQL_SYSTEM_PROMPT = f"""
You are an expert SQL assistant for an Order-to-Cash dataset.
Your job is to translate user natural language questions into valid SQLite query strings.

{SCHEMA_CONTEXT}

CRITICAL RULES:
1. Return ONLY the raw SQL query. No markdown formatting, no ```sql, no explanations. Just the SELECT statement.
2. If the user's question is completely off-topic and cannot be answered by this database (e.g. asking about poems, capital of France, math, code), DO NOT generate SQL. Instead, respond EXACTLY with the word "OFF_TOPIC".
3. Use JOINs carefully. Note that payments link to invoices via invoice_id, shipments link to orders via order_id, invoices to orders via order_id.
"""

SUMMARY_SYSTEM_PROMPT = """
You are a helpful analytics assistant. 
You are given a user's question, the SQL query used to fetch data, and the raw JSON results from the database.
Your job is to provide a clear, concise, and professional natural language answer to the user's question based on the data.
Be concise. Do not explain the SQL to the user unless they ask.
"""

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str
    sql: str | None = None
    data: list[dict[str, Any]] | None = None

@chat_router.post("", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    user_query = request.query.strip()
    
    # STEP 1: Generate SQL
    try:
        completion1 = groq_client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SQL_SYSTEM_PROMPT.strip()},
                {"role": "user", "content": user_query}
            ],
            temperature=0.1,
            max_completion_tokens=500
        )
        sql_or_off_topic = completion1.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to communicate with LLM")

    # Guardrail check
    if sql_or_off_topic == "OFF_TOPIC" or "OFF_TOPIC" in sql_or_off_topic:
        return ChatResponse(
            response="This system is designed to answer questions about the Order-to-Cash dataset only.",
            sql=None,
            data=None
        )

    # Clean up SQL just in case the LLM ignored instructions
    sql_query = sql_or_off_topic.replace("```sql", "").replace("```", "").strip()

    # STEP 2: Execute SQL
    try:
        result = await db.execute(text(sql_query))
        rows = result.mappings().all()
        # Convert to a list of dicts, ensuring types are JSON serializable
        data_res = [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"SQL Execution failed: {e}\nSQL was: {sql_query}")
        return ChatResponse(
            response=f"I tried to analyze the data but encountered a database error: {str(e)}",
            sql=sql_query,
            data=None
        )

    # STEP 3: Summarize Data
    try:
        summary_user_msg = f"""
User Question: {user_query}
SQL Query: {sql_query}
Data Results: {json.dumps(data_res, default=str)}
"""
        completion2 = groq_client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SUMMARY_SYSTEM_PROMPT.strip()},
                {"role": "user", "content": summary_user_msg.strip()}
            ],
            temperature=0.3,
            max_completion_tokens=800
        )
        summary = completion2.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq summary failed: {e}")
        summary = "I could retrieve the data but failed to summarize it."

    return ChatResponse(
        response=summary,
        sql=sql_query,
        data=data_res
    )
