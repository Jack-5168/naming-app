/**
 * Share Page - 分享页面
 * Phase 4: Growth Features
 * 
 * Features:
 * - 分享渠道选择
 * - 分享统计
 * - 分享历史
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Button, Image, ScrollView } from '@tarojs/components';
import { useNavigate, useRouter } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import ShareCard from '../../components/ShareCard';
import './share.css';

interface SharePageProps {
  testId?: string;
}

interface ShareStats {
  totalShares: number;
  sharesByType: { [key: string]: number };
  sharesByChannel: { [key: string]: number };
  recentShares: any[];
  referralStats?: {
    code: string;
    totalReferrals: number;
    convertedReferrals: number;
  } | null;
}

interface ShareData {
  personalityType: string;
  typeName: string;
  typeDescription: string;
  dimensionScores: {
    E: number;
    N: number;
    T: number;
    J: number;
  };
  stabilityIndex: number;
  testCount: number;
  goldenQuote: string;
  rarity: string;
  qrCode: string;
  shareUrl: string;
  shareText: string;
}

export const SharePage: React.FC<SharePageProps> = ({ testId: propTestId }) => {
  const navigate = useNavigate();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [shareStats, setShareStats] = useState<ShareStats | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<'wechat' | 'moment' | 'qq' | 'link'>('wechat');
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const testId = propTestId || router.params.testId;
    if (testId) {
      loadShareData(testId);
    }
    loadShareStats();
  }, []);

  /**
   * Load share card data
   */
  const loadShareData = async (testId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/share/card/personality?testId=${testId}`);
      const data = await response.json();

      if (data.success) {
        setShareData({
          personalityType: data.data.cardData.personalityType,
          typeName: data.data.cardData.typeName,
          typeDescription: data.data.cardData.typeDescription,
          dimensionScores: data.data.cardData.dimensionScores,
          stabilityIndex: data.data.cardData.stabilityIndex,
          testCount: data.data.cardData.testCount,
          goldenQuote: data.data.cardData.goldenQuote,
          rarity: data.data.cardData.rarity,
          qrCode: data.data.cardImageUrl,
          shareUrl: data.data.shareUrl,
          shareText: data.data.shareText,
        });
      } else {
        Taro.showToast({
          title: data.error || '加载失败',
          icon: 'none',
        });
      }
    } catch (err) {
      console.error('Error loading share data:', err);
      Taro.showToast({
        title: '网络错误',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load share statistics
   */
  const loadShareStats = async () => {
    try {
      const response = await fetch('/api/v1/share/stats');
      const data = await response.json();

      if (data.success) {
        setShareStats(data.data);
      }
    } catch (err) {
      console.error('Error loading share stats:', err);
    }
  };

  /**
   * Track share event
   */
  const trackShare = async (channel: string) => {
    try {
      await fetch('/api/v1/share/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'personality_card',
          channel,
          targetId: propTestId || router.params.testId,
        }),
      });
    } catch (err) {
      console.error('Error tracking share:', err);
    }
  };

  /**
   * Handle share to WeChat
   */
  const handleShareToWeChat = async () => {
    await trackShare('wechat');
    
    Taro.showShareMenu({
      withShareTicket: true,
      showShareItems: ['wechatFriends'],
      success: () => {
        Taro.showToast({
          title: '点击右上角分享',
          icon: 'none',
        });
      },
    });
  };

  /**
   * Handle share to WeChat Moments
   */
  const handleShareToMoment = async () => {
    await trackShare('moment');
    
    Taro.showShareMenu({
      withShareTicket: true,
      showShareItems: ['wechatMoment'],
      success: () => {
        Taro.showToast({
          title: '点击右上角分享到朋友圈',
          icon: 'none',
        });
      },
    });
  };

  /**
   * Handle share to QQ
   */
  const handleShareToQQ = async () => {
    await trackShare('qq');
    
    Taro.showToast({
      title: 'QQ 分享功能开发中',
      icon: 'none',
    });
  };

  /**
   * Handle copy link
   */
  const handleCopyLink = async () => {
    await trackShare('link');
    
    if (!shareData?.shareUrl) return;

    Taro.setClipboardData({
      data: shareData.shareUrl,
      success: () => {
        Taro.showToast({
          title: '链接已复制',
          icon: 'success',
        });
      },
    });
  };

  /**
   * Handle save to album
   */
  const handleSaveToAlbum = () => {
    Taro.showToast({
      title: '长按卡片保存图片',
      icon: 'none',
    });
  };

  if (loading) {
    return (
      <View className="share-loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <View className="share-page">
      {/* Header */}
      <View className="share-header">
        <Text className="share-title">分享我的 MBTI</Text>
        <Text className="share-subtitle">邀请好友一起探索性格奥秘</Text>
        
        <View className="stats-toggle" onClick={() => setShowStats(!showStats)}>
          <Text className="stats-icon">📊</Text>
          <Text className="stats-text">
            {showStats ? '隐藏统计' : '查看统计'}
          </Text>
        </View>
      </View>

      {/* Share Statistics */}
      {showStats && shareStats && (
        <View className="share-stats">
          <View className="stats-summary">
            <View className="stat-item">
              <Text className="stat-value">{shareStats.totalShares}</Text>
              <Text className="stat-label">总分享</Text>
            </View>
            {shareStats.referralStats && (
              <>
                <View className="stat-item">
                  <Text className="stat-value">{shareStats.referralStats.totalReferrals}</Text>
                  <Text className="stat-label">邀请人数</Text>
                </View>
                <View className="stat-item">
                  <Text className="stat-value">{shareStats.referralStats.convertedReferrals}</Text>
                  <Text className="stat-label">成功转化</Text>
                </View>
              </>
            )}
          </View>

          {shareStats.sharesByChannel && Object.keys(shareStats.sharesByChannel).length > 0 && (
            <View className="stats-detail">
              <Text className="stats-detail-title">分享渠道</Text>
              {Object.entries(shareStats.sharesByChannel).map(([channel, count]) => (
                <View key={channel} className="channel-stat">
                  <Text className="channel-name">{getChannelName(channel)}</Text>
                  <Text className="channel-count">{count}次</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Share Card */}
      {shareData && (
        <ScrollView className="share-card-scroll" scrollY>
          <ShareCard
            personalityType={shareData.personalityType}
            typeName={shareData.typeName}
            typeDescription={shareData.typeDescription}
            dimensionScores={shareData.dimensionScores}
            stabilityIndex={shareData.stabilityIndex}
            testCount={shareData.testCount}
            goldenQuote={shareData.goldenQuote}
            rarity={shareData.rarity}
            qrCodeUrl={shareData.qrCode}
            shareUrl={shareData.shareUrl}
          />
        </ScrollView>
      )}

      {/* Share Channels */}
      <View className="share-channels">
        <Text className="channels-title">选择分享渠道</Text>
        
        <View className="channel-options">
          <View
            className={`channel-option ${selectedChannel === 'wechat' ? 'selected' : ''}`}
            onClick={() => setSelectedChannel('wechat')}
          >
            <View className="channel-icon wechat">💬</View>
            <Text className="channel-label">微信好友</Text>
          </View>
          
          <View
            className={`channel-option ${selectedChannel === 'moment' ? 'selected' : ''}`}
            onClick={() => setSelectedChannel('moment')}
          >
            <View className="channel-icon moment">📱</View>
            <Text className="channel-label">朋友圈</Text>
          </View>
          
          <View
            className={`channel-option ${selectedChannel === 'qq' ? 'selected' : ''}`}
            onClick={() => setSelectedChannel('qq')}
          >
            <View className="channel-icon qq">🐧</View>
            <Text className="channel-label">QQ 好友</Text>
          </View>
          
          <View
            className={`channel-option ${selectedChannel === 'link' ? 'selected' : ''}`}
            onClick={() => setSelectedChannel('link')}
          >
            <View className="channel-icon link">🔗</View>
            <Text className="channel-label">复制链接</Text>
          </View>
        </View>

        <View className="share-actions">
          {selectedChannel === 'wechat' && (
            <Button className="action-btn primary" onClick={handleShareToWeChat}>
              分享给微信好友
            </Button>
          )}
          
          {selectedChannel === 'moment' && (
            <Button className="action-btn primary" onClick={handleShareToMoment}>
              分享到朋友圈
            </Button>
          )}
          
          {selectedChannel === 'qq' && (
            <Button className="action-btn primary" onClick={handleShareToQQ}>
              分享给 QQ 好友
            </Button>
          )}
          
          {selectedChannel === 'link' && (
            <Button className="action-btn primary" onClick={handleCopyLink}>
              复制链接
            </Button>
          )}
          
          <Button className="action-btn secondary" onClick={handleSaveToAlbum}>
            保存卡片
          </Button>
        </View>
      </View>

      {/* KOC Referral Section */}
      {shareStats?.referralStats && (
        <View className="referral-section">
          <Text className="referral-title">🎁 邀请好友赚佣金</Text>
          <Text className="referral-desc">
            每成功邀请一位好友付费，即可获得 15% 佣金
          </Text>
          <View className="referral-stats">
            <View className="referral-stat">
              <Text className="referral-stat-value">
                {shareStats.referralStats.totalReferrals}
              </Text>
              <Text className="referral-stat-label">已邀请</Text>
            </View>
            <View className="referral-stat">
              <Text className="referral-stat-value">
                {shareStats.referralStats.convertedReferrals}
              </Text>
              <Text className="referral-stat-label">已转化</Text>
            </View>
          </View>
          <Button
            className="action-btn referral"
            onClick={() => navigate({ url: '/koc/dashboard' })}
          >
            查看佣金详情
          </Button>
        </View>
      )}
    </View>
  );
};

/**
 * Get channel name
 */
function getChannelName(channel: string): string {
  const names: { [key: string]: string } = {
    wechat: '微信好友',
    moment: '朋友圈',
    qq: 'QQ 好友',
    link: '复制链接',
    weibo: '微博',
  };
  return names[channel] || channel;
}

export default SharePage;
