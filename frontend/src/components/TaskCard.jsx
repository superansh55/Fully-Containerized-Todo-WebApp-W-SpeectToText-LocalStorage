import { useState, useRef } from 'react';
import { pushToast } from './Toast';

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CopyIcon({ copied }) {
  if (copied) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function getDueBadgeClass(dueDate) {
  if (!dueDate) return null;
  const now  = new Date();
  const due  = new Date(dueDate);
  const diff = (due - now) / (1000 * 60 * 60 * 24);
  if (diff < 0)   return 'overdue';
  if (diff < 2)   return 'soon';
  return '';
}

function formatDue(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const SEV_MAP = { P0: 'Urgent', P1: 'High', P2: 'Medium', P3: 'Low' };
const ENV_MAP = { prod: 'Work', staging: 'Personal', homelab: 'Home', dev: 'Other' };

export default function TaskCard({ task, onToggle, onDelete, onDragStart, onDragOver, onDrop }) {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const dragRef = useRef(null);

  const handleCopyCmd = async () => {
    try {
      await navigator.clipboard.writeText(task.command);
      setCopiedCmd(true);
      pushToast('Command copied!', 'success', 1800);
      setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      pushToast('Copy failed', 'error');
    }
  };

  const tags = task.tags ? task.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const dueCls = getDueBadgeClass(task.due_date);
  const sevLower = (task.severity || 'p2').toLowerCase();

  return (
    <div
      id={`task-${task.id}`}
      ref={dragRef}
      className={`task-card ${sevLower} ${task.completed ? 'completed' : ''}`}
      draggable
      onDragStart={() => onDragStart?.(task.id)}
      onDragOver={e => { e.preventDefault(); onDragOver?.(task.id); }}
      onDrop={() => onDrop?.(task.id)}
    >
      {/* Checkbox */}
      <button
        id={`check-${task.id}`}
        className={`task-check ${task.completed ? 'checked' : ''}`}
        onClick={() => onToggle(task.id, task.completed)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        title={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed && <CheckIcon />}
      </button>

      {/* Body */}
      <div className="task-body">
        {/* Top row: badges + title */}
        <div className="task-meta">
          <span className={`badge ${sevLower}`}>{SEV_MAP[task.severity] || task.severity}</span>
          <span className="badge env">{ENV_MAP[task.env] || task.env}</span>
          {tags.map(tag => (
            <span key={tag} className="badge tag">#{tag}</span>
          ))}
        </div>

        <p className="task-title">{task.title}</p>

        {/* Command snippet */}
        {task.command && (
          <div className="task-command">
            <span className="dollar">$</span>
            <span style={{ flex: 1, overflowX: 'auto' }}>{task.command}</span>
            <button
              id={`copy-cmd-${task.id}`}
              className={`copy-btn ${copiedCmd ? 'copied' : ''}`}
              onClick={handleCopyCmd}
              title="Copy command"
            >
              <CopyIcon copied={copiedCmd} />
            </button>
          </div>
        )}

        {/* Notes */}
        {task.notes && (
          <p className="task-notes">{task.notes}</p>
        )}

        {/* Footer: due date + created */}
        <div className="task-footer">
          {task.due_date && (
            <span className={`due-badge ${dueCls}`}>
              <CalendarIcon /> {formatDue(task.due_date)}
            </span>
          )}
          {task.created_at && (
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <div className="task-actions">
        <button
          id={`delete-${task.id}`}
          className="btn btn-danger-ghost"
          onClick={() => onDelete(task.id)}
          title="Delete task"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
