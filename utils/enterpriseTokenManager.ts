// utils/enterpriseTokenManager.ts - Düzeltilmiş Versiyon
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfoManager, { DeviceInfo } from './deviceInfo';
import SecureStorage from './secureStorage';
import { router } from 'expo-router';

// Type definitions
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  deviceSessionToken: string;
  expiresIn: number;
  user?: UserData;
  employee?: EmployeeData;
  systemInfo?: SystemInfo;
}

export interface UserData {
  id?: number | string;
  company_id?: number | string;
  company_name?: string;
  email?: string;
  phone_number?: string;
  address?: string;
  rol?: number;
  userType?: 'company' | 'employee';
  personel_id?: number | string;
  ad?: string;
  soyad?: string;
  telefon_no?: string;
}

export interface EmployeeData {
  personel_id?: number | string;
  id?: number | string;
  ad?: string;
  soyad?: string;
  rol?: number; 
  email?: string;
  telefon_no?: string;
  userType?: 'company' | 'employee';
  company_id?: number | string;
  company_name?: string;
  phone_number?: string;
  address?: string;
}

export interface SystemInfo {
  tokenType: string;
  sessionDuration: string;
  autoLogout: boolean;
  deviceRegistered: boolean;
}

export interface TokenMetadata {
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  deviceSessionExpiry: number;
  lastRefresh: number;
  deviceFingerprint: DeviceInfo;
}

export interface TokenInfo {
  token: string | null;
  type: 'access' | 'refresh_needed' | 'session_restore_needed' | 'login_required';
  needsRefresh: boolean;
}

export enum TokenState {
  VALID = 'valid',
  EXPIRED = 'expired',
  INVALID = 'invalid',
  MISSING = 'missing'
}

export class EnterpriseTokenManager {
  // ✅ Güvenli Storage keys - normalized
  private static readonly KEYS = {
    ACCESS_TOKEN: 'artemis_access_token',
    REFRESH_TOKEN: 'artemis_refresh_token', 
    DEVICE_SESSION_TOKEN: 'artemis_device_session_token',
    USER_DATA: 'artemis_user_data',
    TOKEN_METADATA: 'artemis_token_metadata'
  } as const;

  // Token durumları
  static readonly TOKEN_STATES = TokenState;

  // ✅ Gelişmiş token kaydetme sistemi
  static async saveTokens(authResponse: AuthResponse): Promise<boolean> {
    try {
      const {
        accessToken,
        refreshToken, 
        deviceSessionToken,
        expiresIn,
        user,
        employee
      } = authResponse;
  
      console.log('💾 Enterprise token\'lar kaydediliyor...');
  
      // Token validation
      if (!accessToken || !refreshToken || !deviceSessionToken) {
        throw new Error('Required tokens missing');
      }
  
      // ✅ USER DATA NORMALIZASYONU - Bu kısım eklendi
      let userData = user || employee;
      if (userData) {
        // ✅ Firma için normalize et
        if (user) {
          userData = {
            ...user,
            company_id: user.id || user.company_id,
            id: user.id || user.company_id,
            userType: 'company'
          };
          console.log('✅ Company data normalized:', {
            company_id: userData.company_id,
            id: userData.id,
            userType: userData.userType
          });
        }
        
        // ✅ Çalışan için normalize et
        if (employee) {
          userData = {
            ...employee,
            personel_id: employee.personel_id,
            id: employee.personel_id,
            userType: 'employee'
          };
          console.log('✅ Employee data normalized:', {
            personel_id: userData.personel_id,
            id: userData.id,
            userType: userData.userType
          });
        }
      } else {
        console.error('❌ Hiç kullanıcı verisi bulunamadı!');
      }
  
      // Token metadata
      const tokenMetadata: TokenMetadata = {
        accessTokenExpiry: Date.now() + (expiresIn * 1000),
        refreshTokenExpiry: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 gün
        deviceSessionExpiry: Date.now() + (180 * 24 * 60 * 60 * 1000), // 180 gün
        lastRefresh: Date.now(),
        deviceFingerprint: await DeviceInfoManager.getCachedDeviceInfo()
      };
  
      // ✅ Token'ları paralel olarak güvenli şekilde kaydet
      const saveOperations = await Promise.allSettled([
        SecureStorage.setSecureItem(this.KEYS.ACCESS_TOKEN, accessToken),
        SecureStorage.setSecureItem(this.KEYS.REFRESH_TOKEN, refreshToken),
        SecureStorage.setSecureItem(this.KEYS.DEVICE_SESSION_TOKEN, deviceSessionToken),
        AsyncStorage.setItem(this.KEYS.TOKEN_METADATA, JSON.stringify(tokenMetadata)),
        AsyncStorage.setItem(this.KEYS.USER_DATA, JSON.stringify(userData)) // ✅ Normalized data kaydet
      ]);
  
      // Sonuçları kontrol et
      const failedOperations = saveOperations.filter(op => op.status === 'rejected');
      
      if (failedOperations.length > 0) {
        console.error('❌ Bazı token kaydetme işlemleri başarısız:', failedOperations);
        
        // Critical token'lar kaydedildi mi kontrol et
        const accessSaved = saveOperations[0].status === 'fulfilled';
        const refreshSaved = saveOperations[1].status === 'fulfilled';
        const userDataSaved = saveOperations[4].status === 'fulfilled';
        
        if (!accessSaved || !refreshSaved) {
          throw new Error('Critical tokens could not be saved');
        }
        
        if (!userDataSaved) {
          console.warn('⚠️ User data kaydedilemedi ama token\'lar kaydedildi');
        }
      }
  
      console.log('✅ Enterprise token\'lar başarıyla kaydedildi');
      console.log('⏰ Access token süresi:', new Date(tokenMetadata.accessTokenExpiry).toLocaleString('tr-TR'));
      console.log('👤 Kaydedilen kullanıcı verisi:', userData);
  
      return true;
    } catch (error) {
      console.error('❌ Token kaydetme hatası:', error);
      
      // Partial cleanup - başarısız kayıt durumunda temizle
      await this.clearAllTokens();
      return false;
    }
  }

