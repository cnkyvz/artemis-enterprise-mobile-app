// app/bakim-gecmisi/[company_id].tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  StatusBar,
  Platform,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/enterpriseApi';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import offlineStorage from '../../artemis-api/utils/offlineStorage';


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
  giris_numune?: string; // Birim (Litre veya Metreküp)
  giris_litre?: number;  // Miktar
  cikis_numune?: string; // Birim (Litre veya Metreküp)
  cikis_litre?: number;  // Miktar
  // Gerekirse diğer alanlar eklenebilir
}

interface FirmaBilgi {
  company_id: number;  // company_id yerine
  company_name: string;  // ad yerine
  email: string;
  phone_number: string;  // telefon_no yerine
  address: string;  // yeni alan
}

export default function FirmaBakimGecmisi() {
  const [bakimFormlari, setBakimFormlari] = useState<BakimFormu[]>([]);
  const [filteredFormlari, setFilteredFormlari] = useState<BakimFormu[]>([]);
  const [firma, setFirma] = useState<FirmaBilgi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { company_id } = useLocalSearchParams();
  const router = useRouter();
  
  // Ay ve yıl filtresi için state
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  
  // Tüm formlardan benzersiz yılları elde et
  const [uniqueYears, setUniqueYears] = useState<number[]>([]);
  
  // Türkçe ay isimleri
  const months = [
    { id: 0, name: 'Ocak' },
    { id: 1, name: 'Şubat' },
    { id: 2, name: 'Mart' },
    { id: 3, name: 'Nisan' },
    { id: 4, name: 'Mayıs' },
    { id: 5, name: 'Haziran' },
    { id: 6, name: 'Temmuz' },
    { id: 7, name: 'Ağustos' },
    { id: 8, name: 'Eylül' },
    { id: 9, name: 'Ekim' },
    { id: 10, name: 'Kasım' },
    { id: 11, name: 'Aralık' },
    { id: -1, name: 'Tüm Aylar' }
  ];

  const hapticFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    fetchFirmaBilgisi(); // Bu aynı kalabilir (tek firma bilgisi)
    initializePage(); // fetchBakimGecmisi() yerine
  }, [company_id]);

  // Benzersiz yılları ve formlari filtreleme
  useEffect(() => {
    if (bakimFormlari.length > 0) {
      // Benzersiz yılları elde et
      const years = bakimFormlari.map(form => new Date(form.tarih).getFullYear());
      const uniqueYearsArray = [...new Set(years)].sort((a, b) => b - a); // Yılları azalan sırada sırala
      setUniqueYears(uniqueYearsArray);
      
      // Varsayılan olarak en son yılı seç
      if (!selectedYear && uniqueYearsArray.length > 0) {
        setSelectedYear(uniqueYearsArray[0]);
      }
      
      // Filtreleme işlemi
      applyFilters();
    }
  }, [bakimFormlari, selectedMonth, selectedYear]);

  // Filtreleri uygula
  const applyFilters = () => {
    let filtered = [...bakimFormlari];
    
    // Yıl filtresi
    if (selectedYear !== null) {
      filtered = filtered.filter(form => {
        const formDate = new Date(form.tarih);
        return formDate.getFullYear() === selectedYear;
      });
    }
    
    // Ay filtresi
    if (selectedMonth !== null && selectedMonth !== -1) {
      filtered = filtered.filter(form => {
        const formDate = new Date(form.tarih);
        return formDate.getMonth() === selectedMonth;
      });
    }
    
    // Tarihe göre azalan sırada sırala (en son tarih en üstte)
    filtered.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
    
    setFilteredFormlari(filtered);
  };

  // Filtre modunu sıfırla
  const resetFilters = () => {
    setSelectedMonth(-1);
    setSelectedYear(null);
  };
  
  const fetchFirmaBilgisi = async () => {
    try {
      const networkState = await NetInfo.fetch();
      
      if (networkState.isConnected) {
        // Online - API'den çek
        const response = await api.get(`/api/firma/${company_id}`);
        setFirma(response.data);
      } else {
        // Offline - Cache'den çek
        const cachedCompany = await offlineStorage.getCompanyInfo(company_id);
        if (cachedCompany) {
          setFirma({
            company_id: cachedCompany.company_id,
            company_name: cachedCompany.company_name,
            email: cachedCompany.email,
            phone_number: cachedCompany.phone_number,
            address: cachedCompany.address
          });
          console.log('📴 Offline: Firma bilgisi cache\'den alındı');
        } else {
          setError('Offline modda firma bilgisi bulunamadı.');
        }
      }
    } catch (err: any) {
      console.error('Firma bilgisi hatası:', err);
      setError('Firma bilgisi yüklenemedi.');
    }
  };

