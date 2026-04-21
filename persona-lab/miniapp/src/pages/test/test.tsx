import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import QuestionCard from '../../components/QuestionCard';
import ProgressBar from '../../components/ProgressBar';
import './test.css';

const Test = () => {
  const [sessionId, setSessionId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    createTestSession();
  }, []);

  const createTestSession = async () => {
    try {
      const token = Taro.getStorageSync('accessToken');
      const res = await Taro.request({
        url: 'http://localhost:3000/api/v1/tests/sessions',
        method: 'POST',
        header: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSessionId(res.data.sessionId);
      setTotalQuestions(res.data.totalQuestions);
      setStartTime(Date.now());
      fetchNextQuestion();
    } catch (error) {
      Taro.showToast({
        title: '创建测试失败',
        icon: 'none',
      });
      setLoading(false);
    }
  };

  const fetchNextQuestion = async () => {
    try {
      const res = await Taro.request({
        url: `http://localhost:3000/api/v1/tests/sessions/${sessionId}/next`,
      });

      if (res.data.completed) {
        // Test completed
        finishTest();
        return;
      }

      setCurrentQuestion(res.data.question);
      setQuestionNumber(res.data.questionNumber);
      setLoading(false);
    } catch (error) {
      Taro.showToast({
        title: '加载题目失败',
        icon: 'none',
      });
    }
  };

  const handleAnswer = async (optionId) => {
    if (submitting) return;
    setSubmitting(true);

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    try {
      const token = Taro.getStorageSync('accessToken');
      await Taro.request({
        url: `http://localhost:3000/api/v1/tests/sessions/${sessionId}/answer`,
        method: 'POST',
        header: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          questionId: currentQuestion.id,
          optionId,
          timeSpent,
        },
      });

      // Auto navigate to next question with animation
      setTimeout(() => {
        setStartTime(Date.now());
        fetchNextQuestion();
        setSubmitting(false);
      }, 300);
    } catch (error) {
      Taro.showToast({
        title: '提交失败',
        icon: 'none',
      });
      setSubmitting(false);
    }
  };

  const finishTest = async () => {
    try {
      const token = Taro.getStorageSync('accessToken');
      
      // Get test results
      const resultRes = await Taro.request({
        url: `http://localhost:3000/api/v1/tests/results/${sessionId}`,
        header: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Generate report
      const reportRes = await Taro.request({
        url: 'http://localhost:3000/api/v1/reports',
        method: 'POST',
        header: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          testResultId: resultRes.data.id,
        },
      });

      // Navigate to result page
      Taro.redirectTo({
        url: `/pages/result/result?id=${resultRes.data.id}&reportId=${reportRes.data.id}`,
      });
    } catch (error) {
      Taro.showToast({
        title: '完成测试失败',
        icon: 'none',
      });
    }
  };

  if (loading) {
    return (
      <View className="test-page loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <View className="test-page">
      <ProgressBar current={questionNumber} total={totalQuestions} />
      
      <View className="question-container">
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            questionNumber={questionNumber}
            onAnswer={handleAnswer}
            disabled={submitting}
          />
        )}
      </View>
    </View>
  );
};

export default Test;
