// app/bakim-gecmisi.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';
import EnterpriseTokenManager from '../utils/enterpriseTokenManager';
import { getCurrentToken, getCurrentUser } from '../artemis-api/middleware/auth';


const { width, height } = Dimensions.get('window');

// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface BakimFormu {
  id: number;
  tarih: string;
  firma_adi: string;
  model: string;
  seri_no: string;
  aciklamalar?: string;
}

export default function BakimGecmisi() {
  const [bakimFormlari, setBakimFormlari] = useState<BakimFormu[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { company_id } = useLocalSearchParams();

  useEffect(() => {
    fetchBakimGecmisi();
  }, [company_id]); // company_id değiştiğinde tekrar çalıştır

  useEffect(() => {
    fetchBakimGecmisi();
  }, []);

  const fetchBakimGecmisi = async () => {
    try {
      // ❌ Token'ı manuel almaya gerek yok - interceptor hallediyor
      // const token = await getCurrentToken();
      
      // Önce URL parametresinden company_id'yi kontrol et
      let companyId = company_id;
      
      // Eğer URL'den gelmiyorsa, AsyncStorage'dan userData'yı al
      if (!companyId) {
        const userData = await getCurrentUser();
        if (userData) {
          companyId = userData.company_id || userData.id;
        }
      }
      
      // Eğer hala companyId yoksa hata ver
      if (!companyId) {
        console.error('Company ID bulunamadı:', { company_id, fromStorage: false });
        Alert.alert('Hata', 'Firma bilgisi bulunamadı. Lütfen tekrar giriş yapın.', [
          { text: 'Tamam', onPress: () => router.replace('/uye-giris') }
        ]);
        return;
      }
      
      // Debug için
      console.log('API isteği gönderiliyor:', { company_id: companyId });
      
      // ✅ API isteği - interceptor otomatik token ekleyecek
      const response = await api.get(`/api/firma-bakim-gecmisi/${companyId}`);

      console.log('Bakım Formu Yanıtı:', response.data);
      
      setBakimFormlari(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error('Bakım geçmişi hatası:', err);
      
      // Daha detaylı hata yakalama
      let errorMessage = 'Bakım geçmişi yüklenemedi';
      
      if (err.response) {
        // Sunucu yanıtı varsa (4xx, 5xx)
        errorMessage += `: ${err.response.status} - ${err.response.data?.error || err.message}`;
        console.log('Hata detayı:', err.response.data);
        
        if (err.response.status === 401) {
          Alert.alert('Oturum Süresi Doldu', 'Lütfen tekrar giriş yapın', [
            { text: 'Tamam', onPress: () => {
              // ✅ Enterprise logout kullan
              import('../artemis-api/middleware/auth').then(({ logout }) => {
                logout();
              });
            }}
          ]);
          return;
        }
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Pull-to-refresh için
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Hafif titreşim uygula
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      await fetchBakimGecmisi();
      // Yükleme başarılı olursa başarı titreşimi ver
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Hata durumunda hata titreşimi ver
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Tarihi uygun formata dönüştürme
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      // Tarih geçerli mi kontrol et
      if (isNaN(date.getTime())) {
        return dateString; // Geçersizse orijinal string'i döndür
      }
      
      // Format: 21.03.2025 şeklinde
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    } catch (e) {
      console.error("Tarih formatı hatası:", e);
      return dateString;
    }
  };

  const renderBakimFormu = (form: BakimFormu) => (
    <TouchableOpacity 
      key={form.id} 
      style={styles.formItem}
      onPress={() => {
        // Detay sayfasına git
        router.push(`/bakim-formu-detay/${form.id}`);
      }}
    >
      <View style={styles.formHeader}>
        <Text style={styles.formDate}>{formatDate(form.tarih)}</Text>
        <Text style={styles.formModel}>{form.model}</Text>
      </View>
      <Text style={styles.formFirma}>{form.firma_adi}</Text>
      
      {form.seri_no && (
        <Text style={styles.formSeriNo}>Seri No: {form.seri_no}</Text>
      )}
      
      {form.aciklamalar && (
        <View style={styles.formDescription}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.formAciklama}>
            {form.aciklamalar}
          </Text>
        </View>
      )}
      
      <View style={styles.viewDetailContainer}>
        <Text style={styles.viewDetailText}>Detayları Görüntüle</Text>
        <Ionicons name="chevron-forward" size={16} color="#0088cc" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.mainContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#2C3E50"
          translucent
        />
        <LinearGradient          
          colors={['#2C3E50', '#34495E']}          
          style={styles.headerGradient}       
        >         
          <View style={styles.headerContent}>           
            <Text style={styles.headerTitle}>Bakım Geçmişi</Text>           
            <TouchableOpacity              
              style={styles.backButton}             
              onPress={() => {               
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);               
                router.back();             
              }}           
            >             
              <Ionicons name="arrow-back" size={24} color="white" />           
            </TouchableOpacity>         
          </View>       
        </LinearGradient>
        
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0088cc" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.mainContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#2C3E50"
          translucent
        />
        <LinearGradient          
          colors={['#2C3E50', '#34495E']}          
          style={styles.headerGradient}       
        >         
          <View style={styles.headerContent}>           
            <Text style={styles.headerTitle}>Bakım Geçmişi</Text>           
            <TouchableOpacity              
              style={styles.backButton}             
              onPress={() => {               
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);               
                router.back();             
              }}           
            >             
              <Ionicons name="arrow-back" size={24} color="white" />           
            </TouchableOpacity>         
          </View>       
        </LinearGradient>
        
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBakimGecmisi}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#2C3E50"
        translucent
      />
      <LinearGradient          
        colors={['#2C3E50', '#34495E']}          
        style={styles.headerGradient}       
      >         
        <View style={styles.headerContent}>           
          <Text style={styles.headerTitle}>Bakım Geçmişi</Text>           
          <TouchableOpacity              
            style={styles.backButton}             
            onPress={() => {               
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);               
              router.back();             
            }}           
          >             
            <Ionicons name="arrow-back" size={24} color="white" />           
          </TouchableOpacity>         
        </View>       
      </LinearGradient>
      
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0088cc']} // Android renk
            tintColor="#0088cc" // iOS renk
            progressBackgroundColor="#ffffff" // Android için arka plan rengi
          />
        }
      >
        {bakimFormlari.length === 0 ? (
          <Text style={styles.noDataText}>Henüz bakım kaydı bulunmamaktadır.</Text>
        ) : (
          bakimFormlari.map(renderBakimFormu)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + (height * 0.03),
    paddingBottom: height * 0.03,
    paddingHorizontal: width * 0.05,
    marginBottom: height * 0.02,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  formItem: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  formDate: {
    fontSize: 14,
    color: '#666',
  },
  formModel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0088cc',
  },
  formFirma: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  formSeriNo: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  formDescription: {
    marginTop: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  formAciklama: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  viewDetailContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  viewDetailText: {
    color: '#0088cc',
    fontSize: 14,
    marginRight: 5,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  retryButton: {
    backgroundColor: '#0088cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 15,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});