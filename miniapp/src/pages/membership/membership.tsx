/**
 * Membership Page
 * Phase 4: 会员权益管理系统
 * 
 * Features:
 * - Display 6 membership tiers with pricing
 * - Show current membership status
 * - Display benefit usage
 * - Allow membership upgrade
 */

import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import MembershipCard from '../../components/MembershipCard';
import PricingTable from '../../components/PricingTable';
import './membership.css';

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

interface CurrentMembership {
  tier: string;
  tierName: string;
  status: 'none' | 'active' | 'expired';
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
  benefits: any;
  usage: Array<{
    benefit: string;
    used: number;
    limit: number | 'unlimited';
    remaining: number | 'unlimited';
    resetDate?: string | null;
  }>;
  features: string[];
}

const Membership: React.FC = () => {
  const router = useRouter();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [currentMembership, setCurrentMembership] = useState<CurrentMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchMembershipData();
  }, []);

  const fetchMembershipData = async () => {
    try {
      setLoading(true);
      const token = Taro.getStorageSync('accessToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch tiers
      const tiersRes = await Taro.request({
        url: 'http://localhost:3000/api/v1/memberships/tiers',
        header: headers,
      });

      if (tiersRes.data.success) {
        setTiers(tiersRes.data.data);
      }

      // Fetch current membership
      const currentRes = await Taro.request({
        url: 'http://localhost:3000/api/v1/memberships/me',
        header: headers,
      });

      if (currentRes.data.success) {
        setCurrentMembership(currentRes.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch membership data:', error);
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: MembershipTier) => {
    if (upgrading) return;

    // Check if already this tier
    if (currentMembership?.tier === tier.tier) {
      Taro.showToast({
        title: '已是该会员等级',
        icon: 'none',
      });
      return;
    }

    Taro.showModal({
      title: '确认升级',
      content: `升级为${tier.name}，价格${tier.priceDisplay}`,
      confirmText: '确认支付',
      cancelText: '再想想',
      success: async (res) => {
        if (res.confirm) {
          setUpgrading(true);
          try {
            const token = Taro.getStorageSync('accessToken');
            const upgradeRes = await Taro.request({
              url: 'http://localhost:3000/api/v1/memberships/upgrade',
              method: 'POST',
              header: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              data: {
                tier: tier.tier,
                productId: tier.sortOrder + 1,
              },
            });

            if (upgradeRes.data.success) {
              Taro.showToast({
                title: '升级成功',
                icon: 'success',
              });
              fetchMembershipData(); // Refresh data
            } else {
              Taro.showToast({
                title: upgradeRes.data.error || '升级失败',
                icon: 'none',
              });
            }
          } catch (error) {
            console.error('Upgrade failed:', error);
            Taro.showToast({
              title: '支付失败',
              icon: 'none',
            });
          } finally {
            setUpgrading(false);
          }
        }
      },
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View className="membership-page loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <View className="membership-page">
      {/* Header */}
      <View className="membership-header">
        <Text className="page-title">会员中心</Text>
        <Text className="page-subtitle">选择适合您的会员方案</Text>
      </View>

      {/* Current Membership Status */}
      {currentMembership && (
        <View className="current-membership-section">
          <MembershipCard
            tier={currentMembership.tier}
            tierName={currentMembership.tierName}
            status={currentMembership.status}
            endDate={currentMembership.endDate}
            usage={currentMembership.usage}
          />
        </View>
      )}

      {/* Membership Tiers */}
      <View className="tiers-section">
        <Text className="section-title">会员套餐</Text>
        <ScrollView className="tiers-scroll" scrollY>
          {tiers.map((tier) => (
            <View key={tier.tier} className="tier-item">
              <View className="tier-info">
                <View className="tier-header">
                  <Text className="tier-name">{tier.name}</Text>
                  {tier.isPopular && (
                    <View className="popular-badge">
                      <Text>热门</Text>
                    </View>
                  )}
                </View>
                <Text className="tier-price">{tier.priceDisplay}</Text>
                {tier.billingCycle === 'monthly' && (
                  <Text className="billing-cycle">/月</Text>
                )}
                {tier.billingCycle === 'yearly' && (
                  <Text className="billing-cycle">/年</Text>
                )}
                <Text className="tier-duration">
                  {tier.durationDays === 0 ? '永久有效' : `有效期${tier.durationDays}天`}
                </Text>
              </View>

              <View className="tier-benefits">
                <Text className="benefit-item">
                  📄 基础报告：{tier.benefits.report_basic === 'unlimited' ? '无限' : tier.benefits.report_basic}次
                </Text>
                <Text className="benefit-item">
                  📊 专业报告：{tier.benefits.report_pro === 'unlimited' ? '无限' : tier.benefits.report_pro}次
                </Text>
                <Text className="benefit-item">
                  🎉 生活事件：{tier.benefits.life_event === 'unlimited' ? '无限' : tier.benefits.life_event}次
                </Text>
                <Text className="benefit-item">
                  👥 双人合测：{tier.benefits.dual_test === 'unlimited' ? '无限' : tier.benefits.dual_test}次
                </Text>
                {tier.benefits.priority_support && (
                  <Text className="benefit-item highlight">
                    ⭐ 优先支持：✅
                  </Text>
                )}
              </View>

              <View className="tier-features">
                {tier.features.map((feature, index) => (
                  <Text key={index} className="feature-item">
                    ✓ {feature}
                  </Text>
                ))}
              </View>

              <Button
                className={`upgrade-btn ${currentMembership?.tier === tier.tier ? 'current' : ''} ${tier.isPopular ? 'popular' : ''}`}
                onClick={() => handleUpgrade(tier)}
                disabled={upgrading || currentMembership?.tier === tier.tier}
              >
                {currentMembership?.tier === tier.tier ? '当前套餐' : '立即升级'}
              </Button>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Pricing Table Link */}
      <View className="pricing-table-section">
        <Button
          className="pricing-table-btn"
          onClick={() => {
            Taro.navigateTo({
              url: '/pages/membership/pricing-table',
            });
          }}
        >
          查看详细对比表
        </Button>
      </View>
    </View>
  );
};

export default Membership;
