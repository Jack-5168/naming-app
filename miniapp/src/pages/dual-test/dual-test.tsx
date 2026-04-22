/**
 * Dual Test Page - 双人合测页面
 * Phase 4: Growth Features
 * 
 * Features:
 * - 邀请好友入口
 * - 合测结果展示
 * - 兼容性分析
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Button, Image, Canvas, ScrollView } from '@tarojs/components';
import { useNavigate, useRouter } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import './dual-test.css';

interface DualTestPageProps {
  testId?: string;
}

interface DualTestData {
  dualTestId: number;
  inviteCode: string;
  status: 'pending' | 'accepted' | 'completed';
  initiator?: {
    id: number;
    nickname: string;
    avatar: string;
    mbtiType?: string;
  };
  participant?: {
    id: number;
    nickname: string;
    avatar: string;
    mbtiType?: string;
  } | null;
  compatibilityScore?: number;
  compatibilityLevel?: string;
  conflictWarnings?: any[];
  relationshipAdvice?: any[];
  expiresAt?: string;
}

export const DualTestPage: React.FC<DualTestPageProps> = ({ testId: propTestId }) => {
  const navigate = useNavigate();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [dualTest, setDualTest] = useState<DualTestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitationMethod, setInvitationMethod] = useState<'wechat' | 'link' | 'qrcode'>('wechat');

  useEffect(() => {
    // Check if this is an invitation page or result page
    const { inviteCode, dualTestId } = router.params;
    const currentTestId = propTestId || dualTestId;

    if (inviteCode) {
      // User clicked an invitation link
      loadInvitation(inviteCode);
    } else if (currentTestId) {
      // Viewing existing dual test
      loadDualTest(currentTestId);
    } else {
      setLoading(false);
      setError('No test ID or invite code provided');
    }
  }, []);

  /**
   * Load invitation details (for invitees)
   */
  const loadInvitation = async (inviteCode: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/dual-test/invite/${inviteCode}`);
      const data = await response.json();

      if (data.success) {
        setDualTest({
          dualTestId: 0,
          inviteCode,
          status: 'pending',
          initiator: data.data.initiator,
          expiresAt: data.data.expiresAt,
        });
      } else {
        setError(data.error || 'Invitation not found');
      }
    } catch (err) {
      setError('Failed to load invitation');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load dual test details
   */
  const loadDualTest = async (dualTestId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/dual-test/${dualTestId}`);
      const data = await response.json();

      if (data.success) {
        setDualTest(data.data);
      } else {
        setError(data.error || 'Failed to load dual test');
      }
    } catch (err) {
      setError('Failed to load dual test');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Accept invitation
   */
  const handleAcceptInvitation = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/dual-test/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: dualTest?.inviteCode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Taro.showToast({
          title: '已接受邀请',
          icon: 'success',
        });
        // Navigate to test page
        navigate({ url: '/pages/test/test' });
      } else {
        Taro.showToast({
          title: data.error || '接受失败',
          icon: 'none',
        });
      }
    } catch (err) {
      Taro.showToast({
        title: '网络错误',
        icon: 'none',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create dual test invitation
   */
  const handleCreateInvitation = async () => {
    try {
      if (!propTestId) {
        Taro.showToast({
          title: '请先完成测试',
          icon: 'none',
        });
        return;
      }

      setLoading(true);
      const response = await fetch('/api/v1/dual-test/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: propTestId,
          invitationMethod,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDualTest(data.data);
        setShowInviteModal(false);
        Taro.showToast({
          title: '邀请已创建',
          icon: 'success',
        });
      } else {
        if (data.error?.includes('upgrade')) {
          // Show paywall
          Taro.showModal({
            title: '双人合测',
            content: '双人合测功能需要付费解锁（¥99）',
            confirmText: '立即解锁',
            success: (res) => {
              if (res.confirm) {
                navigate({ url: '/membership/upgrade' });
              }
            },
          });
        } else {
          Taro.showToast({
            title: data.error || '创建失败',
            icon: 'none',
          });
        }
      }
    } catch (err) {
      Taro.showToast({
        title: '网络错误',
        icon: 'none',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Share invitation
   */
  const handleShare = () => {
    if (!dualTest?.shareUrl) return;

    Taro.showShareMenu({
      withShareTicket: true,
      showShareItems: ['wechatFriends', 'wechatMoment'],
    });
  };

  /**
   * Copy share link
   */
  const handleCopyLink = () => {
    if (!dualTest?.shareUrl) return;

    Taro.setClipboardData({
      data: dualTest.shareUrl,
      success: () => {
        Taro.showToast({
          title: '链接已复制',
          icon: 'success',
        });
      },
    });
  };

  /**
   * Save QR code
   */
  const handleSaveQRCode = () => {
    if (!dualTest?.qrCode) return;

    Taro.saveImageToPhotosAlbum({
      filePath: dualTest.qrCode,
      success: () => {
        Taro.showToast({
          title: '已保存到相册',
          icon: 'success',
        });
      },
      fail: () => {
        Taro.showToast({
          title: '保存失败',
          icon: 'none',
        });
      },
    });
  };

  if (loading) {
    return (
      <View className="dual-test-loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="dual-test-error">
        <Text>{error}</Text>
        <Button onClick={() => navigate({ url: '/pages/index/index' })}>
          返回首页
        </Button>
      </View>
    );
  }

  // Invitation page (for invitees)
  if (dualTest?.status === 'pending' && !dualTest.initiator) {
    return (
      <View className="dual-test-invitation">
        <View className="invitation-header">
          <Text className="invitation-title">双人合测邀请</Text>
        </View>

        <View className="invitation-content">
          {dualTest.initiator && (
            <View className="initiator-info">
              <Image
                className="initiator-avatar"
                src={dualTest.initiator.avatar}
                mode="aspectFill"
              />
              <Text className="initiator-name">{dualTest.initiator.nickname}</Text>
              {dualTest.initiator.mbtiType && (
                <Text className="initiator-type">{dualTest.initiator.mbtiType}</Text>
              )}
            </View>
          )}

          <Text className="invitation-text">
            邀请你一起进行 MBTI 双人合测，探索你们的性格契合度
          </Text>

          <View className="invitation-features">
            <View className="feature-item">
              <Text className="feature-icon">🎯</Text>
              <Text className="feature-text">匹配度评分</Text>
            </View>
            <View className="feature-item">
              <Text className="feature-icon">⚠️</Text>
              <Text className="feature-text">冲突预警</Text>
            </View>
            <View className="feature-item">
              <Text className="feature-icon">💡</Text>
              <Text className="feature-text">关系建议</Text>
            </View>
          </View>

          {dualTest.expiresAt && (
            <Text className="expiration-text">
              邀请有效期至 {new Date(dualTest.expiresAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View className="invitation-actions">
          <Button className="action-btn primary" onClick={handleAcceptInvitation}>
            接受邀请
          </Button>
          <Button className="action-btn secondary" onClick={() => navigate({ url: '/pages/index/index' })}>
            先看看
          </Button>
        </View>
      </View>
    );
  }

  // Dual test result page
  if (dualTest?.status === 'completed') {
    return (
      <View className="dual-test-result">
        <View className="result-header">
          <Text className="result-title">双人合测报告</Text>
          <Text className="result-subtitle">探索你们的性格契合度</Text>
        </View>

        {/* Compatibility Score */}
        <View className="compatibility-section">
          <View className="score-circle">
            <Text className="score-value">
              {Math.round((dualTest.compatibilityScore || 0) * 100)}
            </Text>
            <Text className="score-label">契合度</Text>
          </View>
          <Text className="compatibility-level">
            {getCompatibilityLevelText(dualTest.compatibilityLevel)}
          </Text>
        </View>

        {/* User Types */}
        <View className="users-section">
          <View className="user-card">
            <Image
              className="user-avatar"
              src={dualTest.initiator?.avatar}
              mode="aspectFill"
            />
            <Text className="user-name">{dualTest.initiator?.nickname}</Text>
            <Text className="user-type">{dualTest.initiator?.mbtiType}</Text>
          </View>

          <View className="vs-divider">
            <Text>V</Text>
            <Text>S</Text>
          </View>

          <View className="user-card">
            <Image
              className="user-avatar"
              src={dualTest.participant?.avatar}
              mode="aspectFill"
            />
            <Text className="user-name">{dualTest.participant?.nickname}</Text>
            <Text className="user-type">{dualTest.participant?.mbtiType}</Text>
          </View>
        </View>

        {/* Conflict Warnings */}
        {dualTest.conflictWarnings && dualTest.conflictWarnings.length > 0 && (
          <View className="warnings-section">
            <Text className="section-title">⚠️ 冲突预警</Text>
            {dualTest.conflictWarnings.map((warning, index) => (
              <View key={index} className="warning-item">
                <Text className="warning-dimension">{warning.dimension}</Text>
                <Text className="warning-description">{warning.description}</Text>
                <Text className="warning-suggestion">💡 {warning.suggestion}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Relationship Advice */}
        {dualTest.relationshipAdvice && dualTest.relationshipAdvice.length > 0 && (
          <View className="advice-section">
            <Text className="section-title">💡 相处之道</Text>
            {dualTest.relationshipAdvice.map((advice, index) => (
              <View key={index} className="advice-item">
                <Text className="advice-category">{advice.category}</Text>
                <Text className="advice-text">{advice.advice}</Text>
                <Text className="advice-example">例：{advice.example}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View className="result-actions">
          <Button className="action-btn primary" onClick={handleShare}>
            分享报告
          </Button>
          <Button className="action-btn secondary" onClick={() => navigate({ url: '/pages/index/index' })}>
            返回首页
          </Button>
        </View>
      </View>
    );
  }

  // Default: Show create invitation option
  return (
    <View className="dual-test-home">
      <View className="home-header">
        <Text className="home-title">双人合测</Text>
        <Text className="home-subtitle">邀请好友一起探索性格契合度</Text>
      </View>

      <View className="home-features">
        <View className="feature-card">
          <Text className="feature-icon">🎯</Text>
          <Text className="feature-title">匹配度评分</Text>
          <Text className="feature-desc">0-100 分量化契合度</Text>
        </View>
        <View className="feature-card">
          <Text className="feature-icon">⚠️</Text>
          <Text className="feature-title">冲突预警</Text>
          <Text className="feature-desc">识别潜在矛盾点</Text>
        </View>
        <View className="feature-card">
          <Text className="feature-icon">💡</Text>
          <Text className="feature-title">关系建议</Text>
          <Text className="feature-desc">专业相处之道</Text>
        </View>
      </View>

      <View className="home-price">
        <Text className="price-label">价格</Text>
        <Text className="price-value">¥99</Text>
      </View>

      <View className="home-actions">
        <Button className="action-btn primary" onClick={() => setShowInviteModal(true)}>
          邀请好友合测
        </Button>
        <Button className="action-btn secondary" onClick={() => navigate({ url: '/pages/index/index' })}>
          返回首页
        </Button>
      </View>

      {/* Invitation Modal */}
      {showInviteModal && (
        <View className="modal-overlay">
          <View className="modal-content">
            <Text className="modal-title">选择邀请方式</Text>
            
            <View className="method-options">
              <View
                className={`method-option ${invitationMethod === 'wechat' ? 'selected' : ''}`}
                onClick={() => setInvitationMethod('wechat')}
              >
                <Text className="method-icon">💬</Text>
                <Text className="method-name">微信</Text>
              </View>
              <View
                className={`method-option ${invitationMethod === 'link' ? 'selected' : ''}`}
                onClick={() => setInvitationMethod('link')}
              >
                <Text className="method-icon">🔗</Text>
                <Text className="method-name">链接</Text>
              </View>
              <View
                className={`method-option ${invitationMethod === 'qrcode' ? 'selected' : ''}`}
                onClick={() => setInvitationMethod('qrcode')}
              >
                <Text className="method-icon">📱</Text>
                <Text className="method-name">二维码</Text>
              </View>
            </View>

            <View className="modal-actions">
              <Button className="action-btn primary" onClick={handleCreateInvitation}>
                创建邀请
              </Button>
              <Button className="action-btn secondary" onClick={() => setShowInviteModal(false)}>
                取消
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * Get compatibility level text
 */
function getCompatibilityLevelText(level?: string): string {
  const levelMap: { [key: string]: string } = {
    excellent: '天作之合',
    good: '非常匹配',
    moderate: '中等契合',
    challenging: '需要磨合',
  };
  return levelMap[level || 'moderate'] || '中等契合';
}

export default DualTestPage;
