// app/randevu-firmalar.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  TextInput,
  StatusBar,
  Platform,
  Dimensions,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/enterpriseApi';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import offlineStorage from '../artemis-api/utils/offlineStorage';
import OfflineIndicator from '../components/OfflineIndicator';

const { width, height } = Dimensions.get('window');

// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface Firma {
  company_id: number;
  company_name: string; // 'ad' yerine
  email: string;
  phone_number: string; // 'telefon_no' yerine
  address: string; // Yeni eklenen alan
}

export default function RandevuFirmalar() {
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [filteredFirmalar, setFilteredFirmalar] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [dataSource, setDataSource] = useState<'cache' | 'api' | 'none'>('none');
  const router = useRouter();

  const hapticFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    initializePage(); // fetchFirmalar() yerine
  }, []);

  // Arama metnine göre firmaları filtrele
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredFirmalar(firmalar);
    } else {
      const lowercasedSearch = searchText.toLowerCase();
      const filtered = firmalar.filter(firma => 
        firma.company_name.toLowerCase().includes(lowercasedSearch) || 
        firma.email.toLowerCase().includes(lowercasedSearch) ||
        firma.phone_number.includes(searchText)
      );
      setFilteredFirmalar(filtered);
    }
  }, [searchText, firmalar]);

  const fetchFirmalar = async () => {
    try {
      // ✅ Token kontrolü ve manuel header kaldırıldı
      const response = await api.get('/api/firmalar');
  
      console.log('Firmalar Yanıtı:', response.data);
      
      setFirmalar(response.data);
      setFilteredFirmalar(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error('Firmalar listesi hatası:', err);
      
      if (err.response && err.response.status === 401) {
        // ✅ Enterprise logout kullan
        import('../artemis-api/middleware/auth').then(({ logout }) => {
          logout();
        });
      } else {
        setError('Firmalar listesi yüklenemedi: ' + (err.response?.data?.error || err.message));
      }
      
      setLoading(false);
    }
  };

  // İlk sayfa yükleme - Offline-First
const initializePage = async () => {
  try {
    setLoading(true);
    
    const networkState = await NetInfo.fetch();
    const isCurrentlyOffline = !networkState.isConnected;
    setIsOffline(isCurrentlyOffline);

    if (isCurrentlyOffline) {
      console.log('📴 Offline mode - Cache\'den firmalar yükleniyor...');
      await loadFirmalarFromCache();
    } else {
      const isCacheStale = await offlineStorage.isCacheStale();
      
      if (isCacheStale) {
        console.log('⏰ Cache eski, önce cache gösteriliyor sonra güncelleniyor...');
        await loadFirmalarFromCache();
        await fetchFirmalarFromAPI(true);
      } else {
        console.log('✅ Cache güncel, cache\'den yükleniyor...');
        await loadFirmalarFromCache();
      }
    }
  } catch (error) {
    console.error('❌ Sayfa başlatma hatası:', error);
    setError('Firmalar yüklenirken bir hata oluştu');
  } finally {
    setLoading(false);
  }
};

// Cache'den yükle
const loadFirmalarFromCache = async () => {
  try {
    const cachedFirmalar = await offlineStorage.getCachedCompanies();
    
    if (cachedFirmalar.length > 0) {
      setFirmalar(cachedFirmalar);
      setFilteredFirmalar(cachedFirmalar);
      setDataSource('cache');
      setError(null);
    } else {
      setDataSource('none');
    }
  } catch (error) {
    console.error('❌ Cache\'den firma yükleme hatası:', error);
  }
};

// API'den çek ve cache'le
const fetchFirmalarFromAPI = async (isBackgroundUpdate = false) => {
  try {
    if (!isBackgroundUpdate) setLoading(true);

    // ✅ Token kontrolü ve manuel header kaldırıldı
    const response = await api.get('/api/firmalar');

    // Cache'e kaydet
    await offlineStorage.cacheCompanies(response.data);
    
    setFirmalar(response.data);
    setFilteredFirmalar(response.data);
    setDataSource('api');
    setError(null);
    
  } catch (err: any) {
    console.error('❌ API\'den firma çekme hatası:', err);
    
    if (!isBackgroundUpdate) {
      await loadFirmalarFromCache();
    }
    
    if (firmalar.length === 0) {
      setError('Firmalar listesi yüklenemedi: ' + (err.response?.data?.error || err.message));
    }
  } finally {
    if (!isBackgroundUpdate) setLoading(false);
  }
};

  // Pull-to-refresh için
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const networkState = await NetInfo.fetch();
      
      if (networkState.isConnected) {
        await fetchFirmalarFromAPI();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await loadFirmalarFromCache();
        Alert.alert('Offline Mode', 'İnternet bağlantısı yok. Cache\'den veriler gösteriliyor.');
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('❌ Refresh hatası:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Arama kutusunu temizle
  const clearSearch = () => {
    hapticFeedback();
    setSearchText('');
  };

  const renderFirmaKarti = (firma: Firma, index: number) => (
    <TouchableOpacity 
      key={`${firma.company_id}-${index}`} 
      style={styles.firmaCard}
      onPress={() => {
        hapticFeedback();
        router.push(`/firma-randevu-takvimi/${firma.company_id}`);
      }}
    >
      <LinearGradient 
        colors={['#F5F9FF', '#E3F2FD']} 
        style={styles.firmaCardGradient}
      >
        <View style={styles.firmaHeader}>
          <View style={styles.firmaIcon}>
            <Ionicons name="business-outline" size={30} color="#1E88E5" />
          </View>
          <View style={styles.firmaInfo}>
            <Text style={styles.firmaName}>{firma.company_name}</Text>
            <Text style={styles.firmaEmail}>{firma.email}</Text>
            <Text style={styles.firmaTelefon}>{firma.phone_number}</Text>
          </View>
        </View>
        
        <View style={styles.firmaDivider} />
        
        <View style={styles.firmaFooter}>
          <View style={styles.firmaDetailsBtn}>
            <Text style={styles.firmaDetailsBtnText}>Randevu Takvimini Görüntüle</Text>
            <Ionicons name="chevron-forward" size={16} color="#1E88E5" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.mainContainer}>
        <OfflineIndicator />
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
            <View>
              <Text style={styles.headerTitle}>Servis Randevusu</Text>
              <Text style={styles.headerSubtitle}>Randevu vermek için firmayı seçin</Text>
            </View>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                hapticFeedback();
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1E88E5" />
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
            <View>
              <Text style={styles.headerTitle}>Servis Randevusu</Text>
              <Text style={styles.headerSubtitle}>Randevu vermek için firmayı seçin</Text>
            </View>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                hapticFeedback();
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              hapticFeedback();
              initializePage();;
            }}
          >
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
      {/* Header'ı ScrollView dışına taşıyoruz */}
      <LinearGradient 
        colors={['#2C3E50', '#34495E']} 
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Servis Randevusu</Text>
            <Text style={styles.headerSubtitle}>Randevu vermek için firmayı seçin</Text>
          </View>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              hapticFeedback();
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
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
        {/* Veri Kaynağı Göstergesi */}
        {dataSource === 'cache' && (
          <View style={[styles.dataSourceIndicator, { backgroundColor: isOffline ? '#FF9500' : '#34C759' }]}>
            <Ionicons name={isOffline ? 'cloud-offline' : 'cloud-done'} size={16} color="white" />
            <Text style={styles.dataSourceText}>
              {isOffline ? 'Offline Veriler' : 'Cache\'den Yüklendi'}
            </Text>
          </View>
        )}
        {/* Arama Kutusu */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#1E88E5" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Firma ara..."
              placeholderTextColor="#888"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText ? (
              <TouchableOpacity 
                onPress={clearSearch}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#1E88E5" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        
        {filteredFirmalar.length === 0 ? (
          <View style={styles.noDataContainer}>
            {searchText ? (
              <>
                <Ionicons name="search" size={60} color="#1E88E5" />
                <Text style={styles.noDataText}>Aramanızla eşleşen firma bulunamadı.</Text>
              </>
            ) : (
              <>
                <Ionicons name="business-outline" size={60} color="#1E88E5" />
                <Text style={styles.noDataText}>Firma bulunamadı.</Text>
              </>
            )}
          </View>
        ) : (
          filteredFirmalar.map((firma, index) => renderFirmaKarti(firma, index))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F9FF',
    padding: 20,
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + (height * 0.03), 
    paddingBottom: height * 0.03,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E0E0E0',
  },
  backButton: {
    padding: 10,
  },
  searchContainer: {
    paddingHorizontal: width * 0.04,
    marginTop: height * 0.02, // Arama kutusuna üstten margin ekliyoruz
    marginBottom: height * 0.02,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  firmaCard: {
    marginHorizontal: width * 0.04,
    marginBottom: height * 0.02,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  firmaCardGradient: {
    padding: 15,
  },
  firmaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  firmaIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  firmaInfo: {
    flex: 1,
  },
  firmaName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 5,
  },
  firmaEmail: {
    fontSize: 14,
    color: '#34495E',
    marginBottom: 3,
  },
  firmaTelefon: {
    fontSize: 14,
    color: '#34495E',
  },
  firmaDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 10,
  },
  firmaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  firmaDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  firmaDetailsBtnText: {
    fontSize: 14,
    color: '#1E88E5',
    marginRight: 5,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    margin: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noDataText: {
    marginTop: 15,
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1E88E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 15,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Veri kaynağı göstergesi
dataSourceIndicator: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 8,
  marginHorizontal: 15,
  marginTop: 10,
  borderRadius: 8,
},
dataSourceText: {
  color: 'white',
  fontSize: 12,
  fontWeight: '500',
  marginLeft: 6,
},
noDataSubText: {
  marginTop: 8,
  fontSize: 14,
  color: '#999',
  textAlign: 'center',
},
});