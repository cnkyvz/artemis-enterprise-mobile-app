// utils/deviceInfo.ts
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Dimensions, Platform } from 'react-native';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Type definitions
export interface DeviceInfo {
  deviceId: string;
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  screenResolution: string;
  screenScale: number;
  timezone: string;
  language: string;
  region: string;
  platform: string;
  platformVersion: string | number;
  bundleId: string;
  buildVersion: string;
  isDevice: boolean;
  deviceType: Device.DeviceType | 'UNKNOWN';
  manufacturer: string;
  collectedAt: string;
  userAgent: string;
}

export interface CachedDeviceInfo {
  deviceInfo: DeviceInfo;
  timestamp: number;
}

export class DeviceInfoManager {
  private static DEVICE_ID_KEY = '@device_id';
  private static cachedDeviceInfo: DeviceInfo | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

  // Benzersiz device ID oluştur veya al
  static async getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(this.DEVICE_ID_KEY);
      
      if (!deviceId) {
        // Yeni device ID oluştur
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        const platform = Platform.OS;
        
        deviceId = `${platform}_${timestamp}_${random}`;
        await AsyncStorage.setItem(this.DEVICE_ID_KEY, deviceId);
        
        console.log('🆔 Yeni device ID oluşturuldu:', deviceId);
      } else {
        console.log('🆔 Mevcut device ID kullanılıyor:', deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('❌ Device ID oluşturma hatası:', error);
      // Fallback ID
      return `${Platform.OS}_fallback_${Date.now()}`;
    }
  }

  // Tam device bilgilerini topla
  static async collectDeviceInfo(): Promise<DeviceInfo> {
    try {
      const { width, height } = Dimensions.get('window');
      const deviceId = await this.getOrCreateDeviceId();
      const appVersion = Application.nativeApplicationVersion || '1.0.0';
      
      const deviceInfo: DeviceInfo = {
        // Temel bilgiler
        deviceId,
        deviceModel: `${Device.brand || 'Unknown'} ${Device.modelName || 'Unknown'}`,
        osVersion: `${Platform.OS} ${Device.osVersion || 'Unknown'}`,
        appVersion,
        
        // Ekran bilgileri
        screenResolution: `${Math.round(width)}x${Math.round(height)}`,
        screenScale: Dimensions.get('window').scale,
        
        // Lokalizasyon
        timezone: Localization.timezone || 'Unknown',
        language: Localization.locale || 'tr-TR',
        region: Localization.region || 'TR',
        
        // Platform detayları
        platform: Platform.OS,
        platformVersion: Platform.Version,
        
        // Uygulama bilgileri
        bundleId: Application.applicationId || 'com.artemis.app',
        buildVersion: Application.nativeBuildVersion || '1',
        
        // Cihaz özellikleri
        isDevice: Device.isDevice || false,
        deviceType: Device.deviceType || 'UNKNOWN',
        manufacturer: Device.manufacturer || 'Unknown',
        
        // Zaman damgası
        collectedAt: new Date().toISOString(),
        
        // Güvenlik fingerprint için ek veri
        userAgent: `Artemis/${appVersion} (${Platform.OS} ${Device.osVersion}; ${Device.modelName})`,
      };

      console.log('📱 Device Info toplandı:', {
        deviceId: deviceInfo.deviceId,
        model: deviceInfo.deviceModel,
        os: deviceInfo.osVersion,
        screen: deviceInfo.screenResolution
      });

      return deviceInfo;
    } catch (error) {
      console.error('❌ Device info toplama hatası:', error);
      
      // Minimal fallback device info
      const { width, height } = Dimensions.get('window');
      return {
        deviceId: await this.getOrCreateDeviceId(),
        deviceModel: 'Unknown Device',
        osVersion: `${Platform.OS} Unknown`,
        appVersion: '1.0.0',
        screenResolution: `${Math.round(width)}x${Math.round(height)}`,
        screenScale: 1,
        timezone: 'Unknown',
        language: 'tr-TR',
        region: 'TR',
        platform: Platform.OS,
        platformVersion: Platform.Version,
        bundleId: 'com.artemis.app',
        buildVersion: '1',
        isDevice: false,
        deviceType: 'UNKNOWN',
        manufacturer: 'Unknown',
        collectedAt: new Date().toISOString(),
        userAgent: `Artemis/1.0.0 (${Platform.OS})`,
      };
    }
  }

  // Device bilgilerini cache'le (performans için)
  static async getCachedDeviceInfo(): Promise<DeviceInfo> {
    const now = Date.now();
    
    // Cache varsa ve güncel ise kullan
    if (this.cachedDeviceInfo && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      console.log('📱 Cached device info kullanılıyor');
      return this.cachedDeviceInfo;
    }
    
    // Yeni device info topla ve cache'le
    console.log('📱 Yeni device info toplanıyor...');
    this.cachedDeviceInfo = await this.collectDeviceInfo();
    this.cacheTimestamp = now;
    
    return this.cachedDeviceInfo;
  }

  // Debug için device info'yu yazdır
  static async printDeviceInfo(): Promise<DeviceInfo> {
    const deviceInfo = await this.getCachedDeviceInfo();
    
    console.log('📱 === DEVICE INFO DEBUG ===');
    console.log('🆔 Device ID:', deviceInfo.deviceId);
    console.log('📱 Model:', deviceInfo.deviceModel);
    console.log('💻 OS:', deviceInfo.osVersion);
    console.log('📱 App:', deviceInfo.appVersion);
    console.log('📐 Screen:', deviceInfo.screenResolution);
    console.log('🌍 Timezone:', deviceInfo.timezone);
    console.log('🗣️ Language:', deviceInfo.language);
    console.log('⏰ Collected:', deviceInfo.collectedAt);
    console.log('📱 ========================');
    
    return deviceInfo;
  }

  // Device ID'yi sıfırla (test için)
  static async resetDeviceId(): Promise<string> {
    try {
      await AsyncStorage.removeItem(this.DEVICE_ID_KEY);
      this.cachedDeviceInfo = null;
      this.cacheTimestamp = 0;
      console.log('🔄 Device ID sıfırlandı');
      return await this.getOrCreateDeviceId();
    } catch (error) {
      console.error('❌ Device ID sıfırlama hatası:', error);
      throw error;
    }
  }

  // Network durumu değişikliğinde device info'yu güncelle
  static invalidateCache(): void {
    this.cachedDeviceInfo = null;
    this.cacheTimestamp = 0;
    console.log('🔄 Device info cache temizlendi');
  }

  // Cache durumu kontrolü
  static isCacheValid(): boolean {
    const now = Date.now();
    return this.cachedDeviceInfo !== null && (now - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  // Cache metadata
  static getCacheMetadata(): { isValid: boolean; age: number; lastUpdated: string | null } {
    const now = Date.now();
    return {
      isValid: this.isCacheValid(),
      age: this.cacheTimestamp > 0 ? now - this.cacheTimestamp : 0,
      lastUpdated: this.cacheTimestamp > 0 ? new Date(this.cacheTimestamp).toISOString() : null
    };
  }
}

// Export default for convenience
export default DeviceInfoManager;