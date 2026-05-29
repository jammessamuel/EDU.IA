"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitAuthMiddleware = void 0;
const common_1 = require("@nestjs/common");
const authRateLimitMap = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_REQUESTS = 10;
let RateLimitAuthMiddleware = class RateLimitAuthMiddleware {
    use(req, res, next) {
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
};
exports.RateLimitAuthMiddleware = RateLimitAuthMiddleware;
exports.RateLimitAuthMiddleware = RateLimitAuthMiddleware = __decorate([
    (0, common_1.Injectable)()
], RateLimitAuthMiddleware);
//# sourceMappingURL=rate-limit.js.map