// app/firma-randevu-takvimi/[company_id].tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  TouchableOpacity, 
  Modal, 
  FlatList,
  StatusBar,
  Platform, 
  Dimensions,
  ActivityIndicator ,
  ScrollView,
  RefreshControl
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../utils/enterpriseApi';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import offlineStorage from '../../artemis-api/utils/offlineStorage';
import OfflineIndicator from '../../components/OfflineIndicator';

const { width, height } = Dimensions.get('window');



// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;


// Türkçe Yerelleştirme
LocaleConfig.locales['tr'] = {
  monthNames: [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ],
  monthNamesShort: [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
  ],
  dayNames: [
    'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
  ],
  dayNamesShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
};
LocaleConfig.defaultLocale = 'tr';

interface FirmaBilgi {
  company_id: number;  // company_id yerine
  company_name: string;  // ad yerine
  email: string;
  phone_number: string;  // telefon_no yerine
  address: string;  // yeni alan
}

type MarkedDates = {
  [date: string]: {
    marked?: boolean;
    dotColor?: string;
    color?: string;
    textColor?: string;
    type?: string;
    [key: string]: any;
  }
};

type SelectorType = 'month' | 'year' | null;

export default function FirmaRandevuTakvimi() {
  const { company_id } = useLocalSearchParams();
  const router = useRouter();
  
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [firma, setFirma] = useState<FirmaBilgi | null>(null);
  
  // Onay modalı için state
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [dateToConfirm, setDateToConfirm] = useState('');
  
  // Ay/Yıl seçici için state'ler
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorType, setSelectorType] = useState<SelectorType>(null);

  // API çağrılarını iptal etmek için ref
  const cancelTokenSourceRef = useRef<any>(null);
  
  // Debounce için zamanlayıcı
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const [isOffline, setIsOffline] = useState(false);
  const [dataSource, setDataSource] = useState<'cache' | 'api' | 'none'>('none');

  

  // Firma bilgilerini getir
  useEffect(() => {
    fetchFirmaBilgisi();
  }, [company_id]);

  // Takvim başlatma - Offline-First
const initializeTakvim = async () => {
  try {
    setLoading(true);
    
    const networkState = await NetInfo.fetch();
    const isCurrentlyOffline = !networkState.isConnected;
    setIsOffline(isCurrentlyOffline);

    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    if (isCurrentlyOffline) {
      console.log('📴 Offline mode - Cache\'den takvim yükleniyor...');
      await loadTakvimFromCache(month, year);
    } else {
      const isCacheStale = await offlineStorage.isRandevuCacheStale(company_id, month, year);
      
      if (isCacheStale) {
        console.log('⏰ Takvim cache eski, önce cache gösteriliyor sonra güncelleniyor...');
        await loadTakvimFromCache(month, year);
        await fetchTakvimFromAPI(true);
      } else {
        console.log('✅ Takvim cache güncel, cache\'den yükleniyor...');
        await loadTakvimFromCache(month, year);
      }
    }
  } catch (error) {
    console.error('❌ Takvim başlatma hatası:', error);
  } finally {
    setLoading(false);
  }
};

// Cache'den takvim yükle
const loadTakvimFromCache = async (month: number, year: number) => {
  try {
    const cachedData = await offlineStorage.getCachedRandevular(company_id, month, year);
    
    if (cachedData.randevuGunleri.length > 0 || cachedData.formGunleri.length > 0) {
      // ✅ TİP HATASI DÜZELTİLDİ
      const markedDateData: MarkedDates = {};
      
      // Form günleri (yeşil nokta)
      cachedData.formGunleri?.forEach((tarih: string) => {
        markedDateData[tarih] = { 
          marked: true, 
          dotColor: 'green',
          color: 'rgba(0, 255, 0, 0.2)' 
        };
      });

      // Randevu günleri (sarı arka plan)
      cachedData.randevuGunleri?.forEach((tarih: string) => {
        const randevuTarihi = new Date(tarih);
        const today = new Date();
        
        // Sadece tarih kısmını karşılaştır
        randevuTarihi.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        if (randevuTarihi >= today) {
          markedDateData[tarih] = { 
            marked: true, 
            dotColor: 'yellow',
            color: 'rgba(255, 255, 0, 0.3)', 
            type: 'randevu'
          };
        }
      });

      setMarkedDates(markedDateData);
      setDataSource('cache');
    } else {
      setDataSource('none');
    }
  } catch (error) {
    console.error('❌ Cache\'den takvim yükleme hatası:', error);
  }
};

