/**
 * Authentication Middleware
 * Phase 1: MVP Implementation
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../security/auth';

/**
 * Authentication middleware
 * Verifies JWT access token and attaches user to request
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }
    
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    
    (req as any).user = {
      id: payload.userId,
      email: payload.email,
      deviceId: payload.deviceId,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
}

export default authMiddleware;
