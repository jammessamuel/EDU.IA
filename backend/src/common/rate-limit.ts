import { Injectable, NestMiddleware } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const authRateLimitMap = new Map<string, RateLimitEntry>();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_REQUESTS = 10;

@Injectable()
export class RateLimitAuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const identifier = req.ip || 'anonymous';
    const now = Date.now();

    let entry = authRateLimitMap.get(identifier);

    if (!entry || now > entry.resetTime) {
      authRateLimitMap.set(identifier, { count: 1, resetTime: now + AUTH_WINDOW_MS });
      return next();
    }

    entry.count++;

    if (entry.count > AUTH_MAX_REQUESTS) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Muitas tentativas de login. Tente novamente em ${Math.ceil(retryAfter / 60)} minutos.`,
        retryAfter,
      });
    }

    next();
  }
}
