/**
 * Authentication Middleware
 * Phase 1: MVP Implementation
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Authentication middleware
 * Verifies JWT access token and attaches user to request
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export default authMiddleware;
//# sourceMappingURL=auth.d.ts.map