//app/teknisyen-talep-detay/[id].tsx
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
  TextInput,
  Linking,
  Image 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../../utils/enterpriseApi';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
  durum: string;
  teknisyen_cevap?: string;
  cevap_tarihi?: string;
  media_urls?: string;
};

export default function TeknisyenTalepDetay() {
  const { id } = useLocalSearchParams();
  console.log('Parametre olarak gelen ID:', id);
  const [talepDetay, setTalepDetay] = useState<TalepDetay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cevap, setCevap] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const [showQuickReplies, setShowQuickReplies] = useState(false);

// Kısayol cevaplar
const quickReplies = [
  "Talebiniz değerlendiriliyor. En kısa sürede dönüş yapacağız.",
  "Teknik ekibimiz konuyla ilgili size ulaşacak.",
  "Randevu için lütfen bizimle iletişime geçin.",
  "Arıza bildiriminiz alındı. Hemen müdahale edilecek.",
  "Bakım talebiniz programa alındı.",
  "Ek bilgi için size telefon ile ulaşacağız.",
  "Talebiniz tamamlandı. Teşekkür ederiz.",
  "Konu ile ilgili detaylı inceleme yapıp geri dönüş yapacağız."
];

const selectQuickReply = (reply: string) => {
  setCevap(reply);
  setShowQuickReplies(false);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

  useEffect(() => {
    fetchTalepDetay();
  }, [id]);

  const fetchTalepDetay = async () => {
    try {
      console.log('🔍 Teknisyen talep detayı alınıyor - ID:', id);
      
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
      const response = await api.get(`/api/teknisyen-talep-detay/${id}`);
      
      console.log('✅ Teknisyen talep detayı alındı:', response.data?.seri_no);
      setTalepDetay(response.data);
      if (response.data.teknisyen_cevap) {
        setCevap(response.data.teknisyen_cevap);
      }
      setLoading(false);
      
    } catch (err) {
      console.error('❌ Teknisyen talep detayı yüklenirken hata:', err);
      console.error('❌ API Error Status:', err.response?.status);
      console.error('❌ API Error Data:', err.response?.data);
      
      // ✅ 401 hatası durumunda giriş sayfasına yönlendir
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
      setLoading(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!cevap.trim()) {
      Alert.alert('Hata', 'Lütfen bir cevap yazın');
      return;
    }
    
    setSubmitting(true);
    
    try {
      console.log('📤 Teknisyen cevabı gönderiliyor...');
      
      const response = await api.post(`/api/talep-cevapla/${id}`, {
        teknisyen_cevap: cevap
      });
      
      console.log('✅ Cevap başarıyla gönderildi');
      
      if (response.data && talepDetay) {
        setTalepDetay({
          ...talepDetay,
          durum: 'cevaplandi',
          teknisyen_cevap: cevap,
          cevap_tarihi: new Date().toISOString()
        });
        
        Alert.alert(
          'Başarılı', 
          'Cevabınız firmaya iletildi.', 
          [{
            text: 'Tamam', 
            onPress: () => router.replace('/teknisyen-panel')
          }]
        );
      }
      
      setSubmitting(false);
    } catch (err) {
      console.error('❌ Cevap gönderilirken hata:', err);
      console.error('❌ API Error Status:', err.response?.status);
      
      // ✅ 401 hatası kontrolü
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
        Alert.alert('Hata', 'Cevap gönderilemedi');
      }
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  // Loading state
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
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Talep Detayı</Text>
            
            <View style={{width: 40}} />
          </View>
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0088cc" />
        </View>
      </View>
    );
  }

  // Error state
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
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Talep Detayı</Text>
            
            <View style={{width: 40}} />
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

  // Main content
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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Talep Detayı</Text>
          
          <View style={{width: 40}} />
        </View>
      </LinearGradient>

      <KeyboardAwareScrollView 
        style={styles.container}
        enableOnAndroid={true}
        extraScrollHeight={100}
        keyboardShouldPersistTaps="handled"
        resetScrollToCoords={{ x: 0, y: 0 }}
        enableAutomaticScroll={true}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>Firma Talebi</Text>
              <Text style={styles.cardSubtitle}>{talepDetay.seri_no}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: talepDetay.durum === 'cevaplandi' ? '#27ae60' : '#f39c12' }
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

          <View style={styles.messageContainer}>
            <View style={styles.messageHeader}>
              <Ionicons name="mail-outline" size={20} color="#34495e" />
              <Text style={styles.messageHeaderText}>Firma Mesajı</Text>
            </View>
            <View style={styles.messageContent}>
              <Text style={styles.messageText}>{talepDetay.aciklamalar}</Text>
            </View>
          </View>

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
              <View style={styles.divider} />
              <View style={styles.messageContainer}>
                <View style={styles.messageHeader}>
                  <Ionicons name="send-outline" size={20} color="#27ae60" />
                  <Text style={[styles.messageHeaderText, {color: '#27ae60'}]}>Cevabınız</Text>
                </View>
                <View style={[styles.messageContent, styles.responseContent]}>
                  <Text style={styles.messageText}>{talepDetay.teknisyen_cevap}</Text>
                  {talepDetay.cevap_tarihi && (
                    <Text style={styles.responseDateText}>
                      {formatDate(talepDetay.cevap_tarihi)}
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}

          {talepDetay.durum !== 'cevaplandi' && (
            <>
              <View style={styles.divider} />
              <View style={styles.responseFormContainer}>
                <View style={styles.responseFormHeader}>
                  <Text style={styles.responseFormLabel}>Cevabınız:</Text>
                  <TouchableOpacity 
                    style={styles.quickReplyToggle}
                    onPress={() => {
                      setShowQuickReplies(!showQuickReplies);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons 
                      name={showQuickReplies ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#3498db" 
                    />
                    <Text style={styles.quickReplyToggleText}>Hızlı Cevaplar</Text>
                  </TouchableOpacity>
                </View>

                {showQuickReplies && (
                  <View style={styles.quickRepliesContainer}>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.quickRepliesScroll}
                    >
                      {quickReplies.map((reply, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.quickReplyButton}
                          onPress={() => selectQuickReply(reply)}
                        >
                          <Text style={styles.quickReplyText}>{reply}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TextInput
                  style={styles.responseInput}
                  placeholder="Firma talebini cevaplayın..."
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={cevap}
                  onChangeText={setCevap}
                />
                <TouchableOpacity 
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmitResponse}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="white" style={styles.submitButtonIcon} />
                      <Text style={styles.submitButtonText}>Cevabı Gönder</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    // Hata Konteyner
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
  
    // Ana Konteyner ve Header
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
    container: {
      flex: 1,
      padding: 15,
    },
  
    // Kart ve İçerik Stilleri
    card: {
      backgroundColor: 'white',
      borderRadius: 15,
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
    messageContainer: {
      marginBottom: 10,
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
    responseContent: {
      backgroundColor: '#e8f5e9',
    },
    messageText: {
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
    responseFormContainer: {
      marginTop: 10,
    },
    responseFormLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#34495e',
      marginBottom: 10,
    },
    responseInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 10,
      padding: 10,
      minHeight: 120,
      textAlignVertical: 'top',
      marginBottom: 15,
      fontSize: 14,
      color: '#2c3e50',
    },
    submitButton: {
      backgroundColor: '#3498db',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center', 
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonIcon: {
      marginRight: 10,
    },
    submitButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    mediaContainer: {
      marginTop: 15,
      marginBottom: 10,
    },
    mediaScroll: {
      marginTop: 10,
    },
    mediaItem: {
      width: 120,
      height: 120,
      borderRadius: 8,
      marginRight: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#ddd',
    },
    mediaImage: {
      width: '100%',
      height: '100%',
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
    responseFormHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    quickReplyToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    quickReplyToggleText: {
      fontSize: 14,
      color: '#3498db',
      fontWeight: '600',
      marginLeft: 5,
    },
    quickRepliesContainer: {
      marginBottom: 15,
    },
    quickRepliesScroll: {
      marginVertical: 5,
    },
    quickReplyButton: {
      backgroundColor: '#f8f9fa',
      borderWidth: 1,
      borderColor: '#e9ecef',
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 10,
      marginRight: 10,
      marginVertical: 5,
      maxWidth: width * 0.8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    quickReplyText: {
      fontSize: 13,
      color: '#495057',
      textAlign: 'center',
      lineHeight: 18,
    }
  });