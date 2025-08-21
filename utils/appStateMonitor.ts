// utils/appStateMonitor.ts - Düzeltilmiş Versiyon
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import EnterpriseTokenManager from './enterpriseTokenManager';
import DeviceInfoManager from './deviceInfo';
import { enterpriseAuth } from './enterpriseApi';
import { NativeEventSubscription } from 'react-native';

// Type definitions
export interface AppStateConfig {
  tokenCheckInterval: number;
  maxBackgroundTime: number;
  networkRetryDelay: number;
  enableDebugLogs: boolean;
}

export interface TokenSnapshot {
  timestamp: number;
  accessStatus: string;
  refreshStatus: string;
  deviceSessionStatus: string;
}

export interface DebugInfo {
  isActive: boolean;
  currentAppState: AppStateStatus;
  lastActiveTime: string;
  backgroundTime: number;
  config: AppStateConfig;
  tokenSnapshot?: TokenSnapshot;
  networkState?: NetInfoState;
}

class AppStateMonitor {
  private appStateSubscription: NativeEventSubscription | null = null;
  private netInfoSubscription: NetInfoSubscription | null = null;
  private tokenCheckInterval: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private lastActiveTime: number = Date.now();
  private backgroundTime: number = 0;
  private lastTokenSnapshot: TokenSnapshot | null = null;
  private currentNetworkState: NetInfoState | null = null;
  private isInitialized: boolean = false;
  private lastSessionExtend: number = 0;
  
  // ✅ Geliştirilmiş konfigürasyon
  private config: AppStateConfig = {
    tokenCheckInterval: 5 * 60 * 1000, // 5 dakika
    maxBackgroundTime: 30 * 60 * 1000, // 30 dakika
    networkRetryDelay: 3000, // 3 saniye
    enableDebugLogs: __DEV__
  };

  constructor(customConfig?: Partial<AppStateConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  // ✅ Geliştirilmiş monitoring başlatma
  start(): void {
    if (this.isActive) {
      this.log('⚠️ App state monitor zaten aktif');
      return;
    }

    this.log('📱 App State Monitoring başlatılıyor...');

    try {
      // App state değişikliklerini dinle
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
      
      // Network durumu değişikliklerini dinle
      this.netInfoSubscription = NetInfo.addEventListener(this.handleNetworkChange.bind(this));
      
      // Periyodik token kontrolü başlat
      this.startPeriodicTokenCheck();
      
      // İlk network durumunu al
      NetInfo.fetch().then(state => {
        this.currentNetworkState = state;
        this.log(`🌐 İlk network durumu: ${state.isConnected ? 'Bağlı' : 'Bağlı değil'} (${state.type})`);
      }).catch(err => {
        this.log(`❌ İlk network durumu alınamadı: ${err.message}`);
      });
      
      this.isActive = true;
      this.isInitialized = true;
      this.log('✅ App State Monitor aktif');
      
    } catch (error) {
      this.log(`❌ App State Monitor başlatma hatası: ${error.message}`);
      this.cleanup();
    }
  }

  // ✅ Güvenli monitoring durdurma
  stop(): void {
    this.log('📱 App State Monitoring durduruluyor...');
    this.cleanup();
    this.log('✅ App State Monitor durduruldu');
  }

  // ✅ Cleanup işlemi
  private cleanup(): void {
    try {
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }
      
      if (this.netInfoSubscription) {
        this.netInfoSubscription();
        this.netInfoSubscription = null;
      }
      
      if (this.tokenCheckInterval) {
        clearInterval(this.tokenCheckInterval);
        this.tokenCheckInterval = null;
      }
      
      this.isActive = false;
      this.isInitialized = false;
    } catch (error) {
      this.log(`❌ Cleanup hatası: ${error.message}`);
    }
  }

  // ✅ Geliştirilmiş app state değişikliği
  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    const previousState = AppState.currentState;
    
    this.log(`📱 App state: ${previousState} -> ${nextAppState}`);

