// utils/enterpriseApi.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import EnterpriseTokenManager, { AuthResponse, UserData, EmployeeData } from './enterpriseTokenManager';
import DeviceInfoManager, { DeviceInfo } from './deviceInfo';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { TokenInfo } from './enterpriseTokenManager'; // getBestAvailableToken için

// Type definitions
export interface LoginCredentials {
  email?: string;
  password: string;
  personel_id?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  deviceInfo: DeviceInfo;
}

export interface SessionRestoreRequest {
  deviceSessionToken: string;
  deviceInfo: DeviceInfo;
}

export interface LogoutRequest {
  deviceInfo: DeviceInfo;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionRestoreResponse {
    accessToken: string;
    refreshToken: string;
    deviceSessionToken: string;
    expiresIn: number;
    user: UserData | EmployeeData;
    // AuthResponse'dan extend etmek yerine direct tanımla
  }

export interface QueueItem {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  originalRequest: InternalAxiosRequestConfig;
}


export type UserType = 'company' | 'employee';

class EnterpriseApiManager {
  private api: AxiosInstance;
  private isRefreshing: boolean = false;
  private failedQueue: QueueItem[] = [];
  
  constructor() {
    this.api = axios.create({
      baseURL: 'http://34.140.8.78:3000', // Server IP'nizi buraya yazın
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - her istekte token ekle
    // ✅ DÜZELTİLMİŞ REQUEST INTERCEPTOR
    this.api.interceptors.request.use(
      async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
        console.log(`📤 API İsteği: ${config.method?.toUpperCase()} ${config.url}`);

        console.log(`📤 API İsteği Debug:`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          fullURL: `${config.baseURL}${config.url}`
        });
        
        // Login endpoint'lerinde token ekleme
        const skipTokenUrls = ['/api/giris', '/api/calisan-giris', '/api/companies'];
        const needsToken = !skipTokenUrls.some(url => config.url?.includes(url));
        
        if (needsToken) {
          // ✅ Token alma mantığını basitleştir
          const accessToken = await EnterpriseTokenManager.getAccessToken();
          
          if (accessToken) {
            // ✅ Token mevcut ise direkt ekle
            if (!config.headers) {
              config.headers = {} as any;
            }
            config.headers.Authorization = `Bearer ${accessToken}`;
            console.log('🎯 Access token kullanılıyor');
          } else {
            // ✅ Token yoksa getBestAvailableToken kullan
            console.log('⏰ Access token bulunamadı, en iyi token aranıyor...');
            const tokenInfo = await EnterpriseTokenManager.getBestAvailableToken();
            
            if (tokenInfo.token) {
              if (!config.headers) {
                config.headers = {} as any;
              }
              config.headers.Authorization = `Bearer ${tokenInfo.token}`;
              console.log(`🔑 ${tokenInfo.type} token eklendi`);
            } else {
              console.log('❌ Hiç geçerli token bulunamadı');
              // ✅ Token yoksa 401 hatası almak için devam et
            }
          }
        }

        return config;
      },
      (error: AxiosError): Promise<AxiosError> => {
        console.error('❌ Request interceptor hatası:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - token yenileme (dosya sonundan buraya taşındı)
    this.api.interceptors.response.use(
      (response: AxiosResponse): AxiosResponse => {
        console.log(`📥 API Yanıtı: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        return response;
      },
      async (error: AxiosError): Promise<any> => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
        console.log(`❌ API Hatası: ${error.response?.status} - ${originalRequest?.url}`);
    
        // ✅ 401 Unauthorized - Token expired/invalid
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
    
          // ✅ Backend'den gelen token expired sinyalini kontrol et
          const errorData = error.response.data as any;
          if (errorData?.code === 'TOKEN_EXPIRED' || errorData?.shouldRefresh) {
            console.log('⏰ Token expired - refresh/restore deneniyor');
          }
    
          // Refresh işlemi devam ediyorsa queue'ya ekle
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject, originalRequest });
            });
          }
    
          this.isRefreshing = true;
    
          try {
            // ✅ Geliştirilmiş token refresh stratejisi
            const refreshed = await this.attemptComprehensiveTokenRefresh();
            
            if (refreshed) {
              this.processQueue(null);
              
              // Orijinal isteği yeni token ile tekrar dene
              const newToken = await EnterpriseTokenManager.getAccessToken();
              if (newToken) {
                if (!originalRequest.headers) {
                  originalRequest.headers = {} as any;
                }
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return this.api(originalRequest);
              }
            }
            
            // Refresh başarısız
            this.processQueue(error);
            await this.handleAuthFailure();
            
          } catch (refreshError) {
            console.error('❌ Comprehensive token refresh hatası:', refreshError);
            this.processQueue(refreshError as AxiosError);
            await this.handleAuthFailure();
          } finally {
            this.isRefreshing = false;
          }
        }

        // 403 Forbidden - Yetki hatası
        if (error.response?.status === 403) {
          console.log('🚫 Yetki hatası - 403');
          Alert.alert(
            'Yetki Hatası',
            'Bu işlem için yetkiniz bulunmuyor.',
            [{ text: 'Tamam' }]
          );
        }

        // Network hatası
        if (!error.response) {
          console.log('🌐 Network hatası');
          Alert.alert(
            'Bağlantı Hatası',
            'İnternet bağlantınızı kontrol edin.',
            [{ text: 'Tamam' }]
          );
        }

        return Promise.reject(error);
      }
    );
  }

  // ✅ Geliştirilmiş comprehensive token refresh
  private async attemptComprehensiveTokenRefresh(): Promise<boolean> {
    console.log('🔄 Comprehensive token refresh başlatılıyor...');
    
    // 1. Önce refresh token ile dene
    const refreshStatus = await EnterpriseTokenManager.checkRefreshTokenStatus();
    if (refreshStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
      console.log('🔄 Refresh token ile yenileme deneniyor...');
      const refreshSuccess = await this.refreshWithRefreshToken();
      if (refreshSuccess) {
        console.log('✅ Refresh token ile başarılı');
        return true;
      }
    }
    
    // 2. Refresh başarısızsa device session ile dene
    const deviceSessionStatus = await EnterpriseTokenManager.checkDeviceSessionStatus();
    if (deviceSessionStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
      console.log('📱 Device session ile restore deneniyor...');
      const restoreSuccess = await this.restoreWithDeviceSession();
      if (restoreSuccess) {
        console.log('✅ Device session ile başarılı');
        return true;
      }
    }
    
    console.log('❌ Hiç token yenileme yöntemi başarılı olmadı');
    return false;
  }

  // Token refresh deneme mantığı
  private async attemptTokenRefresh(): Promise<boolean> {
    console.log('🔄 Token refresh deneniyor...');
    
    const refreshStatus = await EnterpriseTokenManager.checkRefreshTokenStatus();
    
    if (refreshStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
      return await this.refreshWithRefreshToken();
    }
    
    const deviceSessionStatus = await EnterpriseTokenManager.checkDeviceSessionStatus();
    
    if (deviceSessionStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
      return await this.restoreWithDeviceSession();
    }
    
    console.log('❌ Hiç geçerli token yok');
    return false;
  }

  // Refresh token ile yenile
  private async refreshWithRefreshToken(): Promise<boolean> {
    try {
      console.log('🔄 Refresh token ile yenileme...');
      
      const refreshToken = await EnterpriseTokenManager.getRefreshToken();
      const deviceInfo = await DeviceInfoManager.getCachedDeviceInfo();
      
      if (!refreshToken) {
        throw new Error('Refresh token bulunamadı');
      }

      const requestData: RefreshTokenRequest = {
        refreshToken,
        deviceInfo
      };

      const response = await axios.post<RefreshTokenResponse>(
        `${this.api.defaults.baseURL}/api/refresh-tokens`,
        requestData
      );

      if (response.data.accessToken) {
        // Sadece access ve refresh token'ı güncelle
        const currentDeviceSessionToken = await EnterpriseTokenManager.getDeviceSessionToken();
        const currentUserData = await EnterpriseTokenManager.getUserData();
        
        if (!currentDeviceSessionToken || !currentUserData) {
          throw new Error('Mevcut session bilgileri bulunamadı');
        }

        await EnterpriseTokenManager.saveTokens({
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          deviceSessionToken: currentDeviceSessionToken,
          expiresIn: response.data.expiresIn || 7200, // 2 saat default
          user: currentUserData as UserData,
          employee: currentUserData as EmployeeData
        });
        
        console.log('✅ Token başarıyla yenilendi');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Refresh token hatası:', error);
      return false;
    }
  }

  // Device session ile restore
  private async restoreWithDeviceSession(): Promise<boolean> {
    try {
      console.log('📱 Device session ile restore...');
      
      const deviceSessionToken = await EnterpriseTokenManager.getDeviceSessionToken();
      const deviceInfo = await DeviceInfoManager.getCachedDeviceInfo();
      
      if (!deviceSessionToken) {
        throw new Error('Device session token bulunamadı');
      }

      const requestData: SessionRestoreRequest = {
        deviceSessionToken,
        deviceInfo
      };

      const response = await axios.post<SessionRestoreResponse>(
        `${this.api.defaults.baseURL}/api/restore-session`,
        requestData
      );

      if (response.data.accessToken) {
        await EnterpriseTokenManager.saveTokens({
            ...response.data,
            user: (response.data as any).user
        });
        
        console.log('✅ Session başarıyla restore edildi');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Session restore hatası:', error);
      return false;
    }
  }

  // Auth başarısızlığını handle et
  private async handleAuthFailure(): Promise<void> {
    console.log('🚪 Auth başarısızlığı - çıkış yapılıyor');
    
    await EnterpriseTokenManager.clearAllTokens();
    
    // Login sayfasına yönlendir
    setTimeout(() => {
      router.replace('/');
    }, 100);
  }

  // Queue'daki istekleri işle
  private processQueue(error: AxiosError | null): void {
    this.failedQueue.forEach(({ resolve, reject, originalRequest }) => {
      if (error) {
        reject(error);
      } else {
        resolve(this.api(originalRequest));
      }
    });
    
    this.failedQueue = [];
  }

  // Manuel token kontrolü
  async validateToken(): Promise<boolean> {
    try {
      // ✅ DEBUG: URL'leri logla
      console.log('🔍 Validation Debug:', {
        baseURL: this.api.defaults.baseURL,
        fullURL: `${this.api.defaults.baseURL}/api/validate-token`,
        envURL: process.env.EXPO_PUBLIC_API_URL
      });
      
      const response = await this.api.get('/api/validate-token');
      
      console.log('✅ Validation başarılı:', response.data);
      return response.data.valid;
    } catch (error) {
      console.error('❌ Token validasyon hatası:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        requestURL: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
        headers: error.config?.headers
      });
      
      return false;
    }
  }

  // Enterprise login
  async enterpriseLogin(credentials: LoginCredentials, userType: UserType = 'company'): Promise<AuthResponse> {
    try {
      console.log('🔐 Enterprise login başlatılıyor...', userType);
      
      const deviceInfo = await DeviceInfoManager.getCachedDeviceInfo();
      
      const endpoint = userType === 'company' ? '/api/giris' : '/api/calisan-giris';
      
      const response = await this.api.post<AuthResponse>(endpoint, {
        ...credentials,
        deviceInfo
      });

      if (response.data.accessToken) {
        await EnterpriseTokenManager.saveTokens(response.data);
        console.log('✅ Enterprise login başarılı');
        return response.data;
      }

      throw new Error('Token alınamadı');
    } catch (error) {
      console.error('❌ Enterprise login hatası:', error);
      throw error;
    }
  }

  // Enterprise logout
  async enterpriseLogout(): Promise<void> {
    try {
      console.log('🚪 Enterprise logout başlatılıyor...');
      
      const accessToken = await EnterpriseTokenManager.getAccessToken();
      const deviceInfo = await DeviceInfoManager.getCachedDeviceInfo();
      
      if (accessToken) {
        const logoutData: LogoutRequest = { deviceInfo };
        await this.api.post('/api/logout', logoutData);
      }
      
      await EnterpriseTokenManager.clearAllTokens();
      console.log('✅ Enterprise logout tamamlandı');
      
    } catch (error) {
      console.error('❌ Logout hatası:', error);
      // Hata olsa bile local token'ları temizle
      await EnterpriseTokenManager.clearAllTokens();
    }
  }

  // API instance'ı dışarı ver
  getApiInstance(): AxiosInstance {
    return this.api;
  }

  // Base URL'i güncelle
  updateBaseURL(newBaseURL: string): void {
    this.api.defaults.baseURL = newBaseURL;
    console.log('🔄 API Base URL güncellendi:', newBaseURL);
  }

  // Timeout'u güncelle
  updateTimeout(newTimeout: number): void {
    this.api.defaults.timeout = newTimeout;
    console.log('⏰ API Timeout güncellendi:', newTimeout);
  }

  // Request config'i güncelle
  updateDefaultHeaders(headers: Record<string, string>): void {
    Object.assign(this.api.defaults.headers, headers);
    console.log('📝 API Headers güncellendi:', headers);
  }

  // Debug bilgileri
  getDebugInfo(): {
    baseURL: string;
    timeout: number;
    isRefreshing: boolean;
    queueLength: number;
  } {
    return {
      baseURL: this.api.defaults.baseURL || '',
      timeout: this.api.defaults.timeout || 0,
      isRefreshing: this.isRefreshing,
      queueLength: this.failedQueue.length
    };
  }
}

// Singleton instance
const enterpriseApiManager = new EnterpriseApiManager();

// Export default api instance
export default enterpriseApiManager.getApiInstance();

// Export manager class
export { EnterpriseApiManager };

// Export auth helper functions
export const enterpriseAuth = {
  login: enterpriseApiManager.enterpriseLogin.bind(enterpriseApiManager),
  logout: enterpriseApiManager.enterpriseLogout.bind(enterpriseApiManager),
  validateToken: enterpriseApiManager.validateToken.bind(enterpriseApiManager)
};

// Export manager instance for advanced usage
export const apiManager = enterpriseApiManager;
