import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import './Paywall.css';

interface PaywallProps {
  onClose: () => void;
  onUnlock: () => void;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  priceDisplay: string;
  duration: number;
  features: string[];
  level: number;
  popular?: boolean;
}

const Paywall: React.FC<PaywallProps> = ({ onClose, onUnlock }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await Taro.request({
        url: 'http://localhost:3000/api/v1/memberships/products',
      });
      setProducts(res.data.products);
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const handlePurchase = async (product: Product) => {
    try {
      const token = Taro.getStorageSync('accessToken');
      const res = await Taro.request({
        url: 'http://localhost:3000/api/v1/payments/create-order',
        method: 'POST',
        header: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          productId: product.id,
          level: product.level,
        },
      });

      // Initiate WeChat Pay
      Taro.requestPayment({
        timeStamp: res.data.paymentParams.timeStamp,
        nonceStr: res.data.paymentParams.nonceStr,
        package: res.data.paymentParams.package,
        signType: res.data.paymentParams.signType,
        paySign: res.data.paymentParams.paySign,
        success: () => {
          Taro.showToast({
            title: '支付成功',
            icon: 'success',
          });
          onUnlock();
        },
        fail: () => {
          Taro.showToast({
            title: '支付取消',
            icon: 'none',
          });
        },
      });
    } catch (error) {
      Taro.showToast({
        title: '创建订单失败',
        icon: 'none',
      });
    }
  };

  return (
    <View className="paywall-overlay">
      <View className="paywall-content">
        <View className="paywall-header">
          <Text className="paywall-title">解锁完整报告</Text>
          <Text className="paywall-subtitle">选择适合您的会员方案</Text>
          <Button className="close-btn" onClick={onClose}>✕</Button>
        </View>

        <View className="products-list">
          {products.map((product) => (
            <View
              key={product.id}
              className={`product-card ${product.popular ? 'popular' : ''}`}
            >
              {product.popular && (
                <View className="popular-badge">热门推荐</View>
              )}
              <View className="product-header">
                <Text className="product-name">{product.name}</Text>
                <Text className="product-price">{product.priceDisplay}</Text>
              </View>
              <Text className="product-description">{product.description}</Text>
              <Text className="product-duration">{product.duration}天有效期</Text>
              
              <View className="product-features">
                {product.features.map((feature, index) => (
                  <View key={index} className="feature-item">
                    <Text className="feature-icon">✓</Text>
                    <Text className="feature-text">{feature}</Text>
                  </View>
                ))}
              </View>

              <Button
                className="purchase-btn"
                onClick={() => handlePurchase(product)}
              >
                立即解锁
              </Button>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export default Paywall;
