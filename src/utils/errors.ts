export class BotError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string = message,
  ) {
    super(message);
    this.name = 'BotError';
  }
}

export class PermissionError extends BotError {
  constructor(userMessage = 'You do not have permission to perform this action.') {
    super('Permission denied', userMessage);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends BotError {
  constructor(entity: string, id?: string | number) {
    const message = id !== undefined ? `${entity} with ID ${id} was not found.` : `${entity} was not found.`;
    super(message, message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends BotError {
  constructor(userMessage: string) {
    super(userMessage, userMessage);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends BotError {
  constructor(message = 'A database error occurred. Please try again later.') {
    super(message, message);
    this.name = 'DatabaseError';
  }
}

export function isBotError(error: unknown): error is BotError {
  return error instanceof BotError;
}

export function wrapDatabaseError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (isBotError(error)) {
      throw error;
    }
    console.error('Database error:', error);
    throw new DatabaseError();
  }
}
