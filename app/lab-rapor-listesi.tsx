// app/lab-rapor-listesi.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';
import NetInfo from '@react-native-community/netinfo';
import offlineStorage from '../artemis-api/utils/offlineStorage';
import OfflineIndicator from '../components/OfflineIndicator';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface RaporItem {
  id: number;
  rapor_no: string;
  rapor_adi: string;
  qr_kod: string;
  firma_adi: string;
  company_name?: string;
  durum: string;
  hazirlayan_id: string;
  hazirlanma_tarihi: string;
  onay_tarihi?: string;
  red_nedeni?: string;
  toplam_test_sayisi: number;
  uygun_test_sayisi: number;
  uygun_olmayan_test_sayisi: number;
}

export default function LabRaporListesi() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [raporlar, setRaporlar] = useState<RaporItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'onay_bekliyor' | 'onaylandi' | 'reddedildi' | 'revizyon_gerekli'>('all');

  // Sayfa her açıldığında listeyi yenile
  useFocusEffect(
    React.useCallback(() => {
      loadRaporlar();
    }, [])
  );

// app/lab-rapor-listesi.tsx - loadRaporlar fonksiyonunu güncelle
const loadRaporlar = async () => {
  try {
    setLoading(true);
    
    const networkState = await NetInfo.fetch();
    setIsOffline(!networkState.isConnected);
    
    console.log('📋 Lab raporları yükleniyor...');
    
    if (networkState.isConnected) {
      // ✅ Online - API'den çek
      let response;
      let dataFound = false;
      
      // 1. Önce lab raporlarını dene
      try {
        response = await api.get('/api/lab-raporlarim');
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log(`✅ Lab raporları bulundu: ${response.data.length} kayıt`);
          
          // Cache'e kaydet
          await offlineStorage.cacheLabRaporlari(response.data);
          
          setRaporlar(response.data);
          dataFound = true;
        }
      } catch (raporError) {
        console.log('⚠️ Lab raporları endpoint hatası:', raporError.response?.data?.error);
      }
      
      // 2. Eğer lab raporları bulunamazsa lab numunelerini dene
      if (!dataFound) {
        try {
          console.log('🔄 Lab numuneleri deneniyor...');
          response = await api.get('/api/lab-numuneler');
          
          if (response.data && Array.isArray(response.data)) {
            const convertedData = response.data.map(numune => ({
              id: numune.id,
              rapor_no: `LAB-${numune.qr_kod}`,
              rapor_adi: `${numune.firma_adi || 'Bilinmeyen Firma'} - ${numune.alinan_yer || 'Bilinmeyen Yer'}`,
              qr_kod: numune.qr_kod,
              firma_adi: numune.firma_adi || numune.company_name || 'Bilinmeyen Firma',
              company_name: numune.company_name,
              alan_kisi: numune.alan_kisi || 'Bilinmeyen Kişi',
              alinan_yer: numune.alinan_yer || 'Bilinmeyen Yer',
              durum: numune.durum === 'lab_girisi' ? 'rapor_bekleniyor' : numune.durum,
              hazirlayan_id: numune.lab_teknisyen_id || '',
              hazirlanma_tarihi: numune.lab_giris_tarihi || numune.olusturma_tarihi,
              onay_tarihi: null,
              red_nedeni: null,
              toplam_test_sayisi: 0,
              uygun_test_sayisi: 0,
              uygun_olmayan_test_sayisi: 0,
              seri_no: numune.qr_kod
            }));
            
            // Cache'e kaydet
            await offlineStorage.cacheLabNumuneler(response.data);
            
            setRaporlar(convertedData);
            dataFound = true;
          }
        } catch (numuneError) {
          console.log('⚠️ Lab numuneleri endpoint hatası:', numuneError.response?.data?.error);
        }
      }
      
      if (!dataFound) {
        setRaporlar([]);
      }
    } else {
      // ✅ Offline - Cache'den yükle
      console.log('📴 Offline: Lab verileri cache\'den yükleniyor...');
      
      // Önce lab raporlarını dene
      let cachedRaporlar = await offlineStorage.getCachedLabRaporlari();
      
      if (cachedRaporlar && cachedRaporlar.length > 0) {
        setRaporlar(cachedRaporlar);
      } else {
        // Lab numunelerini dene
        const cachedNumuneler = await offlineStorage.getCachedLabNumuneler();
        
        if (cachedNumuneler && cachedNumuneler.length > 0) {
          const convertedData = cachedNumuneler.map(numune => ({
            id: numune.id,
            rapor_no: `LAB-${numune.qr_kod}`,
            rapor_adi: `${numune.firma_adi || 'Bilinmeyen Firma'} - ${numune.alinan_yer || 'Bilinmeyen Yer'}`,
            qr_kod: numune.qr_kod,
            firma_adi: numune.firma_adi || numune.company_name || 'Bilinmeyen Firma',
            company_name: numune.company_name,
            alan_kisi: numune.alan_kisi || 'Bilinmeyen Kişi',
            alinan_yer: numune.alinan_yer || 'Bilinmeyen Yer',
            durum: numune.durum === 'lab_girisi' ? 'rapor_bekleniyor' : numune.durum,
            hazirlayan_id: numune.lab_teknisyen_id || '',
            hazirlanma_tarihi: numune.lab_giris_tarihi || numune.olusturma_tarihi,
            onay_tarihi: null,
            red_nedeni: null,
            toplam_test_sayisi: 0,
            uygun_test_sayisi: 0,
            uygun_olmayan_test_sayisi: 0,
            seri_no: numune.qr_kod
          }));
          
          setRaporlar(convertedData);
        } else {
          setRaporlar([]);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Genel rapor listesi hatası:', error);
    
    // Hata durumunda cache'den yükle
    try {
      const cachedRaporlar = await offlineStorage.getCachedLabRaporlari();
      if (cachedRaporlar && cachedRaporlar.length > 0) {
        setRaporlar(cachedRaporlar);
      } else {
        const cachedNumuneler = await offlineStorage.getCachedLabNumuneler();
        if (cachedNumuneler && cachedNumuneler.length > 0) {
          // Convert logic...
          setRaporlar([]);
        } else {
          setRaporlar([]);
        }
      }
    } catch (cacheError) {
      console.error('❌ Cache\'den lab veri yükleme hatası:', cacheError);
      setRaporlar([]);
    }
    
    // Sadece online'da hata göster
    if (!isOffline) {
      const errorMessage = error.response?.data?.error || 'Rapor listesi yüklenemedi';
      Alert.alert('Bağlantı Hatası', errorMessage);
    }
  } finally {
    setLoading(false);
  }
};

const onRefresh = async () => {
  const networkState = await NetInfo.fetch();
  
  if (networkState.isConnected) {
    setRefreshing(true);
    await loadRaporlar();
    setRefreshing(false);
  } else {
    // Offline'da sadece cache'den yenile
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadRaporlar();
  }
};

  const getDurumColor = (durum: string) => {
    switch (durum) {
      case 'taslak':
        return '#6B7280'; // Gri
      case 'onay_bekliyor':
        return '#F59E0B'; // Sarı
      case 'onaylandi':
        return '#10B981'; // Yeşil
      case 'reddedildi':
        return '#EF4444'; // Kırmızı
      case 'revizyon_gerekli':
        return '#F97316'; // Turuncu
      default:
        return '#6B7280';
    }
  };

  const getDurumText = (durum: string) => {
    switch (durum) {
      case 'taslak':
        return 'Taslak';
      case 'onay_bekliyor':
        return 'Onay Bekliyor';
      case 'onaylandi':
        return 'Onaylandı';
      case 'reddedildi':
        return 'Reddedildi';
      case 'revizyon_gerekli':
        return 'Revizyon Gerekli';
      default:
        return 'Bilinmeyen';
    }
  };

  const filteredRaporlar = raporlar.filter(rapor => {
    if (filter === 'all') return true;
    return rapor.durum === filter;
  });

  const handleRaporPress = (rapor: RaporItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // ✅ YENİ MANTIK: Durum bazında yönlendirme
    if (rapor.durum === 'revizyon_gerekli') {
      // Revizyon gerekli -> Düzenleme sayfasına git (önceki verilerle)
      router.push({
        pathname: '/lab-rapor-olustur',
        params: { 
          qr_kod: rapor.qr_kod,
          rapor_id: rapor.id 
        }
      });
    } else if (rapor.durum === 'rapor_bekleniyor' || !rapor.id) {
      // Rapor henüz oluşturulmamış -> Yeni rapor oluştur
      const qrKod = rapor.qr_kod || rapor.seri_no;
      
      if (!qrKod) {
        Alert.alert('Hata', 'Bu numune için QR kod bulunamadı');
        return;
      }
      
      router.push({
        pathname: '/lab-rapor-olustur',
        params: { qr_kod: qrKod }
      });
    } else {
      // Diğer durumlar (onaylandi, reddedildi, onay_bekliyor) -> Detay sayfası (ReadOnly)
      router.push(`/lab-rapor-detay/${rapor.id}`);
    }
  };


  const renderFilterButton = (filterType: typeof filter, title: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterType && styles.activeFilterButton
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFilter(filterType);
      }}
    >
      <Ionicons 
        name={icon} 
        size={18} 
        color={filter === filterType ? 'white' : '#64748B'} 
      />
      <Text style={[
        styles.filterButtonText,
        filter === filterType && styles.activeFilterButtonText
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderRaporCard = (rapor: RaporItem, index: number) => {
    const uygunOrani = rapor.toplam_test_sayisi > 0 ? 
      Math.round((rapor.uygun_test_sayisi / rapor.toplam_test_sayisi) * 100) : 0;

    return (
      <TouchableOpacity
        key={index}
        style={styles.raporCard}
        onPress={() => handleRaporPress(rapor)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="file-document" size={24} color="#1E3A8A" />
            <View style={styles.titleContainer}>
              <Text style={styles.raporNo}>{rapor.rapor_no}</Text>
              <Text style={styles.raporAdi} numberOfLines={1}>
                {rapor.rapor_adi}
              </Text>
            </View>
          </View>
          <View style={[
            styles.durumBadge,
            { backgroundColor: getDurumColor(rapor.durum) }
          ]}>
            <Text style={styles.durumText}>
              {getDurumText(rapor.durum)}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Firma:</Text>
            <Text style={styles.infoValue}>
              {rapor.firma_adi || rapor.company_name || 'Bilinmiyor'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>QR Kod:</Text>
            <Text style={styles.infoValue}>{rapor.qr_kod}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hazırlanma:</Text>
            <Text style={styles.infoValue}>
              {new Date(rapor.hazirlanma_tarihi).toLocaleDateString('tr-TR')}
            </Text>
          </View>

          {rapor.onay_tarihi && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Onay Tarihi:</Text>
              <Text style={styles.infoValue}>
                {new Date(rapor.onay_tarihi).toLocaleDateString('tr-TR')}
              </Text>
            </View>
          )}
          
          {/* Test İstatistikleri */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{rapor.toplam_test_sayisi}</Text>
              <Text style={styles.statLabel}>Toplam</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>
                {rapor.uygun_test_sayisi}
              </Text>
              <Text style={styles.statLabel}>Uygun</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#EF4444' }]}>
                {rapor.uygun_olmayan_test_sayisi}
              </Text>
              <Text style={styles.statLabel}>Uygun Değil</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
                %{uygunOrani}
              </Text>
              <Text style={styles.statLabel}>Başarı</Text>
            </View>
          </View>

          {/* Red nedeni varsa göster */}
          {rapor.red_nedeni && (
            <View style={styles.redNedenContainer}>
              <Text style={styles.redNedenLabel}>Red Nedeni:</Text>
              <Text style={styles.redNedenText}>{rapor.red_nedeni}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          {/* ✅ Revizyon gerekli durumunda "Düzenle" butonu göster */}
          {rapor.durum === 'revizyon_gerekli' && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => handleRaporPress(rapor)} // ✅ Aynı handleRaporPress kullan
            >
              <Ionicons name="create-outline" size={16} color="#F59E0B" />
              <Text style={styles.editButtonText}>Düzenle</Text>
            </TouchableOpacity>
          )}
          
          {/* ✅ Rapor bekleniyor durumunda "Rapor Oluştur" butonu göster */}
          {rapor.durum === 'rapor_bekleniyor' && (
            <TouchableOpacity 
              style={styles.createRaporButton}
              onPress={() => handleRaporPress(rapor)} // ✅ Aynı handleRaporPress kullan
            >
              <Ionicons name="add-circle-outline" size={16} color="#10B981" />
              <Text style={styles.createRaporButtonText}>Rapor Oluştur</Text>
            </TouchableOpacity>
          )}
          
          {/* ✅ Diğer durumlar için "Detayları Gör" */}
          {!['revizyon_gerekli', 'rapor_bekleniyor'].includes(rapor.durum) && (
            <View style={styles.viewDetailHint}>
              <Text style={styles.viewDetailText}>Detayları Gör</Text>
            </View>
          )}
          
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Raporlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineIndicator />
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" translucent />
      
      <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rapor Listesi</Text>
      </LinearGradient>

    {/* Filtre Butonları */}
    <View style={styles.filterWrapper}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.filterScrollContent}
      >
        {renderFilterButton('all', 'Tümü', 'list-outline')}
        {renderFilterButton('onay_bekliyor', 'Onay Bekliyor', 'time-outline')}
        {renderFilterButton('onaylandi', 'Onaylandı', 'checkmark-circle-outline')}
        {renderFilterButton('reddedildi', 'Reddedildi', 'close-circle-outline')}
        {/* ✅ YENİ EKLENEN */}
        {renderFilterButton('revizyon_gerekli', 'Revizyon Gerekli', 'refresh-outline')}
      </ScrollView>
    </View>


      {/* Rapor Listesi */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1E3A8A']}
            tintColor="#1E3A8A"
          />
        }
      >
        {filteredRaporlar.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-document-outline" size={80} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Rapor Bulunamadı</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' ? 
                'Henüz hiç rapor oluşturulmamış' :
                `${getDurumText(filter)} durumunda rapor bulunmuyor`
              }
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.countContainer}>
              <Text style={styles.countText}>
                {filteredRaporlar.length} rapor listeleniyor
              </Text>
            </View>
            
            {filteredRaporlar.map((rapor, index) => renderRaporCard(rapor, index))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    paddingTop: STATUSBAR_HEIGHT + 15,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterWrapper: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,        // 8'den 6'ya düşür
    borderRadius: 8,
    marginRight: 4,              // 6'dan 4'e düşür  
    backgroundColor: 'transparent',
    minWidth: 50,                // 60'dan 50'ye düşür
  },
  activeFilterButton: {
    backgroundColor: '#1E3A8A',
  },
  filterButtonText: {
    marginLeft: 4,
    fontSize: 10,                // 11'den 10'a düşür
    fontWeight: '600',
    color: '#64748B',
  },
  activeFilterButtonText: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  countContainer: {
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  raporCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleContainer: {
    marginLeft: 8,
    flex: 1,
  },
  raporNo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  raporAdi: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  durumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  durumText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
  },
  cardContent: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  redNedenContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  redNedenLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 4,
  },
  redNedenText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748B',
  },
  createRaporButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    marginRight: 8,
  },
  createRaporButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },
  viewDetailHint: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

});