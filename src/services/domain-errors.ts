export class DomainError extends Error {
  constructor(message: string, public readonly code: string) { super(message); this.name = "DomainError"; }
}
export class NotFoundError extends DomainError {
  constructor(message: string) { super(message, "NOT_FOUND"); this.name = "NotFoundError"; }
}
export class InvalidStateError extends DomainError {
  constructor(message: string) { super(message, "INVALID_STATE"); this.name = "InvalidStateError"; }
}
export class ValidationError extends DomainError {
  constructor(message: string) { super(message, "VALIDATION"); this.name = "ValidationError"; }
}
