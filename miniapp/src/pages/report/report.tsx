import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import Paywall from '../../components/Paywall';
import './report.css';

const Report = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params;
    if (params?.id) {
      fetchReport(params.id);
    }
  }, []);

  const fetchReport = async (id) => {
    try {
      const token = Taro.getStorageSync('accessToken');
      const res = await Taro.request({
        url: `http://localhost:3000/api/v1/reports/${id}`,
        header: {
          Authorization: `Bearer ${token}`,
        },
      });
      setReport(res.data);
      setLoading(false);

      if (!res.data.isUnlocked) {
        // Show paywall for locked sections
        setTimeout(() => setShowPaywall(true), 2000);
      }
    } catch (error) {
      Taro.showToast({
        title: '加载报告失败',
        icon: 'none',
      });
      setLoading(false);
    }
  };

  const unlockReport = () => {
    setShowPaywall(true);
  };

  if (loading) {
    return (
      <View className="report-page loading">
        <Text>加载报告中...</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View className="report-page error">
        <Text>未找到报告</Text>
      </View>
    );
  }

  return (
    <View className="report-page">
      <View className="report-header">
        <Text className="report-title">{report.title}</Text>
        <Text className="report-summary">{report.summary}</Text>
      </View>

      <ScrollView className="report-content" scrollY>
        {report.content?.sections?.map((section, index) => (
          <View key={index} className="report-section">
            <Text className="section-title">{section.title}</Text>
            <Text className="section-content">{section.content}</Text>
          </View>
        ))}

        {!report.isUnlocked && (
          <View className="locked-section">
            <View className="lock-icon">🔒</View>
            <Text className="lock-text">解锁完整报告</Text>
            <Text className="lock-hint">付费解锁剩余 13 页深度分析</Text>
            <Button className="unlock-btn" onClick={unlockReport}>
              立即解锁
            </Button>
          </View>
        )}
      </ScrollView>

      {showPaywall && (
        <Paywall
          onClose={() => setShowPaywall(false)}
          onUnlock={() => {
            setShowPaywall(false);
            // Refresh report after payment
            const params = Taro.getCurrentInstance().router?.params;
            if (params?.id) {
              fetchReport(params.id);
            }
          }}
        />
      )}
    </View>
  );
};

export default Report;
