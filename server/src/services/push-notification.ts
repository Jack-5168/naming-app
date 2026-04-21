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

import { PrismaClient, PushNotificationType, PushStatus } from '@prisma/client';
import webpush from 'web-push';

const prisma = new PrismaClient();

// ==================== Configuration ====================

// VAPID keys for web push (generate with: npx web-push generate-vapid-keys)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@personaalab.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ==================== Types ====================

export interface PushStrategy {
  type: 'report_ready' | 'retest_reminder' | 'membership_expiring' | 'personalized';
  trigger: 'immediate' | 'scheduled' | 'behavioral';
  delay: number; // seconds
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

// ==================== Notification Templates ====================

const NOTIFICATION_TEMPLATES: Record<PushNotificationType, PushStrategy> = {
  report_ready: {
    type: 'report_ready',
    trigger: 'immediate',
    delay: 0,
    template: '📊 你的报告已生成！点击查看完整分析',
    deepLink: '/report/{reportId}',
  },
  retest_reminder: {
    type: 'retest_reminder',
    trigger: 'scheduled',
    delay: 30 * 24 * 60 * 60, // 30 days
    template: '🔍 距离上次测试已经过去 30 天，你的性格维度可能发生了变化',
    deepLink: '/test/start',
  },
  membership_expiring: {
    type: 'membership_expiring',
    trigger: 'scheduled',
    delay: 7 * 24 * 60 * 60, // 7 days before expiry
    template: '⏰ 会员即将到期，续费享优惠',
    deepLink: '/membership/renew',
  },
  personalized: {
    type: 'personalized',
    trigger: 'behavioral',
    delay: 0,
    template: '📈 你的外向维度可能变化了 {change}%！',
    deepLink: '/report/compare',
  },
  dual_test_invite: {
    type: 'dual_test_invite',
    trigger: 'immediate',
    delay: 0,
    template: '👥 {inviter} 邀请你进行双人合测',
    deepLink: '/dual-test/{inviteCode}',
  },
  commission_paid: {
    type: 'commission_paid',
    trigger: 'immediate',
    delay: 0,
    template: '💰 佣金已到账：¥{amount}',
    deepLink: '/koc/commissions',
  },
};

// ==================== Main Functions ====================

/**
 * Create a push notification
 */
export async function createPushNotification(payload: PushNotificationPayload) {
  try {
    const { userId, type, title, content, deepLink, scheduledAt } = payload;

    const notification = await prisma.pushNotification.create({
      data: {
        userId,
        type,
        title,
        content,
        deepLink,
        status: scheduledAt ? 'pending' : 'pending',
        scheduledAt,
      },
    });

    // If not scheduled, send immediately
    if (!scheduledAt) {
      await sendNotification(notification.id);
    }

    return notification;
  } catch (error) {
    console.error('Error creating push notification:', error);
    throw error;
  }
}

/**
 * Send a notification to user's devices
 */
export async function sendNotification(notificationId: string) {
  try {
    const notification = await prisma.pushNotification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          include: {
            pushSubscriptions: true,
          },
        },
      },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    const subscriptions = notification.user.pushSubscriptions;
    
    if (subscriptions.length === 0) {
      console.log(`No push subscriptions for user ${notification.userId}`);
      await prisma.pushNotification.update({
        where: { id: notificationId },
        data: { status: 'failed' },
      });
      return;
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.content,
      deepLink: notification.deepLink,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
    });

    // Send to all user devices
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
      } catch (error) {
        console.error(`Failed to send to endpoint ${sub.endpoint}:`, error);
        // Remove invalid subscription
        if ((error as any).statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          });
        }
      }
    });

    await Promise.all(sendPromises);

    // Update notification status
    await prisma.pushNotification.update({
      where: { id: notificationId },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    await prisma.pushNotification.update({
      where: { id: notificationId },
      data: { status: 'failed' },
    });
    throw error;
  }
}

/**
 * Schedule notifications based on strategies
 */
export async function scheduleNotifications() {
  try {
    const now = new Date();

    // Schedule membership expiring reminders (7 days before)
    const expiringMemberships = await prisma.membership.findMany({
      where: {
        status: 'active',
        endDate: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: { user: true },
    });

    for (const membership of expiringMemberships) {
      // Check if reminder already sent
      const existingReminder = await prisma.pushNotification.findFirst({
        where: {
          userId: membership.userId,
          type: 'membership_expiring',
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (!existingReminder) {
        await createPushNotification({
          userId: membership.userId,
          type: 'membership_expiring',
          title: '会员即将到期',
          content: `您的会员将于${membership.endDate.toLocaleDateString()}到期，及时续费享受优惠`,
          deepLink: '/membership/renew',
        });
      }
    }

    // Schedule retest reminders (30 days after last test)
    const usersNeedingRetest = await prisma.testRecord.groupBy({
      by: ['userId'],
      _max: { completedAt: true },
      having: {
        completedAt: {
          lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    for (const record of usersNeedingRetest) {
      const userId = record.userId;
      
      // Check if reminder already sent
      const existingReminder = await prisma.pushNotification.findFirst({
        where: {
          userId,
          type: 'retest_reminder',
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (!existingReminder) {
        await createPushNotification({
          userId,
          type: 'retest_reminder',
          title: '重测提醒',
          content: '距离上次测试已经过去 30 天，你的性格维度可能发生了变化，快来重新测试吧！',
          deepLink: '/test/start',
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    throw error;
  }
}

/**
 * Send personalized notification based on dimension changes
 */
export async function sendPersonalizedNotification(
  userId: number,
  dimension: string,
  change: number
) {
  const template = NOTIFICATION_TEMPLATES.personalized.template.replace(
    '{change}',
    Math.abs(change).toFixed(1)
  );

  await createPushNotification({
    userId,
    type: 'personalized',
    title: '性格维度变化',
    content: template,
    deepLink: '/report/compare',
  });
}

/**
 * Subscribe user to push notifications
 */
export async function subscribeUser(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string,
  platform: string
) {
  try {
    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (existing) {
      return existing;
    }

    const subscription = await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint,
        p256dh,
        auth,
        platform,
      },
    });

    return subscription;
  } catch (error) {
    console.error('Error subscribing user:', error);
    throw error;
  }
}

/**
 * Unsubscribe user from push notifications
 */
export async function unsubscribeUser(endpoint: string) {
  try {
    await prisma.pushSubscription.delete({
      where: { endpoint },
    });
    return { success: true };
  } catch (error) {
    console.error('Error unsubscribing user:', error);
    throw error;
  }
}

// ==================== Cron Job Handler ====================

/**
 * Process scheduled notifications (should be called every minute)
 */
export async function processScheduledNotifications() {
  try {
    const now = new Date();

    const pendingNotifications = await prisma.pushNotification.findMany({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: now,
        },
      },
    });

    for (const notification of pendingNotifications) {
      await sendNotification(notification.id);
    }

    return { processed: pendingNotifications.length };
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
    throw error;
  }
}

export default {
  createPushNotification,
  sendNotification,
  scheduleNotifications,
  sendPersonalizedNotification,
  subscribeUser,
  unsubscribeUser,
  processScheduledNotifications,
};