// Sayfa başlatma - Offline-First
const initializePage = async () => {
  try {
    setLoading(true);
    
    const networkState = await NetInfo.fetch();
    const isCurrentlyOffline = !networkState.isConnected;

    if (isCurrentlyOffline) {
      console.log('📴 Offline mode - Cache\'den bakım geçmişi yükleniyor...');
      const hasCache = await loadBakimFromCache();
      
      if (!hasCache) {
        setError('Offline modda veri bulunamadı. Lütfen internetle bağlanarak verileri güncelleyin.');
      }
    } else {
      // ✅ Online - cache stale kontrolü daha akıllı
      const isCacheStale = await offlineStorage.isBakimCacheStale(company_id);
      
      if (isCacheStale) {
        console.log('⏰ Cache eski veya boş - API\'den fresh data çekiliyor...');
        await fetchBakimFromAPI();
      } else {
        console.log('✅ Cache güncel - önce cache göster, arka planda güncelle');
        const hasCache = await loadBakimFromCache();
        
        if (hasCache) {
          // Arka planda güncelleme
          fetchBakimFromAPI(true);
        } else {
          // Cache boşsa direkt API'den çek
          await fetchBakimFromAPI();
        }
      }
    }
  } catch (error) {
    console.error('❌ Bakım geçmişi başlatma hatası:', error);
    setError('Bakım geçmişi yüklenirken bir hata oluştu');
  } finally {
    setLoading(false);
  }
};

// ✅ Cache load fonksiyonunu boolean return yapısına çevir
const loadBakimFromCache = async () => {
  try {
    console.log('🔍 Cache\'den bakım formları aranıyor...', company_id);
    const cachedForms = await offlineStorage.getCachedBakimGecmisi(company_id);
    console.log('📊 Cache\'den gelen form sayısı:', cachedForms.length);
    
    if (cachedForms.length > 0) {
      setBakimFormlari(cachedForms);
      setFilteredFormlari(cachedForms);
      setError(null);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Cache\'den bakım yükleme hatası:', error);
    return false;
  }
};

