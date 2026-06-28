import { getDatabase } from '../db';
import { NotFoundError, ValidationError, wrapDatabaseError } from '../utils/errors';
import type { RotaUser } from '../types';

interface RotaUserRow {
  id: number;
  user_id: string;
  added_at: string;
}

function mapRotaUser(row: RotaUserRow): RotaUser {
  return {
    id: row.id,
    userId: row.user_id,
    addedAt: row.added_at,
  };
}

export function addRotaUser(userId: string): RotaUser {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM rota_users WHERE user_id = ?').get(userId) as
      | RotaUserRow
      | undefined;

    if (existing) {
      throw new ValidationError(`<@${userId}> is already on the rota.`);
    }

    const addedAt = new Date().toISOString();
    const result = db.prepare('INSERT INTO rota_users (user_id, added_at) VALUES (?, ?)').run(userId, addedAt);

    return {
      id: Number(result.lastInsertRowid),
      userId,
      addedAt,
    };
  });
}

export function removeRotaUser(userId: string): RotaUser {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM rota_users WHERE user_id = ?').get(userId) as
      | RotaUserRow
      | undefined;

    if (!existing) {
      throw new NotFoundError('Rota user', userId);
    }

    db.prepare('DELETE FROM rota_users WHERE user_id = ?').run(userId);
    return mapRotaUser(existing);
  });
}

export function listRotaUsers(): RotaUser[] {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM rota_users ORDER BY id ASC').all() as unknown as RotaUserRow[];
    return rows.map(mapRotaUser);
  });
}

export function getRotationIndex(): number {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const row = db.prepare('SELECT rotation_index FROM rota_state WHERE id = 1').get() as {
      rotation_index: number;
    };
    return row.rotation_index;
  });
}

export function setRotationIndex(index: number): void {
  wrapDatabaseError(() => {
    const db = getDatabase();
    db.prepare('UPDATE rota_state SET rotation_index = ? WHERE id = 1').run(index);
  });
}