  // ✅ Güvenli token okuma metodları
  static async getAccessToken(): Promise<string | null> {
    try {
      const token = await SecureStorage.getSecureItem(this.KEYS.ACCESS_TOKEN);
      return token;
    } catch (error) {
      console.error('❌ Access token alma hatası:', error);
      return null;
    }
  }

  static async getRefreshToken(): Promise<string | null> {
    try {
      const token = await SecureStorage.getSecureItem(this.KEYS.REFRESH_TOKEN);
      return token;
    } catch (error) {
      console.error('❌ Refresh token alma hatası:', error);
      return null;
    }
  }

  static async getDeviceSessionToken(): Promise<string | null> {
    try {
      const token = await SecureStorage.getSecureItem(this.KEYS.DEVICE_SESSION_TOKEN);
      return token;
    } catch (error) {
      console.error('❌ Device session token alma hatası:', error);
      return null;
    }
  }

  // ✅ Token metadata alma (güvenli)
  static async getTokenMetadata(): Promise<TokenMetadata | null> {
    try {
      const metadata = await AsyncStorage.getItem(this.KEYS.TOKEN_METADATA);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      console.error('❌ Token metadata alma hatası:', error);
      return null;
    }
  }

  // ✅ User data alma (güvenli)
  static async getUserData(): Promise<UserData | EmployeeData | null> {
    try {
      const userData = await AsyncStorage.getItem(this.KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('❌ User data alma hatası:', error);
      return null;
    }
  }

  // ✅ Token durum kontrolü (geliştirilmiş)
  static async checkAccessTokenStatus(): Promise<TokenState> {
    try {
      const accessToken = await this.getAccessToken();
      const metadata = await this.getTokenMetadata();

      if (!accessToken) {
        console.log('🔍 Access token missing');
        return TokenState.MISSING;
      }

      if (!metadata || !metadata.accessTokenExpiry) {
        console.log('🔍 Access token metadata invalid');
        return TokenState.INVALID;
      }

      // 2 dakika güvenlik marjı
      const expiry = metadata.accessTokenExpiry - (2 * 60 * 1000);
      const now = Date.now();

      if (now >= expiry) {
        console.log('⏰ Access token expired');
        return TokenState.EXPIRED;
      }

      console.log('✅ Access token valid');
      return TokenState.VALID;
    } catch (error) {
      console.error('❌ Access token durum kontrolü hatası:', error);
      return TokenState.INVALID;
    }
  }

  static async checkRefreshTokenStatus(): Promise<TokenState> {
    try {
      const refreshToken = await this.getRefreshToken();
      const metadata = await this.getTokenMetadata();

      if (!refreshToken) {
        return TokenState.MISSING;
      }

      if (!metadata || !metadata.refreshTokenExpiry) {
        return TokenState.INVALID;
      }

      const now = Date.now();
      if (now >= metadata.refreshTokenExpiry) {
        console.log('⏰ Refresh token expired');
        return TokenState.EXPIRED;
      }

      return TokenState.VALID;
    } catch (error) {
      console.error('❌ Refresh token durum kontrolü hatası:', error);
      return TokenState.INVALID;
    }
  }

  static async checkDeviceSessionStatus(): Promise<TokenState> {
    try {
      const deviceSessionToken = await this.getDeviceSessionToken();
      const metadata = await this.getTokenMetadata();

      if (!deviceSessionToken) {
        return TokenState.MISSING;
      }

      if (!metadata || !metadata.deviceSessionExpiry) {
        return TokenState.INVALID;
      }

      const now = Date.now();
      if (now >= metadata.deviceSessionExpiry) {
        console.log('⏰ Device session expired');
        return TokenState.EXPIRED;
      }

      return TokenState.VALID;
    } catch (error) {
      console.error('❌ Device session durum kontrolü hatası:', error);
      return TokenState.INVALID;
    }
  }

  // ✅ Token geçerlilik kontrolü (optimized)
  static async hasValidToken(): Promise<boolean> {
    try {
      const [accessStatus, refreshStatus, deviceSessionStatus] = await Promise.all([
        this.checkAccessTokenStatus(),
        this.checkRefreshTokenStatus(),
        this.checkDeviceSessionStatus()
      ]);

      console.log('🔍 Token durumları:', {
        access: accessStatus,
        refresh: refreshStatus,
        deviceSession: deviceSessionStatus
      });

      // En az birisi geçerliyse true
      return accessStatus === TokenState.VALID ||
             refreshStatus === TokenState.VALID ||
             deviceSessionStatus === TokenState.VALID;
    } catch (error) {
      console.error('❌ Token geçerlilik kontrolü hatası:', error);
      return false;
    }
  }

  // ✅ YENİ FONKSİYON - Auth durumunu detaylı döndür
  static async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    userRole: number | null;
    userType: 'company' | 'employee' | null;
    needsRefresh: boolean;
    userData: any;
  }> {
    try {
      const [accessStatus, refreshStatus, deviceSessionStatus] = await Promise.all([
        this.checkAccessTokenStatus(),
        this.checkRefreshTokenStatus(),
        this.checkDeviceSessionStatus()
      ]);

      const userData = await this.getUserData();

      // Access token geçerliyse direkt authenticated
      if (accessStatus === TokenState.VALID && userData) {
        return {
          isAuthenticated: true,
          userRole: userData.rol || null,
          userType: userData.userType || (userData.personel_id ? 'employee' : 'company'),
          needsRefresh: false,
          userData
        };
      }

      // Refresh gerekiyorsa
      if (refreshStatus === TokenState.VALID || deviceSessionStatus === TokenState.VALID) {
        return {
          isAuthenticated: false,
          userRole: null,
          userType: null,
          needsRefresh: true,
          userData: null
        };
      }

      // Hiç token yok
      return {
        isAuthenticated: false,
        userRole: null,
        userType: null,
        needsRefresh: false,
        userData: null
      };

    } catch (error) {
      console.error('❌ Auth status check hatası:', error);
      return {
        isAuthenticated: false,
        userRole: null,
        userType: null,
        needsRefresh: false,
        userData: null
      };
    }
  }

