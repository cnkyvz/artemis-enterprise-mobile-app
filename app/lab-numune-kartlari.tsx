// app/lab-numune-kartlari.tsx
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

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface NumuneItem {
  id: number;
  qr_kod: string;
  firma_adi: string;
  company_name?: string;
  alinan_yer: string;
  numune_alis_tarihi: string;
  lab_giris_tarihi: string;
  alan_kisi: string;
  durum: string;
  teknisyen_tam_ad?: string;
}

export default function LabNumuneListesi() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [numuneler, setNumuneler] = useState<NumuneItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'lab_girisi' | 'rapor_hazirlaniyor'>('all');

  // Sayfa her açıldığında listeyi yenile
  useFocusEffect(
    React.useCallback(() => {
      loadNumuneler();
    }, [])
  );


  const loadNumuneler = async () => {
    try {
      setLoading(true);
      
      // Lab'a girmiş numuneleri çek
      const response = await api.get('/api/lab-numuneler');
      
      if (response.data && Array.isArray(response.data)) {
        // ✅ DÜZELTME: Backend'den gelen verileri doğru şekilde map et
        const mappedData = response.data.map(item => ({
          ...item,
          // ✅ Firma adını doğru kaynaklardan al (barkod-ekrani.tsx'deki sırayla aynı)
          firma_adi: item.firma_adi || item.company_name || 'Bilinmeyen Firma',
          // ✅ Alan kişi bilgisini ekle (barkod-ekrani.tsx'de alan_kisi olarak kaydediliyor)
          alan_kisi: item.alan_kisi || 'Bilinmeyen Kişi',
          // ✅ Alınan yer bilgisini ekle (barkod-ekrani.tsx'de alinan_yer olarak kaydediliyor)
          alinan_yer: item.alinan_yer || 'Bilinmeyen Yer'
        }));
        
        setNumuneler(mappedData);
      } else {
        setNumuneler([]);
      }
    } catch (error) {
      console.error('❌ Numune listesi yükleme hatası:', error);
      Alert.alert('Hata', 'Numune listesi yüklenemedi. Lütfen tekrar deneyin.');
      setNumuneler([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNumuneler();
    setRefreshing(false);
  };

  const getDurumColor = (durum: string) => {
    switch (durum) {
      case 'numune_alindi':
        return '#6B7280'; // Gri - Yolda
      case 'lab_girisi':
        return '#F59E0B'; // Turuncu - Lab'da
      case 'rapor_hazirlandi':
      case 'rapor_tamamlandi':
        return '#10B981'; // Yeşil - Rapor Hazırlandı
      case 'testler_tamamlandi':
        return '#3B82F6'; // Mavi - Test Tamamlandı
      default:
        return '#6B7280'; // Gri
    }
  };

  const getDurumText = (durum: string) => {
    switch (durum) {
      case 'numune_alindi':
      case 'manuel_eklenen': // ✅ Eklendi
        return 'Yolda';
      case 'lab_girisi':
        return 'Lab\'da';
      case 'rapor_hazirlandi':
      case 'rapor_tamamlandi':
        return 'Rapor Hazırlandı';
      case 'testler_tamamlandi':
        return 'Test Tamamlandı';
      default:
        return 'Bilinmeyen';
    }
  };

  const filteredNumuneler = numuneler.filter(numune => {
    if (filter === 'all') return true;
    if (filter === 'yolda') return numune.durum === 'numune_alindi' || numune.durum === 'manuel_eklenen'; // ✅ İki durum da
    if (filter === 'lab_girisi') return numune.durum === 'lab_girisi';
    if (filter === 'rapor_hazirlaniyor') return numune.durum === 'testler_tamamlandi';
    return numune.durum === filter;
  });

  const handleNumunePress = (numune: NumuneItem) => {
    // ✅ Yolda durumundaki numunelere tıklanmasını engelle
    if (numune.durum === 'numune_alindi') {
      Alert.alert(
        'Bilgi',
        'Bu numune henüz yoldadır. Lab\'a girişi yapıldıktan sonra işlem yapabilirsiniz.',
        [{ text: 'Tamam' }]
      );
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Diğer durumlar için rapor oluşturmaya git
    router.push({
      pathname: '/lab-rapor-olustur',
      params: { qr_kod: numune.qr_kod }
    });
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

  const renderNumuneCard = (numune: NumuneItem, index: number) => {
    // ✅ DÜZELTME: Backend'den gelen doğru field'ları kullan
    const firmaAdi = numune.firma_adi || numune.company_name || 'Bilinmeyen Firma';
    const labGirisTarihi = numune.lab_giris_tarihi ? 
      new Date(numune.lab_giris_tarihi).toLocaleDateString('tr-TR') : 
      'Henüz Girmedi';
  
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.numuneCard,
          numune.durum === 'numune_alindi' && styles.disabledCard
        ]}
        onPress={() => handleNumunePress(numune)}
        disabled={numune.durum === 'numune_alindi'}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons 
              name="flask" 
              size={24} 
              color={numune.durum === 'numune_alindi' ? '#94A3B8' : '#1E3A8A'} 
            />
            <View style={styles.titleContainer}>
              <Text style={[
                styles.qrKod,
                numune.durum === 'numune_alindi' && styles.disabledText
              ]}>
                {numune.qr_kod}
              </Text>
              <Text style={[
                styles.firmaAdi,
                numune.durum === 'numune_alindi' && styles.disabledText
              ]} numberOfLines={1}>
                {firmaAdi}
              </Text>
            </View>
          </View>
          <View style={[
            styles.durumBadge,
            { backgroundColor: getDurumColor(numune.durum) }
          ]}>
            <Text style={styles.durumText}>
              {getDurumText(numune.durum)}
            </Text>
          </View>
        </View>
  
        <View style={styles.cardContent}>
          {/* ✅ DÜZELTME: Doğru field adlarını kullan */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Firma:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {firmaAdi}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alınan Yer:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {numune.alinan_yer || 'Bilinmeyen Yer'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lab Giriş:</Text>
            <Text style={styles.infoValue}>{labGirisTarihi}</Text>
          </View>
          
          {numune.teknisyen_tam_ad && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Teknisyen:</Text>
              <Text style={styles.infoValue}>{numune.teknisyen_tam_ad}</Text>
            </View>
          )}
  
          {/* ✅ DÜZELTME: alan_kisi field'ını kullan */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alan Kişi:</Text>
            <Text style={styles.infoValue}>{numune.alan_kisi || 'Bilinmeyen Kişi'}</Text>
          </View>
        </View>

        {/* Card footer kısmı aynı kalacak */}
        <View style={styles.cardFooter}>
          <View style={styles.actionButtons}>
            {numune.durum === 'numune_alindi' && (
              <View style={[styles.yoldaButton, styles.disabledButton]}>
                <Ionicons name="car" size={16} color="#94A3B8" />
                <Text style={[styles.yoldaButtonText, styles.disabledButtonText]}>
                  Yolda
                </Text>
              </View>
            )}
            
            {numune.durum === 'lab_girisi' && (
              <TouchableOpacity 
                style={styles.raporButton}
                onPress={() => router.push({
                  pathname: '/lab-rapor-olustur',
                  params: { qr_kod: numune.qr_kod }
                })}
              >
                <Ionicons name="document-text" size={16} color="#F59E0B" />
                <Text style={[styles.raporButtonText, { color: '#F59E0B' }]}>
                  Rapor Oluştur
                </Text>
              </TouchableOpacity>
            )}
            
            {(numune.durum === 'testler_tamamlandi' || 
              numune.durum === 'rapor_hazirlandi' || 
              numune.durum === 'rapor_tamamlandi') && (
              <TouchableOpacity 
                style={[styles.raporButton, { backgroundColor: '#D1FAE5' }]}
                onPress={() => router.push({
                  pathname: '/lab-rapor-olustur',
                  params: { qr_kod: numune.qr_kod }
                })}
              >
                <Ionicons name="document-text" size={16} color="#10B981" />
                <Text style={[styles.raporButtonText, { color: '#10B981' }]}>
                  Rapor Görüntüle
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {numune.durum !== 'numune_alindi' && (
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Numuneler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" translucent />
      
      <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lab Numune Listesi</Text>
      </LinearGradient>

      {/* Filtre Butonları */}
      <View style={styles.filterWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterScrollContent}
        >
          
          {renderFilterButton('all', 'Tümü', 'list-outline')}
          {renderFilterButton('yolda', 'Yolda', 'car-outline')}
          {renderFilterButton('lab_girisi', 'Lab\'da', 'flask-outline')}
          {renderFilterButton('rapor_hazirlaniyor', 'Rapor Hazırlanacak', 'document-outline')}
        </ScrollView>
      </View>

      {/* Numune Listesi */}
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
        {filteredNumuneler.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="flask-empty-outline" size={80} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Numune Bulunamadı</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' ? 
                'Henüz lab\'a numune girişi yapılmamış' :
                `${getDurumText(filter)} durumunda numune bulunmuyor`
              }
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.countContainer}>
              <Text style={styles.countText}>
                {filteredNumuneler.length} numune listeleniyor
              </Text>
            </View>
            
            {filteredNumuneler.map((numune, index) => renderNumuneCard(numune, index))}
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
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  activeFilterButton: {
    backgroundColor: '#1E3A8A',
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 12,
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
  numuneCard: {
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
  qrKod: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  firmaAdi: {
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
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  cardContent: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  raporButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
  },
  raporButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
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
  yoldaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7', // Açık sarı background
    borderRadius: 6,
  },
  yoldaButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  disabledCard: {
    opacity: 0.6,
    backgroundColor: '#F8FAFC',
  },
  disabledText: {
    color: '#94A3B8',
  },
  disabledButton: {
    backgroundColor: '#F1F5F9',
    opacity: 0.7,
  },
  disabledButtonText: {
    color: '#94A3B8',
  },
});