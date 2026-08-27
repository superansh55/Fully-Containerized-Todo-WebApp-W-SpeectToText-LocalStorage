import { useState, useRef } from 'react';
import { pushToast } from './Toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8"/>
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 1l22 22"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6"/>
      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v3M8 22h8"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

function Waveform() {
  return (
    <div className="waveform">
      {[...Array(5)].map((_, i) => <span key={i} />)}
    </div>
  );
}

export default function TaskForm({ onCreate, onCancel, onCreated }) {
  const [title,    setTitle]    = useState('');
  const [env,      setEnv]      = useState('prod');
  const [command,  setCommand]  = useState('');
  const [severity, setSeverity] = useState('P2');
  const [notes,    setNotes]    = useState('');
  const [tags,     setTags]     = useState('');
  const [dueDate,  setDueDate]  = useState('');
  const [showMore, setShowMore] = useState(false);

  const [isRecording,    setIsRecording]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [submitting,     setSubmitting]     = useState(false);

  const mediaRef  = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current   = new MediaRecorder(stream);
      chunksRef.current  = [];
      mediaRef.current.ondataavailable = e => chunksRef.current.push(e.data);
      mediaRef.current.onstop = handleTranscribe;
      mediaRef.current.start();
      setIsRecording(true);
    } catch {
      pushToast('Microphone access denied', 'error');
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    mediaRef.current?.stream?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
  };

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const blob     = new Blob(chunksRef.current, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('file', blob, 'speech.wav');
      const res  = await fetch(`${API}/transcribe`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.text) {
        setTitle(data.text);
        pushToast('Voice transcribed ✓', 'success');
      } else {
        pushToast('Could not transcribe audio', 'error');
      }
    } catch {
      pushToast('Transcription service unreachable', 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!title.trim()) {
      pushToast('Task title is required', 'error');
      return;
    }
    setSubmitting(true);
    const result = await onCreate({ title: title.trim(), env, command, severity, notes, tags, due_date: dueDate || null });
    setSubmitting(false);
    if (result.ok) {
      setTitle(''); setCommand(''); setNotes(''); setTags(''); setDueDate('');
      pushToast('Task created', 'success');
      onCreated?.();
    } else {
      pushToast(`Failed: ${result.error}`, 'error');
    }
  };

  const handleCancel = () => {
    setTitle(''); setCommand(''); setNotes(''); setTags(''); setDueDate('');
    onCancel?.();
  };

  // Ctrl+Enter shortcut
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      setTitle(''); setCommand(''); setNotes(''); setTags(''); setDueDate('');
    }
  };

  return (
    <form
      id="task-form"
      className="glass-card task-form"
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      {/* Title + mic row */}
      <div className="task-form-row">
        <input
          id="task-title-input"
          type="text"
          className="input flex-1"
          placeholder="What needs to be done?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoComplete="off"
        />
        <button
          id="mic-btn"
          type="button"
          className={`btn btn-mic ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          title={isRecording ? 'Stop recording' : 'Record voice'}
        >
          {isRecording ? <MicOffIcon /> : <MicIcon />}
        </button>
      </div>

      {/* Transcribing indicator */}
      {isTranscribing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="transcribing-pill">
            <Waveform /> Transcribing…
          </div>
        </div>
      )}
      {isRecording && !isTranscribing && (
        <div className="transcribing-pill">
          <Waveform /> Recording — speak now
        </div>
      )}

      {/* Command snippet */}
      <input
        id="task-command-input"
        type="text"
        className="input mono"
        placeholder="Sub-tasks or action items (optional)"
        value={command}
        onChange={e => setCommand(e.target.value)}
      />

      {/* Main selects + submit */}
      <div className="task-form-grid">
        <select
          id="task-env-select"
          className="select"
          value={env}
          onChange={e => setEnv(e.target.value)}
        >
          <option value="prod">Category: Work</option>
          <option value="staging">Category: Personal</option>
          <option value="homelab">Category: Home</option>
          <option value="dev">Category: Other</option>
        </select>

        <select
          id="task-severity-select"
          className="select"
          value={severity}
          onChange={e => setSeverity(e.target.value)}
        >
          <option value="P0">Priority: Urgent</option>
          <option value="P1">Priority: High</option>
          <option value="P2">Priority: Medium</option>
          <option value="P3">Priority: Low</option>
        </select>

        <button
          type="button"
          id="toggle-more-btn"
          className="btn btn-ghost"
          onClick={() => setShowMore(v => !v)}
        >
          {showMore ? '▴ Less' : '▾ More'}
        </button>

        <button
          type="button"
          id="cancel-task-btn"
          className="btn btn-ghost"
          onClick={handleCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          id="add-task-btn"
          className="btn btn-primary"
          disabled={submitting}
        >
          <PlusIcon />
          {submitting ? 'Adding…' : 'Add Task'}
        </button>
      </div>

      {/* Expanded fields */}
      {showMore && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="task-tags-input"
              type="text"
              className="input"
              style={{ flex: 1 }}
              placeholder="Tags (comma-separated): aws, k8s, incident"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
            <input
              id="task-due-input"
              type="date"
              className="input"
              style={{ width: 160, colorScheme: 'dark' }}
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
          <textarea
            id="task-notes-input"
            className="input"
            placeholder="Notes — runbook steps, context, links…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4 }}>
        <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 3, padding: '0 4px', fontSize: 10 }}>Ctrl+Enter</kbd> to submit &nbsp;·&nbsp;
        <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 3, padding: '0 4px', fontSize: 10 }}>Esc</kbd> to clear
      </p>
    </form>
  );
}
