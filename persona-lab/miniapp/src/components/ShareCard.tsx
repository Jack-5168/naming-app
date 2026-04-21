import { View, Text, Image } from '@tarojs/components';
import './ShareCard.css';

interface ShareCardProps {
  personalityType: string;
  stabilityIndex: number;
}

const ShareCard: React.FC<ShareCardProps> = ({
  personalityType,
  stabilityIndex,
}) => {
  return (
    <View className="share-card">
      <View className="card-header">
        <Text className="card-title">人格探索局</Text>
        <Text className="card-subtitle">探索真实的自己</Text>
      </View>

      <View className="card-content">
        <View className="type-badge">
          <Text className="type-text">{personalityType}</Text>
        </View>
        
        <View className="stability-badge">
          <Text className="stability-text">稳定性指数</Text>
          <Text className="stability-value">{stabilityIndex}</Text>
        </View>
      </View>

      <View className="card-footer">
        <View className="qr-placeholder">
          <Text className="qr-text">扫码测试</Text>
        </View>
        <Text className="footer-text">长按识别二维码开始测试</Text>
      </View>
    </View>
  );
};

export default ShareCard;
