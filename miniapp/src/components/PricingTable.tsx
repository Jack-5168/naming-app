/**
 * PricingTable Component
 * Phase 4: 会员权益管理系统
 * 
 * Displays detailed comparison table of all membership tiers
 */

import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import './PricingTable.css';

interface MembershipTier {
  tier: string;
  name: string;
  nameEn: string;
  price: number;
  priceDisplay: string;
  durationDays: number;
  billingCycle?: 'once' | 'monthly' | 'yearly';
  benefits: {
    report_basic: number | 'unlimited';
    report_pro: number | 'unlimited';
    life_event: number | 'unlimited';
    dual_test: number | 'unlimited';
    priority_support: boolean;
  };
  features: string[];
  isPopular?: boolean;
  sortOrder: number;
}

interface PricingTableProps {
  onUpgrade?: (tier: string) => void;
  currentTier?: string;
}

const benefitRows = [
  { key: 'report_basic', label: '基础报告', icon: '📄' },
  { key: 'report_pro', label: '专业报告', icon: '📊' },
  { key: 'life_event', label: '生活事件', icon: '🎉' },
  { key: 'dual_test', label: '双人合测', icon: '👥' },
  { key: 'priority_support', label: '优先支持', icon: '⭐', isBoolean: true },
];

const PricingTable: React.FC<PricingTableProps> = ({ onUpgrade, currentTier }) => {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      const token = Taro.getStorageSync('accessToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await Taro.request({
        url: 'http://localhost:3000/api/v1/memberships/tiers',
        header: headers,
      });

      if (res.data.success) {
        setTiers(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number | 'unlimited' | boolean, isBoolean?: boolean): string => {
    if (isBoolean) {
      return value ? '✅' : '❌';
    }
    if (value === 'unlimited') return '无限';
    if (value === 0) return '—';
    return `${value}次`;
  };

  const handleUpgrade = (tier: MembershipTier) => {
    if (onUpgrade) {
      onUpgrade(tier.tier);
    } else {
      Taro.navigateTo({
        url: '/pages/membership/membership',
      });
    }
  };

  if (loading) {
    return (
      <View className="pricing-table loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <View className="pricing-table">
      <View className="table-header">
        <Text className="table-title">会员套餐对比</Text>
        <Text className="table-subtitle">选择最适合您的方案</Text>
      </View>

      <ScrollView className="table-scroll" scrollX scrollY>
        <View className="table-container">
          {/* Header Row */}
          <View className="table-row header-row">
            <View className="table-cell feature-cell">
              <Text>权益</Text>
            </View>
            {tiers.map((tier) => (
              <View
                key={tier.tier}
                className={`table-cell tier-cell ${tier.isPopular ? 'popular' : ''} ${currentTier === tier.tier ? 'current' : ''}`}
              >
                <Text className="tier-name">{tier.name}</Text>
                <Text className="tier-price">{tier.priceDisplay}</Text>
                {tier.billingCycle === 'monthly' && <Text className="cycle">/月</Text>}
                {tier.billingCycle === 'yearly' && <Text className="cycle">/年</Text>}
                {tier.isPopular && <View className="popular-tag"><Text>推荐</Text></View>}
                {currentTier === tier.tier && <View className="current-tag"><Text>当前</Text></View>}
              </View>
            ))}
          </View>

          {/* Benefit Rows */}
          {benefitRows.map((row) => (
            <View key={row.key} className="table-row">
              <View className="table-cell feature-cell">
                <Text className="feature-icon">{row.icon}</Text>
                <Text className="feature-label">{row.label}</Text>
              </View>
              {tiers.map((tier) => (
                <View key={tier.tier} className="table-cell value-cell">
                  <Text className="value-text">
                    {formatValue(tier.benefits[row.key as keyof typeof tier.benefits], row.isBoolean)}
                  </Text>
                </View>
              ))}
            </View>
          ))}

          {/* Features Section */}
          <View className="table-row section-row">
            <View className="table-cell feature-cell">
              <Text className="section-label">特色功能</Text>
            </View>
            {tiers.map((tier) => (
              <View key={tier.tier} className="table-cell features-cell">
                {tier.features.slice(0, 3).map((feature, idx) => (
                  <Text key={idx} className="feature-item">✓ {feature}</Text>
                ))}
              </View>
            ))}
          </View>

          {/* Action Row */}
          <View className="table-row action-row">
            <View className="table-cell feature-cell" />
            {tiers.map((tier) => (
              <View key={tier.tier} className="table-cell action-cell">
                <Button
                  className={`upgrade-btn ${tier.isPopular ? 'popular' : ''} ${currentTier === tier.tier ? 'current' : ''}`}
                  onClick={() => handleUpgrade(tier)}
                  disabled={currentTier === tier.tier}
                >
                  {currentTier === tier.tier ? '当前套餐' : '立即升级'}
                </Button>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer Note */}
      <View className="table-footer">
        <Text className="footer-note">
          💡 提示：会员权益在有效期内可重复使用，部分权益按周期重置
        </Text>
      </View>
    </View>
  );
};

export default PricingTable;