// API'den takvim çek ve cache'le
const fetchTakvimFromAPI = async (isBackgroundUpdate = false) => {
  if (!isBackgroundUpdate) setLoading(true);

  try {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    const response = await api.get(`/api/firma-randevulari/${company_id}`, {
      params: { month, year }
    });

    // Cache'e kaydet
    await offlineStorage.cacheRandevular(company_id, month, year, response.data);

    // ✅ TİP HATASI DÜZELTİLDİ: MarkedDates tipini açıkça belirt
    const markedDateData: MarkedDates = {};

    // Bugünün tarihini al
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD formatı
    
    // Form günleri (yeşil nokta)
    response.data.formGunleri?.forEach((tarih: string) => {
      markedDateData[tarih] = { 
        marked: true, 
        dotColor: 'green',
        color: 'rgba(0, 255, 0, 0.2)' 
      };
    });

    // Randevu günleri (sarı arka plan)
    response.data.randevuGunleri?.forEach((tarih: string) => {
      const randevuTarihi = new Date(tarih);
      const today = new Date();
      
      // Sadece tarih kısmını karşılaştır (saat bilgisini görmezden gel)
      randevuTarihi.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      if (randevuTarihi >= today) {
        markedDateData[tarih] = { 
          marked: true, 
          dotColor: 'yellow',
          color: 'rgba(255, 255, 0, 0.3)', 
          type: 'randevu',
          ...(tarih === todayString && { textColor: '#007BFF' })
        };
      }
    });

    // Bugün için özel işaretleme
    if (!markedDateData[todayString]) {
      markedDateData[todayString] = {
        marked: false, // Bugün için temel değerler ekle
        textColor: '#007BFF'
      };
    }

    setMarkedDates(markedDateData);
    setDataSource('api');

  } catch (error) {
    console.error('❌ API\'den takvim çekme hatası:', error);
    
    if (!isBackgroundUpdate) {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      await loadTakvimFromCache(month, year);
    }
  } finally {
    if (!isBackgroundUpdate) setLoading(false);
  }
};

const fetchFirmaBilgisi = useCallback(async () => {
  try {
    const networkState = await NetInfo.fetch();
    
    if (networkState.isConnected) {
      // Online - API'den çek
      console.log('🌐 Online: Firma bilgisi API\'den çekiliyor...');
      const response = await api.get(`/api/firma/${company_id}`);
      console.log('✅ Firma Bilgisi:', response.data);
      setFirma(response.data);
    } else {
      // ✅ Offline - Cache'den çek
      console.log('📴 Offline: Firma bilgisi cache\'den çekiliyor...');
      const cachedCompany = await offlineStorage.getCompanyInfo(company_id);
      
      if (cachedCompany) {
        setFirma({
          company_id: cachedCompany.company_id,
          company_name: cachedCompany.company_name,
          email: cachedCompany.email,
          phone_number: cachedCompany.phone_number,
          address: cachedCompany.address
        });
        console.log('✅ Offline: Firma bilgisi cache\'den alındı');
      } else {
        console.log('⚠️ Offline: Firma cache\'de bulunamadı');
        // Hata gösterme, sadece firma bilgisi olmadan devam et
      }
    }
  } catch (err: any) {
    console.error('❌ Firma bilgisi hatası:', err);
    
    // ✅ Offline durumunda hata gösterme
    const networkState = await NetInfo.fetch();
    if (networkState.isConnected) {
      Alert.alert('Hata', 'Firma bilgileri yüklenemedi.');
      throw err;
    }
    // Offline'da sessizce devam et
  }
}, [company_id]);