  // ✅ En iyi token seçimi (smart selection)
// ✅ En iyi token seçimi (enhanced smart selection)
static async getBestAvailableToken(): Promise<TokenInfo> {
  try {
    // 1. Access token kontrolü
    const accessStatus = await this.checkAccessTokenStatus();
    if (accessStatus === TokenState.VALID) {
      const accessToken = await this.getAccessToken();
      if (accessToken) {
        console.log('🎯 Access token kullanılıyor');
        return {
          token: accessToken,
          type: 'access',
          needsRefresh: false
        };
      }
    }

    // 2. Access token expired ama refresh var
    if (accessStatus === TokenState.EXPIRED) {
      const refreshStatus = await this.checkRefreshTokenStatus();
      if (refreshStatus === TokenState.VALID) {
        console.log('🔄 Access expired, refresh mevcut - yenileme gerekli');
        return {
          token: null,
          type: 'refresh_needed',
          needsRefresh: true
        };
      }
      
      // 3. Refresh de expired ama device session var
      const deviceSessionStatus = await this.checkDeviceSessionStatus();
      if (deviceSessionStatus === TokenState.VALID) {
        console.log('📱 Access & refresh expired, device session restore gerekli');
        return {
          token: null,
          type: 'session_restore_needed',
          needsRefresh: false
        };
      }
    }

    // 4. Hiç token yok
    console.log('❌ Hiç geçerli token yok, yeniden giriş gerekli');
    return {
      token: null,
      type: 'login_required',
      needsRefresh: false
    };
  } catch (error) {
    console.error('❌ Best token selection hatası:', error);
    return {
      token: null,
      type: 'login_required',
      needsRefresh: false
    };
  }
}

