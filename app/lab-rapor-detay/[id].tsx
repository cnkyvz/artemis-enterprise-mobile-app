// app/lab-rapor-detay/[id].tsx
import React, { useState, useEffect } from 'react';
import { 
 View, 
 Text, 
 StyleSheet, 
 TouchableOpacity, 
 ScrollView,
 Alert,
 ActivityIndicator,
 StatusBar,
 Platform,
 Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api from '../../utils/enterpriseApi';
import NetInfo from '@react-native-community/netinfo';
import offlineStorage from '../../artemis-api/utils/offlineStorage';
import OfflineIndicator from '../../components/OfflineIndicator';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface RaporData {
 id: number;
 rapor_no: string;
 rapor_adi: string;
 qr_kod: string;
 firma_adi: string;
 company_name?: string;
 durum: string;
 hazirlayan_id: string;
 hazirlayan_ad?: string;
 hazirlayan_soyad?: string;
 hazirlanma_tarihi: string;
 onay_tarihi?: string;
 onaylayan_admin_id?: number;
 red_nedeni?: string;
 toplam_test_sayisi: number;
 uygun_test_sayisi: number;
 uygun_olmayan_test_sayisi: number;
 genel_degerlendirme?: string;
 oneriler?: string;
 numune_cinsi?: string;
 analiz_baslama_tarihi?: string;
 analiz_bitis_tarihi?: string;
 rapor_metni?: any;
 test_sonuclari?: TestSonucu[];
}

interface TestSonucu {
 id?: number;
 artemis_numune_no?: string;
 nokta_adi: string;
 test_adi: string;
 test_sonucu?: string;
 test_sonucu_metin?: string;
 test_birimi: string;
 limit_deger: string;
 test_metodu: string;
 durum: string;
 // Backward compatibility
 testler?: string;
 birim?: string;
 bulgu?: string;
 metot?: string;
 numune_yeri?: string;
}

export default function RaporDetay() {
 const router = useRouter();
 const { id } = useLocalSearchParams<{ id: string }>();
 
 const [loading, setLoading] = useState(true);
 const [rapor, setRapor] = useState<RaporData | null>(null);
 const [testSonuclari, setTestSonuclari] = useState<TestSonucu[]>([]);
 const [isOffline, setIsOffline] = useState(false);

 useEffect(() => {
   if (id) {
     loadRaporData();
   } else {
     Alert.alert('Hata', 'Rapor ID bulunamadı');
     router.back();
   }
 }, [id]);

 const loadRaporData = async () => {
  try {
    setLoading(true);
    
    const networkState = await NetInfo.fetch();
    setIsOffline(!networkState.isConnected);
    
    console.log('📋 Rapor detayı yükleniyor - ID:', id);
    
    if (networkState.isConnected) {
      // ✅ Online - API'den çek
      const response = await api.get(`/api/rapor-detay/${id}`);
      const raporData = response.data;
      
      console.log('✅ Rapor verisi alındı:', {
        rapor_no: raporData.rapor_no,
        test_sonuclari_count: raporData.test_sonuclari?.length || 0
      });
      
      // Cache'e kaydet
      await offlineStorage.cacheRaporDetay(id, raporData);
      
      setRapor(raporData);
      processTestResults(raporData);
    } else {
      // ✅ Offline - Cache'den çek
      console.log('📴 Offline: Rapor cache\'den yükleniyor...');
      
      const cachedRapor = await offlineStorage.getCachedRaporDetay(id);
      
      if (cachedRapor) {
        console.log('✅ Offline rapor bulundu:', cachedRapor.rapor_no);
        setRapor(cachedRapor);
        processTestResults(cachedRapor);
      } else {
        // Cache'de yoksa lab raporları cache'inden ara
        const labRaporlari = await offlineStorage.getCachedLabRaporlari();
        const foundRapor = labRaporlari.find(r => r.id.toString() === id);
        
        if (foundRapor) {
          console.log('✅ Lab raporları cache\'den bulundu:', foundRapor.rapor_no);
          setRapor(foundRapor);
          setTestSonuclari([]); // Test sonuçları cache'de olmayabilir
        } else {
          throw new Error('Rapor offline cache\'de bulunamadı');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Rapor detay yükleme hatası:', error);
    
    // Hata durumunda cache'den yükle
    if (!isOffline) {
      try {
        const cachedRapor = await offlineStorage.getCachedRaporDetay(id);
        if (cachedRapor) {
          setRapor(cachedRapor);
          processTestResults(cachedRapor);
          return;
        }
      } catch (cacheError) {
        console.error('❌ Cache\'den rapor yükleme hatası:', cacheError);
      }
    }
    
    Alert.alert(
      isOffline ? 'Offline Mod' : 'Hata', 
      isOffline ? 
        'Bu rapor offline modda görüntülenemiyor.' :
        error.response?.data?.error || 'Rapor detayları yüklenemedi',
      [
        { text: 'Geri Dön', onPress: () => router.back() }
      ]
    );
  } finally {
    setLoading(false);
  }
};

// ✅ Test sonuçlarını işleme fonksiyonu
const processTestResults = (raporData: any) => {
  let testler: TestSonucu[] = [];
  
  if (raporData.test_sonuclari && Array.isArray(raporData.test_sonuclari)) {
    testler = raporData.test_sonuclari.map((test: any) => ({
      nokta_adi: test.nokta_adi || test.numune_yeri || 'Giriş',
      test_adi: test.test_adi || test.testler || 'Bilinmiyor',
      test_sonucu_metin: test.test_sonucu_metin || test.test_sonucu || test.bulgu || '',
      test_birimi: test.test_birimi || test.birim || '',
      limit_deger: test.limit_deger || '',
      test_metodu: test.test_metodu || test.metot || '',
      durum: test.durum || 'uygun',
      artemis_numune_no: test.artemis_numune_no || ''
    }));
  }
  
  // Eğer test_sonuclari boşsa rapor_metni'nden almaya çalış
  if (testler.length === 0 && raporData.rapor_metni) {
    try {
      const raporMetni = typeof raporData.rapor_metni === 'string' ? 
        JSON.parse(raporData.rapor_metni) : raporData.rapor_metni;
      
      if (raporMetni.test_sonuclari && Array.isArray(raporMetni.test_sonuclari)) {
        testler = raporMetni.test_sonuclari.map((test: any) => ({
          nokta_adi: test.nokta_adi || test.numune_yeri || 'Giriş',
          test_adi: test.test_adi || test.testler || 'Bilinmiyor',
          test_sonucu_metin: test.test_sonucu_metin || test.bulgu || '',
          test_birimi: test.test_birimi || test.birim || '',
          limit_deger: test.limit_deger || '',
          test_metodu: test.test_metodu || test.metot || '',
          durum: test.durum || 'uygun'
        }));
      }
    } catch (parseError) {
      console.log('⚠️ rapor_metni parse hatası:', parseError);
    }
  }
  
  setTestSonuclari(testler);
  console.log(`📊 ${testler.length} test sonucu yüklendi`);
};

const handleEditRapor = async () => {
  if (!rapor) return;
  
  const networkState = await NetInfo.fetch();
  
  if (!networkState.isConnected) {
    Alert.alert(
      'Offline Mod',
      'Rapor düzenleme online modda yapılabilir.'
    );
    return;
  }
  
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
  if (rapor.durum === 'revizyon_gerekli') {
    router.push({
      pathname: '/lab-rapor-olustur',
      params: { 
        qr_kod: rapor.qr_kod,
        rapor_id: rapor.id.toString()
      }
    });
  } else {
    Alert.alert('Bilgi', 'Bu rapor düzenlenemez.');
  }
};

 const getDurumColor = (durum: string) => {
   switch (durum) {
     case 'taslak':
       return '#6B7280';
     case 'onay_bekliyor':
       return '#F59E0B';
     case 'onaylandi':
       return '#10B981';
     case 'reddedildi':
       return '#EF4444';
     case 'revizyon_gerekli':
       return '#F97316';
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

 const getTestDurumColor = (durum: string) => {
   switch (durum) {
     case 'uygun':
       return '#10B981';
     case 'uygun_degil':
       return '#EF4444';
     default:
       return '#6B7280';
   }
 };

 const formatDate = (dateString: string) => {
   if (!dateString) return 'Belirtilmemiş';
   try {
     return new Date(dateString).toLocaleDateString('tr-TR');
   } catch {
     return dateString;
   }
 };



 const renderInfoRow = (label: string, value: string | number, valueColor?: string) => (
   <View style={styles.infoRow}>
     <Text style={styles.infoLabel}>{label}:</Text>
     <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>
       {value || 'Belirtilmemiş'}
     </Text>
   </View>
 );

 const renderTestTable = () => {
   if (testSonuclari.length === 0) {
     return (
       <View style={styles.noTestContainer}>
         <MaterialCommunityIcons name="flask-empty" size={48} color="#94A3B8" />
         <Text style={styles.noTestText}>Test sonucu bulunamadı</Text>
       </View>
     );
   }

   return (
     <View style={styles.tableContainer}>
       {/* Tablo Başlık */}
       <View style={styles.tableHeader}>
         <Text style={[styles.tableHeaderText, styles.col1]}>Test Adı</Text>
         <Text style={[styles.tableHeaderText, styles.col2]}>Birim</Text>
         <Text style={[styles.tableHeaderText, styles.col3]}>Bulgu</Text>
         <Text style={[styles.tableHeaderText, styles.col4]}>Limit</Text>
         <Text style={[styles.tableHeaderText, styles.col5]}>Durum</Text>
       </View>

       {/* Test Satırları */}
       {testSonuclari.map((test, index) => (
         <View key={index} style={styles.tableRow}>
           <View style={[styles.tableCell, styles.col1]}>
             <Text style={styles.tableCellText} numberOfLines={2}>
               {test.test_adi}
             </Text>
             {test.nokta_adi !== 'Giriş' && (
               <Text style={styles.noktaText}>({test.nokta_adi})</Text>
             )}
           </View>
           
           <View style={[styles.tableCell, styles.col2]}>
             <Text style={styles.tableCellText}>
               {test.test_birimi}
             </Text>
           </View>
           
           <View style={[styles.tableCell, styles.col3]}>
             <Text style={[styles.tableCellText, styles.bulgaText]}>
               {test.test_sonucu_metin}
             </Text>
           </View>
           
           <View style={[styles.tableCell, styles.col4]}>
             <Text style={styles.tableCellText}>
               {test.limit_deger}
             </Text>
           </View>
           
           <View style={[styles.tableCell, styles.col5]}>
             <View style={[
               styles.durumBadge,
               { backgroundColor: getTestDurumColor(test.durum) }
             ]}>
               <Text style={styles.durumBadgeText}>
                 {test.durum === 'uygun' ? '✓' : '✗'}
               </Text>
             </View>
           </View>
         </View>
       ))}

       {/* Metot Bilgisi */}
       <View style={styles.metodContainer}>
         <Text style={styles.metodTitle}>Kullanılan Metotlar:</Text>
         {Array.from(new Set(testSonuclari.map(t => t.test_metodu).filter(Boolean))).map((metot, index) => (
           <Text key={index} style={styles.metodText}>• {metot}</Text>
         ))}
       </View>
     </View>
   );
 };

 if (loading) {
   return (
     <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
       <ActivityIndicator size="large" color="#1E3A8A" />
       <Text style={styles.loadingText}>Rapor detayları yükleniyor...</Text>
     </View>
   );
 }

 if (!rapor) {
   return (
     <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
       <MaterialCommunityIcons name="file-remove" size={80} color="#EF4444" />
       <Text style={styles.errorText}>Rapor bulunamadı</Text>
       <TouchableOpacity style={styles.backToListButton} onPress={() => router.back()}>
         <Text style={styles.backToListText}>Listeye Dön</Text>
       </TouchableOpacity>
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
       <View style={styles.headerContent}>
         <Text style={styles.headerTitle}>Rapor Detayı</Text>
         <Text style={styles.headerSubtitle}>{rapor.rapor_no}</Text>
       </View>
       {rapor.durum === 'revizyon_gerekli' && (
         <TouchableOpacity 
           style={styles.editButton}
           onPress={handleEditRapor}
         >
           <Ionicons name="create-outline" size={24} color="white" />
         </TouchableOpacity>
       )}
     </LinearGradient>

     <ScrollView 
       style={styles.content} 
       showsVerticalScrollIndicator={false}
       contentContainerStyle={{ paddingBottom: 30 }}
     >
       {/* Rapor Durumu */}
       <View style={styles.statusCard}>
         <View style={[
           styles.statusBadge,
           { backgroundColor: getDurumColor(rapor.durum) }
         ]}>
           <MaterialCommunityIcons 
             name={
               rapor.durum === 'onaylandi' ? 'check-circle' :
               rapor.durum === 'reddedildi' ? 'close-circle' :
               rapor.durum === 'onay_bekliyor' ? 'clock' : 'file-edit'
             } 
             size={24} 
             color="white" 
           />
           <Text style={styles.statusText}>{getDurumText(rapor.durum)}</Text>
         </View>
       </View>

       {/* Temel Bilgiler */}
       <View style={styles.card}>
         <View style={styles.cardHeader}>
           <MaterialCommunityIcons name="information" size={24} color="#1E3A8A" />
           <Text style={styles.cardTitle}>Rapor Bilgileri</Text>
         </View>
         
         {renderInfoRow('Rapor No', rapor.rapor_no)}
         {renderInfoRow('Rapor Adı', rapor.rapor_adi || 'Belirtilmemiş')}
         {renderInfoRow('QR Kod', rapor.qr_kod)}
         {renderInfoRow('Firma', rapor.firma_adi || rapor.company_name || 'Bilinmiyor')}
         {renderInfoRow('Numune Cinsi', rapor.numune_cinsi || 'Belirtilmemiş')}
         {renderInfoRow('Hazırlanma Tarihi', formatDate(rapor.hazirlanma_tarihi))}
         
         {rapor.hazirlayan_ad && (
           renderInfoRow('Hazırlayan', `${rapor.hazirlayan_ad} ${rapor.hazirlayan_soyad || ''}`)
         )}
         
         {rapor.analiz_baslama_tarihi && (
           renderInfoRow('Analiz Başlama', formatDate(rapor.analiz_baslama_tarihi))
         )}
         
         {rapor.analiz_bitis_tarihi && (
           renderInfoRow('Analiz Bitiş', formatDate(rapor.analiz_bitis_tarihi))
         )}
         
         {rapor.onay_tarihi && (
           renderInfoRow('Onay Tarihi', formatDate(rapor.onay_tarihi))
         )}
       </View>

       {/* Test İstatistikleri */}
       <View style={styles.card}>
         <View style={styles.cardHeader}>
           <MaterialCommunityIcons name="chart-bar" size={24} color="#1E3A8A" />
           <Text style={styles.cardTitle}>Test İstatistikleri</Text>
         </View>
         
         <View style={styles.statsContainer}>
           <View style={styles.statBox}>
             <Text style={[styles.statNumber, { color: '#1E3A8A' }]}>
               {rapor.toplam_test_sayisi}
             </Text>
             <Text style={styles.statLabel}>Toplam Test</Text>
           </View>
         </View>
       </View>

       {/* Test Sonuçları */}
       <View style={styles.card}>
         <View style={styles.cardHeader}>
           <MaterialCommunityIcons name="table" size={24} color="#1E3A8A" />
           <Text style={styles.cardTitle}>Test Sonuçları</Text>
         </View>
         
         {renderTestTable()}
       </View>


       {/* Red Nedeni */}
       {rapor.red_nedeni && (
         <View style={styles.rejectionCard}>
           <View style={styles.cardHeader}>
             <MaterialCommunityIcons name="alert-circle" size={24} color="#EF4444" />
             <Text style={[styles.cardTitle, { color: '#EF4444' }]}>Red Nedeni</Text>
           </View>
           <Text style={styles.rejectionText}>{rapor.red_nedeni}</Text>
         </View>
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
 headerContent: {
   flex: 1,
 },
 headerTitle: {
   color: 'white',
   fontSize: 20,
   fontWeight: 'bold',
 },
 headerSubtitle: {
   color: 'rgba(255, 255, 255, 0.8)',
   fontSize: 14,
   marginTop: 2,
 },
 editButton: {
   width: 40,
   height: 40,
   borderRadius: 20,
   backgroundColor: 'rgba(255, 255, 255, 0.2)',
   justifyContent: 'center',
   alignItems: 'center',
 },
 content: {
   flex: 1,
   padding: 16,
 },
 loadingText: {
   marginTop: 10,
   fontSize: 16,
   color: '#64748B',
 },
 errorText: {
   fontSize: 18,
   color: '#EF4444',
   textAlign: 'center',
   marginTop: 10,
 },
 backToListButton: {
   marginTop: 20,
   backgroundColor: '#1E3A8A',
   paddingHorizontal: 20,
   paddingVertical: 10,
   borderRadius: 8,
 },
 backToListText: {
   color: 'white',
   fontSize: 16,
   fontWeight: '600',
 },
 statusCard: {
   alignItems: 'center',
   marginBottom: 16,
 },
 statusBadge: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 20,
   paddingVertical: 10,
   borderRadius: 25,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 2 },
   shadowOpacity: 0.1,
   shadowRadius: 4,
   elevation: 3,
 },
 statusText: {
   color: 'white',
   fontSize: 16,
   fontWeight: 'bold',
   marginLeft: 8,
 },
 card: {
   backgroundColor: 'white',
   borderRadius: 16,
   padding: 20,
   marginBottom: 16,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 2 },
   shadowOpacity: 0.1,
   shadowRadius: 8,
   elevation: 3,
 },
 cardHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: 15,
   paddingBottom: 10,
   borderBottomWidth: 1,
   borderBottomColor: '#E2E8F0',
 },
 cardTitle: {
   fontSize: 18,
   fontWeight: 'bold',
   color: '#1E3A8A',
   marginLeft: 8,
 },
 infoRow: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 12,
   paddingVertical: 4,
 },
 infoLabel: {
   fontSize: 14,
   color: '#64748B',
   fontWeight: '500',
   flex: 1,
 },
 infoValue: {
   fontSize: 14,
   color: '#0F172A',
   fontWeight: '600',
   flex: 2,
   textAlign: 'right',
 },
 statsContainer: {
   flexDirection: 'row',
   justifyContent: 'space-around',
 },
 statBox: {
   alignItems: 'center',
   flex: 1,
 },
 statNumber: {
   fontSize: 24,
   fontWeight: 'bold',
 },
 statLabel: {
   fontSize: 12,
   color: '#64748B',
   marginTop: 4,
   textAlign: 'center',
 },
 tableContainer: {
   marginTop: 8,
 },
 tableHeader: {
   flexDirection: 'row',
   backgroundColor: '#F8FAFC',
   paddingVertical: 12,
   paddingHorizontal: 8,
   borderRadius: 8,
   marginBottom: 4,
 },
 tableHeaderText: {
   fontSize: 12,
   fontWeight: 'bold',
   color: '#374151',
   textAlign: 'center',
 },
 tableRow: {
   flexDirection: 'row',
   paddingVertical: 8,
   paddingHorizontal: 4,
   borderBottomWidth: 1,
   borderBottomColor: '#F1F5F9',
 },
 tableCell: {
   justifyContent: 'center',
   paddingHorizontal: 4,
 },
 tableCellText: {
   fontSize: 11,
   color: '#374151',
   textAlign: 'center',
 },
 bulgaText: {
   fontWeight: '600',
   color: '#1E3A8A',
 },
 noktaText: {
   fontSize: 9,
   color: '#94A3B8',
   textAlign: 'center',
   marginTop: 2,
 },
 durumBadge: {
   paddingVertical: 4,
   paddingHorizontal: 8,
   borderRadius: 12,
   alignItems: 'center',
   justifyContent: 'center',
 },
 durumBadgeText: {
   color: 'white',
   fontSize: 12,
   fontWeight: 'bold',
 },
 col1: { flex: 2 }, // Test Adı
 col2: { flex: 1 }, // Birim
 col3: { flex: 1 }, // Bulgu
 col4: { flex: 1 }, // Limit
 col5: { flex: 1 }, // Durum
 noTestContainer: {
   alignItems: 'center',
   paddingVertical: 40,
 },
 noTestText: {
   fontSize: 16,
   color: '#94A3B8',
   marginTop: 10,
 },
 metodContainer: {
   marginTop: 16,
   paddingTop: 16,
   borderTopWidth: 1,
   borderTopColor: '#E2E8F0',
 },
 metodTitle: {
   fontSize: 14,
   fontWeight: 'bold',
   color: '#374151',
   marginBottom: 8,
 },
 metodText: {
   fontSize: 12,
   color: '#64748B',
   marginBottom: 4,
 },
 evaluationText: {
   fontSize: 14,
   color: '#374151',
   lineHeight: 20,
   textAlign: 'justify',
 },
 rejectionCard: {
   backgroundColor: '#FEF2F2',
   borderRadius: 16,
   padding: 20,
   marginBottom: 16,
   borderLeftWidth: 4,
   borderLeftColor: '#EF4444',
 },
 rejectionText: {
   fontSize: 14,
   color: '#7F1D1D',
   lineHeight: 20,
   textAlign: 'justify',
 },
});