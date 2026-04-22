/**
 * MembershipCard Component
 * Phase 4: 会员权益管理系统
 * 
 * Displays current membership status and benefit usage
 */

import { View, Text, Progress } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './MembershipCard.css';

interface UsageItem {
  benefit: string;
  used: number;
  limit: number | 'unlimited';
  remaining: number | 'unlimited';
  resetDate?: string | null;
}

interface MembershipCardProps {
  tier: string;
  tierName: string;
  status: 'none' | 'active' | 'expired';
  endDate: string | null;
  usage: UsageItem[];
}

const benefitLabels: Record<string, string> = {
  report_basic: '基础报告',
  report_pro: '专业报告',
  life_event: '生活事件',
  dual_test: '双人合测',
  priority_support: '优先支持',
};

const benefitIcons: Record<string, string> = {
  report_basic: '📄',
  report_pro: '📊',
  life_event: '🎉',
  dual_test: '👥',
  priority_support: '⭐',
};

const MembershipCard: React.FC<MembershipCardProps> = ({
  tier,
  tierName,
  status,
  endDate,
  usage,
}) => {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getTierGradient = () => {
    switch (tier) {
      case 'FREE':
        return 'linear-gradient(135deg, #999 0%, #666 100%)';
      case 'BASIC':
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      case 'PRO_REPORT':
        return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
      case 'PRO_MONTHLY':
        return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
      case 'PRO_YEARLY':
        return 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
      case 'DUAL_TEST':
        return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
      default:
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'active':
        return '有效期内';
      case 'expired':
        return '已过期';
      case 'none':
        return '未开通';
      default:
        return '';
    }
  };

  const calculateProgress = (item: UsageItem): number => {
    if (item.limit === 'unlimited') return 100;
    if (item.limit === 0) return 0;
    return Math.min(100, Math.round((item.used / item.limit) * 100));
  };

  const getProgressColor = (percent: number): string => {
    if (percent >= 80) return '#f5576c';
    if (percent >= 50) return '#f093fb';
    return '#4caf50';
  };

  return (
    <View className="membership-card" style={{ background: getTierGradient() }}>
      {/* Card Header */}
      <View className="card-header">
        <View className="tier-info">
          <Text className="tier-name">{tierName}</Text>
          <View className="status-badge">
            <Text className="status-text">{getStatusText()}</Text>
          </View>
        </View>
        {endDate && status === 'active' && (
          <View className="expiry-info">
            <Text className="expiry-label">有效期至</Text>
            <Text className="expiry-date">{formatDate(endDate)}</Text>
          </View>
        )}
      </View>

      {/* Usage Progress */}
      <View className="card-usage">
        <Text className="usage-title">权益使用情况</Text>
        {usage.map((item, index) => {
          const percent = calculateProgress(item);
          const color = getProgressColor(percent);

          return (
            <View key={index} className="usage-item">
              <View className="usage-header">
                <Text className="usage-icon">{benefitIcons[item.benefit] || '📍'}</Text>
                <Text className="usage-name">{benefitLabels[item.benefit] || item.benefit}</Text>
                <Text className="usage-count">
                  {item.limit === 'unlimited' ? (
                    <Text className="unlimited-text">无限</Text>
                  ) : (
                    `${item.used}/${item.limit}`
                  )}
                </Text>
              </View>
              {item.limit !== 'unlimited' && item.limit > 0 && (
                <View className="usage-progress">
                  <Progress
                    percent={percent}
                    color={color}
                    backgroundColor="rgba(255,255,255,0.3)"
                    strokeWidth={6}
                    activeColor={color}
                  />
                  {item.resetDate && (
                    <Text className="reset-date">
                      重置：{formatDate(item.resetDate)}
                    </Text>
                  )}
                </View>
              )}
              {item.limit === 0 && (
                <Text className="not-included">该权益未包含</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Quick Actions */}
      <View className="card-actions">
        <Button
          className="action-btn"
          onClick={() => {
            Taro.navigateTo({
              url: '/pages/membership/membership',
            });
          }}
        >
          升级会员
        </Button>
        <Button
          className="action-btn secondary"
          onClick={() => {
            Taro.showModal({
              title: '会员说明',
              content: '会员权益在有效期内可重复使用，部分权益按月/年重置。',
              showCancel: false,
            });
          }}
        >
          权益说明
        </Button>
      </View>
    </View>
  );
};

export default MembershipCard;