// API'den çek ve cache'le
const fetchBakimFromAPI = async (isBackgroundUpdate = false) => {
  try {
    if (!isBackgroundUpdate) setLoading(true);

    const response = await api.get(`/api/firma-bakim-gecmisi/${company_id}`);

    // Cache'e kaydet
    await offlineStorage.cacheBakimGecmisi(company_id, response.data);
    
    setBakimFormlari(response.data);
    setFilteredFormlari(response.data);
    setError(null);
    
  } catch (err: any) {
    console.error('❌ API\'den bakım çekme hatası:', err);
    
    if (!isBackgroundUpdate) {
      await loadBakimFromCache();
    }
    
    if (bakimFormlari.length === 0) {
      setError('Bakım geçmişi yüklenemedi: ' + (err.response?.data?.error || err.message));
    }
  } finally {
    if (!isBackgroundUpdate) setLoading(false);
  }
};

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
        hapticFeedback();
        router.push(`/bakim-formu-detay/${form.id}`);
      }}
    >
      <LinearGradient 
        colors={['#F5F9FF', '#E3F2FD']} 
        style={styles.formItemGradient}
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
          <Ionicons name="chevron-forward" size={16} color="#1E88E5" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => {
            hapticFeedback();
            initializePage();
          }}
        >
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Seçilen ayın adını al
  const getSelectedMonthName = () => {
    if (selectedMonth === null) return 'Tüm Aylar';
    return months.find(m => m.id === selectedMonth)?.name || 'Tüm Aylar';
  };

  return (
     <View style={styles.mainContainer}>
                <StatusBar
                    barStyle="light-content"
                    backgroundColor="#2C3E50"
                    translucent
                />
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient 
        colors={['#2C3E50', '#34495E']} 
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              hapticFeedback();
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bakım Geçmişi</Text>
        </View>
      </LinearGradient>

      {firma && (
        <View style={styles.firmaInfoContainer}>
        <Text style={styles.firmaName}>{firma.company_name}</Text>
        <Text style={styles.firmaContact}>{firma.email} | {firma.phone_number}</Text>
        {firma.address && <Text style={styles.firmaAddress}>{firma.address}</Text>}
      </View>
      )}
      
      {/* Filtre Alanı */}
      <View style={styles.filterContainer}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Filtrele</Text>
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={() => {
              hapticFeedback();
              resetFilters();
            }}
          >
            <Text style={styles.resetButtonText}>Sıfırla</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.filterRow}>
          {/* Ay Seçici */}
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => {
              hapticFeedback();
              setMonthPickerVisible(true);
            }}
          >
            <Text style={styles.filterButtonText}>{getSelectedMonthName()}</Text>
            <Ionicons name="chevron-down" size={16} color="#555" />
          </TouchableOpacity>
          
          {/* Yıl Seçici */}
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => {
              hapticFeedback();
              setYearPickerVisible(true);
            }}
          >
            <Text style={styles.filterButtonText}>{selectedYear || 'Tüm Yıllar'}</Text>
            <Ionicons name="chevron-down" size={16} color="#555" />
          </TouchableOpacity>
        </View>
        
        {/* Filtre sonuç bilgisi */}
        {(selectedMonth !== null || selectedYear !== null) && (
          <View style={styles.filterInfo}>
            <Text style={styles.filterInfoText}>
              {filteredFormlari.length} form gösteriliyor {(selectedMonth !== null && selectedMonth !== -1) ? `(${getSelectedMonthName()})` : ''} {selectedYear ? `(${selectedYear})` : ''}
            </Text>
          </View>
        )}
      </View>
      
      {filteredFormlari.length === 0 ? (
        <View style={styles.noDataContainer}>
          <Ionicons name="document-text-outline" size={60} color="#ccc" />
          <Text style={styles.noDataText}>
            {selectedMonth !== null || selectedYear !== null ? 
              'Seçilen filtrelere uygun bakım formu bulunamadı.' : 
              'Henüz bakım kaydı bulunmamaktadır.'}
          </Text>
        </View>
      ) : (
        filteredFormlari.map(renderBakimFormu)
      )}
      
      {/* Ay Seçme Modal */}
      <Modal
        visible={monthPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ay Seçin</Text>
              <TouchableOpacity 
                onPress={() => {
                  hapticFeedback();
                  setMonthPickerVisible(false);
                }}
              >
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={months}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    selectedMonth === item.id && styles.selectedPickerItem
                  ]}
                  onPress={() => {
                    hapticFeedback();
                    setSelectedMonth(item.id);
                    setMonthPickerVisible(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    selectedMonth === item.id && styles.selectedPickerItemText
                  ]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      
      {/* Yıl Seçme Modal */}
      <Modal
        visible={yearPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setYearPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yıl Seçin</Text>
              <TouchableOpacity 
                onPress={() => {
                  hapticFeedback();
                  setYearPickerVisible(false);
                }}
              >
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={[{ id: -1, year: 'Tüm Yıllar' }, ...uniqueYears.map(year => ({ id: year, year: year.toString() }))]}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    (selectedYear === item.id || (item.id === -1 && selectedYear === null)) && styles.selectedPickerItem
                  ]}
                  onPress={() => {
                    hapticFeedback();
                    setSelectedYear(item.id === -1 ? null : item.id);
                    setYearPickerVisible(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    (selectedYear === item.id || (item.id === -1 && selectedYear === null)) && styles.selectedPickerItemText
                  ]}>
                    {item.year}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    paddingTop: STATUSBAR_HEIGHT + (height * 0.03), // StatusBar yüksekliğini ekleyin
    paddingBottom: height * 0.03,
    paddingHorizontal: width * 0.05,
    marginBottom: height * 0.02,
},
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: width * 0.05,
  },
  backButton: {
    padding: 10,
  },
  firmaInfoContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    margin: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  firmaName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  firmaContact: {
    fontSize: 14,
    color: '#666',
  },
  // Filtre Stilleri
  filterContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    margin: 15,
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  resetButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  resetButtonText: {
    color: '#1E88E5',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 0.48, // Yaklaşık yarı genişlikte
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
  },
  filterInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  filterInfoText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  formItem: {
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
  formItemGradient: {
    borderRadius: 10,
    padding: 15,
    overflow: 'hidden',
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
    color: '#1E88E5',
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
    color: '#1E88E5',
    fontSize: 14,
    marginRight: 5,
  },
  // Modal Stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  firmaAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingHorizontal: 15,
    paddingBottom: 30, // Alt kısımda ekstra boşluk
    maxHeight: '70%', // Ekranın en fazla %70'ini kaplasın
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  pickerItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedPickerItem: {
    backgroundColor: '#E3F2FD',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedPickerItemText: {
    color: '#1E88E5',
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noDataText: {
    marginTop: 10,
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
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
  }
});