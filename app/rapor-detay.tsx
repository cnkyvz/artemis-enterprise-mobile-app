// app/rapor-detay.tsx
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
  Dimensions,
  Share,
  Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from '../utils/enterpriseApi';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface RaporDetay {
  id: number;
  rapor_no: string;
  rapor_adi: string;
  qr_kod: string;
  firma_adi: string;
  alinan_yer: string;
  numune_alis_tarihi: string;
  analiz_baslama_tarihi: string;
  analiz_bitis_tarihi: string;
  durum: string;
  hazirlayan_ad: string;
  hazirlayan_soyad: string;
  onay_tarihi?: string;
  toplam_test_sayisi: number;
  uygun_test_sayisi: number;
  uygun_olmayan_test_sayisi: number;
  genel_degerlendirme: string;
  oneriler?: string;
  rapor_pdf_url?: string;
  test_sonuclari?: TestSonuc[];
}

interface TestSonuc {
  id: number;
  nokta_adi: string;
  test_adi: string;
  test_sonucu: number;
  test_sonucu_metin: string;
  test_birimi: string;
  durum: string;
  artemis_numune_no: string;
  limit_deger?: string;
}

export default function RaporDetay() {
  const router = useRouter();
  const { qr_kod, rapor_no, rapor_id } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [rapor, setRapor] = useState<RaporDetay | null>(null);

  useEffect(() => {
    loadRaporDetay();
  }, []);

  const loadRaporDetay = async () => {
    try {
      setLoading(true);
      
      let response;
      if (rapor_id) {
        // Rapor ID ile çek
        response = await api.get(`/api/rapor-detay/${rapor_id}`);
      } else if (qr_kod) {
        // QR kod ile rapor bul
        const numuneResponse = await api.get(`/api/numune-sorgula/${qr_kod}`);
        if (numuneResponse.data && numuneResponse.data.rapor_id) {
          response = await api.get(`/api/rapor-detay/${numuneResponse.data.rapor_id}`);
        } else {
          throw new Error('Bu numune için henüz rapor hazırlanmamış');
        }
      } else {
        throw new Error('Rapor bilgisi bulunamadı');
      }

      if (response.data) {
        setRapor(response.data);
        console.log('✅ Rapor detayı yüklendi:', response.data.rapor_no);
      }
      
    } catch (error) {
      console.error('❌ Rapor detay yükleme hatası:', error);
      Alert.alert(
        'Hata',
        error.response?.data?.error || error.message || 'Rapor detayı yüklenemedi'
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!rapor?.rapor_pdf_url) {
      Alert.alert('Hata', 'PDF dosyası bulunamadı');
      return;
    }

    try {
      setDownloading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // PDF URL'sini kontrol et
      const pdfUrl = rapor.rapor_pdf_url;
      const fileName = `${rapor.rapor_no}.pdf`;
      
      // Dosyayı indirme
      const downloadResult = await FileSystem.downloadAsync(
        pdfUrl,
        FileSystem.documentDirectory + fileName
      );

      if (downloadResult.status === 200) {
        // Paylaşım menüsünü aç
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Raporu Paylaş'
        });
        
        Alert.alert('Başarılı', 'Rapor başarıyla indirildi');
      } else {
        throw new Error('İndirme başarısız');
      }

    } catch (error) {
      console.error('❌ PDF indirme hatası:', error);
      
      // Alternatif olarak tarayıcıda aç
      Alert.alert(
        'İndirme Hatası',
        'PDF indirilemedi. Tarayıcıda açmak ister misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Tarayıcıda Aç', 
            onPress: () => Linking.openURL(rapor.rapor_pdf_url!)
          }
        ]
      );
    } finally {
      setDownloading(false);
    }
  };

  const shareReport = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const shareContent = {
        message: `${rapor?.rapor_adi}\n\nRapor No: ${rapor?.rapor_no}\nFirma: ${rapor?.firma_adi}\nDurum: ${getDurumText(rapor?.durum)}\n\nArtemis Arıtım Sistemi`,
        title: `Lab Raporu: ${rapor?.rapor_no}`
      };

      await Share.share(shareContent);
    } catch (error) {
      console.error('Paylaşım hatası:', error);
    }
  };

  const getDurumColor = (durum?: string) => {
    switch (durum) {
      case 'onaylandi':
        return '#10B981';
      case 'onay_bekliyor':
        return '#F59E0B';
      case 'reddedildi':
        return '#EF4444';
      case 'revizyon_gerekli':
        return '#F97316';
      default:
        return '#6B7280';
    }
  };

  const getDurumText = (durum?: string) => {
    switch (durum) {
      case 'onaylandi':
        return 'Onaylandı';
      case 'onay_bekliyor':
        return 'Onay Bekliyor';
      case 'reddedildi':
        return 'Reddedildi';
      case 'revizyon_gerekli':
        return 'Revizyon Gerekli';
      default:
        return 'Bilinmeyen';
    }
  };

  const getSuccessRate = () => {
    if (!rapor || rapor.toplam_test_sayisi === 0) return 0;
    return Math.round((rapor.uygun_test_sayisi / rapor.toplam_test_sayisi) * 100);
  };

  // Test sonuçlarını nokta bazında grupla
  const groupedTests = rapor?.test_sonuclari?.reduce((groups, test) => {
    const nokta = test.nokta_adi;
    if (!groups[nokta]) {
      groups[nokta] = [];
    }
    groups[nokta].push(test);
    return groups;
  }, {} as Record<string, TestSonuc[]>) || {};

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Rapor yükleniyor...</Text>
      </View>
    );
  }

  if (!rapor) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="file-document-outline" size={80} color="#94A3B8" />
        <Text style={styles.errorTitle}>Rapor Bulunamadı</Text>
        <Text style={styles.errorSubtitle}>İstenen rapor bulunamadı veya erişim izniniz yok</Text>
        <TouchableOpacity style={styles.backToListButton} onPress={() => router.back()}>
          <Text style={styles.backToListText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const successRate = getSuccessRate();

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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Rapor Detayı</Text>
          <Text style={styles.headerSubtitle}>{rapor.rapor_no}</Text>
        </View>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={shareReport}
        >
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Rapor Durum Kartı */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getDurumColor(rapor.durum) }
            ]}>
              <Ionicons 
                name={rapor.durum === 'onaylandi' ? 'checkmark-circle' : 'time'} 
                size={16} 
                color="white" 
              />
              <Text style={styles.statusText}>{getDurumText(rapor.durum)}</Text>
            </View>
            
            <View style={styles.successRateContainer}>
              <Text style={styles.successRateNumber}>%{successRate}</Text>
              <Text style={styles.successRateLabel}>Başarı Oranı</Text>
            </View>
          </View>
        </View>

        {/* Rapor Bilgileri */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="file-document" size={24} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Rapor Bilgileri</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rapor Adı:</Text>
            <Text style={styles.infoValue}>{rapor.rapor_adi}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>QR Kod:</Text>
            <Text style={styles.infoValue}>{rapor.qr_kod}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Firma:</Text>
            <Text style={styles.infoValue}>{rapor.firma_adi}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alınan Yer:</Text>
            <Text style={styles.infoValue}>{rapor.alinan_yer}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hazırlayan:</Text>
            <Text style={styles.infoValue}>
              {rapor.hazirlayan_ad} {rapor.hazirlayan_soyad}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Analiz Tarihi:</Text>
            <Text style={styles.infoValue}>
              {rapor.analiz_baslama_tarihi ? 
                new Date(rapor.analiz_baslama_tarihi).toLocaleDateString('tr-TR') : 
                'Belirtilmemiş'
              }
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
        </View>

        {/* Test İstatistikleri */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="chart-pie" size={24} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Test İstatistikleri</Text>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{rapor.toplam_test_sayisi}</Text>
              <Text style={styles.statLabel}>Toplam Test</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>
                {rapor.uygun_test_sayisi}
              </Text>
              <Text style={styles.statLabel}>Uygun</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#EF4444' }]}>
                {rapor.uygun_olmayan_test_sayisi}
              </Text>
              <Text style={styles.statLabel}>Uygun Değil</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
                %{successRate}
              </Text>
              <Text style={styles.statLabel}>Başarı</Text>
            </View>
          </View>
        </View>

        {/* Test Sonuçları */}
        {Object.keys(groupedTests).length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="test-tube" size={24} color="#1E3A8A" />
              <Text style={styles.cardTitle}>Test Sonuçları</Text>
            </View>
            
            {Object.keys(groupedTests).map((nokta, index) => (
              <View key={index} style={styles.testGroup}>
                <Text style={styles.testGroupTitle}>{nokta}</Text>
                {groupedTests[nokta].map((test, testIndex) => (
                  <View key={testIndex} style={styles.testRow}>
                    <View style={styles.testInfo}>
                      <Text style={styles.testName}>{test.test_adi}</Text>
                      <Text style={styles.testSample}>
                        Numune: {test.artemis_numune_no}
                      </Text>
                    </View>
                    <View style={styles.testResultContainer}>
                      <Text style={styles.testResult}>
                        {test.test_sonucu_metin || test.test_sonucu} {test.test_birimi}
                      </Text>
                      <View style={[
                        styles.testStatusBadge,
                        { backgroundColor: test.durum === 'uygun' ? '#10B981' : '#EF4444' }
                      ]}>
                        <Text style={styles.testStatusText}>
                          {test.durum === 'uygun' ? '✓' : '✗'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Değerlendirme */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="clipboard-text" size={24} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Genel Değerlendirme</Text>
          </View>
          
          <Text style={styles.evaluationText}>{rapor.genel_degerlendirme}</Text>
          
          {rapor.oneriler && (
            <>
              <Text style={styles.suggestionsTitle}>Öneriler:</Text>
              <Text style={styles.evaluationText}>{rapor.oneriler}</Text>
            </>
          )}
        </View>

        {/* PDF İndirme */}
        {rapor.rapor_pdf_url && (
          <TouchableOpacity 
            style={[styles.downloadButton, downloading && styles.disabledButton]}
            onPress={downloadPDF}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons name="download" size={24} color="white" />
            )}
            <Text style={styles.downloadButtonText}>
              {downloading ? 'İndiriliyor...' : 'PDF Raporu İndir'}
            </Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.bottomSpace} />
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
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
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
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  successRateContainer: {
    alignItems: 'center',
  },
  successRateNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  successRateLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
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
    marginBottom: 8,
    flexWrap: 'wrap',
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
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  testGroup: {
    marginBottom: 16,
  },
  testGroupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  testRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 6,
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  testSample: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  testResultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testResult: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    marginRight: 8,
  },
  testStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  evaluationText: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginTop: 16,
    marginBottom: 8,
  },
  downloadButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 20,
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748B',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  backToListButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backToListText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpace: {
    height: 30,
  },
});