const fetchTakvimVerileri = useCallback(async () => {
  // Önceki isteği iptal et
  if (cancelTokenSourceRef.current) {
    cancelTokenSourceRef.current.cancel('Yeni istek geldi');
  }

  // Yeni cancel token oluştur
  cancelTokenSourceRef.current = axios.CancelToken.source();

  try {
    setLoading(true);
    
    const response = await api.get(`/api/firma-randevulari/${company_id}`, {
      params: {
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      },
      cancelToken: cancelTokenSourceRef.current.token
    });

    // ✅ TİP HATASI DÜZELTİLDİ
    const markedDateData: MarkedDates = {};
    
    // Form günleri (yeşil nokta)
    response.data.formGunleri?.forEach((tarih: string) => {
      markedDateData[tarih] = { 
        marked: true, 
        dotColor: 'green',
        color: 'rgba(0, 255, 0, 0.2)' 
      };
    });

    // Randevu günleri (sarı arka plan)
    response.data.randevuGunleri?.forEach((tarih: string) => {
      const randevuTarihi = new Date(tarih);
      const today = new Date();
      
      // Sadece tarih kısmını karşılaştır
      randevuTarihi.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      if (randevuTarihi >= today) {
        markedDateData[tarih] = { 
          marked: true, 
          dotColor: 'yellow',
          color: 'rgba(255, 255, 0, 0.3)', 
          type: 'randevu'
        };
      }
    });

    setMarkedDates(markedDateData);

  } catch (error) {
    if (axios.isCancel(error)) {
      console.log('İstek iptal edildi');
    } else {
      console.error('Takvim verileri çekme hatası:', error);
      Alert.alert('Hata', 'Takvim verileri yüklenemedi.');
    }
  } finally {
    setLoading(false);
  }
}, [currentDate, company_id]);

  // Pull-to-refresh için callback fonksiyon ekleyin
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const networkState = await NetInfo.fetch();
      
      if (networkState.isConnected) {
        await Promise.all([
          fetchFirmaBilgisi(),
          fetchTakvimFromAPI()
        ]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // ✅ Offline refresh
        const cachedCompany = await offlineStorage.getCompanyInfo(company_id);
        if (cachedCompany) {
          setFirma({
            company_id: cachedCompany.company_id,
            company_name: cachedCompany.company_name,
            email: cachedCompany.email,
            phone_number: cachedCompany.phone_number,
            address: cachedCompany.address
          });
        }
        await loadTakvimFromCache(currentDate.getMonth() + 1, currentDate.getFullYear());
        Alert.alert('Offline Mode', 'İnternet bağlantısı yok. Cache\'den veriler gösteriliyor.');
      }
    } catch (error) {
      console.error('Yenileme hatası:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFirmaBilgisi, currentDate, company_id]);

  // Ana useEffect
  useEffect(() => {
    initializeTakvim();
  
    // Network durumunu dinle
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = isOffline;
      const isNowOffline = !state.isConnected;
      
      setIsOffline(isNowOffline);
      
      // Online olduysa ve önceden offline'daysa, yeni veriler çek
      if (wasOffline && !isNowOffline) {
        console.log('🌐 İnternet bağlantısı geri geldi, takvim güncelleniyor...');
        fetchTakvimFromAPI(true);
      }
    });
  
    return () => {
      unsubscribe();
      // Diğer temizleme işlemleri...
    };
  }, [currentDate]);

  // Ay değişimini yönet
  const handleMonthChange = useCallback((month: { dateString: string, timestamp: number }) => {
    // Önceki zamanlayıcıyı temizle
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
    }

    // Yeni zamanlayıcı kur (debounce)
    fetchTimerRef.current = setTimeout(() => {
      const newDate = new Date(month.timestamp);
      setCurrentDate(newDate);
    }, 300); // 300ms gecikme
  }, []);


