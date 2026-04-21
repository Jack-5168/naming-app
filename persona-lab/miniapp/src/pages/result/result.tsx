import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import StabilityGauge from '../../components/StabilityGauge';
import ShareCard from '../../components/ShareCard';
import './result.css';

const Result = () => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params;
    if (params?.id) {
      fetchResult(params.id);
    }
  }, []);

  const fetchResult = async (id) => {
    try {
      const token = Taro.getStorageSync('accessToken');
      const res = await Taro.request({
        url: `http://localhost:3000/api/v1/tests/results/${id}`,
        header: {
          Authorization: `Bearer ${token}`,
        },
      });
      setResult(res.data);
      setLoading(false);
    } catch (error) {
      Taro.showToast({
        title: '加载结果失败',
        icon: 'none',
      });
      setLoading(false);
    }
  };

  const viewReport = () => {
    const params = Taro.getCurrentInstance().router?.params;
    if (params?.reportId) {
      Taro.navigateTo({
        url: `/pages/report/report?id=${params.reportId}`,
      });
    }
  };

  const shareResult = () => {
    Taro.showShareMenu({
      withShareTicket: true,
    });
  };

  if (loading) {
    return (
      <View className="result-page loading">
        <Text>加载结果中...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View className="result-page error">
        <Text>未找到测试结果</Text>
      </View>
    );
  }

  return (
    <View className="result-page">
      <View className="result-header">
        <Text className="result-title">测试结果</Text>
        <Text className="result-subtitle">探索真实的自己</Text>
      </View>

      {/* Personality Type */}
      <View className="personality-type-card">
        <Text className="type-label">您的人格类型是</Text>
        <Text className="type-value">{result.personalityType || '探索者'}</Text>
        <Text className="type-description">
          这种类型的人通常具有独特的思维方式和行为模式
        </Text>
      </View>

      {/* Dimension Scores */}
      <View className="dimension-scores">
        <Text className="section-title">四维得分</Text>
        <View className="score-item">
          <Text className="score-label">开放性</Text>
          <View className="score-bar-container">
            <View
              className="score-bar"
              style={{ width: `${result.dimensionScores?.openness || 50}%` }}
            />
          </View>
          <Text className="score-value">{result.dimensionScores?.openness || 50}</Text>
        </View>
        <View className="score-item">
          <Text className="score-label">尽责性</Text>
          <View className="score-bar-container">
            <View
              className="score-bar"
              style={{ width: `${result.dimensionScores?.conscientiousness || 50}%` }}
            />
          </View>
          <Text className="score-value">{result.dimensionScores?.conscientiousness || 50}</Text>
        </View>
        <View className="score-item">
          <Text className="score-label">外向性</Text>
          <View className="score-bar-container">
            <View
              className="score-bar"
              style={{ width: `${result.dimensionScores?.extraversion || 50}%` }}
            />
          </View>
          <Text className="score-value">{result.dimensionScores?.extraversion || 50}</Text>
        </View>
        <View className="score-item">
          <Text className="score-label">神经质</Text>
          <View className="score-bar-container">
            <View
              className="score-bar"
              style={{ width: `${result.dimensionScores?.neuroticism || 50}%` }}
            />
          </View>
          <Text className="score-value">{result.dimensionScores?.neuroticism || 50}</Text>
        </View>
      </View>

      {/* Stability Index */}
      <View className="stability-section">
        <Text className="section-title">稳定性指数</Text>
        <StabilityGauge value={result.stabilityIndex || 0} />
        <Text className="stability-description">
          基于您的 {result.totalQuestions || 0} 次测试，结果稳定性评估
        </Text>
      </View>

      {/* Share Card */}
      <ShareCard
        personalityType={result.personalityType || '探索者'}
        stabilityIndex={result.stabilityIndex || 0}
      />

      {/* Action Buttons */}
      <View className="action-buttons">
        <Button className="report-btn" onClick={viewReport}>
          查看完整报告
        </Button>
        <Button className="share-btn" onClick={shareResult}>
          分享结果
        </Button>
        <Button className="retry-btn" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
          返回首页
        </Button>
      </View>
    </View>
  );
};

export default Result;
