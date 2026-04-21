import Taro from '@tarojs/taro';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  requiresAuth?: boolean;
}

class ApiService {
  private getToken(): string | null {
    return Taro.getStorageSync('accessToken');
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const { url, method = 'GET', data, requiresAuth = true } = options;

    const header: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth) {
      const token = this.getToken();
      if (token) {
        header['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await Taro.request({
        url: `${BASE_URL}${url}`,
        method,
        data,
        header,
      });

      return response.data as T;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // Auth APIs
  async wechatLogin(code: string) {
    return this.request({
      url: '/auth/wechat/login',
      method: 'POST',
      data: { code },
      requiresAuth: false,
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request({
      url: '/auth/refresh',
      method: 'POST',
      data: { refreshToken },
      requiresAuth: false,
    });
  }

  // User APIs
  async getUserInfo() {
    return this.request({
      url: '/users/me',
      method: 'GET',
    });
  }

  // Test APIs
  async createTestSession() {
    return this.request({
      url: '/tests/sessions',
      method: 'POST',
    });
  }

  async getNextQuestion(sessionId: string) {
    return this.request({
      url: `/tests/sessions/${sessionId}/next`,
      method: 'GET',
    });
  }

  async submitAnswer(sessionId: string, questionId: string, optionId: string, timeSpent: number) {
    return this.request({
      url: `/tests/sessions/${sessionId}/answer`,
      method: 'POST',
      data: { questionId, optionId, timeSpent },
    });
  }

  async getTestResults(testResultId: string) {
    return this.request({
      url: `/tests/results/${testResultId}`,
      method: 'GET',
    });
  }

  // Report APIs
  async generateReport(testResultId: string) {
    return this.request({
      url: '/reports',
      method: 'POST',
      data: { testResultId },
    });
  }

  async getReport(reportId: string) {
    return this.request({
      url: `/reports/${reportId}`,
      method: 'GET',
    });
  }

  async getReportHistory() {
    return this.request({
      url: '/reports',
      method: 'GET',
    });
  }

  // Membership APIs
  async getProducts() {
    return this.request({
      url: '/memberships/products',
      method: 'GET',
      requiresAuth: false,
    });
  }

  async getMyMembership() {
    return this.request({
      url: '/memberships/me',
      method: 'GET',
    });
  }

  // Payment APIs
  async createOrder(productId: string, level: number) {
    return this.request({
      url: '/payments/create-order',
      method: 'POST',
      data: { productId, level },
    });
  }
}

export const api = new ApiService();
export default api;
