// app/talep-detay/[id].tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
  Linking, 
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../../utils/enterpriseApi';
import EnterpriseTokenManager from '../../utils/enterpriseTokenManager';

const { width, height } = Dimensions.get('window');

// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

type TalepDetay = {
  id: number;
  seri_no: string;
  tarih: string;
  aciklamalar: string;
  company_name: string;
  email: string;
  phone_number: string;
  address: string;
  olusturma_tarihi: string;
  durum?: string; // 'bekliyor' veya 'cevaplandi'
  teknisyen_cevap?: string;
  cevap_tarihi?: string;
  media_urls?: string;
  
};

export default function TalepDetay() {
  const { id } = useLocalSearchParams();
  const [talepDetay, setTalepDetay] = useState<TalepDetay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchTalepDetay();
  }, [id]);

  const fetchTalepDetay = async () => {
    try {
      console.log('🔍 Talep detayı alınıyor - ID:', id);
      
      // ✅ Enterprise token kontrolü
      const hasEnterpriseToken = await EnterpriseTokenManager.hasValidToken();
      console.log('🔐 Enterprise token var mı?', hasEnterpriseToken);
      
      // ✅ Fallback: Legacy token kontrolü
      if (!hasEnterpriseToken) {
        const legacyToken = await AsyncStorage.getItem('userToken');
        if (!legacyToken) {
          console.log('❌ Hiç token yok, giriş sayfasına yönlendiriliyor');
          return router.replace('/uye-giris');
        }
        console.log('⚠️ Legacy token kullanılıyor');
      }
      
      // ✅ API çağrısı - enterpriseApi otomatik token ekleyecek
      console.log('📤 API isteği gönderiliyor...');
      const response = await api.get(`/api/talep-detay/${id}`);
      
      console.log('✅ Talep detayı alındı:', response.data?.seri_no);
      setTalepDetay(response.data);
      
    } catch (err) {
      console.error('❌ Talep detayı yüklenirken hata:', err);
      console.error('❌ API Error Status:', err.response?.status);
      console.error('❌ API Error Data:', err.response?.data);
      
      // 401 hatası durumunda giriş sayfasına yönlendir
      if (err.response?.status === 401) {
        Alert.alert(
          'Oturum Süresi Doldu',
          'Lütfen tekrar giriş yapın.',
          [
            {
              text: 'Tamam',
              onPress: () => router.replace('/uye-giris')
            }
          ]
        );
      } else {
        setError('Talep detayı yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };



  if (loading) {
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
            <Text style={styles.headerTitle}>Talep Detayı</Text>
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
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0088cc" />
        </View>
      </View>
    );
  }

  if (error || !talepDetay) {
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
            <Text style={styles.headerTitle}>Talep Detayı</Text>
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
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={50} color="#e74c3c" />
          <Text style={styles.errorText}>{error || 'Talep bilgisi bulunamadı'}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchTalepDetay}
          >
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Talep Detayı</Text>
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

      <ScrollView style={styles.container}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>Talep Bilgileri</Text>
              <Text style={styles.cardSubtitle}>{talepDetay.seri_no}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              { 
                backgroundColor: 
                  talepDetay.durum === 'cevaplandi' 
                    ? '#27ae60'  // Yeşil 
                    : '#f39c12'  // Turuncu 
              }
            ]}>
              <Text style={styles.statusText}>
                {talepDetay.durum === 'cevaplandi' ? 'Cevaplandı' : 'Bekliyor'}
              </Text>
            </View>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Firma Adı:</Text>
              <Text style={styles.detailValue}>{talepDetay.company_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>E-posta:</Text>
              <Text style={styles.detailValue}>{talepDetay.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Telefon:</Text>
              <Text style={styles.detailValue}>{talepDetay.phone_number}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Adres:</Text>
              <Text style={styles.detailValue}>{talepDetay.address}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Talep Tarihi:</Text>
              <Text style={styles.detailValue}>{formatDate(talepDetay.tarih)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.descriptionHeader}>
            <Ionicons name="document-text-outline" size={20} color="#34495e" />
            <Text style={styles.descriptionLabel}>Talebiniz:</Text>
          </View>
          <Text style={styles.descriptionText}>{talepDetay.aciklamalar || 'Açıklama bulunmamaktadır.'}</Text>

           {/* Medya Dosyaları - Eklediğimiz kısım */}
           {talepDetay.media_urls && JSON.parse(talepDetay.media_urls).length > 0 && (
            <View style={styles.mediaContainer}>
              <View style={styles.messageHeader}>
                <Ionicons name="images-outline" size={20} color="#34495e" />
                <Text style={styles.messageHeaderText}>Eklenen Medyalar</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
                {talepDetay.media_urls && JSON.parse(talepDetay.media_urls).map((url: string, index: number) => {
                  // URL'nin bir video olup olmadığını kontrol et
                  const isVideo = url.toLowerCase().endsWith('.mp4') || 
                                  url.toLowerCase().endsWith('.mov') || 
                                  url.toLowerCase().includes('video');
                  
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.mediaItem}
                      onPress={() => Linking.openURL(url)}
                    >
                      {isVideo ? (
                        <View style={styles.videoPreview}>
                          <View style={styles.videoPlayOverlay}>
                            <Ionicons name="play-circle" size={30} color="#007BFF" />
                          </View>
                          <Text style={styles.videoLabel}>Video</Text>
                        </View>
                      ) : (
                        <Image 
                          source={{ uri: url }} 
                          style={styles.mediaImage} 
                          resizeMode="cover"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}     

          {talepDetay.durum === 'cevaplandi' && talepDetay.teknisyen_cevap && (
            <>
              <View style={styles.responseContainer}>
                <Ionicons name="mail-outline" size={20} color="#34495e" />
                <Text style={styles.responseLabel}>Artemis Arıtım Cevabı:</Text>
              </View>
              <View style={styles.responseContent}>
                <Text style={styles.responseText}>{talepDetay.teknisyen_cevap}</Text>
                {talepDetay.cevap_tarihi && (
                  <Text style={styles.responseDateText}>
                    {formatDate(talepDetay.cevap_tarihi)}
                  </Text>
                )}
              </View>
            </>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + 45,
    paddingBottom: height * 0.02,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 5,
  },
  container: {
    flex: 1,
    padding: 15,
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
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  statusBadge: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsContainer: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  detailLabel: {
    width: 130,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#34495e',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 15,
  },
  descriptionContainer: {
    marginBottom: 10,
    marginTop: 0,
  },
  descriptionText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
  },
  responseContainer: {
    marginTop: 15,
    flexDirection: 'row',  // Yatay düzenleme için
    alignItems: 'center',  // Dikey olarak hizalama
    marginBottom: 10,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#34495e',
    marginLeft: 10, 
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#34495e',
    marginLeft: 10,
  },
  responseContent: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 10,
  },
  responseText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
  },
  responseDateText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
    textAlign: 'right'
  },
  mediaContainer: {
    marginVertical: 15,
  },
  mediaItem: {
    width: 120,
    height: 120,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  messageHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34495e',
    marginLeft: 10,
  },
  messageContent: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 10,
  },
  mediaScroll: {
    marginTop: 10,
  },
  videoPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e6f7ff',
  },
  videoPlayOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    fontSize: 12,
    color: '#007BFF',
    marginTop: 5,
    fontWeight: 'bold',
  },
});