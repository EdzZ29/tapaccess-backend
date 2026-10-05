import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth on top of SameSite cookies: any state-changing
 * request that carries an Origin header must come from an allowed origin.
 * Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE, so a
 * forged form or fetch from another site is rejected before it reaches a
 * controller. Requests without Origin (curl, server-to-server) are not
 * browser-driven and still need a valid session to do anything.
 */
export function originCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin;
    if (!origin || allowed.has(origin)) return next();
    res.status(403).json({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Origin not allowed',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  };
}
