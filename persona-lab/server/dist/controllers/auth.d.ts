/**
 * Authentication Controller
 * Phase 1: MVP Implementation
 *
 * API Endpoints:
 * - POST /api/v1/auth/wechat/login - WeChat login
 * - POST /api/v1/auth/refresh - Refresh access token
 * - GET /api/v1/users/me - Get current user info
 */
import { Request, Response } from 'express';
interface WechatLoginResponse {
    code: number;
    data: {
        token: string;
        expires_in: number;
        refresh_token: string;
        refresh_expires_in: number;
        user: {
            id: number;
            openid: string;
            nickname: string;
            avatar_url: string | null;
            membership: {
                level: string;
            };
        };
    };
}
interface RefreshTokenResponse {
    code: number;
    data: {
        token: string;
        expires_in: number;
        refresh_token: string;
        refresh_expires_in: number;
    };
}
interface UserInfoResponse {
    code: number;
    data: {
        id: number;
        openid: string;
        nickname: string | null;
        avatar_url: string | null;
        test_count: number;
        last_test_at: Date | null;
        membership: {
            level: string;
            end_date: Date | null;
        };
    };
}
interface ErrorResponse {
    code: number;
    error: string;
    message?: string;
}
/**
 * POST /api/v1/auth/wechat/login
 *
 * WeChat mini-program login
 * Exchanges WeChat login code for user tokens
 *
 * @param code - WeChat login code from mini-program
 * @returns JWT tokens and user info
 */
export declare function wechatLogin(req: Request, res: Response<WechatLoginResponse | ErrorResponse>): Promise<Response<WechatLoginResponse | ErrorResponse, Record<string, any>> | undefined>;
/**
 * POST /api/v1/auth/refresh
 *
 * Refresh access token using refresh token
 *
 * @param refresh_token - JWT refresh token
 * @returns New access and refresh tokens
 */
export declare function refreshToken(req: Request, res: Response<RefreshTokenResponse | ErrorResponse>): Promise<Response<RefreshTokenResponse | ErrorResponse, Record<string, any>> | undefined>;
/**
 * GET /api/v1/users/me
 *
 * Get current authenticated user information
 * Requires Bearer token in Authorization header
 *
 * @returns User profile information
 */
export declare function getCurrentUser(req: Request, res: Response<UserInfoResponse | ErrorResponse>): Promise<Response<UserInfoResponse | ErrorResponse, Record<string, any>> | undefined>;
declare const _default: {
    wechatLogin: typeof wechatLogin;
    refreshToken: typeof refreshToken;
    getCurrentUser: typeof getCurrentUser;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map