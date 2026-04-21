/**
 * Test Page - CAT-Enabled Adaptive Testing
 * Phase 2 Integration: Real-time ability estimates and CAT question selection
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Button, Progress } from '@tarojs/components';
import { useNavigate } from '@tarojs/taro';
import { Question, AnswerResponse } from '../../types';

interface TestPageProps {
  sessionId: string;
}

interface AbilityEstimate {
  E: number;
  N: number;
  T: number;
  J: number;
}

export const TestPage: React.FC<TestPageProps> = ({ sessionId }) => {
  const navigate = useNavigate();
  
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 20, percentage: 0 });
  const [ability, setAbility] = useState<AbilityEstimate | null>(null);
  const [sem, setSem] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial question
  useEffect(() => {
    fetchInitialQuestion();
  }, []);

  const fetchInitialQuestion = async () => {
    try {
      setLoading(true);
      // In production, this would call the API to start the test
      // For now, we assume the session is already created
      setError(null);
    } catch (err) {
      setError('Failed to load test');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle answer submission with CAT integration
   * Phase 2: Receives real-time ability estimates and next question from CAT engine
   */
  const onAnswerSubmit = async (answer: { questionId: string; dimension: string; selectedOption: string }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/tests/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer)
      });

      const data: AnswerResponse = await response.json();

      if (!data.accepted) {
        throw new Error('Answer not accepted');
      }

      if (data.completed) {
        // Test completed - navigate to results with stability data
        navigateToResult(data.result!, data.stability);
      } else {
        // Test continues - update UI with next question and real-time estimates
        setCurrentQuestion(data.nextQuestion!);
        setProgress(data.progress);
        
        // Phase 2: Display real-time ability estimates (optional feature)
        if (data.ability) {
          setAbility(data.ability);
          setSem(data.sem || null);
          updateProgress(data.ability, data.sem || 0);
        }
      }
    } catch (err) {
      setError('Failed to submit answer');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate to result page with test results and stability index
   */
  const navigateToResult = (result: any, stability: any) => {
    navigate({
      url: `/pages/result/result?sessionId=${sessionId}&result=${JSON.stringify(result)}&stability=${JSON.stringify(stability)}`
    });
  };

  /**
   * Update progress display with optional ability estimates
   */
  const updateProgress = (abilityEstimate: AbilityEstimate, semValue: number) => {
    // Could show a live chart of ability estimates
    // For now, just update state for optional display
    console.log('Current ability estimates:', abilityEstimate);
    console.log('Standard error:', semValue);
  };

  if (loading && !currentQuestion) {
    return (
      <View className="test-loading">
        <Text>Loading test...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="test-error">
        <Text>{error}</Text>
        <Button onClick={fetchInitialQuestion}>Retry</Button>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View className="test-start">
        <Text>Ready to start your personality assessment?</Text>
        <Button onClick={fetchInitialQuestion}>Start Test</Button>
      </View>
    );
  }

  return (
    <View className="test-page">
      {/* Progress Bar */}
      <View className="progress-section">
        <Progress 
          percent={progress.percentage} 
          color="#4A90E2"
          backgroundColor="#E0E0E0"
        />
        <Text className="progress-text">
          Question {progress.current} of {progress.total}
        </Text>
      </View>

      {/* Optional: Real-time Ability Display (Phase 2 Feature) */}
      {ability && (
        <View className="ability-display">
          <Text className="ability-title">Current Estimates:</Text>
          <View className="ability-scores">
            <Text>E: {ability.E}</Text>
            <Text>N: {ability.N}</Text>
            <Text>T: {ability.T}</Text>
            <Text>J: {ability.J}</Text>
            {sem && <Text className="sem">SEM: {sem.toFixed(2)}</Text>}
          </View>
        </View>
      )}

      {/* Question Content */}
      <View className="question-section">
        <Text className="question-text">{currentQuestion.content}</Text>
        
        {/* Answer Options */}
        <View className="options-section">
          {currentQuestion.options.map((option) => (
            <Button
              key={option.id}
              className="option-button"
              onClick={() => onAnswerSubmit({
                questionId: currentQuestion.id,
                dimension: currentQuestion.dimension,
                selectedOption: option.id
              })}
              disabled={loading}
            >
              {option.text}
            </Button>
          ))}
        </View>
      </View>
    </View>
  );
};

export default TestPage;
