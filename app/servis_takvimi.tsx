//app/servis_takvimi.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  TouchableOpacity, 
  Modal, 
  FlatList, 
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  RefreshControl,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import axios, { CancelToken } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi'; // axios yerine bunu kullan

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

type GorevBilgisi = {
  arac_ids: string[];
  grup_adi: string;
};

type ServisGunleriResponse = {
  randevuGunleri: string[];
  formGunleri: string[];
  gorevBilgileri: { [date: string]: GorevBilgisi }; // 🆕 YENİ
  debug: {
    company_id: number;
    month: number;
    year: number;
  };
};

type MarkedDates = {
  [date: string]: {
    customStyles?: {
      container?: {
        backgroundColor?: string;
      };
      text?: {
        color?: string;
      };
    };
  }
};

type SelectorType = 'month' | 'year' | null;

export default function ServisTakvimi() {
  const router = useRouter();
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Ay/Yıl seçici için state'ler
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorType, setSelectorType] = useState<SelectorType>(null);

  // State'lere ekle
  const [gorevBilgileri, setGorevBilgileri] = useState<{ [date: string]: GorevBilgisi }>({});

  // API çağrılarını iptal etmek için ref
  const cancelTokenSourceRef = useRef<any>(null);
  
  // Debounce için zamanlayıcı
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // fetchServisGunleri fonksiyonunu düzeltin
  const fetchServisGunleri = useCallback(async () => {
    // Önceki isteği iptal et
    if (cancelTokenSourceRef.current) {
      cancelTokenSourceRef.current.cancel('Yeni istek geldi');
    }

    cancelTokenSourceRef.current = axios.CancelToken.source();

    try {
      setLoading(true);
      
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
  
      console.log('📅 Servis günleri çekiliyor:', { month, year });
  
      const response = await api.get('/api/servis-gunleri', {
        params: { month, year }
      });
  
      console.log('📅 API Response:', response.data);
  
      const today = new Date();
      const markedDateData: MarkedDates = {};
      
      // 🆕 YENİ: Görev bilgilerini kaydet
      setGorevBilgileri(response.data.gorevBilgileri || {});
      
      // Yeşil - Form günleri
      response.data.formGunleri?.forEach((tarih: string) => {
        markedDateData[tarih] = {
          customStyles: {
            container: {
              backgroundColor: 'rgba(0, 255, 0, 0.2)',
              borderRadius: 8
            },
            text: {
              color: '#000'
            }
          }
        };
      });
      
      // Sarı - Randevu günleri (bugünden sonrakiler)
      response.data.randevuGunleri?.forEach((tarih: string) => {
        const randevuTarihi = new Date(tarih);
        const today = new Date();
        
        // Sadece tarih kısmını karşılaştır (saat bilgisini görmezden gel)
        randevuTarihi.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        if (randevuTarihi >= today) {
          markedDateData[tarih] = {
            customStyles: {
              container: {
                backgroundColor: 'rgba(255, 255, 0, 0.3)',
                borderRadius: 8 
              },
              text: {
                color: '#000'
              }
            }
          };
        }
      });
  
      setMarkedDates(markedDateData);
      console.log('✅ Marked dates güncellendi:', Object.keys(markedDateData).length, 'tarih');
  
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('İstek iptal edildi');
      } else {
        console.error('Servis günleri çekme hatası:', error);
        Alert.alert('Hata', 'Servis günleri yüklenemedi.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentDate]); // ✅ currentDate dependency'si önemli

  // Pull-to-refresh için
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Hafif titreşim uygula
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      await fetchServisGunleri();
      // Yükleme başarılı olursa başarı titreşimi ver
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Hata durumunda hata titreşimi ver
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchServisGunleri]);

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

  // Ana useEffect
  useEffect(() => {
    fetchServisGunleri();

    // Temizleme fonksiyonu
    return () => {
      // Zamanlayıcıyı temizle
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }
      
      // Bekleyen istekleri iptal et
      if (cancelTokenSourceRef.current) {
        cancelTokenSourceRef.current.cancel('Bileşen unmount edildi');
      }
    };
  }, [fetchServisGunleri]);


// handleDayPress fonksiyonunu düzelt
const handleDayPress = (day: { dateString: string }) => {
  setSelectedDate(day.dateString);
  
  // Bu tarihte bir işlem varsa detayları göster
  if (markedDates[day.dateString]) {
    const customStyles = markedDates[day.dateString].customStyles;
    const isRandevuGunu = customStyles?.container?.backgroundColor === 'rgba(255, 255, 0, 0.3)';
    const isFormGunu = customStyles?.container?.backgroundColor === 'rgba(0, 255, 0, 0.2)';
    
    // Görev bilgisi kontrolü
    const gorevBilgisi = gorevBilgileri[day.dateString];
    const bugün = new Date().toISOString().split('T')[0];
    const secilenTarih = day.dateString;
    
    if (isRandevuGunu) {
      // Eğer bugün randevu günüyse ve görev bilgisi varsa ARAÇ NEREDE seçeneği ekle
      if (bugün === secilenTarih && gorevBilgisi && gorevBilgisi.arac_ids?.length > 0) {
        Alert.alert(
          'Tarih Detayları', 
          `${day.dateString} tarihinde randevu kaydınız bulunmaktadır.\n\nGrup: ${gorevBilgisi.grup_adi}\nAraç Sayısı: ${gorevBilgisi.arac_ids?.length || 0}`,
          [
            { 
              text: 'ARAÇ NEREDE?', 
              style: 'default',
              onPress: () => handleAracNerede(gorevBilgisi.arac_ids, gorevBilgisi.grup_adi)
            },
            { text: 'Tamam', style: 'cancel' }
          ]
        );
      } else {
        // Normal randevu popup'ı
        Alert.alert(
          'Tarih Detayları', 
          `${day.dateString} tarihinde randevu kaydınız bulunmaktadır.`,
          [{ text: 'Tamam', style: 'default' }]
        );
      }
    } else if (isFormGunu) {
      Alert.alert(
        'Tarih Detayları', 
        `${day.dateString} tarihinde servis kaydınız bulunmaktadır.`,
        [{ text: 'Tamam', style: 'default' }]
      );
    } else {
      Alert.alert(
        'Tarih Detayları',
        `${day.dateString} tarihinde kayıt bulunmaktadır.`,
        [{ text: 'Tamam', style: 'default' }]
      );
    }
  }
};

const handleAracNerede = async (aracIds: string[], grupAdi: string) => {
  try {
    console.log('🗺️ Araç takibi başlatılıyor:', { aracIds, grupAdi });
    
    if (!aracIds || aracIds.length === 0) {
      Alert.alert('Uyarı', 'Bu görev için araç ataması yapılmamış.');
      return;
    }
    
    if (aracIds.length === 1) {
      // Tek araç varsa direkt haritaya git
      router.push(`/arac-takip/${aracIds[0]}?grupAdi=${encodeURIComponent(grupAdi)}`);
    } else {
      // Birden fazla araç varsa seçim ekranına git
      router.push(`/arac-secim?aracIds=${aracIds.join(',')}&grupAdi=${encodeURIComponent(grupAdi)}`);
    }
  } catch (error) {
    console.error('❌ Araç nerede hatası:', error);
    Alert.alert('Hata', 'Araç bilgileri alınamadı.');
  }
};

  // Özel başlık bileşeni - Ay ve Yıl seçilebilir
  const renderCustomHeader = () => {
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
            colors={['#0088cc']} // Android renk
            tintColor="#0088cc" // iOS renk
            progressBackgroundColor="#ffffff" // Android için arka plan rengi
          />
        }
      >
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
          markedDates={markedDates}
          markingType={'custom'}
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
              Seçilen Tarih: {selectedDate}
            </Text>
          </View>
        ) : null}

        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        )}
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + (height * 0.03),
    paddingBottom: height * 0.03,
    paddingHorizontal: width * 0.05,
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
    backgroundColor: 'white',
    paddingTop: 20
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
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20
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
  }
});