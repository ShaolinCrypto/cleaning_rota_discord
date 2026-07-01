import { execute, queryOne, queryRows } from '../db';
import { NotFoundError, ValidationError, wrapDatabaseErrorAsync } from '../utils/errors';
import type { RotaUser } from '../types';
import type { RowDataPacket } from 'mysql2/promise';

interface RotaUserRow extends RowDataPacket {
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

export async function addRotaUser(userId: string): Promise<RotaUser> {
  return wrapDatabaseErrorAsync(async () => {
    const existing = await queryOne<RotaUserRow>('SELECT * FROM rota_users WHERE user_id = ?', [userId]);

    if (existing) {
      throw new ValidationError(`<@${userId}> is already on the rota.`);
    }

    const addedAt = new Date().toISOString();
    const result = await execute('INSERT INTO rota_users (user_id, added_at) VALUES (?, ?)', [
      userId,
      addedAt,
    ]);

    return {
      id: result.insertId,
      userId,
      addedAt,
    };
  });
}

export async function removeRotaUser(userId: string): Promise<RotaUser> {
  return wrapDatabaseErrorAsync(async () => {
    const existing = await queryOne<RotaUserRow>('SELECT * FROM rota_users WHERE user_id = ?', [userId]);

    if (!existing) {
      throw new NotFoundError('Rota user', userId);
    }

    await execute('DELETE FROM rota_users WHERE user_id = ?', [userId]);
    return mapRotaUser(existing);
  });
}

export async function listRotaUsers(): Promise<RotaUser[]> {
  return wrapDatabaseErrorAsync(async () => {
    const rows = await queryRows<RotaUserRow>('SELECT * FROM rota_users ORDER BY id ASC');
    return rows.map(mapRotaUser);
  });
}

export async function getRotationIndex(): Promise<number> {
  return wrapDatabaseErrorAsync(async () => {
    const row = await queryOne<RowDataPacket & { rotation_index: number }>(
      'SELECT rotation_index FROM rota_state WHERE id = 1',
    );
    return row?.rotation_index ?? 0;
  });
}

export async function setRotationIndex(index: number): Promise<void> {
  await wrapDatabaseErrorAsync(async () => {
    await execute('UPDATE rota_state SET rotation_index = ? WHERE id = 1', [index]);
  });
}
