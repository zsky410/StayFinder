export class HttpError extends Error {
  constructor(status, message, details = undefined, code = undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

export function badRequest(message, details) {
  return new HttpError(400, message, details, "bad_request");
}

export function unauthorized(message = "Unauthorized") {
  return new HttpError(401, message, undefined, "unauthorized");
}

export function forbidden(message = "Forbidden") {
  return new HttpError(403, message, undefined, "forbidden");
}

export function notFound(message = "Not found") {
  return new HttpError(404, message, undefined, "not_found");
}

export function serviceUnavailable(message, details) {
  return new HttpError(503, message, details, "service_unavailable");
}

export function asyncRoute(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorMiddleware(error, _req, res, _next) {
  if (error && error.code === "23505") {
    res.status(409).json({
      error: "conflict",
      message: "A unique constraint was violated.",
      details: error.detail,
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.code || "request_error",
      message: error.message,
      details: error.details,
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: "internal_error",
    message: "Unexpected server error.",
  });
}
