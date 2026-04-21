/**
 * Push Notification Service
 * Phase 4: Notification System
 *
 * Supports:
 * - Report ready notifications
 * - Retest reminders (30 days)
 * - Membership expiring reminders (7 days)
 * - Personalized notifications
 * - Dual test invitations
 * - Commission paid notifications
 */
import { PushNotificationType } from '@prisma/client';
export interface PushStrategy {
    type: 'report_ready' | 'retest_reminder' | 'membership_expiring' | 'personalized';
    trigger: 'immediate' | 'scheduled' | 'behavioral';
    delay: number;
    template: string;
    deepLink: string;
}
export interface PushNotificationPayload {
    userId: number;
    type: PushNotificationType;
    title: string;
    content: string;
    deepLink?: string;
    scheduledAt?: Date;
}
/**
 * Create a push notification
 */
export declare function createPushNotification(payload: PushNotificationPayload): Promise<any>;
/**
 * Send a notification to user's devices
 */
export declare function sendNotification(notificationId: string): Promise<{
    success: boolean;
} | undefined>;
/**
 * Schedule notifications based on strategies
 */
export declare function scheduleNotifications(): Promise<{
    success: boolean;
}>;
/**
 * Send personalized notification based on dimension changes
 */
export declare function sendPersonalizedNotification(userId: number, dimension: string, change: number): Promise<void>;
/**
 * Subscribe user to push notifications
 */
export declare function subscribeUser(userId: number, endpoint: string, p256dh: string, auth: string, platform: string): Promise<any>;
/**
 * Unsubscribe user from push notifications
 */
export declare function unsubscribeUser(endpoint: string): Promise<{
    success: boolean;
}>;
/**
 * Process scheduled notifications (should be called every minute)
 */
export declare function processScheduledNotifications(): Promise<{
    processed: any;
}>;
declare const _default: {
    createPushNotification: typeof createPushNotification;
    sendNotification: typeof sendNotification;
    scheduleNotifications: typeof scheduleNotifications;
    sendPersonalizedNotification: typeof sendPersonalizedNotification;
    subscribeUser: typeof subscribeUser;
    unsubscribeUser: typeof unsubscribeUser;
    processScheduledNotifications: typeof processScheduledNotifications;
};
export default _default;
//# sourceMappingURL=push-notification.d.ts.map