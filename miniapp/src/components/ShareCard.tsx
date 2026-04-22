/**
 * ShareCard Component - 分享卡片组件
 * Phase 4: Growth Features
 * 
 * Features:
 * - MBTI 类型海报
 * - 二维码生成
 * - 自定义文案
 * - 支持保存到相册
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, Image, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './ShareCard.css';

interface ShareCardProps {
  personalityType: string;
  typeName?: string;
  typeDescription?: string;
  dimensionScores?: {
    E: number;
    N: number;
    T: number;
    J: number;
  };
  stabilityIndex?: number;
  testCount?: number;
  goldenQuote?: string;
  rarity?: string;
  qrCodeUrl?: string;
  shareUrl?: string;
  onSaved?: () => void;
}

const ShareCard: React.FC<ShareCardProps> = ({
  personalityType,
  typeName,
  typeDescription,
  dimensionScores,
  stabilityIndex,
  testCount = 1,
  goldenQuote,
  rarity,
  qrCodeUrl,
  shareUrl,
  onSaved,
}) => {
  const canvasRef = useRef<any>(null);
  const [cardImage, setCardImage] = React.useState<string>('');

  useEffect(() => {
    // Generate card image when component mounts
    generateCardImage();
  }, [personalityType, stabilityIndex]);

  /**
   * Generate card image from canvas
   */
  const generateCardImage = async () => {
    try {
      // In production, use canvas to generate image
      // For now, we'll use a placeholder approach
      const query = `?type=${personalityType}&stability=${stabilityIndex || 0}`;
      const imageUrl = `/api/v1/share/cards/render/personality${query}`;
      setCardImage(imageUrl);
    } catch (error) {
      console.error('Failed to generate card image:', error);
    }
  };

  /**
   * Save card to album
   */
  const handleSaveToAlbum = async () => {
    try {
      if (!cardImage) {
        Taro.showToast({
          title: '卡片生成中',
          icon: 'none',
        });
        return;
      }

      // Download image first
      const filePath = await downloadImage(cardImage);

      // Save to photos album
      await Taro.saveImageToPhotosAlbum({
        filePath,
        success: () => {
          Taro.showToast({
            title: '已保存到相册',
            icon: 'success',
            duration: 2000,
          });
          onSaved?.();
        },
        fail: (err) => {
          console.error('Save failed:', err);
          Taro.showModal({
            title: '保存失败',
            content: '请检查相册权限设置',
            showCancel: false,
          });
        },
      });
    } catch (error) {
      console.error('Error saving to album:', error);
      Taro.showToast({
        title: '保存失败',
        icon: 'none',
      });
    }
  };

  /**
   * Download image to local
   */
  const downloadImage = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      Taro.downloadFile({
        url: url.startsWith('http') ? url : `https://personaalab.com${url}`,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error('Download failed'));
          }
        },
        fail: reject,
      });
    });
  };

  /**
   * Share to WeChat
   */
  const handleShare = () => {
    Taro.showShareMenu({
      withShareTicket: true,
      showShareItems: ['wechatFriends', 'wechatMoment'],
    });
  };

  /**
   * Copy link
   */
  const handleCopyLink = () => {
    if (!shareUrl) return;

    Taro.setClipboardData({
      data: shareUrl,
      success: () => {
        Taro.showToast({
          title: '链接已复制',
          icon: 'success',
        });
      },
    });
  };

  return (
    <View className="share-card-container">
      {/* Card Preview */}
      <View className="share-card-preview">
        <View className="share-card" id="shareCard">
          {/* Header */}
          <View className="card-header">
            <View className="brand-section">
              <Text className="brand-name">人格探索局</Text>
              <Text className="brand-slogan">探索真实的自己</Text>
            </View>
          </View>

          {/* Main Content */}
          <View className="card-main">
            {/* Personality Type */}
            <View className="type-section">
              <Text className="type-label">我的 MBTI 类型</Text>
              <View className="type-badge-large">
                <Text className="type-text-large">{personalityType}</Text>
              </View>
              {typeName && (
                <Text className="type-name">{typeName}</Text>
              )}
              {typeDescription && (
                <Text className="type-description">{typeDescription}</Text>
              )}
            </View>

            {/* Dimension Scores */}
            {dimensionScores && (
              <View className="dimensions-section">
                <DimensionBar label="外向 E" score={dimensionScores.E} color="#FF6B6B" />
                <DimensionBar label="直觉 N" score={dimensionScores.N} color="#4ECDC4" />
                <DimensionBar label="思考 T" score={dimensionScores.T} color="#45B7D1" />
                <DimensionBar label="判断 J" score={dimensionScores.J} color="#96CEB4" />
              </View>
            )}

            {/* Stability Index */}
            {stabilityIndex !== undefined && (
              <View className="stability-section">
                <Text className="stability-label">人格稳定性指数</Text>
                <View className="stability-gauge">
                  <View
                    className="stability-bar"
                    style={{ width: `${stabilityIndex}%` }}
                  />
                </View>
                <Text className="stability-value">{stabilityIndex}%</Text>
                {testCount > 1 && (
                  <Text className="stability-note">基于{testCount}次测试</Text>
                )}
              </View>
            )}

            {/* Golden Quote */}
            {goldenQuote && (
              <View className="quote-section">
                <Text className="quote-text">"{goldenQuote}"</Text>
              </View>
            )}

            {/* Rarity */}
            {rarity && (
              <View className="rarity-section">
                <Text className="rarity-text">
                  🌟 只有{rarity}的人是这个类型
                </Text>
              </View>
            )}
          </View>

          {/* Footer with QR Code */}
          <View className="card-footer">
            {qrCodeUrl ? (
              <Image
                className="qr-code"
                src={qrCodeUrl}
                mode="aspectFill"
              />
            ) : (
              <View className="qr-placeholder">
                <Text className="qr-placeholder-text">扫码测试</Text>
              </View>
            )}
            <Text className="footer-text">长按识别二维码开始测试</Text>
            <Text className="footer-url">personaalab.com</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="card-actions">
        <View className="action-button" onClick={handleSaveToAlbum}>
          <Text className="action-icon">💾</Text>
          <Text className="action-text">保存到相册</Text>
        </View>
        <View className="action-button" onClick={handleShare}>
          <Text className="action-icon">📤</Text>
          <Text className="action-text">分享</Text>
        </View>
        <View className="action-button" onClick={handleCopyLink}>
          <Text className="action-icon">🔗</Text>
          <Text className="action-text">复制链接</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Dimension Bar Component
 */
interface DimensionBarProps {
  label: string;
  score: number;
  color: string;
}

const DimensionBar: React.FC<DimensionBarProps> = ({ label, score, color }) => {
  const percentage = Math.min(100, Math.max(0, score));

  return (
    <View className="dimension-bar">
      <Text className="dimension-label">{label}</Text>
      <View className="dimension-track">
        <View
          className="dimension-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </View>
      <Text className="dimension-score">{Math.round(percentage)}</Text>
    </View>
  );
};

export default ShareCard;
