/**
 * Share Card Component
 * Phase 4: Growth Features - 分享卡片
 */

import React, { useState } from 'react';
import { View, Text, Image, Button, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './ShareCard.scss';

interface ShareCardProps {
  type: 'personality' | 'stability' | 'dual-test';
  data: any;
  onShare?: () => void;
}

export const ShareCard: React.FC<ShareCardProps> = ({
  type,
  data,
  onShare,
}) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerateCard = async () => {
    setGenerating(true);
    try {
      // In production, use canvas to generate image
      const canvasId = 'share-card-canvas';
      const ctx = Taro.createCanvasContext(canvasId);
      
      // Draw card background
      ctx.setFillStyle('#667eea');
      ctx.fillRect(0, 0, 300, 400);
      
      // Draw content based on type
      if (type === 'personality') {
        ctx.setFillStyle('#ffffff');
        ctx.setFontSize(24);
        ctx.setTextAlign('center');
        ctx.fillText(data.personalityType || 'ENTJ', 150, 100);
        
        ctx.setFontSize(14);
        ctx.fillText(data.goldenQuote || '探索自我', 150, 150);
      } else if (type === 'stability') {
        ctx.setFillStyle('#ffffff');
        ctx.setFontSize(24);
        ctx.setTextAlign('center');
        ctx.fillText('性格稳定性', 150, 100);
        
        ctx.setFontSize(32);
        ctx.setFillStyle('#4CAF50');
        ctx.fillText(`${(data.stabilityIndex * 100).toFixed(0)}%`, 150, 160);
      }
      
      await ctx.draw();
      
      // Save image
      const tempFilePath = await new Promise<string>((resolve, reject) => {
        Taro.canvasToTempFilePath({
          canvasId,
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        });
      });
      
      // Share or save
      if (onShare) {
        onShare();
      }
    } catch (error) {
      console.error('Generate card failed:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleShareToFriends = async () => {
    try {
      await Taro.shareAppMessage({
        title: getShareTitle(type, data),
        path: getSharePath(type, data),
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <View className="share-card-container">
      <Canvas
        canvasId="share-card-canvas"
        className="share-card-canvas"
        style={{ width: '300px', height: '400px' }}
      />
      
      <View className="card-actions">
        <Button
          className="action-btn"
          loading={generating}
          onClick={handleGenerateCard}
        >
          生成分享卡片
        </Button>
        
        <Button className="action-btn secondary" onClick={handleShareToFriends}>
          分享给好友
        </Button>
      </View>
    </View>
  );
};

function getShareTitle(type: string, data: any): string {
  switch (type) {
    case 'personality':
      return `我是${data.personalityType}型人格 - 人格探索局`;
    case 'stability':
      return `我的性格稳定性指数：${(data.stabilityIndex * 100).toFixed(0)}%`;
    case 'dual-test':
      return '邀请你进行双人合测';
    default:
      return '人格探索局';
  }
}

function getSharePath(type: string, data: any): string {
  switch (type) {
    case 'personality':
      return `/pages/report/detail?id=${data.testId}`;
    case 'stability':
      return '/pages/stability/report';
    case 'dual-test':
      return `/pages/dual-test/accept?code=${data.inviteCode}`;
    default:
      return '/pages/index/index';
  }
}

export default ShareCard;
