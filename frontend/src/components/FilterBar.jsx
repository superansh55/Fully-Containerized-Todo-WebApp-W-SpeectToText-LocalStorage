const SEVERITIES = [
  { id: 'P0', label: 'Urgent' },
  { id: 'P1', label: 'High' },
  { id: 'P2', label: 'Medium' },
  { id: 'P3', label: 'Low' }
];
const ENVS = [
  { id: 'prod', label: 'Work' },
  { id: 'staging', label: 'Personal' },
  { id: 'homelab', label: 'Home' },
  { id: 'dev', label: 'Other' }
];

export default function FilterBar({ filters, onChange, counts }) {
  const { severity, env, completed, search } = filters;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
      {/* Search */}
      <div className="search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          id="search-input"
          type="text"
          className="input"
          placeholder="Search tasks, commands, notes…"
          value={search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Filter pills */}
      <div className="filter-bar">
        {/* Severity filters */}
        {SEVERITIES.map(sev => (
          <button
            key={sev.id}
            id={`filter-sev-${sev.id.toLowerCase()}`}
            className={`filter-pill ${severity === sev.id ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, severity: severity === sev.id ? '' : sev.id })}
          >
            <span className={`badge ${sev.id.toLowerCase()}`}>{sev.label}</span>
            {counts?.[sev.id] ? <span>{counts[sev.id]}</span> : null}
          </button>
        ))}

        <div style={{ width: 1, background: 'var(--border-subtle)', alignSelf: 'stretch', margin: '0 4px' }} />

        {/* Env filters */}
        {ENVS.map(e => (
          <button
            key={e.id}
            id={`filter-env-${e.id}`}
            className={`filter-pill ${env === e.id ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, env: env === e.id ? '' : e.id })}
          >
            {e.label}
          </button>
        ))}

        <div style={{ width: 1, background: 'var(--border-subtle)', alignSelf: 'stretch', margin: '0 4px' }} />

        {/* Completion toggle */}
        <button
          id="filter-completed"
          className={`filter-pill ${completed === 1 ? 'active' : ''}`}
          onClick={() => onChange({ ...filters, completed: completed === 1 ? undefined : 1 })}
        >
          ✓ Done
        </button>

        {/* Clear all */}
        {(severity || env || completed !== undefined || search) && (
          <button
            id="filter-clear"
            className="filter-pill"
            onClick={() => onChange({ severity: '', env: '', completed: undefined, search: '' })}
            style={{ marginLeft: 'auto', color: 'var(--danger)', borderColor: 'var(--p0-border)' }}
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}
