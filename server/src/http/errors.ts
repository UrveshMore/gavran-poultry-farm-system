import { ZodError } from 'zod';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { fields?: Record<string, string> };

  constructor(status: number, code: string, message: string, details?: { fields?: Record<string, string> }) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || 'form';
    if (fields[key]) continue;
    fields[key] = issue.message || issue.code;
  }
  return fields;
}
