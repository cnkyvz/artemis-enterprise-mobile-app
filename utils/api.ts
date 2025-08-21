// utils/api.ts - Enterprise uyumlu versiyon
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EnterpriseTokenManager from './enterpriseTokenManager';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://api.artemisaritim.com';

const api = axios.create({
  baseURL: API_URL, 
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  console.log('İstek URL (İlk):', config.url);
  
  // URL'de gereksiz /api/ tekrarını önle
  if (config.url && config.url.startsWith('/api/api/')) {
    config.url = config.url.replace('/api/api/', '/api/');
  }
  
  console.log('İstek URL (Düzeltilmiş):', config.url);
  
  // ✅ Enterprise sistem öncelikli token alma
  try {
    // Önce enterprise token'ı dene
    const enterpriseTokenInfo = await EnterpriseTokenManager.getBestAvailableToken();
    
    if (enterpriseTokenInfo.token) {
      config.headers.Authorization = `Bearer ${enterpriseTokenInfo.token}`;
      console.log('🔑 Enterprise token eklendi (Legacy API)');
      return config;
    }
    
    console.log('⚠️ Enterprise token yok, legacy token deneniyor...');
  } catch (enterpriseError) {
    console.log('❌ Enterprise token alma hatası:', enterpriseError.message);
  }
  
  // ✅ Fallback: Eski sistem token'ı
  try {
    const legacyToken = await AsyncStorage.getItem('userToken');
    if (legacyToken) {
      config.headers.Authorization = `Bearer ${legacyToken}`;
      console.log('🔑 Legacy token eklendi');
    }
  } catch (legacyError) {
    console.log('❌ Legacy token alma hatası:', legacyError.message);
  }
  
  return config;
});

export default api;