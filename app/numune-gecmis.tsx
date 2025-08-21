// app/numune-gecmis.tsx - Sorun tespiti için güncellenmiş versiyon

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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';
import { getCurrentUser, getCurrentToken, logout } from '../artemis-api/middleware/auth';


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
  lab_giris_tarihi?: string;
  alan_kisi: string;
  durum: string;
  test_durumu?: string;
  rapor_no?: string;
  rapor_durum?: string;
  rapor_pdf_url?: string;
  onay_tarihi?: string;
  rapor_id?: number;
}

export default function NumuneGecmis() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [numuneler, setNumuneler] = useState<NumuneItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'numune_alindi' | 'lab_girisi' | 'testler_tamamlandi' | 'rapor_hazirlandi'>('all');
  const [companyId, setCompanyId] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Sayfa her açıldığında listeyi yenile
  useFocusEffect(
    React.useCallback(() => {
      setLoading(true); // ✅ Loading state'i başlat
      setDebugInfo(''); // ✅ Debug info'yu temizle
      loadCompanyId();
    }, [])
  );

  const addDebugInfo = (info: string) => {
    console.log('🔍 DEBUG:', info);
    setDebugInfo(prev => prev + '\n' + info);
  };

  const loadCompanyId = async () => {
    try {
      addDebugInfo('=== Company ID Yükleme Başladı ===');
      
      // ✅ 1. ÖNCE ENTERPRISE SİSTEMDEN DENE
      try {
        console.log('🔍 Enterprise sistemden kullanıcı verisi alınıyor...');
        const enterpriseUser = await getCurrentUser();
        
        if (enterpriseUser) {
          console.log('✅ Enterprise kullanıcı verisi bulundu:', enterpriseUser);
          
          // ✅ Company ID'yi normalize et
          const company_id = enterpriseUser.company_id || enterpriseUser.id;
          
          if (company_id) {
            setCompanyId(company_id.toString());
            addDebugInfo(`✅ Enterprise Company ID: ${company_id}`);
            
            // ✅ Enterprise token kontrolü
            const token = await getCurrentToken();
            
            if (token) {
              addDebugInfo('✅ Enterprise token mevcut, normal API çağrısı yapılıyor...');
              await loadNumunelerWithToken(company_id.toString(), token);
            } else {
              addDebugInfo('⚠️ Enterprise token yok, debug data kullanılıyor');
              await useDebugData(company_id.toString());
            }
            
            return; // ✅ Başarılı, fonksiyondan çık
          }
        }
      } catch (enterpriseError) {
        addDebugInfo(`⚠️ Enterprise sistem hatası: ${enterpriseError.message}`);
      }
      
      // ✅ 2. FALLBACK: LEGACY SİSTEM KONTROLÜ
      const userData = await AsyncStorage.getItem('userData');
      if (userData && userData !== 'null') {
        const user = JSON.parse(userData);
        const company_id = user.company_id;
        
        if (company_id) {
          setCompanyId(company_id.toString());
          const userToken = await AsyncStorage.getItem('userToken');
          
          if (userToken) {
            await loadNumunelerWithToken(company_id.toString(), userToken);
          } else {
            await useDebugData(company_id.toString());
          }
          return;
        }
      }
      
      // ✅ 3. HİÇ VERİ YOKSA
      Alert.alert(
        'Oturum Süresi Doldu',
        'Lütfen tekrar giriş yapın.',
        [
          { 
            text: 'Giriş Yap', 
            onPress: () => {
              logout().then(() => router.push('/uye-giris')).catch(() => router.push('/uye-giris'));
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ loadCompanyId hatası:', error);
      Alert.alert('Hata', 'Kullanıcı bilgileri alınamadı.');
    }
  };

// numune-gecmis.tsx dosyasında testBackendConnection fonksiyonunu değiştirin
const testBackendConnection = async (company_id: string) => {
  try {
    addDebugInfo(`=== Backend Connection Test - Company ID: ${company_id} ===`);
    addDebugInfo(`API Base URL: ${api.defaults.baseURL}`);
    
    // ✅ ÖNCE ENTERPRİSE TOKEN İLE DENE
    const enterpriseToken = await getCurrentToken();
    
    if (enterpriseToken) {
      addDebugInfo('✅ Enterprise token bulundu, normal endpoint deneniyor...');
      try {
        // ✅ API çağrısından önce debug bilgisi ekle
        addDebugInfo(`📤 API isteği gönderiliyor: /api/numune-gecmis/${company_id}`);
        
        const response = await api.get(`/api/numune-gecmis/${company_id}`);
        
        addDebugInfo(`✅ API Response Status: ${response.status}`);
        addDebugInfo(`Response Data Type: ${typeof response.data}`);
        addDebugInfo(`Response Is Array: ${Array.isArray(response.data)}`);
        addDebugInfo(`Response Length: ${response.data?.length || 0}`);
        
        if (response.data && Array.isArray(response.data)) {
          // ✅ Her numune için detaylı log
          response.data.forEach((numune, index) => {
            console.log(`📊 Backend'den Gelen Numune ${index + 1}:`, {
              id: numune.id,
              qr_kod: numune.qr_kod,
              durum: numune.durum,
              firma_adi: numune.firma_adi,
              company_id: numune.company_id,
              olusturma_tarihi: numune.olusturma_tarihi
            });
            
            addDebugInfo(`Numune ${index + 1}: ${numune.qr_kod} - Durum: ${numune.durum} - Firma: ${numune.firma_adi}`);
          });
          
          setNumuneler(response.data);
          setLoading(false);
          
          if (response.data.length === 0) {
            addDebugInfo(`⚠️ Company ID ${company_id} için numune bulunamadı`);
            Alert.alert(
              'Bilgi',
              `Bu firmaya (ID: ${company_id}) ait numune bulunamadı.`,
              [{ text: 'Tamam' }]
            );
          } else {
            addDebugInfo(`✅ SUCCESS: ${response.data.length} numune yüklendi!`);
          }
          
          return; // ✅ Başarılı, fonksiyondan çık
        }
      } catch (enterpriseError) {
        addDebugInfo(`⚠️ Enterprise endpoint hatası: ${enterpriseError.message}`);
        addDebugInfo(`⚠️ Error Status: ${enterpriseError.response?.status}`);
        // Debug endpoint'e geç
      }
    }
    
    // ✅ FALLBACK: DEBUG ENDPOINT (kaldırılabilir, artık gerek yok)
    addDebugInfo('❌ Normal endpoint başarısız oldu');
    setNumuneler([]);
    setLoading(false);
    
    Alert.alert(
      'Bağlantı Hatası',
      'Numune verileri alınamadı. İnternet bağlantınızı kontrol edin.',
      [{ text: 'Tamam' }]
    );
    
  } catch (error) {
    addDebugInfo(`❌ Backend test hatası: ${error.message}`);
    console.error('❌ Backend connection test failed:', error);
    
    setNumuneler([]);
    setLoading(false);
    
    Alert.alert(
      'Hata',
      'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.',
      [{ text: 'Tamam' }]
    );
  }
};

const loadNumunelerWithToken = async (company_id: string, token: string) => {
  try {
    addDebugInfo(`=== Token ile API Çağrısı - Company ID: ${company_id} ===`);
    
    // API headers'ı kontrol et
    addDebugInfo(`API Base URL: ${api.defaults.baseURL}`);
    addDebugInfo(`Token başlangıç: ${token.substring(0, 30)}...`);
    
    const response = await api.get(`/api/numune-gecmis/${company_id}`);
    
    addDebugInfo(`✅ API Response Status: ${response.status}`);
    addDebugInfo(`Response Data Type: ${typeof response.data}`);
    addDebugInfo(`Response Is Array: ${Array.isArray(response.data)}`);
    addDebugInfo(`Response Length: ${response.data?.length || 0}`);
    
    if (response.data && Array.isArray(response.data)) {
      // ✅ Her numune için durum detaylarını logla
      response.data.forEach((numune, index) => {
        console.log(`📊 Backend'den Gelen Numune ${index + 1}:`, {
          qr_kod: numune.qr_kod,
          durum: numune.durum,
          firma_adi: numune.firma_adi,
          lab_giris_tarihi: numune.lab_giris_tarihi,
          olusturma_tarihi: numune.olusturma_tarihi,
          company_id: numune.company_id
        });
        
        addDebugInfo(`Numune ${index + 1}: ${numune.qr_kod} - Durum: ${numune.durum}`);
      });
      
      const sortedData = response.data.sort((a, b) => 
        new Date(b.olusturma_tarihi || b.numune_alis_tarihi).getTime() - 
        new Date(a.olusturma_tarihi || a.numune_alis_tarihi).getTime()
      );
      
      setNumuneler(sortedData);
      
      // ✅ Durum bazında sayıları göster
      const durumSayilari = sortedData.reduce((acc, numune) => {
        acc[numune.durum] = (acc[numune.durum] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📈 Durum Bazında Numune Sayıları:', durumSayilari);
      addDebugInfo(`✅ SUCCESS: ${sortedData.length} numune yüklendi!`);
      addDebugInfo(`Durum Dağılımı: ${JSON.stringify(durumSayilari)}`);
      
    } else {
      addDebugInfo('❌ Response data array değil');
      setNumuneler([]);
    }
    
  } catch (error) {
    addDebugInfo(`❌ API Hatası: ${error.message}`);
    addDebugInfo(`Error Status: ${error.response?.status}`);
    addDebugInfo(`Error Data: ${JSON.stringify(error.response?.data)}`);
    
    // 401/403 hataları için token sorunu
    if (error.response?.status === 401 || error.response?.status === 403) {
      addDebugInfo('🔄 Token sorunu - Tekrar giriş gerekebilir');
      Alert.alert(
        'Oturum Süresi Doldu',
        'Lütfen tekrar giriş yapın.',
        [{ text: 'Giriş Yap', onPress: () => router.push('/uye-giris') }]
      );
    } else {
      // Diğer hatalar için debug data kullan
      addDebugInfo('🔄 API hatası - Debug data deneniyor...');
      await useDebugData(company_id);
    }
  } finally {
    setLoading(false);
  }
};
  
  // Debug data kullanma fonksiyonu
  const useDebugData = async (company_id: string) => {
    try {
      addDebugInfo(`=== Debug Data Kullanılıyor - Company ID: ${company_id} ===`);
      
      const debugResponse = await fetch(`${api.defaults.baseURL}/api/debug-numune-simple/${company_id}`);
      const debugData = await debugResponse.json();
      
      addDebugInfo(`Debug Response Status: ${debugResponse.status}`);
      addDebugInfo(`Debug Data Count: ${debugData.numune_data?.length || 0}`);
      
      if (debugData.success && debugData.numune_data.length > 0) {
        setNumuneler(debugData.numune_data);
        addDebugInfo(`🧪 Debug verisi kullanıldı: ${debugData.numune_data.length} kayıt`);
        
        // Kullanıcıya bilgi ver
        Alert.alert(
          'Debug Modu',
          `${debugData.numune_data.length} numune debug modunda yüklendi. Token sorunu olabilir.`,
          [{ text: 'Tamam' }]
        );
      } else {
        addDebugInfo('❌ Debug data da boş');
        setNumuneler([]);
      }
    } catch (error) {
      addDebugInfo(`❌ Debug data hatası: ${error.message}`);
      setNumuneler([]);
    }
  };

  const loadNumuneler = async (company_id: string) => {
    // Bu fonksiyon artık kullanılmıyor, testBackendConnection kullanıyoruz
    addDebugInfo('loadNumuneler çağrıldı ama testBackendConnection kullanılıyor');
  };

  const onRefresh = async () => {
    if (companyId) {
      setRefreshing(true);
      setDebugInfo('=== REFRESH BAŞLADI ===');
      await testBackendConnection(companyId);
      setRefreshing(false);
    }
  };


  // numune-gecmis.tsx - getDurumText fonksiyonunu güncelleyin:
  const getDurumText = (durum: string, rapor_durum?: string) => {
    if (rapor_durum === 'onaylandi') {
      return 'Rapor Onaylandı';
    } else if (rapor_durum === 'onay_bekliyor') {
      return 'Rapor Onay Bekliyor';
    } else if (rapor_durum === 'reddedildi') {
      return 'Rapor Reddedildi';
    } else if (durum === 'rapor_hazirlandi') {
      return 'Rapor Hazırlandı';
    } else if (durum === 'testler_tamamlandi') {
      return 'Testler Tamamlandı';
    } else if (durum === 'lab_girisi') {
      return 'Lab\'da İşlemde'; // ✅ Lab'a giriş yapılan numuneler
    } else if (durum === 'numune_alindi') {
      return 'Alındı'; // ✅ Barkod ekranından kaydedilen numuneler
    } else if (durum === 'manuel_eklenen') {
      return 'Manuel Eklendi';
    }
    return 'Bilinmeyen Durum';
  };

  // getDurumColor fonksiyonunu güncelleyin:
  const getDurumColor = (durum: string, rapor_durum?: string) => {
    if (rapor_durum === 'onaylandi') {
      return '#10B981'; // Yeşil - Rapor onaylandı
    } else if (rapor_durum === 'onay_bekliyor') {
      return '#F59E0B'; // Sarı - Rapor onay bekliyor
    } else if (rapor_durum === 'reddedildi') {
      return '#EF4444'; // Kırmızı - Rapor reddedildi
    } else if (durum === 'testler_tamamlandi' || durum === 'rapor_hazirlandi') {
      return '#3B82F6'; // Mavi - Testler tamamlandı
    } else if (durum === 'lab_girisi') {
      return '#8B5CF6'; // Mor - Lab'da işlemde
    } else if (durum === 'numune_alindi') {
      return '#F97316'; // Turuncu - Alındı (barkod ekranından)
    } else if (durum === 'manuel_eklenen') {
      return '#6B7280'; // Gri - Manuel eklenen
    }
    return '#6B7280'; // Gri - Bilinmeyen durum
  };

  // getDurumIcon fonksiyonunu güncelleyin:
  const getDurumIcon = (durum: string, rapor_durum?: string) => {
    if (rapor_durum === 'onaylandi') {
      return 'checkmark-circle';
    } else if (rapor_durum === 'onay_bekliyor') {
      return 'time';
    } else if (rapor_durum === 'reddedildi') {
      return 'close-circle';
    } else if (durum === 'rapor_hazirlandi') {
      return 'document-text';
    } else if (durum === 'testler_tamamlandi') {
      return 'flask';
    } else if (durum === 'lab_girisi') {
      return 'medical'; // Lab'da işlemde - tıbbi ikon
    } else if (durum === 'numune_alindi') {
      return 'water'; // Alındı - su damlası ikonu
    } else if (durum === 'manuel_eklenen') {
      return 'create'; // Manuel eklenen - kalem ikonu
    }
    return 'help-circle';
  };

  const filteredNumuneler = numuneler.filter(numune => {
    if (filter === 'all') return true;
    
    // ✅ "Test Tamam" filtresi için rapor onaylanmış olanları da dahil et
    if (filter === 'testler_tamamlandi') {
      return numune.durum === 'testler_tamamlandi' || 
             numune.durum === 'rapor_hazirlandi' || 
             numune.rapor_durum === 'onaylandi';
    }
    
    return numune.durum === filter;
  });

  const handleNumunePress = (numune: NumuneItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (numune.rapor_durum === 'onaylandi' && numune.rapor_no) {
      router.push({
        pathname: '/lab-rapor-detay/[id]',
        params: { 
          id: numune.rapor_id || numune.id // Rapor ID'sini geç
        }
      });
    } else {
      Alert.alert(
        'Numune Detayı',
        `QR Kod: ${numune.qr_kod}\nDurum: ${getDurumText(numune.durum, numune.rapor_durum)}\nAlınma Tarihi: ${new Date(numune.numune_alis_tarihi).toLocaleDateString('tr-TR')}`,
        [{ text: 'Tamam' }]
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
    const durumColor = getDurumColor(numune.durum, numune.rapor_durum);
    const durumText = getDurumText(numune.durum, numune.rapor_durum);
    const durumIcon = getDurumIcon(numune.durum, numune.rapor_durum);
    const hasReport = numune.rapor_durum === 'onaylandi';
  
    // ✅ DEBUG: Her kart için durum bilgisini logla
    console.log(`🔍 Numune Card [${index}]:`, {
      qr_kod: numune.qr_kod,
      durum: numune.durum,
      rapor_durum: numune.rapor_durum,
      durumText,
      durumColor,
      firma_adi: numune.firma_adi
    });
  
    return (
      <TouchableOpacity
        key={index}
        style={styles.numuneCard}
        onPress={() => handleNumunePress(numune)}
      >
        {/* Card içeriği aynı kalacak */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="flask" size={24} color="#1E3A8A" />
            <View style={styles.titleContainer}>
              <Text style={styles.qrKod}>{numune.qr_kod}</Text>
              {numune.rapor_no && (
                <Text style={styles.raporNo}>Rapor: {numune.rapor_no}</Text>
              )}
            </View>
          </View>
          <View style={[
            styles.durumBadge,
            { backgroundColor: durumColor }
          ]}>
            <Ionicons name={durumIcon} size={12} color="white" />
            <Text style={styles.durumText}>{durumText}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alınan Yer:</Text>
            <Text style={styles.infoValue}>{numune.alinan_yer}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alınma Tarihi:</Text>
            <Text style={styles.infoValue}>
              {new Date(numune.numune_alis_tarihi).toLocaleDateString('tr-TR')}
            </Text>
          </View>
          
          {numune.lab_giris_tarihi && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lab Giriş:</Text>
              <Text style={styles.infoValue}>
                {new Date(numune.lab_giris_tarihi).toLocaleDateString('tr-TR')}
              </Text>
            </View>
          )}
          
          {numune.onay_tarihi && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Onay Tarihi:</Text>
              <Text style={styles.infoValue}>
                {new Date(numune.onay_tarihi).toLocaleDateString('tr-TR')}
              </Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alan Kişi:</Text>
            <Text style={styles.infoValue}>{numune.alan_kisi}</Text>
          </View>

          <View style={styles.numuneValuesRow}>
            <View style={styles.valueBox}>
              <Text style={styles.valueNumber}>{numune.numune_giris}</Text>
              <Text style={styles.valueLabel}>Giriş (L)</Text>
            </View>
            <View style={styles.valueBox}>
              <Text style={styles.valueNumber}>{numune.numune_cikis}</Text>
              <Text style={styles.valueLabel}>Çıkış (L)</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          {hasReport && (
            <TouchableOpacity 
              style={styles.reportButton}
              onPress={() => router.push({
                pathname: '/lab-rapor-detay/[id]',
                params: { 
                  id: numune.rapor_id || numune.id 
                }
              })}
            >
              <Ionicons name="document-text-outline" size={16} color="#10B981" />
              <Text style={styles.reportButtonText}>Raporu Görüntüle</Text>
            </TouchableOpacity>
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
        <Text style={styles.loadingText}>Numune geçmişi yükleniyor...</Text>
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
        <Text style={styles.headerTitle}>Numune Geçmişim</Text>
      </LinearGradient>

    {/* Filtre Butonları */}
    <View style={styles.filterWrapper}>
    <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.filterScrollContent}
    >
        {renderFilterButton('all', 'Tümü', 'list-outline')}
        {renderFilterButton('numune_alindi', 'Alındı', 'water-outline')}
        {renderFilterButton('lab_girisi', 'Lab\'da', 'medical-outline')}
        {renderFilterButton('testler_tamamlandi', 'Test Tamam', 'flask-outline')}
        {renderFilterButton('rapor_hazirlandi', 'Raporlu', 'document-text-outline')}
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
                'Henüz hiç numune alınmamış' :
                `${filter} durumunda numune bulunmuyor`
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
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
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
    flex: 1,
    textAlign: 'center',
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
    marginLeft: 4,
    fontSize: 11, // 12'den 11'e küçült
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
  raporNo: {
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
    fontWeight: '600',
  },
  durumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  durumText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 4,
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
  numuneValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  valueBox: {
    alignItems: 'center',
  },
  valueNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  valueLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  reportButtonText: {
    fontSize: 12,
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
});