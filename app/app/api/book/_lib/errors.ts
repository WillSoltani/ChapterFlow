export class BookApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "BookApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isBookApiError(value: unknown): value is BookApiError {
  return value instanceof BookApiError;
}