const handleDayPress = (day: { dateString: string }) => {
  setSelectedDate(day.dateString);
  
  // Tarihin durumuna göre işlem yapılır
  if (markedDates[day.dateString]?.type === 'randevu') {
    // Zaten randevu varsa iptal seçeneği sunalım
    Alert.alert(
      'Tarih Detayları',
      `${formatDate(day.dateString)} tarihinde randevu kaydınız bulunmaktadır.`,
      [
        { text: 'Tamam', style: 'default' },
        { 
          text: 'Randevuyu İptal Et', 
          style: 'destructive', 
          onPress: () => confirmCancelAppointment(day.dateString) 
        }
      ]
    );
  } else if (markedDates[day.dateString]?.dotColor === 'green') {
    // Bakım yapılmış tarih (yeşil nokta)
    Alert.alert(
      'Tarih Detayları',
      `${formatDate(day.dateString)} tarihinde bakım yapılmıştır. Bu tarihe randevu verilemez.`
    );
  } else {
    // Randevu yoksa ve bakım yapılmamışsa, yeni randevu oluşturmak için onay göster
    setDateToConfirm(day.dateString);
    setConfirmModalVisible(true);
  }
};

  // İptal onayı için yeni bir fonksiyon ekleyin
const confirmCancelAppointment = (date: string) => {
  Alert.alert(
    'Randevu İptali Onayı',
    `${formatDate(date)} tarihindeki randevuyu iptal etmek istediğinize emin misiniz?`,
    [
      { text: 'Vazgeç', style: 'cancel' },
      { 
        text: 'İptal Et', 
        style: 'destructive', 
        onPress: () => cancelAppointment(date) 
      }
    ]
  );
};

