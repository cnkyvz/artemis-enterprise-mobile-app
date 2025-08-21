// app/teknisyen-gelen-kutusu.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
  RefreshControl,
  TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';
import NetInfo from '@react-native-community/netinfo';
import offlineStorage from '../artemis-api/utils/offlineStorage';
import OfflineIndicator from '../components/OfflineIndicator';

const { width, height } = Dimensions.get('window');

// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

type TalepFormu = {
  id: number;
  seri_no: string;
  tarih: string;
  aciklamalar: string;
  company_name: string;
  email: string;
  phone_number: string;
  address: string;
  durum: string; // 'bekliyor' veya 'cevaplandi'
  cevap?: string;
  cevap_tarihi?: string;
};

type GunlukGorevBildirim = {
  id: number;
  personel_id: string;
  baslik: string;
  icerik: string;
  tip: string;
  gorev_id: number;
  tarih: string;
  okundu: boolean;
  grup_adi?: string;
  calisan_ids?: string[];
  firma_ids?: number[];
  gorev_tarihi?: string;
  // ✅ YENİ: Backend'den gelen isim bilgileri
  calisan_bilgileri?: Array<{
    personel_id: string;
    first_name: string;
    last_name: string;
  }>;
  firma_bilgileri?: Array<{
    company_id: number;
    company_name: string;
    address?: string;
  }>;
  arac_ids?: string[];
  // 🆕 YENİ: Araç bilgileri
  arac_bilgileri?: Array<{
    id: string;
    plaka: string;
    model: string;
  }>;
};

