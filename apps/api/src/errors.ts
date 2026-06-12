// Consistent error taxonomy. The HTTP layer renders these as
// { error: { type, code, message, param? } }.

export type ApiErrorType =
  | "authentication_error"
  | "authorization_error"
  | "invalid_request_error"
  | "not_found"
  | "rate_limit_error"
  | "conflict"
  | "api_error";

const STATUS_BY_TYPE: Record<ApiErrorType, number> = {
  authentication_error: 401,
  authorization_error: 403,
  invalid_request_error: 400,
  not_found: 404,
  rate_limit_error: 429,
  conflict: 409,
  api_error: 500,
};

export class ApiError extends Error {
  readonly type: ApiErrorType;
  readonly code: string;
  readonly status: number;
  readonly param?: string;

  constructor(
    type: ApiErrorType,
    code: string,
    message: string,
    param?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    this.code = code;
    this.status = STATUS_BY_TYPE[type];
    this.param = param;
  }

  toJSON() {
    return {
      error: {
        type: this.type,
        code: this.code,
        message: this.message,
        ...(this.param ? { param: this.param } : {}),
      },
    };
  }

  // Convenience constructors for the common cases.
  static unauthorized(message = "Authentication required", code = "unauthorized") {
    return new ApiError("authentication_error", code, message);
  }
  static forbidden(message = "Not allowed", code = "forbidden") {
    return new ApiError("authorization_error", code, message);
  }
  static badRequest(message: string, code = "invalid_request", param?: string) {
    return new ApiError("invalid_request_error", code, message, param);
  }
  static notFound(message = "Resource not found", code = "not_found") {
    return new ApiError("not_found", code, message);
  }
  static conflict(message: string, code = "conflict") {
    return new ApiError("conflict", code, message);
  }
}