    try {
      if (nextAppState === 'active') {
        await this.handleAppBecameActive();
      } else if (nextAppState === 'background') {
        await this.handleAppWentBackground();
      } else if (nextAppState === 'inactive') {
        this.log('📱 App became inactive');
      }
    } catch (error) {
      this.log(`❌ App state change handler error: ${error.message}`);
    }
  }

  // ✅ Uygulama arka plana gitti
  private async handleAppWentBackground(): Promise<void> {
    this.log('🔴 Uygulama arka plana gitti');
    this.lastActiveTime = Date.now();
    
    // Arka plan öncesi token durumunu kaydet
    try {
      await this.saveTokenStateSnapshot();
    } catch (error) {
      this.log(`❌ Token snapshot save error: ${error.message}`);
    }
  }

  // ✅ Geliştirilmiş network durumu değişikliği
  private async handleNetworkChange(state: NetInfoState): Promise<void> {
    const wasConnected = this.currentNetworkState?.isConnected;
    const isNowConnected = state.isConnected;
    
    this.currentNetworkState = state;
    this.log(`🌐 Network durumu: ${isNowConnected ? 'Bağlı' : 'Bağlı değil'} (${state.type})`);
    
    // ✅ TOKEN KONTROLÜ EKLE - Network geri gelse bile token yoksa sync yapma
    if (!wasConnected && isNowConnected && AppState.currentState === 'active') {
      this.log('🔄 Network geri geldi, token sağlık kontrolü...');
      
      // ✅ YENİ: Önce token varlığını kontrol et
      const hasValidToken = await EnterpriseTokenManager.hasValidToken();
      if (!hasValidToken) {
        this.log('🔑 Network geri geldi ama token yok, token kontrolü atlanıyor');
        return;
      }
      
      setTimeout(async () => {
        try {
          await this.performTokenHealthCheck();
        } catch (error) {
          this.log(`❌ Network recovery token check failed: ${error.message}`);
        }
      }, this.config.networkRetryDelay);
    }
  }

  // ✅ Geliştirilmiş token sağlık kontrolü
  async performTokenHealthCheck(): Promise<void> {
    try {
      this.log('🩺 Token sağlık kontrolü başlatılıyor ...');
  
      // Eğer monitoring aktif değilse kontrol yapma
      if (!this.isActive || !this.isInitialized) {
        this.log('⚠️ Monitoring aktif değil, token kontrolü atlanıyor');
        return;
      }
  
      // Token durumlarını paralel kontrol et
      const [accessStatus, refreshStatus, deviceSessionStatus] = await Promise.all([
        EnterpriseTokenManager.checkAccessTokenStatus(),
        EnterpriseTokenManager.checkRefreshTokenStatus(),
        EnterpriseTokenManager.checkDeviceSessionStatus()
      ]);
  
      this.log(`🔍 Token durumları - Access: ${accessStatus}, Refresh: ${refreshStatus}, Device: ${deviceSessionStatus}`);
  
      // ✅ ENHANCED TOKEN RECOVERY LOGIC - Öncelik sırası değişti
      
      // 1. Access token geçerliyse direkt session uzat
      if (accessStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
        this.log('✅ Access token geçerli, session uzatılıyor');
        await this.performNetflixStyleSessionExtend();
        
        // Server validation (opsiyonel, network varsa)
        if (this.currentNetworkState?.isConnected) {
          const lastValidation = this.lastTokenSnapshot?.timestamp || 0;
          const timeSinceLastValidation = Date.now() - lastValidation;
          
          if (timeSinceLastValidation > 30 * 60 * 1000) {
            try {
              const isValid = await this.validateTokenWithServer();
              if (!isValid) {
                this.log('❌ Server validation başarısız ama access token geçerli, devam ediliyor');
              }
            } catch (error) {
              this.log(`⚠️ Server validation error (ignored): ${error.message}`);
            }
          }
        }
        return;
      }
  
      // 2. Access token expired - recovery stratejisi
      if (accessStatus === EnterpriseTokenManager.TOKEN_STATES.EXPIRED) {
        this.log('⏰ Access token expired, recovery deneniyor...');
        
        // 2a. Önce refresh token dene
        if (refreshStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
          this.log('🔄 Refresh token ile yenileme deneniyor...');
          const refreshSuccess = await this.attemptSilentRefresh();
          if (refreshSuccess) {
            this.log('✅ Silent refresh başarılı');
            await this.performNetflixStyleSessionExtend();
            return;
          }
          this.log('❌ Silent refresh başarısız');
        }
        
        // 2b. Refresh başarısız/yoksa device session dene
        if (deviceSessionStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
          this.log('📱 Device session ile restore deneniyor...');
          const restoreSuccess = await this.attemptSessionRestore();
          if (restoreSuccess) {
            this.log('✅ Session restore başarılı');
            await this.performNetflixStyleSessionExtend();
            return;
          }
          this.log('❌ Session restore başarısız');
        }
        
        // 2c. Her ikisi de başarısızsa graceful error
        this.log('❌ Tüm recovery yöntemleri başarısız');
        await this.handleGracefulTokenError(new Error('Token recovery başarısız'));
        return;
      }
  
      // 3. Access token missing - diğer token'lara bak
      if (accessStatus === EnterpriseTokenManager.TOKEN_STATES.MISSING) {
        
        // 3a. Refresh token varsa kullan
        if (refreshStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
          this.log('🔄 Access token yok, refresh ile yenileme deneniyor...');
          const refreshSuccess = await this.attemptSilentRefresh();
          if (refreshSuccess) {
            this.log('✅ Refresh ile access token oluşturuldu');
            await this.performNetflixStyleSessionExtend();
            return;
          }
        }
        
        // 3b. Device session varsa kullan
        if (deviceSessionStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
          this.log('📱 Access token yok, device session ile restore deneniyor...');
          const restoreSuccess = await this.attemptSessionRestore();
          if (restoreSuccess) {
            this.log('✅ Device session ile access token oluşturuldu');
            await this.performNetflixStyleSessionExtend();
            return;
          }
        }
      }
  
      // 4. Hiç geçerli token yoksa logout
      if (accessStatus === EnterpriseTokenManager.TOKEN_STATES.MISSING &&
          refreshStatus === EnterpriseTokenManager.TOKEN_STATES.MISSING &&
          deviceSessionStatus === EnterpriseTokenManager.TOKEN_STATES.MISSING) {
        
        this.log('❌ Hiç token yok, otomatik logout');
        await this.handleAutoLogout();
        return;
      }
  
      // 5. Beklenmeyen durum - graceful error
      this.log('⚠️ Beklenmeyen token durumu, graceful error handling');
      await this.handleGracefulTokenError(new Error('Beklenmeyen token durumu'));
  
    } catch (error) {
      this.log(`❌ Token sağlık kontrolü genel hatası: ${error.message}`);
      await this.handleGracefulTokenError(error);
    }
  }
  
  // Nazikçe token hatası işleme
  private async handleGracefulTokenError(error: any): Promise<void> {
    try {
      this.log('Nazikçe token hatası işleniyor...');
      
      // Device session ile restore deneme
      const deviceSessionStatus = await EnterpriseTokenManager.checkDeviceSessionStatus();
      
      if (deviceSessionStatus === EnterpriseTokenManager.TOKEN_STATES.VALID) {
        this.log('🔄 Device session geçerli, graceful restore deneniyor...');
        const restoreSuccess = await this.attemptSessionRestore();
        
        if (restoreSuccess) {
          this.log('Graceful recovery başarılı');
          await this.performNetflixStyleSessionExtend();
          return;
        }
      }
      
      // Son çare: logout
      this.log('❌ Graceful recovery başarısız, logout');
      await this.handleAutoLogout();
      
    } catch (recoveryError) {
      this.log(`❌ Graceful recovery hatası: ${recoveryError.message}`);
      await this.handleAutoLogout();
    }
  }

  // ✅ Güvenli server token validation
  private async validateTokenWithServer(): Promise<boolean> {
    try {
      const validationPromise = enterpriseAuth.validateToken();
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), 10000);
      });
  
      const isValid = await Promise.race([validationPromise, timeoutPromise]);
      return isValid;
    } catch (error) {
      this.log(`❌ Server validation failed: ${error.message}`);
      return false;
    }
  }

  // ✅ Geliştirilmiş sessiz token yenileme
  private async attemptSilentRefresh(): Promise<boolean> {
    try {
      this.log('🔄 Sessiz token yenileme başlatılıyor...');
      
      const refreshToken = await EnterpriseTokenManager.getRefreshToken();
      if (!refreshToken) {
        this.log('❌ Refresh token yok');
        return false;
      }
  
      // Network kontrolü
      if (!this.currentNetworkState?.isConnected) {
        this.log('📡 Network bağlantısı yok, refresh erteleniyor');
        return false;
      }
  
      // Bu işlem enterpriseApi interceptor'da otomatik olarak yapılır
      const isValid = await this.validateTokenWithServer();
      
      if (isValid) {
        this.log('✅ Sessiz token yenileme başarılı');
        return true;
      } else {
        this.log('❌ Sessiz token yenileme başarısız');
        return false;
      }
  
    } catch (error) {
      this.log(`❌ Sessiz token yenileme hatası: ${error.message}`);
      return false;
    }
  }

  // ✅ Geliştirilmiş session restore
  private async attemptSessionRestore(): Promise<boolean> {
    try {
      this.log('📱 Session restore başlatılıyor...');
      
      const deviceSessionToken = await EnterpriseTokenManager.getDeviceSessionToken();
      if (!deviceSessionToken) {
        this.log('❌ Device session token yok');
        return false;
      }
  
      if (!this.currentNetworkState?.isConnected) {
        this.log('📡 Network bağlantısı yok, session restore erteleniyor');
        return false;
      }
  
      const isValid = await this.validateTokenWithServer();
      
      if (isValid) {
        this.log('✅ Session restore başarılı');
        return true;
      } else {
        this.log('❌ Session restore başarısız');
        return false;
      }
  
    } catch (error) {
      this.log(`❌ Session restore hatası: ${error.message}`);
      return false;
    }
  }

  // ✅ Güvenli auto logout
  private async handleAutoLogout(): Promise<void> {
    try {
      this.log('🚪 Auto logout işlemi başlatılıyor...');
      
      await EnterpriseTokenManager.clearAllTokens();
      this.stop();
      
      this.log('✅ Auto logout tamamlandı');
    } catch (error) {
      this.log(`❌ Auto logout error: ${error.message}`);
    }
  }

  // ✅ Geliştirilmiş periyodik token kontrolü
  private startPeriodicTokenCheck(): void {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }

    this.tokenCheckInterval = setInterval(async () => {
      try {
        // Sadece uygulama aktifken ve network varken kontrol et
        if (AppState.currentState === 'active' && this.currentNetworkState?.isConnected) {
          this.log('⏰ Periyodik token kontrolü...');
          await this.performTokenHealthCheck();
        }
      } catch (error) {
        this.log(`❌ Periyodik token kontrolü hatası: ${error.message}`);
      }
    }, this.config.tokenCheckInterval);
  }

  // ✅ EKLE - handleAppStateChange metodundan ÖNCE
  private async handleAppBecameActive(): Promise<void> {
    this.log('🟢 Uygulama aktif oldu');
    
    const now = Date.now();
    this.backgroundTime = now - this.lastActiveTime;
    
    // Her app açılışında session uzat
    if (this.currentNetworkState?.isConnected) {
      this.log('App açılışında session uzatılıyor...');
      
      setTimeout(() => {
        this.performNetflixStyleSessionExtend().catch(error => {
          this.log(`❌ App açılış session uzatma hatası: ${error.message}`);
        });
      }, 1000);
    }
  
    this.lastActiveTime = now;
  }

  private async performNetflixStyleSessionExtend(): Promise<void> {
    try {
      const now = Date.now();
      
      // Rate limiting: 10 dakikada bir uzat
      if (now - this.lastSessionExtend < 10 * 60 * 1000) {
        return;
      }
  
      this.log('Session uzatılıyor...');
  
      // Device info al
      const deviceInfo = await DeviceInfoManager.getCachedDeviceInfo();
      
      // Backend'e session uzatma isteği gönder
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/extend-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await EnterpriseTokenManager.getAccessToken()}`
        },
        body: JSON.stringify({ deviceInfo })
      });
  
      if (response.ok) {
        const result = await response.json();
        this.lastSessionExtend = now;
        
        this.log('✅ Session başarıyla uzatıldı');
        this.log(`📅 Yeni süre: ${new Date(result.extended_until).toLocaleString('tr-TR')}`);
      } else {
        this.log('⚠️ Session uzatma başarısız, token kontrolü devam ediyor');
      }
  
    } catch (error) {
      this.log(`❌ Netflix session uzatma hatası: ${error.message}`);
    }
  }

  // ✅ Token state snapshot kaydetme
  private async saveTokenStateSnapshot(): Promise<void> {
    try {
      const [accessStatus, refreshStatus, deviceSessionStatus] = await Promise.all([
        EnterpriseTokenManager.checkAccessTokenStatus(),
        EnterpriseTokenManager.checkRefreshTokenStatus(),
        EnterpriseTokenManager.checkDeviceSessionStatus()
      ]);

      const snapshot: TokenSnapshot = {
        timestamp: Date.now(),
        accessStatus,
        refreshStatus,
        deviceSessionStatus
      };
      
      this.lastTokenSnapshot = snapshot;
      this.log('💾 Token snapshot kaydedildi');
    } catch (error) {
      this.log(`❌ Token snapshot kaydetme hatası: ${error.message}`);
    }
  }

  // ✅ Debug log (conditional)
  private log(message: string): void {
    if (this.config.enableDebugLogs) {
      console.log(`[AppStateMonitor] ${message}`);
    }
  }

  // ✅ Manuel token kontrolü tetikleme
  async triggerTokenCheck(): Promise<void> {
    try {
      this.log('🔧 Manuel token kontrolü tetikleniyor...');
      await this.performTokenHealthCheck();
    } catch (error) {
      this.log(`❌ Manuel token kontrolü hatası: ${error.message}`);
    }
  }

  // ✅ Geliştirilmiş debug bilgileri
  async getDebugInfo(): Promise<DebugInfo> {
    const info: DebugInfo = {
      isActive: this.isActive,
      currentAppState: AppState.currentState,
      lastActiveTime: new Date(this.lastActiveTime).toLocaleString('tr-TR'),
      backgroundTime: Math.round(this.backgroundTime / 1000),
      config: this.config,
      tokenSnapshot: this.lastTokenSnapshot || undefined,
      networkState: this.currentNetworkState || undefined
    };

    this.log(`🐛 Debug Info: ${JSON.stringify(info, null, 2)}`);
    return info;
  }

  // ✅ Konfigürasyon güncelleme
  updateConfig(newConfig: Partial<AppStateConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log(`⚙️ Konfigürasyon güncellendi: ${JSON.stringify(newConfig)}`);
    
    // Periyodik kontrol süresini güncelle
    if (newConfig.tokenCheckInterval && this.tokenCheckInterval) {
      this.startPeriodicTokenCheck();
    }
  }

  // ✅ Monitor durumunu al
  getStatus(): {
    isActive: boolean;
    isInitialized: boolean;
    hasAppStateListener: boolean;
    hasNetworkListener: boolean;
    hasPeriodicCheck: boolean;
  } {
    return {
      isActive: this.isActive,
      isInitialized: this.isInitialized,
      hasAppStateListener: this.appStateSubscription !== null,
      hasNetworkListener: this.netInfoSubscription !== null,
      hasPeriodicCheck: this.tokenCheckInterval !== null
    };
  }

  // ✅ Son token snapshot'ını al
  getLastTokenSnapshot(): TokenSnapshot | null {
    return this.lastTokenSnapshot;
  }

  // ✅ Network durumunu al
  getCurrentNetworkState(): NetInfoState | null {
    return this.currentNetworkState;
  }

  // ✅ Background süresini al
  getBackgroundTime(): number {
    return this.backgroundTime;
  }

  // ✅ Son aktif zamanı al
  getLastActiveTime(): Date {
    return new Date(this.lastActiveTime);
  }

  // ✅ Restart monitoring (recovery için)
  restart(): void {
    this.log('🔄 AppStateMonitor restart ediliyor...');
    this.stop();
    setTimeout(() => {
      this.start();
    }, 1000);
  }
}

// ✅ Singleton instance with error handling
let appStateMonitorInstance: AppStateMonitor | null = null;

export const getAppStateMonitor = (): AppStateMonitor => {
  if (!appStateMonitorInstance) {
    appStateMonitorInstance = new AppStateMonitor();
  }
  return appStateMonitorInstance;
};

// ✅ Default export - TEK EXPORT
const appStateMonitor = getAppStateMonitor();
export default appStateMonitor;
export { AppStateMonitor };