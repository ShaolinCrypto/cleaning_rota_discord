import { getDatabase } from '../db';
import { NotFoundError, ValidationError, wrapDatabaseError } from '../utils/errors';
import type { Task } from '../types';

interface TaskRow {
  id: number;
  title: string;
  description: string;
  created_at: string;
  active: number;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    active: row.active === 1,
  };
}

export function createTask(title: string, description: string): Task {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new ValidationError('Task title cannot be empty.');
  }

  return wrapDatabaseError(() => {
    const db = getDatabase();
    const createdAt = new Date().toISOString();
    const result = db
      .prepare('INSERT INTO tasks (title, description, created_at, active) VALUES (?, ?, ?, 1)')
      .run(trimmedTitle, description.trim(), createdAt);

    return {
      id: Number(result.lastInsertRowid),
      title: trimmedTitle,
      description: description.trim(),
      createdAt,
      active: true,
    };
  });
}

export function editTask(taskId: number, title: string, description: string): Task {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new ValidationError('Task title cannot be empty.');
  }

  return wrapDatabaseError(() => {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!existing) {
      throw new NotFoundError('Task', taskId);
    }

    db.prepare('UPDATE tasks SET title = ?, description = ? WHERE id = ?').run(
      trimmedTitle,
      description.trim(),
      taskId,
    );

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as unknown as TaskRow;
    return mapTask(updated);
  });
}

export function removeTask(taskId: number): Task {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    if (!existing) {
      throw new NotFoundError('Task', taskId);
    }

    db.prepare('UPDATE tasks SET active = 0 WHERE id = ?').run(taskId);
    return mapTask({ ...existing, active: 0 });
  });
}

export function listTasks(includeInactive = false): Task[] {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const rows = includeInactive
      ? (db.prepare('SELECT * FROM tasks ORDER BY id ASC').all() as unknown as TaskRow[])
      : (db.prepare('SELECT * FROM tasks WHERE active = 1 ORDER BY id ASC').all() as unknown as TaskRow[]);

    return rows.map(mapTask);
  });
}

export function getTaskById(taskId: number): Task {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    if (!row) {
      throw new NotFoundError('Task', taskId);
    }
    return mapTask(row);
  });
}

export function getActiveTasks(): Task[] {
  return listTasks(false);
}
