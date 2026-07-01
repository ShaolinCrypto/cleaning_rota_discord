import { execute, queryOne, queryRows } from '../db';
import { NotFoundError, ValidationError, wrapDatabaseErrorAsync } from '../utils/errors';
import type { Task } from '../types';
import type { RowDataPacket } from 'mysql2/promise';

interface TaskRow extends RowDataPacket {
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

export async function createTask(title: string, description: string): Promise<Task> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new ValidationError('Task title cannot be empty.');
  }

  return wrapDatabaseErrorAsync(async () => {
    const createdAt = new Date().toISOString();
    const result = await execute(
      'INSERT INTO tasks (title, description, created_at, active) VALUES (?, ?, ?, 1)',
      [trimmedTitle, description.trim(), createdAt],
    );

    return {
      id: result.insertId,
      title: trimmedTitle,
      description: description.trim(),
      createdAt,
      active: true,
    };
  });
}

export async function editTask(taskId: number, title: string, description: string): Promise<Task> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new ValidationError('Task title cannot be empty.');
  }

  return wrapDatabaseErrorAsync(async () => {
    const existing = await queryOne<RowDataPacket>('SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
      throw new NotFoundError('Task', taskId);
    }

    await execute('UPDATE tasks SET title = ?, description = ? WHERE id = ?', [
      trimmedTitle,
      description.trim(),
      taskId,
    ]);

    const updated = await queryOne<TaskRow>('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!updated) {
      throw new NotFoundError('Task', taskId);
    }
    return mapTask(updated);
  });
}

export async function removeTask(taskId: number): Promise<Task> {
  return wrapDatabaseErrorAsync(async () => {
    const existing = await queryOne<TaskRow>('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
      throw new NotFoundError('Task', taskId);
    }

    await execute('UPDATE tasks SET active = 0 WHERE id = ?', [taskId]);
    return mapTask({ ...existing, active: 0 });
  });
}

export async function listTasks(includeInactive = false): Promise<Task[]> {
  return wrapDatabaseErrorAsync(async () => {
    const rows = includeInactive
      ? await queryRows<TaskRow>('SELECT * FROM tasks ORDER BY id ASC')
      : await queryRows<TaskRow>('SELECT * FROM tasks WHERE active = 1 ORDER BY id ASC');

    return rows.map(mapTask);
  });
}

export async function getTaskById(taskId: number): Promise<Task> {
  return wrapDatabaseErrorAsync(async () => {
    const row = await queryOne<TaskRow>('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!row) {
      throw new NotFoundError('Task', taskId);
    }
    return mapTask(row);
  });
}

export async function getActiveTasks(): Promise<Task[]> {
  return listTasks(false);
}
