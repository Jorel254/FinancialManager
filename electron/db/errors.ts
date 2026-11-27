export class DbError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DbError";
    this.code = code;
  }
}

export function isDbError(error: unknown): error is DbError {
  return error instanceof DbError;
}
