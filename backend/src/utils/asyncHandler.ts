import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express route handler so that any rejected promise
 * is automatically forwarded to Express's next() error handler.
 *
 * Without this, async errors in Express 4 become unhandled promise
 * rejections, which in Node.js v24+ can crash the process via the
 * libuv UV_HANDLE_CLOSING assertion on Windows.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
