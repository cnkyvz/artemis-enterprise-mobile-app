// app/firmalar-arizaformu.tsx - Complete Offline-First Version
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
  Platform,
  TextInput,  
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
  company_name: string;
  email: string;
  phone_number: string;
  address: string;
  son_form_tarihi?: string;
  form_sayisi?: number;
}

export default function FirmalarArizaformu() {
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
    initializePage();
    
    // Network durumunu dinle
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = isOffline;
      const isNowOffline = !state.isConnected;
      
      setIsOffline(isNowOffline);
      
      // Online olduysa ve önceden offline'daysa, yeni veriler çek
      if (wasOffline && !isNowOffline) {
        console.log('🌐 İnternet bağlantısı geri geldi, firmalar güncelleniyor...');
        fetchFirmalarFromAPI(true);
      }
    });

    return unsubscribe;
  }, []);

  // Arama metnine göre firmaları filtrele
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredFirmalar(firmalar);
    } else {
      const lowercasedSearch = searchText.toLowerCase();
      const filtered = firmalar.filter(firma => 
        (firma.company_name && firma.company_name.toLowerCase().includes(lowercasedSearch)) || 
        (firma.email && firma.email.toLowerCase().includes(lowercasedSearch)) ||
        (firma.phone_number && firma.phone_number.includes(searchText)) ||
        (firma.address && firma.address.toLowerCase().includes(lowercasedSearch))
      );
      setFilteredFirmalar(filtered);
    }
  }, [searchText, firmalar]);

  // Sayfa başlatma - Offline-First mantık
  const initializePage = async () => {
    try {
      setLoading(true);
      
      // İlk olarak network durumunu kontrol et
      const networkState = await NetInfo.fetch();
      const isCurrentlyOffline = !networkState.isConnected;
      setIsOffline(isCurrentlyOffline);

      if (isCurrentlyOffline) {
        // Offline - Cache'den veri yükle
        console.log('📴 Offline mode - Cache\'den firmalar yükleniyor...');
        await loadFirmalarFromCache();
      } else {
        // Online - Cache yaşını kontrol et
        const isCacheStale = await offlineStorage.isCacheStale();
        
        if (isCacheStale) {
          // Cache eski, önce cache'den göster sonra API'den güncelle
          console.log('⏰ Cache eski, önce cache gösteriliyor sonra güncelleniyor...');
          await loadFirmalarFromCache();
          await fetchFirmalarFromAPI(true);
        } else {
          // Cache yeni, cache'den yükle
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

  // Cache'den firmaları yükle
  const loadFirmalarFromCache = async () => {
    try {
      const cachedFirmalar = await offlineStorage.getCachedCompanies();
      
      if (cachedFirmalar.length > 0) {
        console.log(`📦 ${cachedFirmalar.length} firma cache'den yüklendi`);
        setFirmalar(cachedFirmalar);
        setFilteredFirmalar(cachedFirmalar);
        setDataSource('cache');
        setError(null);
      } else {
        console.log('📦 Cache boş');
        setDataSource('none');
      }
    } catch (error) {
      console.error('❌ Cache\'den firma yükleme hatası:', error);
      setDataSource('none');
    }
  };

  // API'den firmaları çek
  const fetchFirmalarFromAPI = async (isBackgroundUpdate = false) => {
    try {
      if (!isBackgroundUpdate) {
        setLoading(true);
      }
  
      // ✅ Token kontrolü ve manuel header kaldırıldı
      console.log('🌐 API\'den firmalar çekiliyor...');
      const response = await api.get('/api/firmalar');
  
      console.log(`✅ ${response.data.length} firma API'den alındı`);
      
      // Cache'e kaydet
      await offlineStorage.cacheCompanies(response.data);
      
      setFirmalar(response.data);
      setFilteredFirmalar(response.data);
      setDataSource('api');
      setError(null);
      
      if (isBackgroundUpdate) {
        // Kullanıcıya güncelleme bilgisi ver
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
    } catch (err: any) {
      console.error('❌ API\'den firma çekme hatası:', err);
      
      if (err.response && err.response.status === 401) {
        // ✅ Enterprise logout kullan
        import('../artemis-api/middleware/auth').then(({ logout }) => {
          logout();
        });
      } else {
        // API hatası - Cache'den yükle
        if (!isBackgroundUpdate) {
          await loadFirmalarFromCache();
        }
        
        if (firmalar.length === 0) {
          setError('Firmalar listesi yüklenemedi: ' + (err.response?.data?.error || err.message));
        }
      }
    } finally {
      if (!isBackgroundUpdate) {
        setLoading(false);
      }
    }
  };

  // Pull-to-refresh
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

  // Tarihi uygun formata dönüştürme
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Yok';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    } catch (e) {
      console.error("Tarih formatı hatası:", e);
      return dateString;
    }
  };

  // Arama kutusunu temizle
  const clearSearch = () => {
    hapticFeedback();
    setSearchText('');
  };

  // Veri kaynağı durumu
  const getDataSourceInfo = () => {
    switch (dataSource) {
      case 'cache':
        return {
          icon: 'cloud-offline' as const,
          text: isOffline ? 'Offline Veriler' : 'Cache\'den Yüklendi',
          color: isOffline ? '#FF9500' : '#34C759'
        };
      case 'api':
        return null; // Bu satırı değiştir - artık null döndürüyor
      default:
        return null;
    }
  };

  const renderFirmaKarti = (firma: Firma) => (
    <TouchableOpacity 
      key={firma.company_id} 
      style={styles.firmaCard}
      onPress={() => {
        hapticFeedback();
        router.push({
          pathname: '/arizaformu',
          params: { 
            company_id: firma.company_id.toString(),
            firmaAdi: firma.company_name,
            telefon: firma.phone_number,
            adres: firma.address
          }
        });
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
            <Text style={styles.firmaAddress}>{firma.address}</Text>
          </View>
        </View>
        
        <View style={styles.firmaDivider} />
        
        <View style={styles.firmaFooter}>
          <View style={styles.firmaStatsContainer}>
            <View style={styles.firmaStatsItem}>
              <Text style={styles.firmaStatsLabel}>Son Form:</Text>
              <Text style={styles.firmaStatsValue}>{formatDate(firma.son_form_tarihi)}</Text>
            </View>
            
            <View style={styles.firmaStatsItem}>
              <Text style={styles.firmaStatsLabel}>Form Sayısı:</Text>
              <Text style={styles.firmaStatsValue}>{firma.form_sayisi || 0}</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.firmaDetailsBtn}
            onPress={() => {
              hapticFeedback();
              router.push({
                pathname: '/arizaformu',
                params: { 
                  company_id: firma.company_id.toString(),
                  firmaAdi: firma.company_name,
                  telefon: firma.phone_number,
                  adres: firma.address
                }
              });
            }}
          >
            <Text style={styles.firmaDetailsBtnText}>Servis Formu</Text>
            <Ionicons name="chevron-forward" size={16} color="#1E88E5" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading && firmalar.length === 0) {
    return (
      <View style={styles.mainContainer}>
        <OfflineIndicator />
        <StatusBar barStyle="light-content" backgroundColor="#2C3E50" translucent />
        <LinearGradient colors={['#2C3E50', '#34495E']} style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Teknik Servis Formu</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1E88E5" />
          <Text style={styles.loadingText}>Firmalar yükleniyor...</Text>
        </View>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Teknik Servis Formu</Text>
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
            colors={['#0088cc']}
            tintColor="#0088cc"
            progressBackgroundColor="#ffffff"
          />
        }
      >
        
        {/* Veri Kaynağı Göstergesi */}
        {getDataSourceInfo() && (
          <View style={[styles.dataSourceIndicator, { backgroundColor: getDataSourceInfo()!.color }]}>
            <Ionicons name={getDataSourceInfo()!.icon} size={16} color="white" />
            <Text style={styles.dataSourceText}>{getDataSourceInfo()!.text}</Text>
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
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color="#1E88E5" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Hata Durumu */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={40} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchFirmalarFromAPI()}>
              <Text style={styles.retryButtonText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Firma Listesi */}
        {filteredFirmalar.length === 0 && !error ? (
          <View style={styles.noDataContainer}>
            {searchText ? (
              <>
                <Ionicons name="search" size={60} color="#ccc" />
                <Text style={styles.noDataText}>Aramanızla eşleşen firma bulunamadı.</Text>
              </>
            ) : (
              <>
                <Ionicons name="business-outline" size={60} color="#ccc" />
                <Text style={styles.noDataText}>
                  {isOffline ? 'Offline modda firma verisi yok.' : 'Firma bulunamadı.'}
                </Text>
                {isOffline && (
                  <Text style={styles.noDataSubText}>
                    İnternet bağlantınızı kontrol edin ve tekrar deneyin.
                  </Text>
                )}
              </>
            )}
          </View>
        ) : (
          filteredFirmalar.map(renderFirmaKarti)
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
    marginTop: STATUSBAR_HEIGHT,
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + 10, 
    paddingBottom: height * 0.02,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    padding: 10,
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
  // Arama kutusu stilleri
  searchContainer: {
    margin: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
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
  firmaAddress: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  firmaCard: {
    margin: 15,
    marginTop: 0,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  firmaCardGradient: {
    borderRadius: 10,
    padding: 15,
    overflow: 'hidden',
  },
  firmaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  firmaIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  firmaInfo: {
    flex: 1,
  },
  firmaName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  firmaEmail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  firmaTelefon: {
    fontSize: 14,
    color: '#555',
  },
  firmaDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginVertical: 12,
  },
  firmaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  firmaStatsContainer: {
    flexDirection: 'column',
  },
  firmaStatsItem: {
    marginBottom: 5,
  },
  firmaStatsLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 2,
  },
  firmaStatsValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  firmaDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
    borderRadius: 20,
  },
  firmaDetailsBtnText: {
    fontSize: 13,
    color: '#1E88E5',
    marginRight: 5,
    fontWeight: '500',
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
  noDataSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    margin: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#1E88E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});