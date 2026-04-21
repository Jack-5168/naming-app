/**
 * Dual Test Card Component
 * Phase 4: Growth Features - 双人合测
 */

import React, { useState } from 'react';
import { View, Text, Image, Button, Share } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './DualTestCard.scss';

interface DualTestCardProps {
  inviteCode: string;
  qrCodeUrl: string;
  onAccept?: () => void;
}

export const DualTestCard: React.FC<DualTestCardProps> = ({
  inviteCode,
  qrCodeUrl,
  onAccept,
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await Taro.shareAppMessage({
        title: '邀请你进行双人合测',
        path: `/pages/dual-test/accept?code=${inviteCode}`,
        imageUrl: qrCodeUrl,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await Taro.setClipboardData({
        data: `https://personaalab.com/dual-test/${inviteCode}`,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
  };

  return (
    <View className="dual-test-card">
      <View className="card-header">
        <Text className="card-title">👥 双人合测邀请</Text>
        <Text className="card-subtitle">探索你们的关系契合度</Text>
      </View>

      <View className="card-body">
        <View className="qr-code-container">
          {qrCodeUrl && (
            <Image
              className="qr-code"
              src={qrCodeUrl}
              mode="aspectFit"
            />
          )}
          <Text className="invite-code">邀请码：{inviteCode}</Text>
        </View>

        <View className="features-list">
          <View className="feature-item">
            <Text className="feature-icon">📊</Text>
            <Text className="feature-text">契合度分析</Text>
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
      </View>

      <View className="card-actions">
        <Button className="action-btn primary" onClick={handleShare}>
          分享给好友
        </Button>
        <Button className="action-btn secondary" onClick={handleCopyLink}>
          {copied ? '已复制' : '复制链接'}
        </Button>
        {onAccept && (
          <Button className="action-btn accept" onClick={handleAccept}>
            接受邀请
          </Button>
        )}
      </View>
    </View>
  );
};

export default DualTestCard;
