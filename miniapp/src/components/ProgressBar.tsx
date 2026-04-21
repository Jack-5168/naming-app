import { View, Text } from '@tarojs/components';
import './ProgressBar.css';

interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <View className="progress-bar">
      <View className="progress-info">
        <Text className="progress-text">
          第 {current} / {total} 题
        </Text>
        <Text className="progress-percentage">{percentage}%</Text>
      </View>
      <View className="progress-track">
        <View
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </View>
    </View>
  );
};

export default ProgressBar;
