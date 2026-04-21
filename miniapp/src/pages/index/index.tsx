import { View, Text, Button, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import './index.css';

const Index = () => {
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    // Check login status
    const token = Taro.getStorageSync('accessToken');
    if (token) {
      // Fetch user info
      fetchUserInfo();
    }
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = Taro.getStorageSync('accessToken');
      const res = await Taro.request({
        url: 'http://localhost:3000/api/v1/users/me',
        header: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUserInfo(res.data.user);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const handleLogin = () => {
    // WeChat login
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
            
            fetchUserInfo();
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

  const startTest = () => {
    if (!userInfo) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none',
      });
      return;
    }
    Taro.navigateTo({
      url: '/pages/test/test',
    });
  };

  return (
    <View className="index-page">
      {/* Hero Section */}
      <View className="hero">
        <Text className="title">人格探索局</Text>
        <Text className="subtitle">探索真实的自己，发现无限可能</Text>
      </View>

      {/* Social Proof */}
      <View className="social-proof">
        <View className="stat">
          <Text className="stat-number">10,000+</Text>
          <Text className="stat-label">测试次数</Text>
        </View>
        <View className="stat">
          <Text className="stat-number">98%</Text>
          <Text className="stat-label">好评率</Text>
        </View>
        <View className="stat">
          <Text className="stat-number">16</Text>
          <Text className="stat-label">人格类型</Text>
        </View>
      </View>

      {/* Report Preview */}
      <View className="report-preview">
        <Text className="section-title">报告样例</Text>
        <View className="preview-card">
          <View className="preview-item">
            <Text className="preview-label">人格类型</Text>
            <Text className="preview-value">ENFP - 竞选者</Text>
          </View>
          <View className="preview-item">
            <Text className="preview-label">四维得分</Text>
            <View className="score-bars">
              <View className="score-bar" style={{ width: '75%' }} />
              <View className="score-bar" style={{ width: '60%' }} />
              <View className="score-bar" style={{ width: '80%' }} />
              <View className="score-bar" style={{ width: '45%' }} />
            </View>
          </View>
          <View className="preview-item">
            <Text className="preview-label">稳定性指数</Text>
            <Text className="preview-value">★★★★☆</Text>
          </View>
        </View>
      </View>

      {/* CTA Button */}
      <View className="cta-section">
        {userInfo ? (
          <Button className="start-btn" onClick={startTest}>
            开始测试
          </Button>
        ) : (
          <Button className="login-btn" onClick={handleLogin}>
            微信一键登录
          </Button>
        )}
      </View>

      {/* User Info */}
      {userInfo && (
        <View className="user-info">
          <Text>欢迎，{userInfo.nickname || '探索者'}</Text>
          <Text>已测试 {userInfo.testCount} 次</Text>
        </View>
      )}
    </View>
  );
};

export default Index;
