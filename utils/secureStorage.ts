// utils/secureStorage.ts - Düzeltilmiş Versiyon
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class SecureStorage {
  // ✅ Güvenli key normalizasyonu
  private static normalizeKey(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string');
    }
    
    // SecureStore için geçerli karakterlere dönüştür
    // Sadece alphanumeric, ".", "-", "_" karakterleri izinli
    return key
      .replace(/[^a-zA-Z0-9.\-_]/g, '_') // Geçersiz karakterleri _ ile değiştir
      .substring(0, 100); // Max 100 karakter sınırı
  }
  
  // ✅ Güvenli token kaydetme
  static async setSecureItem(key: string, value: string): Promise<boolean> {
    try {
      const normalizedKey = this.normalizeKey(key);
      
      if (!value || typeof value !== 'string') {
        console.error('❌ Invalid value provided to SecureStorage');
        return false;
      }
      
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(normalizedKey, value);
        return true;
      }
      
      // Native platformlar için SecureStore kullan
      await SecureStore.setItemAsync(normalizedKey, value, {
        requireAuthentication: false,
        ...(Platform.OS === 'ios' 
          ? { keychainService: 'artemis_keychain' }
          : { sharedPreferencesName: 'artemis_prefs' }
        )
       });
      
      console.log(`✅ Secure item saved: ${normalizedKey.substring(0, 10)}...`);
      return true;
      
    } catch (error) {
      console.error('❌ Secure storage save hatası:', error);
      
      // Fallback: AsyncStorage
      try {
        const normalizedKey = this.normalizeKey(key);
        await AsyncStorage.setItem(`secure_${normalizedKey}`, value);
        console.log('✅ Fallback to AsyncStorage successful');
        return true;
      } catch (fallbackError) {
        console.error('❌ Fallback storage failed:', fallbackError);
        return false;
      }
    }
  }
  
  // ✅ Güvenli token okuma
  static async getSecureItem(key: string): Promise<string | null> {
    try {
      const normalizedKey = this.normalizeKey(key);
      
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(normalizedKey);
      }
      
      const result = await SecureStore.getItemAsync(normalizedKey, {
        requireAuthentication: false,
        ...(Platform.OS === 'ios' 
          ? { keychainService: 'artemis_keychain' }
          : { sharedPreferencesName: 'artemis_prefs' }
        )
       });
      
      if (result) {
        console.log(`✅ Secure item retrieved: ${normalizedKey.substring(0, 10)}...`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Secure storage get hatası:', error);
      
      // Fallback: AsyncStorage
      try {
        const normalizedKey = this.normalizeKey(key);
        const result = await AsyncStorage.getItem(`secure_${normalizedKey}`);
        if (result) {
          console.log('✅ Fallback retrieve successful');
        }
        return result;
      } catch (fallbackError) {
        console.error('❌ Fallback retrieve failed:', fallbackError);
        return null;
      }
    }
  }
  
  // ✅ Güvenli token silme
  static async removeSecureItem(key: string): Promise<boolean> {
    try {
      const normalizedKey = this.normalizeKey(key);
      
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(normalizedKey);
        return true;
      }
      
      await SecureStore.deleteItemAsync(normalizedKey);
      
      console.log(`✅ Secure item removed: ${normalizedKey.substring(0, 10)}...`);
      return true;
      
    } catch (error) {
      console.error('❌ Secure storage remove hatası:', error);
      
      // Fallback
      try {
        const normalizedKey = this.normalizeKey(key);
        await AsyncStorage.removeItem(`secure_${normalizedKey}`);
        console.log('✅ Fallback remove successful');
        return true;
      } catch (fallbackError) {
        console.error('❌ Fallback remove failed:', fallbackError);
        return false;
      }
    }
  }
  
  // ✅ Tüm secure token'ları temizle
  static async clearAllSecureItems(): Promise<boolean> {
    try {
      // Bilinen token key'leri
      const tokenKeys = [
        'access_token',
        'refresh_token', 
        'device_session_token'
      ];
      
      const removePromises = tokenKeys.map(key => this.removeSecureItem(key));
      await Promise.all(removePromises);
      
      console.log('✅ All secure tokens cleared');
      return true;
      
    } catch (error) {
      console.error('❌ Clear all secure items failed:', error);
      return false;
    }
  }
  
  // ✅ Debug: Mevcut token'ları listele
  static async debugTokens(): Promise<void> {
    const keys = ['access_token', 'refresh_token', 'device_session_token'];
    
    console.log('🔍 === SECURE STORAGE DEBUG ===');
    for (const key of keys) {
      try {
        const value = await this.getSecureItem(key);
        console.log(`🔑 ${key}:`, value ? `✅ (${value.length} chars)` : '❌ null');
      } catch (error) {
        console.log(`🔑 ${key}: ❌ Error -`, error.message);
      }
    }
    console.log('🔍 ========================');
  }
}

export default SecureStorage;