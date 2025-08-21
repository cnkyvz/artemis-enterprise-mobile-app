// app/_layout.tsx - GÜNCEL HAL
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import appStateMonitor from '../utils/appStateMonitor';
import EnterpriseTokenManager from '../utils/enterpriseTokenManager';
import { initializeAuth } from '../artemis-api/middleware/auth';
import offlineIntegrationManager from '../artemis-api/utils/offlineIntegrationManager';
import OfflineIndicator from '../components/OfflineIndicator';
import backgroundSync from '../artemis-api/utils/backgroundSync';

// ✅ GLOBAL STATE EKLE - Flash önlemek için
declare global {
 var globalAuthState: {
   isChecked: boolean;
   hasValidToken: boolean;
   isInProgress: boolean;
 } | undefined;
}

// ✅ Global state initialize et
if (typeof global !== 'undefined' && !global.globalAuthState) {
 global.globalAuthState = {
   isChecked: false,
   hasValidToken: false,
   isInProgress: false
 };
}

// Loading Screen Component
function LoadingScreen() {
 return (
   <View style={{ 
     flex: 1, 
     justifyContent: 'center', 
     alignItems: 'center',
     backgroundColor: '#2C3E50' 
   }}>
     <ActivityIndicator size="large" color="#3498DB" />
     <Text style={{ 
       color: 'white', 
       marginTop: 10, 
       fontSize: 16 
     }}>
       Yükleniyor...
     </Text>
   </View>
 );
}

