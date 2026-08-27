import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

function apiFetch(path, options = {}) {
  return fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
}

export function useTasks() {
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const fetchTasks = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.severity)  params.set('severity',  filters.severity);
      if (filters.env)       params.set('env',        filters.env);
      if (filters.completed !== undefined) params.set('completed', filters.completed);
      if (filters.search)    params.set('search',     filters.search);

      const res = await apiFetch(`/tasks?${params}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setTasks(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Optimistic create
  const createTask = useCallback(async (taskData) => {
    const tempId = Date.now();
    const optimistic = {
      id: tempId,
      completed: 0,
      created_at: new Date().toISOString(),
      priority_order: 0,
      ...taskData,
    };
    setTasks(prev => [optimistic, ...prev]);
    try {
      const res = await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setTasks(prev => prev.map(t => (t.id === tempId ? created : t)));
      return { ok: true, task: created };
    } catch (e) {
      // Rollback
      setTasks(prev => prev.filter(t => t.id !== tempId));
      return { ok: false, error: e.message };
    }
  }, []);

  // Optimistic update (toggle complete, edit)
  const updateTask = useCallback(async (id, patch) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const res = await apiFetch(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
      return { ok: true, task: updated };
    } catch (e) {
      // Rollback by re-fetching
      fetchTasks();
      return { ok: false, error: e.message };
    }
  }, [fetchTasks]);

  // Optimistic delete
  const deleteTask = useCallback(async (id) => {
    const snapshot = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      const res = await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      return { ok: true };
    } catch (e) {
      // Rollback
      if (snapshot) setTasks(prev => [...prev, snapshot].sort((a, b) => b.id - a.id));
      return { ok: false, error: e.message };
    }
  }, [tasks]);

  // Reorder
  const reorderTasks = useCallback(async (orderedIds) => {
    try {
      await apiFetch('/tasks/reorder', {
        method: 'POST',
        body: JSON.stringify(orderedIds),
      });
    } catch (e) {
      console.error('Reorder failed:', e);
    }
  }, []);

  return { tasks, setTasks, loading, error, fetchTasks, createTask, updateTask, deleteTask, reorderTasks };
}
