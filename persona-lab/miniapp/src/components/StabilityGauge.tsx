import { View, Text } from '@tarojs/components';
import './StabilityGauge.css';

interface StabilityGaugeProps {
  value: number;
}

const StabilityGauge: React.FC<StabilityGaugeProps> = ({ value }) => {
  // Clamp value between 0 and 100
  const normalizedValue = Math.min(100, Math.max(0, value));
  
  // Determine level
  const getLevel = (val: number) => {
    if (val >= 80) return { label: '非常稳定', color: '#07c160', stars: 5 };
    if (val >= 60) return { label: '比较稳定', color: '#667eea', stars: 4 };
    if (val >= 40) return { label: '中等', color: '#ff9800', stars: 3 };
    if (val >= 20) return { label: '不太稳定', color: '#ff5722', stars: 2 };
    return { label: '需要更多测试', color: '#f44336', stars: 1 };
  };

  const level = getLevel(normalizedValue);
  const rotation = (normalizedValue / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <View className="stability-gauge">
      <View className="gauge-container">
        <View className="gauge-background">
          <View className="gauge-arc" />
        </View>
        <View
          className="gauge-needle"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        <View className="gauge-center">
          <Text className="gauge-value">{normalizedValue}</Text>
        </View>
      </View>
      
      <View className="gauge-labels">
        <Text className="gauge-level" style={{ color: level.color }}>
          {level.label}
        </Text>
        <View className="gauge-stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <Text
              key={i}
              className={`star ${i < level.stars ? 'active' : ''}`}
            >
              ★
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};

export default StabilityGauge;
