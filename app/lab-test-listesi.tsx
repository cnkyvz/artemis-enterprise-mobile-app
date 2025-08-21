// app/lab-test-listesi.tsx
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
  alinan_yer: string;
  numune_giris: number;
  numune_cikis: number;
  numune_alis_tarihi: string;
  lab_giris_tarihi: string;
  alan_kisi: string;
  durum: string;
  test_durumu: string;
  company_name?: string;
}

export default function LabTestListesi() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [numuneler, setNumuneler] = useState<NumuneItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'test_bekliyor' | 'test_tamamlandi'>('all');

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
        setNumuneler(response.data);
      } else {
        setNumuneler([]);
      }
    } catch (error) {
      console.error('❌ Numune listesi yükleme hatası:', error);
      Alert.alert(
        'Hata',
        'Numune listesi yüklenemedi. Lütfen tekrar deneyin.'
      );
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

  const getDurumColor = (durum: string, test_durumu: string) => {
    if (durum === 'lab_girisi' && test_durumu === 'test_bekliyor') {
      return '#F59E0B'; // Sarı - Test bekliyor
    } else if (durum === 'testler_tamamlandi') {
      return '#10B981'; // Yeşil - Test tamamlandı
    } else if (durum === 'rapor_hazirlandi') {
      return '#3B82F6'; // Mavi - Rapor hazırlandı
    }
    return '#6B7280'; // Gri - Bilinmeyen durum
  };

  const getDurumText = (durum: string, test_durumu: string) => {
    if (durum === 'lab_girisi' && test_durumu === 'test_bekliyor') {
      return 'Test Bekliyor';
    } else if (durum === 'testler_tamamlandi') {
      return 'Test Tamamlandı';
    } else if (durum === 'rapor_hazirlandi') {
      return 'Rapor Hazırlandı';
    }
    return 'Bilinmeyen Durum';
  };

  const filteredNumuneler = numuneler.filter(numune => {
    if (filter === 'all') return true;
    if (filter === 'test_bekliyor') {
      return numune.durum === 'lab_girisi' && numune.test_durumu === 'test_bekliyor';
    }
    if (filter === 'test_tamamlandi') {
      return numune.durum === 'testler_tamamlandi' || numune.durum === 'rapor_hazirlandi';
    }
    return true;
  });

  const handleNumunePress = (numune: NumuneItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (numune.durum === 'lab_girisi' && numune.test_durumu === 'test_bekliyor') {
      // Test girişine yönlendir
      router.push({
        pathname: '/lab-test-giris',
        params: { qr_kod: numune.qr_kod }
      });
    } else if (numune.durum === 'testler_tamamlandi') {
      // Rapor oluşturmaya yönlendir
      router.push({
        pathname: '/lab-rapor-olustur',
        params: { qr_kod: numune.qr_kod }
      });
    } else {
      Alert.alert(
        'Bilgi',
        'Bu numune için şu an yapılacak işlem bulunmuyor.'
      );
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
        size={20} 
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

  const renderNumuneCard = (numune: NumuneItem, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.numuneCard}
      onPress={() => handleNumunePress(numune)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="flask" size={24} color="#1E3A8A" />
          <Text style={styles.qrKod}>{numune.qr_kod}</Text>
        </View>
        <View style={[
          styles.durumBadge,
          { backgroundColor: getDurumColor(numune.durum, numune.test_durumu) }
        ]}>
          <Text style={styles.durumText}>
            {getDurumText(numune.durum, numune.test_durumu)}
          </Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Firma:</Text>
          <Text style={styles.infoValue}>
            {numune.firma_adi || numune.company_name || 'Bilinmiyor'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Alınan Yer:</Text>
          <Text style={styles.infoValue}>{numune.alinan_yer}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Lab Giriş:</Text>
          <Text style={styles.infoValue}>
            {numune.lab_giris_tarihi ? 
              new Date(numune.lab_giris_tarihi).toLocaleDateString('tr-TR') : 
              'Giriş yapılmamış'
            }
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Alan Kişi:</Text>
          <Text style={styles.infoValue}>{numune.alan_kisi}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Test Bekleyen Numuneler</Text>
      </LinearGradient>

      {/* Filtre Butonları */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'Tümü', 'list-outline')}
        {renderFilterButton('test_bekliyor', 'Test Bekliyor', 'time-outline')}
        {renderFilterButton('test_tamamlandi', 'Tamamlandı', 'checkmark-circle-outline')}
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
                'Lab\'a henüz numune girişi yapılmamış' :
                filter === 'test_bekliyor' ?
                'Test bekleyen numune bulunmuyor' :
                'Test tamamlanan numune bulunmuyor'
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeFilterButton: {
    backgroundColor: '#1E3A8A',
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 14,
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
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrKod: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginLeft: 8,
  },
  durumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durumText: {
    fontSize: 12,
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
  cardFooter: {
    alignItems: 'flex-end',
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
});