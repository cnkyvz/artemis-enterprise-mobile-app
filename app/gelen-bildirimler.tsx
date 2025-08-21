// app/gelen-bildirimler.tsx
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
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';
import EnterpriseTokenManager from '../utils/enterpriseTokenManager';
import Avatar from '../components/Avatar/Avatar';

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
  durum?: string;
  cevap?: string;
  cevap_tarihi?: string;
};

type Bildirim = {
  id: number;
  baslik: string;
  icerik: string;
  tarih: string;
  okundu: boolean;
  talep_id?: number;
  tip?: string;
  ariza_form_id?: number;
  teknisyen_adi?: string;
  teknisyen_resmi?: string;
  teknisyen_id?: number;
  teknisyen_avatar_data?: {  // YENİ ALAN
    name: string;
    initials: string;
    color: string;
    avatarUrl: string;
    hasImage: boolean;
  };
};

export default function GelenBildirimler() {
  const [activeTab, setActiveTab] = useState<'talepler' | 'bildirimler'>('talepler');
  const [talepFormlari, setTalepFormlari] = useState<TalepFormu[]>([]);
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [degerlendirmeModalVisible, setDegerlendirmeModalVisible] = useState(false);
  const [secilenBildirim, setSecilenBildirim] = useState<Bildirim | null>(null);
  const [puan, setPuan] = useState(0);
  const [yorum, setYorum] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);

  // Demo bildirim verileri
  const demoBildirimler: Bildirim[] = [
    {
      id: 1,
      baslik: 'Servis Planlama',
      icerik: 'Önümüzdeki hafta için servis bakım planınız oluşturulmuştur.',
      tarih: '2025-04-05',
      okundu: false
    },
    {
      id: 2,
      baslik: 'Fatura Bilgilendirme',
      icerik: 'Nisan ayı servis faturanız oluşturulmuştur.',
      tarih: '2025-04-03',
      okundu: true
    },
    {
      id: 3,
      baslik: 'Sistem Bakımı',
      icerik: 'Sistemlerimiz 10 Nisan tarihinde bakımda olacaktır. Geçici kesintiler yaşanabilir.',
      tarih: '2025-04-01',
      okundu: true
    }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      console.log('🔍 GELEN BİLDİRİMLER DEBUG BAŞLADI');
      console.log('📱 Current route:', router.pathname || 'unknown');
      
      // ✅ 1. Önce Enterprise token kontrolü
      const hasEnterpriseToken = await EnterpriseTokenManager.hasValidToken();
      console.log('🔐 Enterprise token var mı?', hasEnterpriseToken);
      
      let company_id = null;
      
      if (hasEnterpriseToken) {
        // ✅ Enterprise sistemden user data al
        const enterpriseUserData = await EnterpriseTokenManager.getUserData();
        console.log('🏢 Enterprise user data:', enterpriseUserData);
        
        if (enterpriseUserData) {
          company_id = enterpriseUserData.company_id || enterpriseUserData.id;
          console.log('✅ Enterprise company_id:', company_id);
        }
      }
      
      // ✅ 2. Fallback: Legacy sistem kontrolü
      if (!company_id) {
        console.log('⚠️ Enterprise user data yok, legacy sistemi deneniyor...');
        const userData = await AsyncStorage.getItem('userData');
        console.log('👤 Legacy userData var mı?', !!userData);
        
        if (userData && userData !== 'null') {
          const user = JSON.parse(userData);
          company_id = user.company_id;
          console.log('✅ Legacy company_id:', company_id);
        }
      }
      
      // ✅ 3. Company ID kontrolü
      if (!company_id) {
        console.log('❌ Hiç company_id bulunamadı');
        setError('Kullanıcı ID bilgisi bulunamadı');
        return;
      }
      
      console.log('🚀 API istekleri başlatılıyor - Company ID:', company_id);
      
      // ✅ 4. Talep formları API isteği
      try {
        console.log('📋 Talep formları isteniyor...');
        const talepResponse = await api.get(`/api/talep-formlari/${company_id}`);
        console.log('✅ Talep formları başarılı:', talepResponse.data?.length || 0, 'adet');
        setTalepFormlari(talepResponse.data || []);
      } catch (talepErr) {
        console.error('❌ Talep formları yüklenirken hata:', talepErr);
        console.error('❌ API Error Status:', talepErr.response?.status);
        console.error('❌ API Error Data:', talepErr.response?.data);
        setTalepFormlari([]);
      }
      
      // ✅ 5. Bildirimler API isteği
      try {
        console.log('🔔 Bildirimler isteniyor...');
        const bildirimResponse = await api.get(`/api/bildirimler/${company_id}`);
        console.log('✅ Bildirimler başarılı:', bildirimResponse.data?.length || 0, 'adet');
        setBildirimler(bildirimResponse.data || []);
      } catch (bildirimErr) {
        console.error('❌ Bildirimler çekilemedi:', bildirimErr);
        console.error('❌ API Error Status:', bildirimErr.response?.status);
        console.error('❌ API Error Data:', bildirimErr.response?.data);
        setBildirimler([]);
      }
      
      console.log('✅ fetchData tamamlandı');
      
    } catch (err) {
      console.error('❌ fetchData genel hatası:', err);
      setError('Veriler yüklenemedi');
    } finally {
      console.log('🏁 fetchData finally bloğu');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchData();
  };

  const handleTalepDetails = (talepId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/talep-detay/${talepId}`);
  };

  const handleBildirimOkundu = async (bildirimId: number, talepId?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      // Bildirimi okundu olarak işaretle
      await api.put(`/api/bildirim/${bildirimId}/okundu`);
      
      // State'i güncelle
      setBildirimler(prev => prev.map(bildirim => 
        bildirim.id === bildirimId ? {...bildirim, okundu: true} : bildirim
      ));
      
    } catch (err) {
      console.error('Bildirim okundu hatası:', err);
      
      // Hata olsa bile UI'daki durumu güncelle - kullanıcı deneyimini bozmayalım
      setBildirimler(prev => prev.map(bildirim => 
        bildirim.id === bildirimId ? {...bildirim, okundu: true} : bildirim
      ));
      
      // Talep ID varsa yine detay sayfasına git
      if (talepId) {
        router.push(`/talep-detay/${talepId}`);
      }
    }
  };

  // Tüm bildirimleri silme fonksiyonu
// handleTumBildirimleriSil fonksiyonunu güncelle
const handleTumBildirimleriSil = () => {
  if (bildirimler.length === 0) {
    return;
  }
  
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
  Alert.alert(
    "Tüm Bildirimleri Sil",
    "Tüm bildirimleri silmek istediğinizden emin misiniz?",
    [
      {
        text: "İptal",
        style: "cancel"
      },
      {
        text: "Tümünü Sil",
        style: "destructive",
        onPress: async () => {
          try {
            // ✅ Enterprise sistemden company_id al
            let company_id = null;
            
            const enterpriseUserData = await EnterpriseTokenManager.getUserData();
            if (enterpriseUserData) {
              company_id = enterpriseUserData.company_id || enterpriseUserData.id;
            }
            
            // Fallback: Legacy sistem
            if (!company_id) {
              const userData = await AsyncStorage.getItem('userData');
              if (userData && userData !== 'null') {
                const user = JSON.parse(userData);
                company_id = user.company_id;
              }
            }
            
            if (!company_id) {
              Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı');
              return;
            }
            
            await api.delete(`/api/bildirimler/${company_id}`);
            setBildirimler([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) {
            console.error('Tüm bildirimleri silme hatası:', err);
            setBildirimler([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        }
      }
    ]
  );
};

  // Tüm bildirimleri okundu olarak işaretleme
  const handleTumBildirimleriOkunduIsaretle = async () => {
    if (bildirimler.length === 0) {
      return; // Eğer bildirim yoksa işlem yapma
    }
    
    const okunmamisBildirimler = bildirimler.filter(b => !b.okundu);
    if (okunmamisBildirimler.length === 0) {
      // Tüm bildirimler zaten okunmuşsa işlem yapma
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) return;
      
      const user = JSON.parse(userData);
      const company_id = user.company_id;
      
      // Tüm bildirimleri okundu olarak işaretleme API isteği
      await api.put(`/api/bildirimler/${company_id}/okundu`);
      
      // UI'ı güncelle
      setBildirimler(prev => prev.map(bildirim => ({...bildirim, okundu: true})));
      
      // Başarılı işlem geri bildirimi
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Tüm bildirimleri okundu işaretleme hatası:', err);
      
      // UI'ı güncelle (opsiyonel, UX için)
      setBildirimler(prev => prev.map(bildirim => ({...bildirim, okundu: true})));
    }
  };

  // Okunmamış bildirim sayısını hesapla
  const unreadCount = bildirimler.filter(b => !b.okundu).length;

  const fetchTalepFormlari = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) {
        return router.replace('/uye-giris');
      }
      
      const user = JSON.parse(userData);
      const company_id = user.company_id;
      
      const response = await api.get(`/api/talep-formlari/${company_id}`);
      setTalepFormlari(response.data);
    } catch (err) {
      console.error('Talep formları yüklenirken hata:', err);
      setError('Talep formları yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatTalepDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${formattedDate} ${hours}:${minutes}:${seconds}`;
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  const handleTabChange = (tab: 'talepler' | 'bildirimler') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const handleDegerlendirmeYap = (bildirim: Bildirim) => {
    setSecilenBildirim(bildirim);
    setPuan(0);
    setYorum('');
    setDegerlendirmeModalVisible(true);
  };
  
  const handleDegerlendirmeGonder = async () => {
    if (!secilenBildirim || puan === 0) {
      Alert.alert('Uyarı', 'Lütfen puanlama yapın');
      return;
    }
  
    try {
      await api.post('/api/degerlendirme-kaydet', {
        ariza_form_id: secilenBildirim.ariza_form_id,
        puan: puan,
        yorum: yorum
      });
  
      // DEĞERLENDİRME KARTINI LİSTEDEN SİL (GÜNCELLE)
      setBildirimler(prev => prev.filter(bildirim => 
        bildirim.id !== secilenBildirim.id
      ));
  
      setDegerlendirmeModalVisible(false);
      Alert.alert('Başarılı', 'Değerlendirmeniz kaydedildi');
      
    } catch (error) {
      console.error('Değerlendirme gönderme hatası:', error);
      Alert.alert('Hata', 'Değerlendirme gönderilemedi');
    }
  };

  const StarRating = ({ rating, onRatingPress }: { rating: number, onRatingPress?: (rating: number) => void }) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onRatingPress && onRatingPress(star)}
            disabled={!onRatingPress}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={32}
              color={star <= rating ? "#f39c12" : "#ddd"}
              style={styles.star}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTalepItem = ({ item }: { item: TalepFormu }) => {
    return (
      <TouchableOpacity
        style={styles.talepCard}
        onPress={() => handleTalepDetails(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardBadge}>
          <Ionicons name="document-text" size={20} color="#fff" />
        </View>
        
        <View style={styles.talepHeader}>
          <View style={styles.talepInfoContainer}>
            <Text style={styles.talepNo}>{item.seri_no}</Text>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={14} color="#7f8c8d" style={{marginRight: 4}} />
              <Text style={styles.talepDate}>{formatTalepDate(item.tarih)}</Text>
            </View>
            
            {/* Cevaplama tarihi gösterimi */}
            {item.durum === 'cevaplandi' && item.cevap_tarihi && (
              <View style={[styles.dateContainer, {marginTop: 4}]}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#27ae60" style={{marginRight: 4}} />
                <Text style={[styles.talepDate, {color: '#27ae60'}]}>
                  Cevaplandı: {formatFullDate(item.cevap_tarihi)}
                </Text>
              </View>
            )}
          </View>
          
          {/* Duruma göre nokta rengi */}
          <View style={[
            styles.statusIndicator, 
            {
              backgroundColor: 
                item.durum === 'cevaplandi' 
                  ? '#27ae60'   // Yeşil 
                  : '#f39c12'   // Turuncu
            }
          ]} />
        </View>
        
        <View style={styles.talepContent}>
          <Text style={styles.talepDescription} numberOfLines={2}>
            {item.aciklamalar || 'Açıklama yok'}
          </Text>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={styles.cardCompanyInfo}>
            <Ionicons name="business-outline" size={14} color="#2c3e50" style={{marginRight: 4}} />
            <Text style={styles.companyName} numberOfLines={1}>{item.company_name}</Text>
          </View>
          <View style={styles.chevronContainer}>
            <Ionicons name="chevron-forward" size={20} color="#0088cc" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

// renderBildirimItem fonksiyonunu güncelle
const renderBildirimItem = ({ item }: { item: Bildirim }) => (
  <TouchableOpacity
    style={[
      styles.talepCard, 
      styles.bildirimCard,
      item.tip === 'randevu' && styles.randevuBildirimCard,
      item.tip === 'talep' && styles.talepBildirimCard,
      item.tip === 'degerlendirme_bekliyor' && styles.degerlendirmeBildirimCard // EKLE
    ]}
    activeOpacity={0.7}
    onPress={() => {
      if (item.tip === 'degerlendirme_bekliyor') {
        handleDegerlendirmeYap(item); // YENİ FONKSİYON
      } else {
        handleBildirimOkundu(item.id, item.talep_id);
      }
    }}
  >
    <View style={[
      styles.cardBadge, 
      {backgroundColor: item.okundu ? '#95a5a6' : '#e74c3c'},
      item.tip === 'degerlendirme_bekliyor' && { backgroundColor: item.okundu ? '#95a5a6' : '#f39c12' } // EKLE
    ]}>
      <Ionicons 
        name={item.tip === 'degerlendirme_bekliyor' ? 'star' : (item.okundu ? "mail-open" : "mail")} 
        size={20} 
        color="#fff" 
      />
    </View>
    
    <View style={styles.talepHeader}>
      <View style={styles.talepInfoContainer}>
        <Text style={styles.bildirimTitle}>
          {item.tip === 'degerlendirme_bekliyor' ? 'Değerlendirme Bekliyor' :
           item.tip === 'randevu' ? 'Randevu Bildirimi' : 
           item.tip === 'talep' ? 'Talep Cevabı' : 
           item.baslik}
        </Text>
        <View style={styles.dateContainer}>
          <Ionicons 
            name="calendar-outline" 
            size={14} 
            color="#7f8c8d" 
            style={{marginRight: 4}} 
          />
          <Text style={styles.talepDate}>{formatTalepDate(item.tarih)}</Text>
        </View>
      </View>
      {!item.okundu && <View style={styles.unreadIndicator} />}
    </View>
    
    <View style={styles.talepContent}>
      <Text style={styles.talepDescription} numberOfLines={2}>
        {item.icerik}
      </Text>
      {/* Değerlendirme butonu ekle */}
      {item.tip === 'degerlendirme_bekliyor' && !item.okundu && (
        <TouchableOpacity 
          style={styles.degerlendirmeButton}
          onPress={() => handleDegerlendirmeYap(item)}
        >
          <Ionicons name="star-outline" size={16} color="#f39c12" />
          <Text style={styles.degerlendirmeButtonText}>Değerlendirme Yap</Text>
        </TouchableOpacity>
      )}
    </View>
  </TouchableOpacity>
);

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
            
            <Text style={styles.headerTitle}>Gelen Kutusu</Text>
            
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
          
          <Text style={styles.headerTitle}>Gelen Bildirimler</Text>
          
          <View style={{width: 40}} />
        </View>
      </LinearGradient>
      
      {/* Tab Navigasyonu */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'talepler' && styles.activeTabButton
          ]}
          onPress={() => handleTabChange('talepler')}
        >
          <Ionicons 
            name="document-text-outline" 
            size={20} 
            color={activeTab === 'talepler' ? '#2980b9' : '#7f8c8d'} 
            style={styles.tabIcon}
          />
          <Text 
            style={[
              styles.tabText, 
              activeTab === 'talepler' && styles.activeTabText
            ]}
          >
            Talepler
          </Text>
        </TouchableOpacity>
        
      <TouchableOpacity 
        style={[
          styles.tabButton, 
          activeTab === 'bildirimler' && styles.activeTabButton
        ]}
        onPress={() => handleTabChange('bildirimler')}
      >
        <Ionicons 
          name="mail-unread-outline" 
          size={20} 
          color={activeTab === 'bildirimler' ? '#2980b9' : '#7f8c8d'}
          style={styles.tabIcon}
        />
        <Text 
          style={[
            styles.tabText, 
            activeTab === 'bildirimler' && styles.activeTabText
          ]}
        >
          Bildirimler
        </Text>
        {unreadCount > 0 && (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
        </View>
        )}
      </TouchableOpacity>
    </View>

      {/* Değerlendirme Modal'ı */}
      <Modal
        visible={degerlendirmeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDegerlendirmeModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDegerlendirmeModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.degerlendirmeModal}>
                
                {/* AVATAR - Modal'ın sol üst köşesinde */}
                {secilenBildirim && (
                  <View style={styles.avatarContainer}>
                  {!imageLoadError ? (
                    // Önce internet'ten resim yüklemeye çalış
                    <Image

                      style={styles.avatarImage}
                      onError={() => {
                        console.log('Image yükleme hatası, varsayılan resme geçiliyor');
                        setImageLoadError(true);
                      }}
                      onLoad={() => {
                        console.log('Resim başarıyla yüklendi');
                      }}
                    />
                  ) : (
                    // Hata olursa local resmi göster
                    <Image
                      source={require('../assets/images/suataliipek.jpg')}
                      style={styles.avatarImage}
                      onError={() => {
                        console.log('Varsayılan resim de yüklenemedi!');
                      }}
                    />
                  )}
                  
                  {/* Yeşil online nokta */}
                  <View style={styles.onlineIndicator} />
                </View>
                )}

                {/* Modal Header - Avatar'ın yanında başlar */}
                <View style={styles.modalHeaderWithAvatar}>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.modalTitle}>Servis Değerlendirmesi</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setDegerlendirmeModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Modal Content */}
                <View style={styles.modalContent}>
                  <Text style={styles.servisInfo}>
                    {secilenBildirim?.icerik}
                  </Text>

                  <Text style={styles.puanLabel}>Hizmet Puanınız:</Text>
                  <StarRating rating={puan} onRatingPress={setPuan} />

                  <Text style={styles.yorumLabel}>Yorumunuz (İsteğe bağlı):</Text>
                  <TextInput
                    style={styles.yorumInput}
                    value={yorum}
                    onChangeText={setYorum}
                    placeholder="Hizmet hakkındaki görüşlerinizi yazabilirsiniz..."
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity 
                    style={[styles.gonderButton, puan === 0 && styles.gonderButtonDisabled]}
                    onPress={handleDegerlendirmeGonder}
                    disabled={puan === 0}
                  >
                    <Text style={[styles.gonderButtonText, puan === 0 && styles.gonderButtonTextDisabled]}>
                      Değerlendirmeyi Gönder
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={50} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchData} // fetchTalepFormlari yerine fetchData kullan
          >
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
        </View>
      ) : activeTab === 'talepler' ? (
        talepFormlari.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color="#95a5a6" />
            <Text style={styles.emptyText}>Henüz talebiniz bulunmamaktadır</Text>
          </View>
        ) : (
          <FlatList
            data={talepFormlari.sort((a, b) => {
              // Tarih değerlerini Date nesnelerine dönüştürme
              const dateA = new Date(a.tarih);
              const dateB = new Date(b.tarih);
              
              // Tarihler aynıysa, ID'ye göre sıralama yaparak en yeni kaydı üstte göster
              if (dateB.getTime() === dateA.getTime()) {
                return b.id - a.id;
              }
              
              // Tarihleri azalan şekilde sırala (en yeni en üstte)
              return dateB.getTime() - dateA.getTime();
            })}
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
      ) : (
        <>
          {/* Bildirimler için header butonları */}
          {bildirimler.length > 0 && (
            <View style={styles.bildirimlerHeader}>
              <TouchableOpacity 
                style={styles.bildirimActionButton}
                onPress={handleTumBildirimleriOkunduIsaretle}
              >
                <Ionicons name="mail-open-outline" size={18} color="#2980b9" />
                <Text style={styles.bildirimActionText}>Tümünü Oku</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.bildirimActionButton, {backgroundColor: '#f8d7da'}]}
                onPress={handleTumBildirimleriSil}
              >
                <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                <Text style={[styles.bildirimActionText, {color: '#e74c3c'}]}>Tümünü Sil</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {bildirimler.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-outline" size={60} color="#95a5a6" />
              <Text style={styles.emptyText}>Henüz bildiriminiz bulunmamaktadır</Text>
            </View>
          ) : (
            <FlatList
              data={bildirimler.sort((a, b) => {
                // Tarih değerlerini Date nesnelerine dönüştürme
                const dateA = new Date(a.tarih);
                const dateB = new Date(b.tarih);
                
                // Tarihler aynıysa, ID'ye göre sıralama
                if (dateB.getTime() === dateA.getTime()) {
                  return b.id - a.id;
                }
                
                // Tarihleri azalan şekilde sırala (en yeni en üstte)
                return dateB.getTime() - dateA.getTime();
              })}
              renderItem={renderBildirimItem}
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
          )}
        </>
      )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 15,
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
    color: '#2980b9',
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
    padding: 15,
    paddingTop: 5,
  },
  talepCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    marginTop:10,
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
  bildirimCard: {
    borderLeftColor: '#e74c3c',
  },
  randevuBildirimCard: {
    borderLeftColor: '#f1c40f', // Randevu bildirimleri için farklı bir yeşil ton
  },
  cardBadge: {
    position: 'absolute',
    top: -10,
    right: 15,
    backgroundColor: '#3498db',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
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
  talepNo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  bildirimTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
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
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f39c12',
    marginTop: 5,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e74c3c',
    marginTop: 5,
  },
  talepContent: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    marginBottom: 10,
  },
  talepDescription: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cardCompanyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  companyName: {
    fontSize: 13,
    color: '#2c3e50',
    flex: 1,
  },
  chevronContainer: {
    backgroundColor: '#f8f9fa',
    padding: 5,
    borderRadius: 15,
  },
  // Bildirimler Header için stiller
  bildirimlerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginTop: 5,
  },
  bildirimActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bildirimActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2980b9',
    marginLeft: 5,
  },
  talepBildirimCard: {
    borderLeftColor: '#2ecc71', // Talep bildirimleri için farklı bir yeşil ton
  },
  degerlendirmeBildirimCard: {
    borderLeftColor: '#f39c12', // Turuncu border
  },
  degerlendirmeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  degerlendirmeButtonText: {
    color: '#f39c12',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  degerlendirmeModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 15,
    maxHeight: '80%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    position: 'relative', // Avatar pozisyonu için
  },
  headerTextContainer: {
    flex: 1,
  },
  modalHeaderWithAvatar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 40, // Avatar için yer bırak
    paddingLeft: 85, // Avatar genişliği + margin
    paddingRight: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#27ae60',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarContainer: {
    position: 'absolute',
    top: -30,  // Modal'ın üzerinde
    left: 15,  // Sol tarafta
    zIndex: 10,
    width: 60,
    height: 60,
  },

  // Avatar resmi
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  teknisyenName: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  closeButton: {
    padding: 5,
    marginTop: -10,
  },
  modalContent: {
    padding: 20,
  },
  teknisyenInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  servisInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 20,
  },
  puanLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  star: {
    marginHorizontal: 5,
  },
  yorumLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 10,
  },
  yorumInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 20,
    minHeight: 80,
  },
  gonderButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  gonderButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  gonderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gonderButtonTextDisabled: {
    color: '#bdc3c7',
  }
});