  // ✅ Güvenli token temizleme
  static async clearAllTokens(): Promise<boolean> {
    try {
      console.log('🧹 Tüm token\'lar temizleniyor...');
      
      const clearOperations = await Promise.allSettled([
        SecureStorage.removeSecureItem(this.KEYS.ACCESS_TOKEN),
        SecureStorage.removeSecureItem(this.KEYS.REFRESH_TOKEN),
        SecureStorage.removeSecureItem(this.KEYS.DEVICE_SESSION_TOKEN),
        AsyncStorage.removeItem(this.KEYS.TOKEN_METADATA),
        AsyncStorage.removeItem(this.KEYS.USER_DATA)
      ]);
  
      const failedClears = clearOperations.filter(op => op.status === 'rejected');
      
      if (failedClears.length > 0) {
        console.warn('⚠️ Bazı token temizleme işlemleri başarısız:', failedClears.length);
      }
  
      console.log('✅ Token temizleme tamamlandı');
      
      // ✅ Global auth state resetle
      if (typeof global !== 'undefined' && (global as any).globalAuthState) {
        (global as any).globalAuthState.isChecked = false;
        (global as any).globalAuthState.isInProgress = false;
        console.log('🔄 Global auth state resetlendi');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Token temizleme hatası:', error);
      return false;
    }
  }

  // ✅ Auto logout with improved error handling
  static async autoLogoutIfNeeded(): Promise<boolean> {
    try {
      const hasValid = await this.hasValidToken();
      
      if (!hasValid) {
        console.log('🚪 Otomatik çıkış yapılıyor - token yok');
        await this.clearAllTokens();
        
        // Ana sayfaya yönlendir
        setTimeout(() => {
          router.replace('/');
        }, 100);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Auto logout error:', error);
      // Hata durumunda güvenli tarafta kal ve logout yap
      await this.clearAllTokens();
      router.replace('/');
      return true;
    }
  }

  // ✅ Debug tools (enhanced)
  static async debugTokens(): Promise<void> {
    console.log('🔍 === ENTERPRISE TOKEN DEBUG ===');
    
    try {
      const [accessStatus, refreshStatus, deviceSessionStatus] = await Promise.all([
        this.checkAccessTokenStatus(),
        this.checkRefreshTokenStatus(), 
        this.checkDeviceSessionStatus()
      ]);

      const [metadata, userData] = await Promise.all([
        this.getTokenMetadata(),
        this.getUserData()
      ]);

      console.log('🎯 Token Status:');
      console.log('  Access:', accessStatus);
      console.log('  Refresh:', refreshStatus);
      console.log('  Device Session:', deviceSessionStatus);
      
      if (metadata) {
        console.log('⏰ Expiry Times:');
        console.log('  Access:', new Date(metadata.accessTokenExpiry).toLocaleString('tr-TR'));
        console.log('  Refresh:', new Date(metadata.refreshTokenExpiry).toLocaleString('tr-TR'));
        console.log('  Device:', new Date(metadata.deviceSessionExpiry).toLocaleString('tr-TR'));
      }

      if (userData) {
        const userName = (userData as UserData).company_name || 
                        `${(userData as EmployeeData).ad} ${(userData as EmployeeData).soyad}`;
        console.log('👤 User:', userName);
      }

      // SecureStorage debug
      await SecureStorage.debugTokens();
      
    } catch (error) {
      console.error('❌ Debug error:', error);
    }

    console.log('🔍 ===========================');
  }
}

export default EnterpriseTokenManager;