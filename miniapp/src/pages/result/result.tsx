/**
 * Result Page - Display MBTI Results with Stability Index
 * Phase 2 Integration: Shows stability gauge and confidence metrics
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Button, Canvas } from '@tarojs/components';
import { useNavigate, useRouter } from '@tarojs/taro';

interface ResultData {
  mbtiType: string;
  dimensionScores: {
    E: number;
    N: number;
    T: number;
    J: number;
  };
  confidence: number;
  completedAt: number;
}

interface StabilityData {
  stabilityIndex: number;
  stabilityProbability: number;
  status: 'stable' | 'moderate' | 'unstable' | 'new';
  confidenceBand: {
    lower: number;
    upper: number;
  };
}

interface ResultPageProps {
  // Props can be passed or retrieved from route params
  result?: ResultData;
  stability?: StabilityData;
}

export const ResultPage: React.FC<ResultPageProps> = ({ result: propResult, stability: propStability }) => {
  const navigate = useNavigate();
  const router = useRouter();
  
  const [result, setResult] = useState<ResultData | null>(null);
  const [stability, setStability] = useState<StabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get data from route params first, then props
    if (propResult && propStability) {
      setResult(propResult);
      setStability(propStability);
      setLoading(false);
    } else {
      // Parse from route params
      const { result: resultParam, stability: stabilityParam } = router.params;
      
      if (resultParam && stabilityParam) {
        try {
          setResult(JSON.parse(decodeURIComponent(resultParam)));
          setStability(JSON.parse(decodeURIComponent(stabilityParam)));
        } catch (err) {
          console.error('Failed to parse result data:', err);
        }
      }
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <View className="result-loading">
        <Text>Loading results...</Text>
      </View>
    );
  }

  if (!result || !stability) {
    return (
      <View className="result-error">
        <Text>No results available</Text>
        <Button onClick={() => navigate({ url: '/pages/test/test' })}>
          Retake Test
        </Button>
      </View>
    );
  }

  return (
    <View className="result-page">
      {/* MBTI Type Display */}
      <MBTIType type={result.mbtiType} />
      
      {/* Dimension Scores */}
      <DimensionScores dimensions={result.dimensionScores} />
      
      {/* Confidence Score */}
      <ConfidenceDisplay confidence={result.confidence} />
      
      {/* Phase 2: Stability Index Gauge */}
      <StabilityGauge 
        stabilityIndex={stability.stabilityIndex}
        probability={stability.stabilityProbability}
        status={stability.status}
        confidenceBand={stability.confidenceBand}
      />
      
      {/* Interpretation */}
      <Interpretation type={result.mbtiType} stability={stability} />
      
      {/* Paywall / Call to Action */}
      <Paywall />
      
      {/* Actions */}
      <View className="action-buttons">
        <Button className="action-btn" onClick={() => navigate({ url: '/pages/index/index' })}>
          Home
        </Button>
        <Button className="action-btn primary" onClick={() => navigate({ url: '/pages/report/report' })}>
          Detailed Report
        </Button>
      </View>
    </View>
  );
};

/**
 * Display MBTI Type with animation
 */
const MBTIType: React.FC<{ type: string }> = ({ type }) => {
  return (
    <View className="mbti-type-section">
      <Text className="type-label">Your Personality Type</Text>
      <Text className="type-value">{type}</Text>
      <Text className="type-description">
        {getTypeDescription(type)}
      </Text>
    </View>
  );
};

/**
 * Display dimension scores as bars
 */
const DimensionScores: React.FC<{ dimensions: { E: number; N: number; T: number; J: number } }> = ({ 
  dimensions 
}) => {
  const dims = [
    { key: 'E', label: 'Extraversion', score: dimensions.E },
    { key: 'N', label: 'Intuition', score: dimensions.N },
    { key: 'T', label: 'Thinking', score: dimensions.T },
    { key: 'J', label: 'Judging', score: dimensions.J }
  ];

  return (
    <View className="dimension-section">
      <Text className="section-title">Dimension Scores</Text>
      {dims.map(dim => (
        <View key={dim.key} className="dimension-bar">
          <Text className="dimension-label">{dim.label}</Text>
          <View className="bar-container">
            <View 
              className="bar-fill" 
              style={{ width: `${dim.score}%` }}
            />
          </View>
          <Text className="dimension-score">{dim.score}</Text>
        </View>
      ))}
    </View>
  );
};

/**
 * Display confidence score
 */
const ConfidenceDisplay: React.FC<{ confidence: number }> = ({ confidence }) => {
  return (
    <View className="confidence-section">
      <Text className="confidence-label">Assessment Confidence</Text>
      <View className="confidence-gauge">
        <Text className="confidence-value">{confidence}%</Text>
      </View>
    </View>
  );
};

/**
 * Phase 2: Stability Index Gauge Component
 * Shows how consistent the user's type is across multiple assessments
 */