// İptal işlemi için yeni bir fonksiyon ekleyin
const cancelAppointment = async (date: string) => {
  try {
    const networkState = await NetInfo.fetch();
    
    if (!networkState.isConnected) {
      // Offline mode - yerel iptal
      console.log('📴 Offline randevu iptali kaydediliyor...');
      
      await offlineStorage.cancelOfflineRandevu(company_id, date);
      
      // Local state'den kaldır
      const updatedMarked = { ...markedDates };
      delete updatedMarked[date];
      setMarkedDates(updatedMarked);
      
      Alert.alert(
        'Offline İptal', 
        'İnternet bağlantısı yok. Randevu iptali yerel olarak kaydedildi ve bağlantı kurulduğunda otomatik işlenecek.'
      );
      return;
    }

    const response = await api.put('/api/randevu-iptal', {
      company_id: Number(company_id),
      randevu_tarihi: date
    });
    
    if (response.status === 200) {
      Alert.alert('Başarılı', 'Randevu başarıyla iptal edildi.');
      
      // Takvimi güncelle
      await fetchTakvimFromAPI();
    }
  } catch (error) {
    console.error('Randevu iptal hatası:', error);
    Alert.alert('Hata', 'Randevu iptal edilemedi.');
  }
};

  // Randevu oluşturma fonksiyonu
  const createRandevu = async () => {
    try {
      const networkState = await NetInfo.fetch();
      
      if (!networkState.isConnected) {
        // Offline mode - yerel kayıt
        console.log('📴 Offline randevu kaydediliyor...');
        
        await offlineStorage.saveOfflineRandevu(company_id, dateToConfirm);
        
        // Local state'i güncelle
        const updatedMarked = { ...markedDates };
        updatedMarked[dateToConfirm] = {
          marked: true,
          dotColor: 'yellow',
          color: 'rgba(255, 255, 0, 0.3)',
          type: 'randevu'
        };
        setMarkedDates(updatedMarked);
        
        Alert.alert(
          'Offline Kayıt', 
          'İnternet bağlantısı yok. Randevu yerel olarak kaydedildi ve bağlantı kurulduğunda otomatik gönderilecek.'
        );
        return;
      }
  
      // ✅ Token kontrolü ve manuel header kaldırıldı
      const response = await api.post('/api/randevu-ekle', {
        company_id: Number(company_id),
        randevu_tarihi: dateToConfirm
      });
      
      if (response.status === 201) {
        Alert.alert('Başarılı', 'Randevu başarıyla oluşturuldu.');
        
        // Takvimi güncelle
        await fetchTakvimFromAPI();
      }
    } catch (error) {
      console.error('Randevu oluşturma hatası:', error);
      Alert.alert('Hata', 'Randevu oluşturulamadı.');
    }
  };

  // Özel başlık bileşeni - Ay ve Yıl seçilebilir
  const renderCustomHeaderContent = () => {
    const month = LocaleConfig.locales['tr'].monthNames[currentDate.getMonth()];
    const year = currentDate.getFullYear();

    return (
      <View style={styles.customHeaderContainer}>
        <TouchableOpacity 
          style={styles.monthYearButton}
          onPress={() => {
            setSelectorType('month');
            setSelectorVisible(true);
          }}
        >
          <Text style={styles.monthText}>{month}</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerDivider}> </Text>
        
        <TouchableOpacity 
          style={styles.monthYearButton}
          onPress={() => {
            setSelectorType('year');
            setSelectorVisible(true);
          }}
        >
          <Text style={styles.yearText}>{year}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Ay seçme modalı için veri
  const months = LocaleConfig.locales['tr'].monthNames.map((name:string, index:number) => ({
    id: index,
    name: name
  }));

  // Yıl seçme modalı için veri (şu anki yılın ±10 yılı)
  const currentYear = currentDate.getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => ({
    id: currentYear - 10 + i,
    name: `${currentYear - 10 + i}`
  }));

  // Ay veya yıl seçildiğinde
  const handleSelect = (id: number) => {
    const newDate = new Date(currentDate);
    
    if (selectorType === 'month') {
      newDate.setMonth(id);
    } else if (selectorType === 'year') {
      newDate.setFullYear(id);
    }
    
    setCurrentDate(newDate);
    setSelectorVisible(false);
    setSelectorType(null);
  };

  // Tarihi formatlama
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate()} ${LocaleConfig.locales['tr'].monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  if (loading && !firma) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0088cc" />
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
              <Text style={styles.headerTitle}>Randevu Takvimi</Text>
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
          colors={['#0088cc']}
          tintColor="#0088cc"
          progressBackgroundColor="#ffffff"
        />
      }
    >

    <View style={styles.container}>
      {/* Veri Kaynağı Göstergesi */}
      {dataSource === 'cache' && (
        <View style={[styles.dataSourceIndicator, { backgroundColor: isOffline ? '#FF9500' : '#34C759' }]}>
          <Ionicons name={isOffline ? 'cloud-offline' : 'cloud-done'} size={16} color="white" />
          <Text style={styles.dataSourceText}>
            {isOffline ? 'Offline Veriler' : 'Cache\'den Yüklendi'}
          </Text>
        </View>
      )}

      {firma && (
        <View style={styles.firmaInfoContainer}>
        <Text style={styles.firmaName}>{firma.company_name}</Text>
        <Text style={styles.firmaContact}>{firma.email} | {firma.phone_number}</Text>
        {firma.address && <Text style={styles.firmaAddress}>{firma.address}</Text>}
      </View>
      )}
      

      
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'rgba(0, 255, 0, 0.2)' }]} />
          <Text style={styles.legendText}>Bakım Formları</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'rgba(255, 255, 0, 0.3)' }]} />
          <Text style={styles.legendText}>Randevular</Text>
        </View>
      </View>
      
      <Calendar
        // Genel Takvim Ayarları
        markedDates={markedDates as any}
        markingType={'period'}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        // Başlangıç tarihi olarak şu anki tarihi ve yılı kullan
        initialDate={currentDate.toISOString().split('T')[0]}
        // Özel başlık içeriği kullandığımız için renderHeader kullanıyoruz
        renderHeader={renderCustomHeaderContent}
        theme={{
          selectedDayBackgroundColor: '#007BFF',
          selectedDayTextColor: 'white',
          todayTextColor: '#007BFF',
          arrowColor: '#007BFF',
          // Ay ve yıl başlığı stilini özelleştir
          monthTextColor: '#333',
          textMonthFontWeight: 'bold',
          textMonthFontSize: 18
        }}
        
        // Türkçe Ayarlar
        monthFormat={'MMMM yyyy'}
        hideArrows={false}
        hideExtraDays={true}
        disableMonthChange={false}
        firstDay={1} // Haftanın ilk günü Pazartesi
      />

      {selectedDate ? (
        <View style={styles.dateDetailContainer}>
          <Text style={styles.dateDetailText}>
            Seçilen Tarih: {formatDate(selectedDate)}
          </Text>
        </View>
      ) : null}

      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      )}

      {/* Ay/Yıl Seçici Modal */}
      <Modal
        visible={selectorVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectorVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setSelectorVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectorType === 'month' ? 'Ay Seçiniz' : 'Yıl Seçiniz'}
              </Text>
              <TouchableOpacity onPress={() => setSelectorVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={selectorType === 'month' ? months : years}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.selectorItem,
                    (selectorType === 'month' && currentDate.getMonth() === item.id) || 
                    (selectorType === 'year' && currentDate.getFullYear() === item.id) 
                      ? styles.selectedItem 
                      : null
                  ]}
                  onPress={() => handleSelect(item.id)}
                >
                  <Text style={styles.selectorItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Randevu Onay Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Randevu Onayı</Text>
            <Text style={styles.confirmModalText}>
              {dateToConfirm ? formatDate(dateToConfirm) : ''} tarihine randevu verilecek, onaylıyor musunuz?
            </Text>
            
            <View style={styles.confirmModalButtons}>
            <TouchableOpacity 
                style={[styles.confirmModalButton, styles.confirmModalButtonNo]}
                onPress={() => setConfirmModalVisible(false)}
                >
                <Text style={styles.confirmModalButtonText}>Hayır</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                style={[styles.confirmModalButton, styles.confirmModalButtonNo]}
                onPress={() => setConfirmModalVisible(false)}
                >
                <Text style={styles.confirmModalButtonText}>Hayır</Text>
            </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmModalButton, styles.confirmModalButtonYes]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  createRandevu();
                }}
              >
                <Text style={[styles.confirmModalButtonText, styles.confirmModalButtonTextYes]}>Evet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    backgroundColor: 'white',
    paddingTop: 20
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + (height * 0.03), // StatusBar yüksekliğini ekleyin
    paddingBottom: height * 0.03,
    paddingHorizontal: width * 0.05,
    marginBottom: height * 0.02,
},
headerTitle: {
  color: 'white',
  fontSize: 24,
  fontWeight: 'bold',
  textAlign: 'center',
},
headerContent: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#0088cc',
  },
  firmaAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  firmaInfoContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
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
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  dateDetailContainer: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    alignItems: 'center'
  },
  dateDetailText: {
    fontSize: 16,
    color: '#333'
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  loadingText: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20
  },
  // Özel Başlık Stilleri
  customHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10
  },
  monthYearButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: '#f5f5f5'
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  yearText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  headerDivider: {
    fontSize: 18,
    marginHorizontal: 2
  },
  // Modal Stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '80%',
    maxHeight: '70%',
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  closeButton: {
    fontSize: 22,
    color: '#666'
  },
  selectorItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  selectedItem: {
    backgroundColor: 'rgba(0, 123, 255, 0.1)'
  },
  selectorItemText: {
    fontSize: 16,
    color: '#333'
  },
  // Randevu Onay Modal Stilleri
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  confirmModalText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  confirmModalButtonNo: {
    backgroundColor: '#f2f2f2',
  },
  confirmModalButtonYes: {
    backgroundColor: '#0088cc',
  },
  confirmModalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  confirmModalButtonTextYes: {
    color: 'white',
  },
  dataSourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  dataSourceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  }
});