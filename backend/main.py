from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import sqlite3, os, asyncio
from datetime import datetime, timezone
import httpx

app = FastAPI(title="DevOps Tasker API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("DB_PATH", "/app/data/tasks.db")
STT_URL = os.getenv("STT_URL", "http://speech-service:9000/asr")

# ─────────────────────────────────────────────
# Database helpers
# ─────────────────────────────────────────────

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for crash-safe writes — survives container OOM kills
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_conn() as conn:
        # Create base table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT    NOT NULL,
                env          TEXT    DEFAULT 'prod',
                command      TEXT    DEFAULT '',
                severity     TEXT    DEFAULT 'P2',
                completed    INTEGER DEFAULT 0,
                notes        TEXT    DEFAULT '',
                tags         TEXT    DEFAULT '',
                due_date     TEXT    DEFAULT NULL,
                priority_order INTEGER DEFAULT 0,
                created_at   TEXT    DEFAULT (datetime('now')),
                updated_at   TEXT    DEFAULT (datetime('now')),
                completed_at TEXT    DEFAULT NULL
            )
        """)

        # Idempotent column migrations — safe to run on every startup
        _add_column_if_missing(conn, "tasks", "notes",          "TEXT DEFAULT ''")
        _add_column_if_missing(conn, "tasks", "tags",           "TEXT DEFAULT ''")
        _add_column_if_missing(conn, "tasks", "due_date",       "TEXT DEFAULT NULL")
        _add_column_if_missing(conn, "tasks", "priority_order", "INTEGER DEFAULT 0")
        _add_column_if_missing(conn, "tasks", "created_at",     "TEXT DEFAULT ''")
        _add_column_if_missing(conn, "tasks", "updated_at",     "TEXT DEFAULT ''")
        _add_column_if_missing(conn, "tasks", "completed_at",   "TEXT DEFAULT NULL")
        conn.commit()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, col_def: str):
    existing = [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


init_db()

# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────

class TaskCreate(BaseModel):
    title:    str            = Field(..., min_length=1, max_length=500)
    env:      str            = Field("prod",  max_length=50)
    command:  str            = Field("",      max_length=1000)
    severity: str            = Field("P2",    pattern="^P[0-3]$")
    notes:    str            = Field("",      max_length=5000)
    tags:     str            = Field("",      max_length=200)
    due_date: Optional[str]  = Field(None)


class TaskUpdate(BaseModel):
    title:     Optional[str]  = Field(None, min_length=1, max_length=500)
    env:       Optional[str]  = Field(None, max_length=50)
    command:   Optional[str]  = Field(None, max_length=1000)
    severity:  Optional[str]  = Field(None, pattern="^P[0-3]$")
    completed: Optional[int]  = None
    notes:     Optional[str]  = Field(None, max_length=5000)
    tags:      Optional[str]  = Field(None, max_length=200)
    due_date:  Optional[str]  = None
    priority_order: Optional[int] = None


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/api/health")
def health():
    """Health check — used by Docker HEALTHCHECK and load balancers."""
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "db": "connected", "ts": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/tasks")
def get_tasks(
    completed: Optional[int] = None,
    severity:  Optional[str] = None,
    env:       Optional[str] = None,
    search:    Optional[str] = None,
):
    """List tasks with optional filters."""
    query  = "SELECT * FROM tasks WHERE 1=1"
    params = []

    if completed is not None:
        query += " AND completed = ?"
        params.append(completed)
    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if env:
        query += " AND env = ?"
        params.append(env)
    if search:
        query += " AND (title LIKE ? OR notes LIKE ? OR command LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like, like])

    query += " ORDER BY completed ASC, priority_order ASC, id DESC"

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        return [row_to_dict(r) for r in rows]


@app.post("/api/tasks", status_code=201)
def create_task(task: TaskCreate):
    """Create a new task. Returns the full created task object."""
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        cursor = conn.execute(
            """INSERT INTO tasks
               (title, env, command, severity, notes, tags, due_date, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (task.title, task.env, task.command, task.severity,
             task.notes, task.tags, task.due_date, now, now)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return row_to_dict(row)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, update: TaskUpdate):
    """Partial update — supports toggling completed, editing any field."""
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")

        fields = {}
        if update.title     is not None: fields["title"]          = update.title
        if update.env       is not None: fields["env"]            = update.env
        if update.command   is not None: fields["command"]        = update.command
        if update.severity  is not None: fields["severity"]       = update.severity
        if update.notes     is not None: fields["notes"]          = update.notes
        if update.tags      is not None: fields["tags"]           = update.tags
        if update.due_date  is not None: fields["due_date"]       = update.due_date
        if update.priority_order is not None: fields["priority_order"] = update.priority_order

        now = datetime.now(timezone.utc).isoformat()
        fields["updated_at"] = now

        if update.completed is not None:
            fields["completed"] = update.completed
            fields["completed_at"] = now if update.completed else None

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values     = list(fields.values()) + [task_id]
        conn.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", values)
        conn.commit()

        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return row_to_dict(row)


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    with get_conn() as conn:
        result = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"status": "deleted", "id": task_id}


@app.post("/api/tasks/reorder")
def reorder_tasks(order: list[int]):
    """Accept a list of task IDs in the desired order and update priority_order."""
    with get_conn() as conn:
        for idx, task_id in enumerate(order):
            conn.execute("UPDATE tasks SET priority_order = ? WHERE id = ?", (idx, task_id))
        conn.commit()
    return {"status": "ok"}


@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Forward audio to Whisper STT service using async httpx (non-blocking)."""
    try:
        audio_bytes = await file.read()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{STT_URL}?task=transcribe&language=en&output=json",
                files={"audio_file": (file.filename, audio_bytes, file.content_type)},
            )
        if response.status_code == 200:
            text = response.json().get("text", "").strip()
            return {"text": text}
        raise HTTPException(status_code=502, detail="Transcription service error")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transcription service timed out")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Transcription service unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))