interface StabilityGaugeProps {
  stabilityIndex: number;
  probability: number;
  status: 'stable' | 'moderate' | 'unstable' | 'new';
  confidenceBand: { lower: number; upper: number };
}

const StabilityGauge: React.FC<StabilityGaugeProps> = ({
  stabilityIndex,
  probability,
  status,
  confidenceBand
}) => {
  // Determine color based on status
  const getStatusColor = () => {
    switch (status) {
      case 'stable': return '#4CAF50';
      case 'moderate': return '#FFA726';
      case 'unstable': return '#EF5350';
      case 'new': return '#42A5F5';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'stable': return 'Highly Consistent';
      case 'moderate': return 'Moderately Consistent';
      case 'unstable': return 'Variable';
      case 'new': return 'First Assessment';
      default: return 'Unknown';
    }
  };

  return (
    <View className="stability-section" style={{ borderColor: getStatusColor() }}>
      <Text className="stability-title">Type Stability Index</Text>
      
      {/* Gauge Visualization */}
      <View className="stability-gauge">
        <View className="gauge-outer">
          <View 
            className="gauge-fill"
            style={{ 
              width: `${stabilityIndex}%`,
              backgroundColor: getStatusColor()
            }}
          />
        </View>
        <Text className="gauge-value">{stabilityIndex}</Text>
      </View>
      
      {/* Status Indicator */}
      <View className="stability-status">
        <Text 
          className="status-badge"
          style={{ backgroundColor: getStatusColor() }}
        >
          {getStatusText()}
        </Text>
      </View>
      
      {/* Probability Text */}
      <Text className="stability-probability">
        {Math.round(probability * 100)}% probability of same type on retest
      </Text>
      
      {/* Confidence Band */}
      <View className="confidence-band">
        <Text className="band-label">Confidence Range:</Text>
        <Text className="band-values">
          {confidenceBand.lower} - {confidenceBand.upper}
        </Text>
      </View>
      
      {/* Explanation */}
      <Text className="stability-explanation">
        {getStabilityExplanation(status)}
      </Text>
    </View>
  );
};

/**
 * Display interpretation text
 */
const Interpretation: React.FC<{ type: string; stability: StabilityData }> = ({ 
  type, 
  stability 
}) => {
  return (
    <View className="interpretation-section">
      <Text className="section-title">What This Means</Text>
      <Text className="interpretation-text">
        {getFullInterpretation(type, stability)}
      </Text>
    </View>
  );
};

/**
 * Paywall / Premium Features
 */
const Paywall: React.FC = () => {
  return (
    <View className="paywall-section">
      <Text className="paywall-title">Unlock Full Report</Text>
      <Text className="paywall-text">
        Get detailed insights, career recommendations, and relationship compatibility
      </Text>
      <Button className="paywall-btn">Upgrade to Premium</Button>
    </View>
  );
};

// Helper Functions

function getTypeDescription(type: string): string {
  const descriptions: { [key: string]: string } = {
    INTJ: 'The Architect - Strategic and analytical',
    INTP: 'The Thinker - Logical and innovative',
    ENTJ: 'The Commander - Bold and decisive',
    ENTP: 'The Debater - Curious and clever',
    INFJ: 'The Advocate - Insightful and inspiring',
    INFP: 'The Mediator - Poetic and kind',
    ENFJ: 'The Protagonist - Charismatic and inspiring',
    ENFP: 'The Campaigner - Enthusiastic and creative',
    ISTJ: 'The Logistician - Practical and fact-minded',
    ISFJ: 'The Defender - Dedicated and warm',
    ESTJ: 'The Executive - Excellent administrators',
    ESFJ: 'The Consul - Caring and social',
    ISTP: 'The Virtuoso - Bold and practical',
    ISFP: 'The Adventurer - Artistic and charming',
    ESTP: 'The Entrepreneur - Smart and energetic',
    ESFP: 'The Entertainer - Spontaneous and energetic'
  };
  return descriptions[type] || 'Unique personality type';
}

function getStabilityExplanation(status: string): string {
  const explanations: { [key: string]: string } = {
    stable: 'Your results show high consistency across assessments. Your personality type is well-established and reliable.',
    moderate: 'Your results show moderate consistency. Some variation is normal and may reflect personal growth or situational factors.',
    unstable: 'Your results show significant variation. This could indicate ongoing personal development or that you\'re between developmental stages.',
    new: 'This is your first assessment. Take the test again in a few weeks to see how consistent your results are.'
  };
  return explanations[status] || '';
}

function getFullInterpretation(type: string, stability: StabilityData): string {
  const baseInterpretation = getTypeDescription(type);
  const stabilityNote = stability.status === 'stable' 
    ? ' This assessment is highly reliable based on your test history.'
    : stability.status === 'new'
    ? ' Consider retaking the test to confirm your results.'
    : '';
  
  return `${baseInterpretation}.${stabilityNote}`;
}

export default ResultPage;
