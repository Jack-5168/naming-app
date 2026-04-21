/**
 * KOC Dashboard Component
 * Phase 4: Growth Features - KOC 分销系统
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './KOCDashboard.scss';

interface Commission {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  createdAt: string;
}

interface DashboardData {
  totalReferrals: number;
  convertedReferrals: number;
  conversionRate: number;
  totalEarned: number;
  totalWithdrawn: number;
  balance: number;
}

export const KOCDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [referralLink, setReferralLink] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard data
      const dashboardRes = await Taro.request({
        url: '/api/v1/growth/koc/dashboard',
        method: 'GET',
      });
      setDashboard(dashboardRes.data.data);

      // Fetch commissions
      const commissionsRes = await Taro.request({
        url: '/api/v1/growth/koc/commissions',
        method: 'GET',
      });
      setCommissions(commissionsRes.data.data.commissions);

      // Fetch referral link
      const referralRes = await Taro.request({
        url: '/api/v1/growth/koc/referral-link',
        method: 'GET',
      });
      setReferralLink(referralRes.data.data.referralLink);
    } catch (error) {
      console.error('Load data failed:', error);
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await Taro.setClipboardData({
        data: referralLink,
      });
      Taro.showToast({
        title: '已复制',
        icon: 'success',
      });
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleShare = async () => {
    try {
      await Taro.shareAppMessage({
        title: '人格测试 - 专业性格分析',
        path: `/?ref=${referralLink.split('ref=')[1]}`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!dashboard || dashboard.balance < 50) {
      Taro.showToast({
        title: '余额不足¥50',
        icon: 'none',
      });
      return;
    }

    Taro.showModal({
      title: '提现申请',
      content: `可提现金额：¥${dashboard.balance.toFixed(2)}`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await Taro.request({
              url: '/api/v1/growth/koc/withdraw',
              method: 'POST',
              data: {
                amount: dashboard.balance,
                alipayAccount: 'user@example.com', // Get from user profile
              },
            });
            
            Taro.showToast({
              title: '提现申请已提交',
              icon: 'success',
            });
            
            loadData(); // Refresh data
          } catch (error) {
            console.error('Withdraw failed:', error);
            Taro.showToast({
              title: '提现失败',
              icon: 'none',
            });
          }
        }
      },
    });
  };

  if (loading) {
    return (
      <View className="koc-dashboard loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="koc-dashboard" scrollY>
      {/* Stats Overview */}
      <View className="stats-section">
        <View className="stat-card primary">
          <Text className="stat-value">¥{dashboard?.balance.toFixed(2) || '0.00'}</Text>
          <Text className="stat-label">可提现余额</Text>
        </View>

        <View className="stats-grid">
          <View className="stat-item">
            <Text className="stat-value">{dashboard?.totalReferrals || 0}</Text>
            <Text className="stat-label">邀请人数</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{dashboard?.conversionRate.toFixed(1) || '0'}%</Text>
            <Text className="stat-label">转化率</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">¥{dashboard?.totalEarned.toFixed(2) || '0.00'}</Text>
            <Text className="stat-label">累计收益</Text>
          </View>
        </View>
      </View>

      {/* Referral Link */}
      <View className="referral-section">
        <Text className="section-title">专属推广链接</Text>
        <View className="link-container">
          <Text className="link-text" selectable>
            {referralLink}
          </Text>
          <Button className="copy-btn" onClick={handleCopyLink}>
            复制
          </Button>
        </View>
        <Button className="share-btn" onClick={handleShare}>
          分享给好友
        </Button>
        <Text className="commission-note">
          好友通过你的链接购买，你可获得 15% 佣金
        </Text>
      </View>

      {/* Withdraw */}
      <View className="withdraw-section">
        <Button
          className="withdraw-btn"
          onClick={handleWithdraw}
          disabled={!dashboard || dashboard.balance < 50}
        >
          提现
        </Button>
        <Text className="withdraw-note">
          满¥50 可提现，3 个工作日内到账
        </Text>
      </View>

      {/* Commission Records */}
      <View className="records-section">
        <Text className="section-title">佣金记录</Text>
        {commissions.length === 0 ? (
          <View className="empty-state">
            <Text>暂无记录</Text>
          </View>
        ) : (
          commissions.map((commission) => (
            <View key={commission.id} className="record-item">
              <View className="record-info">
                <Text className="record-date">
                  {new Date(commission.createdAt).toLocaleDateString()}
                </Text>
                <Text className="record-status">{getStatusText(commission.status)}</Text>
              </View>
              <Text className={`record-amount ${commission.amount < 0 ? 'negative' : 'positive'}`}>
                {commission.amount < 0 ? '-' : '+'}¥{Math.abs(commission.amount).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    paid: '已打款',
    cancelled: '已取消',
  };
  return statusMap[status] || status;
}

export default KOCDashboard;