export default function TeknisyenGelenKutusu() {
  const [activeTab, setActiveTab] = useState<'bekleyen' | 'cevaplanan' | 'bildirimler'>('bekleyen');
  const [talepFormlari, setTalepFormlari] = useState<TalepFormu[]>([]);
  const [bildirimler, setBildirimler] = useState<GunlukGorevBildirim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filteredBekleyenTalepler, setFilteredBekleyenTalepler] = useState<TalepFormu[]>([]);
  const [filteredCevaplanmisTalepler, setFilteredCevaplanmisTalepler] = useState<TalepFormu[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [dataSource, setDataSource] = useState<'cache' | 'api' | 'none'>('none');
  const router = useRouter();

  useEffect(() => {
    console.log('🚀 TeknisyenGelenKutusu component mount edildi');
    initializePage(); // ✅ Tek fonksiyon çağır
  }, []);

// ✅ EKLEME: activeTab değiştiğinde bildirimler tekrar yüklensin
useEffect(() => {
  if (activeTab === 'bildirimler') {
    console.log('📋 Bildirimler tab\'ı açıldı, cache\'den yükleniyor...');
    
    // ✅ Offline-safe bildirim yükleme
    const loadBildirimlerSafe = async () => {
      const networkState = await NetInfo.fetch();
      if (networkState.isConnected) {
        fetchBildirimler(); // Online'da API çağır
      } else {
        // Offline'da sadece cache'den yükle
        try {
          const userInfo = await AsyncStorage.getItem('userData');
          if (userInfo) {
            const user = JSON.parse(userInfo);
            const cachedBildirimler = await offlineStorage.getCachedBildirimler(user.personel_id);
            setBildirimler(cachedBildirimler || []);
          }
        } catch (error) {
          console.error('Cache bildirim yükleme hatası:', error);
        }
      }
    };
    
    loadBildirimlerSafe();
  }
}, [activeTab]);

  // ✅ 1. YENİ FONKSİYON - Sayfa başlatma
  const initializePage = async () => {
    try {
      setLoading(true);
      
      const networkState = await NetInfo.fetch();
      const isCurrentlyOffline = !networkState.isConnected;
      setIsOffline(isCurrentlyOffline);

      if (isCurrentlyOffline) {
        console.log('📴 Offline mode - Cache\'den veriler yükleniyor...');
        await loadFromCache();
      } else {
        await loadFromCache(); // Önce cache göster
        await fetchFromAPI(true); // Sonra güncelle
      }
    } catch (error) {
      console.error('❌ Sayfa başlatma hatası:', error);
      setError('Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 2. YENİ FONKSİYON - Cache'den yükle
  const loadFromCache = async () => {
    try {
      const cachedTalepler = await offlineStorage.getCachedTeknikTalepler();
      
      if (cachedTalepler.length > 0) {
        setTalepFormlari(cachedTalepler);
        filterTalepler(cachedTalepler, searchText);
        setDataSource('cache');
      }

      // Bildirimler için
      const userInfo = await AsyncStorage.getItem('userData');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        const cachedBildirimler = await offlineStorage.getCachedBildirimler(user.personel_id);
        setBildirimler(cachedBildirimler);
      }
    } catch (error) {
      console.error('❌ Cache\'den yükleme hatası:', error);
    }
  };

  // ✅ 3. YENİ FONKSİYON - API'den çek
  const fetchFromAPI = async (isBackgroundUpdate = false) => {
    try {
      if (!isBackgroundUpdate) setLoading(true);

      const response = await api.get('/api/teknisyen-talepler');
      await offlineStorage.cacheTeknikTalepler(response.data);
      
      setTalepFormlari(response.data);
      filterTalepler(response.data, searchText);
      setDataSource('api');

      // Bildirimler
      const userInfo = await AsyncStorage.getItem('userData');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        const bildirimResponse = await api.get(`/api/calisan-bildirimleri/${user.personel_id}`);
        await offlineStorage.cacheBildirimler(user.personel_id, bildirimResponse.data);
        setBildirimler(bildirimResponse.data);
      }
    } catch (error) {
      console.error('❌ API\'den çekme hatası:', error);
      if (!isBackgroundUpdate) {
        await loadFromCache();
      }
    } finally {
      if (!isBackgroundUpdate) setLoading(false);
    }
  };

  const fetchTalepFormlari = async () => {
    try {
      // ✅ Bu kısım doğru - header yok, interceptor ekleyecek
      const response = await api.get('/api/teknisyen-talepler');
      setTalepFormlari(response.data);
      filterTalepler(response.data, searchText);
    } catch (err) {
      console.error('Talep formları yüklenirken hata:', err);
      setError('Talep formları yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchBildirimler = async () => {
    try {
      console.log('📱 fetchBildirimler başladı...');
      
      // ✅ Offline kontrolü ekle
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        console.log('📴 Offline - Bildirimler cache\'den yükleniyor...');
        
        const userInfo = await AsyncStorage.getItem('userData');
        if (userInfo) {
          const user = JSON.parse(userInfo);
          const cachedBildirimler = await offlineStorage.getCachedBildirimler(user.personel_id);
          setBildirimler(cachedBildirimler || []);
          console.log('✅ Offline bildirimler cache\'den yüklendi:', cachedBildirimler?.length || 0);
        }
        return;
      }
      
      // ✅ Online - API'den çek
      const userInfo = await AsyncStorage.getItem('userData');
      console.log('👤 UserData Storage:', userInfo);
      
      if (userInfo) {
        const user = JSON.parse(userInfo);
        const personelId = user.personel_id;
        
        console.log(`📡 API çağrısı: /api/calisan-bildirimleri/${personelId}`);
        
        const response = await api.get(`/api/calisan-bildirimleri/${personelId}`);
        
        console.log('✅ API Yanıtı:', {
          status: response.status,
          dataLength: response.data?.length,
          firstItem: response.data?.[0]
        });
        
        // Cache'e kaydet
        await offlineStorage.cacheBildirimler(personelId, response.data || []);
        
        setBildirimler(response.data || []);
        console.log('✅ Bildirimler state\'e set edildi:', response.data?.length || 0);
      }
    } catch (err) {
      console.error('❌ Bildirimler yüklenirken hata:', err);
      
      // ✅ Hata durumunda cache'den yükle
      try {
        const userInfo = await AsyncStorage.getItem('userData');
        if (userInfo) {
          const user = JSON.parse(userInfo);
          const cachedBildirimler = await offlineStorage.getCachedBildirimler(user.personel_id);
          setBildirimler(cachedBildirimler || []);
          console.log('✅ Hata sonrası cache\'den yüklendi');
        }
      } catch (cacheError) {
        console.error('❌ Cache\'den bildirim yükleme hatası:', cacheError);
      }
    }
  };

  // Talepleri filtrele
  const filterTalepler = (talepler: TalepFormu[], searchQuery: string) => {
    if (!searchQuery.trim()) {
      // Tüm bekleyen ve cevaplanmış talepleri ayır
      const bekleyen = talepler
        .filter(talep => talep.durum === 'bekliyor')
        .sort((a, b) => {
          const dateA = new Date(a.tarih);
          const dateB = new Date(b.tarih);
          
          if (dateB.getTime() === dateA.getTime()) {
            return b.id - a.id;
          }
          
          return dateB.getTime() - dateA.getTime();
        });
        
      const cevaplanmis = talepler
        .filter(talep => talep.durum === 'cevaplandi')
        .sort((a, b) => {
          if (a.cevap_tarihi && b.cevap_tarihi) {
            const dateA = new Date(a.cevap_tarihi);
            const dateB = new Date(b.cevap_tarihi);
            return dateB.getTime() - dateA.getTime();
          }
          
          if (a.cevap_tarihi && !b.cevap_tarihi) return -1;
          if (!a.cevap_tarihi && b.cevap_tarihi) return 1;
          
          const dateA = new Date(a.tarih);
          const dateB = new Date(b.tarih);
          
          if (dateB.getTime() === dateA.getTime()) {
            return b.id - a.id;
          }
          
          return dateB.getTime() - dateA.getTime();
        });
        
      setFilteredBekleyenTalepler(bekleyen);
      setFilteredCevaplanmisTalepler(cevaplanmis);
    } else {
      // Arama sorgusuna göre filtrele
      const lowercaseQuery = searchQuery.toLowerCase();
      
      const filteredBekleyen = talepler
        .filter(talep => 
          talep.durum === 'bekliyor' && 
          (talep.company_name.toLowerCase().includes(lowercaseQuery) ||
           talep.seri_no.toLowerCase().includes(lowercaseQuery) ||
           talep.aciklamalar.toLowerCase().includes(lowercaseQuery) ||
           talep.email.toLowerCase().includes(lowercaseQuery) ||
           talep.address.toLowerCase().includes(lowercaseQuery) ||
           talep.phone_number.includes(searchQuery))
        )
        .sort((a, b) => {
          const dateA = new Date(a.tarih);
          const dateB = new Date(b.tarih);
          
          if (dateB.getTime() === dateA.getTime()) {
            return b.id - a.id;
          }
          
          return dateB.getTime() - dateA.getTime();
        });
        
      const filteredCevaplanmis = talepler
        .filter(talep => 
          talep.durum === 'cevaplandi' && 
          (talep.company_name.toLowerCase().includes(lowercaseQuery) ||
           talep.seri_no.toLowerCase().includes(lowercaseQuery) ||
           talep.aciklamalar.toLowerCase().includes(lowercaseQuery) ||
           talep.email.toLowerCase().includes(lowercaseQuery) ||
           talep.address.toLowerCase().includes(lowercaseQuery) ||
           talep.phone_number.includes(searchQuery))
        )
        .sort((a, b) => {
          if (a.cevap_tarihi && b.cevap_tarihi) {
            const dateA = new Date(a.cevap_tarihi);
            const dateB = new Date(b.cevap_tarihi);
            return dateB.getTime() - dateA.getTime();
          }
          
          if (a.cevap_tarihi && !b.cevap_tarihi) return -1;
          if (!a.cevap_tarihi && b.cevap_tarihi) return 1;
          
          const dateA = new Date(a.tarih);
          const dateB = new Date(b.tarih);
          
          if (dateB.getTime() === dateA.getTime()) {
            return b.id - a.id;
          }
          
          return dateB.getTime() - dateA.getTime();
        });
        
      setFilteredBekleyenTalepler(filteredBekleyen);
      setFilteredCevaplanmisTalepler(filteredCevaplanmis);
    }
  };

  // Search değiştiğinde filtreleme yapma
  useEffect(() => {
    filterTalepler(talepFormlari, searchText);
  }, [searchText, talepFormlari]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    
    if (activeTab === 'bildirimler') {
      await fetchBildirimler();
    } else {
      await fetchTalepFormlari();
    }
    
    setRefreshing(false);
  };

  const handleTalepDetails = (talepId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/teknisyen-talep-detay/${talepId}`);
  };

  const handleTabChange = (tab: 'bekleyen' | 'cevaplanan' | 'bildirimler') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const clearSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchText('');
  };

  const formatTalepDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${formattedDate} ${hours}:${minutes}:${seconds}`;
  };

  // Bekleyen talepler sayısını hesapla
  const bekleyenCount = filteredBekleyenTalepler.length;

  const handleBildirimDetails = async (bildirim: GunlukGorevBildirim) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Bildirimi okundu olarak işaretle
    if (!bildirim.okundu) {
      try {
        await api.put(`/api/calisan-bildirim/${bildirim.id}/okundu`);
        setBildirimler(prev => 
          prev.map(b => b.id === bildirim.id ? { ...b, okundu: true } : b)
        );
      } catch (error) {
        console.error('Bildirim güncelleme hatası:', error);
      }
    }
    
    // GÜNLÜK GÖREV için özel detay ekranı
    if (bildirim.tip === 'gunluk_gorev') {
      let detayMesaj = `📋 ${bildirim.grup_adi || 'Grup'}\n\n`;
      detayMesaj += `📅 Görev Tarihi: ${new Date(bildirim.gorev_tarihi || bildirim.tarih).toLocaleDateString('tr-TR')}\n\n`;
      
      // Çalışan bilgileri
      if (bildirim.calisan_bilgileri && bildirim.calisan_bilgileri.length > 0) {
        detayMesaj += `👥 Gruptaki Çalışanlar (${bildirim.calisan_bilgileri.length} kişi):\n`;
        
        try {
          const userInfo = await AsyncStorage.getItem('userData');
          let myPersonelId = null;
          if (userInfo) {
            const user = JSON.parse(userInfo);
            myPersonelId = user.personel_id;
          }
          
          bildirim.calisan_bilgileri.forEach((calisan, index) => {
            const isMe = calisan.personel_id === myPersonelId;
            const prefix = isMe ? '👤' : '👷';
            const suffix = isMe ? ' (Siz)' : '';
            
            detayMesaj += `${prefix} ${calisan.first_name} ${calisan.last_name}${suffix}\n`;
          });
          
        } catch (userErr) {
          console.error('User bilgisi alınamadı:', userErr);
          bildirim.calisan_bilgileri.forEach((calisan, index) => {
            detayMesaj += `👷 ${calisan.first_name} ${calisan.last_name}\n`;
          });
        }
      } else if (bildirim.calisan_ids && bildirim.calisan_ids.length > 0) {
        detayMesaj += `👥 Gruptaki Çalışanlar (${bildirim.calisan_ids.length} kişi):\n`;
        bildirim.calisan_ids.forEach((calisanId, index) => {
          detayMesaj += `👷 Personel ID: ${calisanId}\n`;
        });
      }
      
      // Firma bilgileri
      if (bildirim.firma_bilgileri && bildirim.firma_bilgileri.length > 0) {
        detayMesaj += `\n🏢 Ziyaret Edilecek Firmalar (${bildirim.firma_bilgileri.length} firma):\n`;
        
        bildirim.firma_bilgileri.forEach((firma, index) => {
          detayMesaj += `🏢 ${firma.company_name}\n`;
          if (firma.address) {
            detayMesaj += `   📍 ${firma.address}\n`;
          }
        });
      } else if (bildirim.firma_ids && bildirim.firma_ids.length > 0) {
        detayMesaj += `\n🏢 Ziyaret Edilecek Firmalar (${bildirim.firma_ids.length} firma):\n`;
        bildirim.firma_ids.forEach((firmaId, index) => {
          detayMesaj += `🏢 Firma ID: ${firmaId}\n`;
        });
      }
      
      // 🆕 Araç bilgileri - YENİ EKLENEN KISIM
      if (bildirim.arac_bilgileri && bildirim.arac_bilgileri.length > 0) {
        detayMesaj += `\n🚗 Görevdeki Araçlar (${bildirim.arac_bilgileri.length} araç):\n`;
        
        bildirim.arac_bilgileri.forEach((arac, index) => {
          detayMesaj += `🚗 ${arac.plaka} - ${arac.model}\n`;
        });
      } else if (bildirim.arac_ids && bildirim.arac_ids.length > 0) {
        // Fallback: Sadece ID'ler varsa
        detayMesaj += `\n🚗 Görevdeki Araçlar (${bildirim.arac_ids.length} araç):\n`;
        bildirim.arac_ids.forEach((aracId, index) => {
          detayMesaj += `🚗 Araç ID: ${aracId}\n`;
        });
      }
      
      // Alert ile detayları göster
      Alert.alert(
        `📋 ${bildirim.baslik}`,
        detayMesaj,
        [
          { 
            text: 'Görev Detayları', 
            onPress: () => {
              console.log('🔍 Görev detayları:', {
                gorev_id: bildirim.gorev_id,
                grup_adi: bildirim.grup_adi,
                calisan_sayisi: bildirim.calisan_bilgileri?.length || bildirim.calisan_ids?.length,
                firma_sayisi: bildirim.firma_bilgileri?.length || bildirim.firma_ids?.length,
                arac_sayisi: bildirim.arac_bilgileri?.length || bildirim.arac_ids?.length, // 🆕
                tarih: bildirim.gorev_tarihi
              });
            }
          },
          { 
            text: 'Tamam', 
            style: 'default' 
          }
        ]
      );
      
    } else {
      // Diğer bildirim tipleri için basit gösterim
      let detayMesaj = bildirim.icerik;
      
      if (bildirim.grup_adi) {
        detayMesaj += `\n\nGrup: ${bildirim.grup_adi}`;
      }
      
      Alert.alert(
        bildirim.baslik,
        detayMesaj,
        [
          { 
            text: 'Detayları Gör', 
            onPress: () => {
              console.log('Görev detayları:', bildirim);
            }
          },
          { 
            text: 'Tamam', 
            style: 'default' 
          }
        ]
      );
    }
  };

  // renderTalepItem fonksiyonu 
  const renderTalepItem = ({ item }: { item: TalepFormu }) => {
    if (item.durum === 'cevaplandi') {
      console.log(`Render - Talep ID: ${item.id}, Cevaplama Tarihi: ${item.cevap_tarihi || 'Yok'}`);
    }
    return (
    <TouchableOpacity
      style={styles.talepCard}
      onPress={() => handleTalepDetails(item.id)}
      activeOpacity={0.7} 
    >
      <View style={[
        /*styles.statusIndicator, */ 
        { backgroundColor: item.durum === 'cevaplandi' ? '#27ae60' : '#f39c12' }
      ]} />
      
      <View style={styles.talepHeader}>
        <View style={styles.talepInfoContainer}>
          <Text style={styles.companyName}>{item.company_name}</Text>
          <Text style={styles.talepNo}>{item.seri_no}</Text>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={14} color="#7f8c8d" style={{marginRight: 4}} />
            <Text style={styles.talepDate}>{formatTalepDate(item.tarih)}</Text>
          </View>
          
          {/* Cevaplama tarihini göster */}
          {item.durum === 'cevaplandi' && item.cevap_tarihi && (
            <View style={[styles.dateContainer, {marginTop: 4}]}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#27ae60" style={{marginRight: 4}} />
              <Text style={[styles.talepDate, {color: '#27ae60'}]}>
                Cevaplama: {formatDate(item.cevap_tarihi)}
              </Text>
            </View>
          )}
        </View>
        <View style={[
          styles.statusBadge, 
          { backgroundColor: item.durum === 'cevaplandi' ? '#27ae60' : '#f39c12' }
        ]}>
          <Text style={styles.statusText}>
            {item.durum === 'cevaplandi' ? 'Cevaplandı' : 'Bekliyor'}
          </Text>
        </View>
      </View>
      
      <View style={styles.talepContent}>
        <Text style={styles.talepDescription} numberOfLines={2}>
          {item.aciklamalar}
        </Text>
      </View>
      
      <View style={styles.cardFooter}>
        <Ionicons name="chevron-forward" size={20} color="#0088cc" />
      </View>
    </TouchableOpacity>
  );
};


  // Bildirim kartı render fonksiyonu
  const renderBildirimItem = ({ item }: { item: GunlukGorevBildirim }) => {
    // Görev tipine göre farklı görünüm için kontrol ediyoruz
    if (item.tip === 'gunluk_gorev') {
      return (
        <TouchableOpacity
          style={[
            styles.talepCard,
            { 
              borderLeftColor: '#4CAF50',
              backgroundColor: item.okundu ? 'white' : '#f1f8e9',
              opacity: item.okundu ? 0.8 : 1
            }
          ]}
          onPress={() => handleBildirimDetails(item)}
          activeOpacity={0.7} 
        >
          <View style={styles.talepHeader}>
            <View style={styles.talepInfoContainer}>  
              <Text style={styles.companyName}>
                📋 {item.baslik}
              </Text>
              <Text style={styles.talepNo}>
                Grup: {item.grup_adi || 'Grup ' + item.gorev_id}
              </Text>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={14} color="#7f8c8d" style={{marginRight: 4}} />
                <Text style={styles.talepDate}>
                  {formatTalepDate(item.tarih)}
                </Text>
              </View>
              
              {/* Görev tarihini ayrıca göster */}
              {item.gorev_tarihi && (
                <View style={[styles.dateContainer, {marginTop: 4}]}>
                  <Ionicons name="briefcase-outline" size={14} color="#4CAF50" style={{marginRight: 4}} />
                  <Text style={[styles.talepDate, {color: '#4CAF50', fontWeight: '600'}]}>
                    Görev: {formatTalepDate(item.gorev_tarihi)}
                  </Text>
                </View>
              )}
              
              {/* Grup istatistikleri */}
              <View style={{flexDirection: 'row', marginTop: 8, gap: 12}}>
                {item.calisan_ids && item.calisan_ids.length > 0 && (
                  <View style={styles.statChip}>
                    <Ionicons name="people-outline" size={12} color="#4CAF50" />
                    <Text style={[styles.statText, {color: '#4CAF50'}]}>
                      {item.calisan_ids.length} çalışan
                    </Text>
                  </View>
                )}
                
                {item.firma_ids && item.firma_ids.length > 0 && (
                  <View style={styles.statChip}>
                    <Ionicons name="business-outline" size={12} color="#FF9800" />
                    <Text style={[styles.statText, {color: '#FF9800'}]}>
                      {item.firma_ids.length} firma
                    </Text>
                  </View>
                )}
  
                {/* 🆕 Araç chip'i - zaten mevcut, sadece arac_bilgileri'ni de kontrol et */}
                {((item.arac_ids && item.arac_ids.length > 0) || (item.arac_bilgileri && item.arac_bilgileri.length > 0)) && (
                  <View style={styles.statChip}>
                    <Ionicons name="car-outline" size={12} color="#9C27B0" />
                    <Text style={[styles.statText, {color: '#9C27B0'}]}>
                      {item.arac_bilgileri?.length || item.arac_ids?.length || 0} araç
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={[
              styles.statusBadge, 
              { backgroundColor: item.okundu ? '#95a5a6' : '#4CAF50' }
            ]}>
              <Text style={styles.statusText}>
                {item.okundu ? 'Okundu' : 'YENİ'}
              </Text>
            </View>
          </View>
          
          <View style={styles.talepContent}>
            <Text style={styles.talepDescription} numberOfLines={2}>
              {item.icerik}
            </Text>
          </View>
          
          <View style={styles.cardFooter}>
            <Text style={[styles.talepDate, {fontSize: 12, color: '#4CAF50'}]}>
              Detaylar için dokunun
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
          </View>
        </TouchableOpacity>
      );
    } else {
      // Diğer bildirim tipleri için mevcut görünüm (değişiklik yok)
      return (
        <TouchableOpacity
          style={[
            styles.talepCard,
            { 
              borderLeftColor: '#3498db',
              backgroundColor: item.okundu ? 'white' : '#f8f9fa',
              opacity: item.okundu ? 0.8 : 1
            }
          ]}
          onPress={() => handleBildirimDetails(item)}
          activeOpacity={0.7} 
        >
          <View style={styles.talepHeader}>
            <View style={styles.talepInfoContainer}>  
              <Text style={styles.companyName}>{item.baslik}</Text>
              <Text style={styles.talepNo}>Görev ID: {item.gorev_id}</Text>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={14} color="#7f8c8d" style={{marginRight: 4}} />
                <Text style={styles.talepDate}>{formatTalepDate(item.tarih)}</Text>
              </View>
            </View>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: item.okundu ? '#95a5a6' : '#3498db' }
            ]}>
              <Text style={styles.statusText}>
                {item.okundu ? 'Okundu' : 'Yeni'}
              </Text>
            </View>
          </View>
          
          <View style={styles.talepContent}>
            <Text style={styles.talepDescription} numberOfLines={2}>
              {item.icerik}
            </Text>
          </View>
          
          <View style={styles.cardFooter}>
            <Ionicons name="chevron-forward" size={20} color="#3498db" />
          </View>
        </TouchableOpacity>
      );
    }
  };
  

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
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Gelen Talepler</Text>
            
            <View style={{width: 40}} />
          </View>
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0088cc" />
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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Gelen Kutusu</Text>
          
          <View style={{width: 40}} />
        </View>
      </LinearGradient>
  
      {/* Arama Kutusu */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#0088cc" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Firma veya talep ara..."
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={20} color="#0088cc" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
  
      {/* Tab Navigasyonu */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'bekleyen' && styles.activeTabButton
          ]}
          onPress={() => handleTabChange('bekleyen')}
        >
          <Ionicons 
            name="time-outline" 
            size={18} 
            color={activeTab === 'bekleyen' ? '#f39c12' : '#7f8c8d'} 
            style={styles.tabIcon}
          />
          <Text 
            style={[
              styles.tabText, 
              activeTab === 'bekleyen' && styles.activeTabText,
              activeTab === 'bekleyen' && {color: '#f39c12'}
            ]}
          >
            Bekleyen
          </Text>
          {bekleyenCount > 0 && (
            <View style={[styles.notificationBadge, {backgroundColor: '#f39c12'}]}>
              <Text style={styles.notificationBadgeText}>{bekleyenCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'cevaplanan' && styles.activeTabButton
          ]}
          onPress={() => handleTabChange('cevaplanan')}
        >
          <Ionicons 
            name="checkmark-circle-outline" 
            size={18} 
            color={activeTab === 'cevaplanan' ? '#27ae60' : '#7f8c8d'}
            style={styles.tabIcon}
          />
          <Text 
            style={[
              styles.tabText, 
              activeTab === 'cevaplanan' && styles.activeTabText,
              activeTab === 'cevaplanan' && {color: '#27ae60'}
            ]}
          >
            Cevaplanan
          </Text>
        </TouchableOpacity>
  
        {/* ✅ YENİ TAB */}
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'bildirimler' && styles.activeTabButton
          ]}
          onPress={() => handleTabChange('bildirimler')}
        >
          <Ionicons 
            name="notifications-outline" 
            size={18} 
            color={activeTab === 'bildirimler' ? '#3498db' : '#7f8c8d'}
            style={styles.tabIcon}
          />
          <Text 
            style={[
              styles.tabText, 
              activeTab === 'bildirimler' && styles.activeTabText,
              activeTab === 'bildirimler' && {color: '#3498db'}
            ]}
          >
            Bildirimler
          </Text>
          {bildirimler.filter(b => !b.okundu).length > 0 && (
            <View style={[styles.notificationBadge, {backgroundColor: '#3498db'}]}>
              <Text style={styles.notificationBadgeText}>
                {bildirimler.filter(b => !b.okundu).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
  
      {error && talepFormlari.length === 0 ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={50} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchTalepFormlari}
          >
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'bekleyen' ? (
        filteredBekleyenTalepler.length === 0 ? (
          <View style={styles.emptyContainer}>
            {searchText ? (
              <>
                <Ionicons name="search" size={60} color="#95a5a6" />
                <Text style={styles.emptyText}>Aramanızla eşleşen bekleyen talep bulunamadı</Text>
              </>
            ) : (
              <>
                <Ionicons name="time-outline" size={60} color="#95a5a6" />
                <Text style={styles.emptyText}>Bekleyen talep bulunmamaktadır</Text>
              </>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredBekleyenTalepler}
            renderItem={renderTalepItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#0088cc']}
                tintColor="#0088cc"
              />
            }
          />
        )
      ) : activeTab === 'cevaplanan' ? (
        filteredCevaplanmisTalepler.length === 0 ? (
          <View style={styles.emptyContainer}>
            {searchText ? (
              <>
                <Ionicons name="search" size={60} color="#95a5a6" />
                <Text style={styles.emptyText}>Aramanızla eşleşen cevaplanan talep bulunamadı</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={60} color="#95a5a6" />
                <Text style={styles.emptyText}>Cevaplanan talep bulunmamaktadır</Text>
              </>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredCevaplanmisTalepler}
            renderItem={renderTalepItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#0088cc']}
                tintColor="#0088cc"
              />
            }
          />
        )
      ) : activeTab === 'bildirimler' ? (
        bildirimler.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={60} color="#95a5a6" />
            <Text style={styles.emptyText}>Henüz bildirim bulunmamaktadır</Text>
          </View>
        ) : (
          <FlatList
            data={bildirimler}
            renderItem={renderBildirimItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  onRefresh();
                  fetchBildirimler();
                }}
                colors={['#0088cc']}
                tintColor="#0088cc"
              />
            }
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + 25,
    paddingBottom: height * 0.02,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  backButton: {
    padding: 10,
  },
  searchContainer: {
    paddingHorizontal: 15,
    marginBottom: 5,
    marginTop: 10,
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
    elevation: 2,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 15,
    marginTop: 5,
    marginBottom: 5,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    position: 'relative',
  },
  activeTabButton: {
    backgroundColor: '#e3f2fd',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#7f8c8d',
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 10,
    backgroundColor: '#e74c3c',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#34495e',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 15,
  },
  listContainer: {
    marginTop: 10,
    padding: 15,
    paddingTop: 5,
  },
  talepCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  talepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  talepInfoContainer: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  talepNo: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  talepDate: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  statusBadge: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  talepContent: {
    marginTop: 10,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#ecf0f1',
    paddingLeft: 10,
  },
  talepDescription: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});