export default function RootLayout() {
 // ✅ Global state'den initial değer al
 const [isLoading, setIsLoading] = useState(() => {
   return !global.globalAuthState?.isChecked;
 });
 
 const [hasChecked, setHasChecked] = useState(() => {
   return global.globalAuthState?.isChecked || false;
 });

 useEffect(() => {
   // ✅ Eğer zaten kontrol edilmişse ve progress yoksa atla
   if (global.globalAuthState?.isChecked && !global.globalAuthState?.isInProgress) {
     console.log('✅ Auth zaten kontrol edilmiş, yeniden kontrol etme');
     setIsLoading(false);
     return;
   }

   // ✅ Progress kontrolü - double execution önleme
   if (global.globalAuthState?.isInProgress) {
     console.log('⚠️ Auth kontrolü zaten devam ediyor, bekleniyor...');
     
     // Progress bitene kadar bekle
     const checkProgress = setInterval(() => {
       if (!global.globalAuthState?.isInProgress) {
         clearInterval(checkProgress);
         setIsLoading(false);
       }
     }, 100);
     
     return () => clearInterval(checkProgress);
   }
   
   // ✅ Auth kontrolünü başlat
   const performAuthCheck = async () => {
     try {
       global.globalAuthState!.isInProgress = true;
       
       console.log('🔍 HIZLI auth kontrolü başlatılıyor...');
       
       // Enterprise auth sistemini başlat
       const authInitialized = await initializeAuth();
       
       if (authInitialized) {
         appStateMonitor.start();
         console.log('✅ Enterprise sistem başlatıldı');
       } else {
         appStateMonitor.start();
         console.log('⚠️ Enterprise auth başarısız, monitor manuel başlatıldı');
       }

       // ✅ HIZLI token kontrolü - sadece cache'den
       const hasValidToken = await EnterpriseTokenManager.hasValidToken();
       
       // ✅ Global state güncelle
       global.globalAuthState!.isChecked = true;
       global.globalAuthState!.hasValidToken = hasValidToken;
       global.globalAuthState!.isInProgress = false;
       
       console.log('✅ Auth kontrol tamamlandı:', hasValidToken);
       
       // ✅ Yönlendirme yapmadan sadece loading'i bitir
       setIsLoading(false);
       
     } catch (error) {
       console.error('❌ Auth kontrol hatası:', error);
       
       global.globalAuthState!.isChecked = true;
       global.globalAuthState!.hasValidToken = false;
       global.globalAuthState!.isInProgress = false;
       
       setIsLoading(false);
     }
   };

   performAuthCheck();

   // ✅ Offline sistemini başlat
   const initOffline = async () => {
    try {
      console.log('📱 Offline sistem başlatılıyor...');
      await offlineIntegrationManager.initialize();
      console.log('✅ Offline sistem başlatıldı');

    } catch (error) {
      console.error('❌ Offline sistem hatası:', error);
      // Hata olsa da uygulamaya devam et
    }
  };

  // Auth kontrolü ile paralel başlat
  initOffline();

   
  // Cleanup function
  return () => {
    console.log('🛑 Sistemler durduruluyor...');
    // ✅ YENİ: Offline sistemini temizle
    offlineIntegrationManager.destroy().catch(console.error);
    // Mevcut kodunuz:
    appStateMonitor.stop();
  };
 }, []); // ✅ Dependency array boş - sadece mount'da çalış

 // ✅ Loading durumunda loading screen göster
 if (isLoading) {
   return <LoadingScreen />;
 }

 return (
   <SafeAreaProvider>
     <StatusBar style="auto" />
     <View style={{ 
      position: 'absolute', 
      top: 50, 
      left: 0, 
      right: 0, 
      zIndex: 1000,
      paddingHorizontal: 16 
    }}>
      <OfflineIndicator />
    </View>
     <Stack
       screenOptions={{
         headerStyle: {
           backgroundColor: '#1E88E5',
         },
         headerTintColor: '#fff',
         headerTitleStyle: {
           fontWeight: 'bold',
         },
         contentStyle: {
           backgroundColor: '#F5F9FF',
         },
         animation: 'slide_from_right',
         gestureEnabled: true,
         fullScreenGestureEnabled: true,
       }}
     >
       {/* Giriş sayfaları */}
       <Stack.Screen
         name="calisan-giris"
         options={{
           title: 'Çalışan Girişi',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="uye-giris"
         options={{
           title: 'Üye Girişi',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="uye-ol"
         options={{
           headerShown: false,
         }}
       />

       {/* Panel ve içerik sayfaları */}
       <Stack.Screen
         name="uye-panel"
         options={{
           title: '',
           headerShown: false,
           gestureEnabled: false,
           fullScreenGestureEnabled: false,
         }}
       />
       <Stack.Screen
         name="gelen-bildirimler"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="barkod-ekrani"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="qr_okuyucu"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="talepformu"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="teknisyen-panel"
         options={{
           title: '',
           headerShown: false,
           gestureEnabled: false,
           fullScreenGestureEnabled: false
         }}
       />    
       <Stack.Screen
         name="arizaformu"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="bakim-gecmisi"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="bakim-formu-detay/[id]"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="talep-detay/[id]"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="teknisyen-talep-detay/[id]"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="teknisyen-gelen-kutusu"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="firmalar"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="bakim-gecmisi/[company_id]"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="servis_takvimi"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="randevu-firmalar"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="firmalar-arizaformu"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="bildirim-ayarlari"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="profil"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="firma-randevu-takvimi/[company_id]"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="numune-gecmis"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="lab-numune-giris"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="lab-test-listesi"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="lab-rapor-listesi"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="lab-test-giris"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="lab-rapor-olustur"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="lab-numune-kartlari"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="lab-rapor-detay/[id]"
         options={{
           title: '',
           headerShown: false,
         }}
       />
        <Stack.Screen
         name="arac-takip/[deviceId]"
         options={{
           title: '',
           headerShown: false,
         }}
       />
        <Stack.Screen
         name="AracTakibi"
         options={{
           title: '',
           headerShown: false,
         }}
       />
       <Stack.Screen
         name="(tabs)"
         options={{
           headerShown: false,
           gestureEnabled: false,
           fullScreenGestureEnabled: false,
           animation: 'none'
         }}
       />

       {/* Ana sayfa */}
       <Stack.Screen
         name="index"
         options={{
           title: '',
           headerShown: false,
         }}
       />
     </Stack>
   </SafeAreaProvider>
 );
}