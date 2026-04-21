import { View, Text, Button, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import './user.css';

const User = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [membership, setMembership] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = Taro.getStorageSync('accessToken');
      
      // Fetch user info
      const userRes = await Taro.request({
        url: 'http://localhost:3000/api/v1/users/me',
        header: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUserInfo(userRes.data.user);

      // Fetch membership
      const membershipRes = await Taro.request({
        url: 'http://localhost:3000/api/v1/memberships/me',
        header: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMembership(membershipRes.data);

      // Fetch report history
      const historyRes = await Taro.request({
        url: 'http://localhost:3000/api/v1/reports',
        header: {
          Authorization: `Bearer ${token}`,
        },
      });
      setHistory(historyRes.data.reports);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const handleLogin = () => {
    Taro.login({
      success: async (res) => {
        if (res.code) {
          try {
            const loginRes = await Taro.request({
              url: 'http://localhost:3000/api/v1/auth/wechat/login',
              method: 'POST',
              data: { code: res.code },
            });
            
            const { accessToken, refreshToken } = loginRes.data;
            Taro.setStorageSync('accessToken', accessToken);
            Taro.setStorageSync('refreshToken', refreshToken);
            
            fetchUserData();
            Taro.showToast({
              title: '登录成功',
              icon: 'success',
            });
          } catch (error) {
            Taro.showToast({
              title: '登录失败',
              icon: 'none',
            });
          }
        }
      },
    });
  };

  const viewReport = (reportId) => {
    Taro.navigateTo({
      url: `/pages/report/report?id=${reportId}`,
    });
  };

  const logout = () => {
    Taro.removeStorageSync('accessToken');
    Taro.removeStorageSync('refreshToken');
    setUserInfo(null);
    setMembership(null);
    setHistory([]);
    Taro.showToast({
      title: '已退出登录',
      icon: 'success',
    });
  };

  if (!userInfo) {
    return (
      <View className="user-page">
        <View className="login-section">
          <Text className="login-title">登录后查看</Text>
          <Button className="login-btn" onClick={handleLogin}>
            微信一键登录
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="user-page">
      {/* User Profile */}
      <View className="profile-section">
        <View className="avatar">
          {userInfo.avatarUrl ? (
            <Image src={userInfo.avatarUrl} mode="aspectFill" />
          ) : (
            <Text className="avatar-placeholder">👤</Text>
          )}
        </View>
        <Text className="nickname">{userInfo.nickname || '探索者'}</Text>
        {membership?.isMember && (
          <View className="member-badge">
            <Text className="member-text">VIP 会员</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View className="stats-section">
        <View className="stat-item">
          <Text className="stat-value">{userInfo.testCount}</Text>
          <Text className="stat-label">测试次数</Text>
        </View>
        <View className="stat-divider" />
        <View className="stat-item">
          <Text className="stat-value">{history.length}</Text>
          <Text className="stat-label">报告数量</Text>
        </View>
      </View>

      {/* Membership Info */}
      {membership?.isMember ? (
        <View className="membership-card">
          <Text className="membership-title">会员有效期至</Text>
          <Text className="membership-date">
            {new Date(membership.endDate).toLocaleDateString()}
          </Text>
        </View>
      ) : (
        <View className="membership-promo">
          <Text className="promo-title">开通会员</Text>
          <Text className="promo-text">解锁完整报告，享受更多权益</Text>
          <Button className="upgrade-btn">立即升级</Button>
        </View>
      )}

      {/* History */}
      <View className="history-section">
        <Text className="section-title">测试历史</Text>
        {history.length > 0 ? (
          history.map((report) => (
            <View
              key={report.id}
              className="history-item"
              onClick={() => viewReport(report.id)}
            >
              <View className="history-info">
                <Text className="history-type">{report.personalityType}</Text>
                <Text className="history-date">
                  {new Date(report.completedAt).toLocaleDateString()}
                </Text>
              </View>
              <View className="history-stability">
                <Text className="stability-label">稳定性</Text>
                <Text className="stability-value">{report.stabilityIndex}</Text>
              </View>
            </View>
          ))
        ) : (
          <View className="empty-history">
            <Text>暂无测试记录</Text>
          </View>
        )}
      </View>

      {/* Logout */}
      <Button className="logout-btn" onClick={logout}>
        退出登录
      </Button>
    </View>
  );
};

export default User;
