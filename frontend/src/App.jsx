import { useState, useEffect, useRef, useMemo } from 'react';
import './index.css';
import { useTasks }          from './hooks/useTasks';
import TaskCard               from './components/TaskCard';
import TaskForm               from './components/TaskForm';
import FilterBar              from './components/FilterBar';
import { ToastContainer, pushToast } from './components/Toast';

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SkeletonCards() {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </>
  );
}

const FILTER_DEFAULTS = { severity: '', env: '', completed: undefined, search: '' };

export default function App() {
  const { tasks, setTasks, loading, error, fetchTasks, createTask, updateTask, deleteTask, reorderTasks } = useTasks();
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const dragItem  = useRef(null);
  const dragOver  = useRef(null);

  // Re-fetch when filters change (server-side filtering)
  useEffect(() => {
    fetchTasks(filters);
  }, [filters]); // eslint-disable-line

  // Severity counts from all loaded tasks (independent of current filter)
  const counts = useMemo(() => {
    const c = { P0: 0, P1: 0, P2: 0, P3: 0 };
    tasks.forEach(t => { if (!t.completed && c[t.severity] !== undefined) c[t.severity]++; });
    return c;
  }, [tasks]);

  // ── Drag & Drop reorder ───────────────────────────────────────
  const handleDragStart = (id) => { dragItem.current = id; };
  const handleDragOver  = (id) => { dragOver.current  = id; };
  const handleDrop      = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    if (dragItem.current === dragOver.current) return;

    setTasks(prev => {
      const next = [...prev];
      const from = next.findIndex(t => t.id === dragItem.current);
      const to   = next.findIndex(t => t.id === dragOver.current);
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      reorderTasks(next.map(t => t.id));
      return next;
    });
    dragItem.current  = null;
    dragOver.current  = null;
  };

  // ── Toggle complete ───────────────────────────────────────────
  const handleToggle = async (id, currentCompleted) => {
    const result = await updateTask(id, { completed: currentCompleted ? 0 : 1 });
    if (!result.ok) pushToast('Update failed', 'error');
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    const result = await deleteTask(id);
    if (result.ok) {
      pushToast('Task deleted', 'info');
    } else {
      pushToast('Delete failed', 'error');
    }
  };

  // ── Stats bar ─────────────────────────────────────────────────
  const openCount = tasks.filter(t => !t.completed).length;
  const doneCount = tasks.filter(t =>  t.completed).length;

  return (
    <>
      <div className="app-layout">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon" aria-hidden="true">
              <TerminalIcon />
            </div>
            <h1>Task Manager</h1>
          </div>

          <button
            id="sidebar-add-task-btn"
            type="button"
            className="btn btn-primary sidebar-add-btn"
            onClick={() => setShowTaskForm(v => !v)}
          >
            <PlusIcon />
            <span>Add task</span>
          </button>

          <nav className="sidebar-nav">
            <button type="button" className="sidebar-nav-link active">
              <InboxIcon />
              <span>Inbox</span>
              <span className="nav-count">{tasks.length}</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            {error && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--danger)', background: 'var(--danger-dim)', padding: '3px 10px', borderRadius: 999, border: '1px solid var(--p0-border)', marginBottom: 10, textAlign: 'center' }}>
                ⚠ Backend unreachable
              </span>
            )}
            <div className="engine-badge">
              <span className="dot" />
              whisper-tiny · local
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="main-content">
          <div className="app-container">
            {/* ── Header ── */}
            <header className="app-header">
              <div className="header-brand">
                <h1>Inbox</h1>
              </div>
            </header>

            {/* ── Stats Chips ── */}
            <div className="stats-bar">
              <div className="stat-chip total">
                All <strong>{tasks.length}</strong>
              </div>
              <div className="stat-chip p0">Urgent <strong>{counts.P0}</strong></div>
              <div className="stat-chip p1">High <strong>{counts.P1}</strong></div>
              <div className="stat-chip p2">Medium <strong>{counts.P2}</strong></div>
              <div className="stat-chip p3">Low <strong>{counts.P3}</strong></div>
              {doneCount > 0 && (
                <div className="stat-chip" style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', marginLeft: 'auto' }}>
                  ✓ {doneCount} done
                </div>
              )}
            </div>

            {/* ── Task Form (shown via "+ Add task") ── */}
            {showTaskForm && (
              <TaskForm
                onCreate={createTask}
                onCancel={() => setShowTaskForm(false)}
                onCreated={() => setShowTaskForm(false)}
              />
            )}

            {/* ── Filter Bar ── */}
            <FilterBar filters={filters} onChange={setFilters} counts={counts} />

            {/* ── Task List ── */}
            <div
              className="task-list"
              onDragLeave={() => { dragOver.current = null; }}
            >
              {loading ? (
                <SkeletonCards />
              ) : tasks.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M9 12h6M9 8h6M9 16h3" />
                  </svg>
                  <h3>No tasks found</h3>
                  <p>
                    {(filters.severity || filters.env || filters.search || filters.completed !== undefined)
                      ? 'Try adjusting your filters.'
                      : 'Add your first task to get started.'}
                  </p>
                  {!(filters.severity || filters.env || filters.search || filters.completed !== undefined) && !showTaskForm && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ marginTop: 16 }}
                      onClick={() => setShowTaskForm(true)}
                    >
                      <PlusIcon />
                      Add task
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Open tasks */}
                  {tasks.filter(t => !t.completed).length > 0 && (
                    <>
                      {tasks.filter(t => !t.completed).map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        />
                      ))}
                    </>
                  )}

                  {/* Completed tasks (collapsible section) */}
                  {tasks.filter(t => t.completed).length > 0 && (
                    <>
                      <div className="section-label">Completed</div>
                      {tasks.filter(t => t.completed).map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ToastContainer />
    </>
  );
}