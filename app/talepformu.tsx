//app/talepformu.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,  
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions 
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import axios from 'axios';
import { router } from 'expo-router';
import { useRouter } from 'expo-router';
// VerificationCodeModal bileşenini import et
// bileşen component klasöründe olmalı
import api from '../utils/enterpriseApi'; // axios yerine bunu kullan
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { launchCameraAsync } from 'expo-image-picker';
import EnterpriseTokenManager from '../utils/enterpriseTokenManager';



const { width, height } = Dimensions.get('window');


// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

type Durum = {
  mekanikCalisir: boolean;
  mekanikArizali: boolean;
  elektrikliCalisir: boolean;
  elektrikliArizali: boolean;
};



const toSnakeCaseAscii = (str: string) =>
  str
    .normalize("NFD") // Türkçe karakterleri ayrıştır
    .replace(/[\u0300-\u036f]/g, "") // Diakritikleri sil
    .replace(/ı/g, "i") // Türkçe 'ı' özel olarak değiştir
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase();

const generateFormNo = (company_id: number) => {
    const timestamp = Date.now();
        return `TLP${new Date().getFullYear()}${company_id}${timestamp.toString().slice(-5)}`;
      };
        
export default function TeknikServisFormu() {
  const bugun = new Date();
  const formatliTarih = `${String(bugun.getDate()).padStart(2, '0')}/${String(bugun.getMonth() + 1).padStart(2, '0')}/${bugun.getFullYear()}`;
  
  // Yerel parametreleri al
  const { firmaAdi: routeFirmaAdi, telefon: routeTelefon, company_id } = useLocalSearchParams();
  
  const [firmaAdi, setFirmaAdi] = useState('');
  const [adres, setAdres] = useState('');
  const [telefon, setTelefon] = useState('');
  const [aciklamalar, setAciklamalar] = useState('');
  const [girisNumune, setGirisNumune] = useState('');
  const [girisLitre, setGirisLitre] = useState('');
  const [cikisNumune, setCikisNumune] = useState('');
  const [cikisLitre, setCikisLitre] = useState('');
  const [calisirAktif, setCalisirAktif] = useState(false);
  const [arizaliAktif, setArizaliAktif] = useState(false);
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  


  type MediaAttachment = {
    uri: string;
    type: string;
    name: string;
  };
  
  // State'i doğru şekilde tiplendir
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  
  // Sayfa yüklendiğinde parametreleri doldur
  useEffect(() => {
    const fillInitialData = async () => {
      // Route üzerinden firma adı geldiyse kullan
      if (routeFirmaAdi) setFirmaAdi(routeFirmaAdi as string);
      if (routeTelefon) setTelefon(routeTelefon as string);
    
      // Eğer company_id varsa API'den adresi al
      if (company_id) {
        try {
          const response = await api.get(`/api/firma/${company_id}`);
          const firma = response.data;
          if (firma?.address) setAdres(firma.address);
        } catch (err) {
          console.error("Firma bilgileri alınamadı:", err);
        }
      } else {
        // ✅ Enterprise sistemden user data al
        try {
          let userData = null;
          
          // 1. Önce Enterprise sistemden dene
          const hasEnterpriseToken = await EnterpriseTokenManager.hasValidToken();
          if (hasEnterpriseToken) {
            userData = await EnterpriseTokenManager.getUserData();
            console.log('✅ Enterprise user data alındı:', userData);
          }
          
          // 2. Fallback: Legacy sistem
          if (!userData) {
            console.log('⚠️ Enterprise data yok, legacy sistemi deneniyor...');
            const storedUser = await AsyncStorage.getItem('userData');
            if (storedUser && storedUser !== 'null') {
              userData = JSON.parse(storedUser);
              console.log('✅ Legacy user data alındı:', userData);
            }
          }
          
          // 3. User data varsa form alanlarını doldur
          if (userData) {
            if (!firmaAdi) setFirmaAdi(userData.company_name || '');
            if (!telefon) setTelefon(userData.phone_number || '');
            if (!adres) setAdres(userData.address || '');
            
            console.log('✅ Form alanları dolduruldu:', {
              firma: userData.company_name,
              telefon: userData.phone_number,
              adres: userData.address
            });
          } else {
            console.log('❌ Hiç user data bulunamadı');
          }
        } catch (error) {
          console.error('❌ User data alma hatası:', error);
        }
      }
    };
  
    fillInitialData();
  }, [routeFirmaAdi, routeTelefon, company_id]);


// Fotoğraf çekme - bu fonksiyon mevcut takePhoto ile aynı
// Fotoğraf çekme - Android için güncellenmiş
const takePhoto = async () => {
  try {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Yetki Gerekli', 'Kameraya erişim izni vermeniz gerekiyor.');
      return;
    }
    
    const result = await launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: false, // Base64'ü kapat, daha performanslı
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const newMedia: MediaAttachment = {
        uri: asset.uri,
        type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        name: `photo-${Date.now()}.jpg`,
      };
      
      console.log('Çekilen fotoğraf:', newMedia);
      setMediaAttachments([...mediaAttachments, newMedia]);
      setMediaPickerVisible(false);
    }
  } catch (error) {
    console.error('Fotoğraf çekme hatası:', error);
    Alert.alert('Hata', 'Fotoğraf çekilirken bir hata oluştu.');
  }
};

// Galeriden görsel seçme - Android için güncellenmiş
const pickImage = async () => {
  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Yetki Gerekli', 'Galeriye erişim izni vermeniz gerekiyor.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Sadece resim
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: false,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const newMedia: MediaAttachment = {
        uri: asset.uri,
        type: 'image/jpeg',
        name: `photo-${Date.now()}.jpg`,
      };
      
      console.log('Seçilen görsel:', newMedia);
      setMediaAttachments([...mediaAttachments, newMedia]);
      setMediaPickerVisible(false);
    }
  } catch (error) {
    console.error('Görsel seçme hatası:', error);
    Alert.alert('Hata', 'Görsel seçilirken bir hata oluştu.');
  }
};

// Video çekme - yeni fonksiyon
const takeVideo = async () => {
  try {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Yetki Gerekli', 'Kameraya erişim izni vermeniz gerekiyor.');
      return;
    }
    
    const result = await launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.6,
      videoMaxDuration: 30,
      // Düzeltilmiş kısım - doğru enum değerini kullanalım
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.High, 
    });
    
    if (!result.canceled) {
      const newMedia: MediaAttachment = {
        uri: result.assets[0].uri,
        type: 'video/mp4',
        name: `video-${Date.now()}.mp4`,
      };
      
      setMediaAttachments([...mediaAttachments, newMedia]);
      setMediaPickerVisible(false);
    }
  } catch (error) {
    console.error('Video çekme hatası:', error);
    Alert.alert('Hata', 'Video çekilirken bir hata oluştu.');
  }
};

    // Belge seçme
    const pickDocument = async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*', // Her türlü belge
          copyToCacheDirectory: true,
        });
        
        if (result.type === 'success') {
          const newMedia: MediaAttachment = {
            uri: result.uri,
            type: result.mimeType || 'application/octet-stream',
            name: result.name,
          };
          
          setMediaAttachments([...mediaAttachments, newMedia]);
          setMediaPickerVisible(false);
        }
      } catch (error) {
        console.error('Belge seçme hatası:', error);
        Alert.alert('Hata', 'Belge seçilirken bir hata oluştu.');
      }
    };

    // Kamera açma ve seçenek sunma
    const openCamera = () => {
      Alert.alert(
        "Kamera",
        "Ne çekmek istersiniz?",
        [
          {
            text: "Fotoğraf",
            onPress: takePhoto
          },
          {
            text: "Video",
            onPress: takeVideo
          },
          {
            text: "İptal",
            style: "cancel"
          }
        ]
      );
    };



    

    // Medya eklentiyi kaldırma
    const removeAttachment = (index: number) => {
      const updatedAttachments = [...mediaAttachments];
      updatedAttachments.splice(index, 1);
      setMediaAttachments(updatedAttachments);
    };
  

  const toSnakeCase = (str: string) => str.replace(/([A-Z])/g, "_$1").toLowerCase();


// Formu gönderme işlemi
const handleSubmit = async () => {
  if (!firmaAdi.trim() || !adres.trim() || !telefon.trim()) {
    Alert.alert('Uyarı', 'Lütfen gerekli alanları doldurunuz.');
    return;
  }

  // Onay dialogu göster
  Alert.alert(
    'Talep Onayı',
    'Talebi onaylıyor musunuz?',
    [
      {
        text: 'Hayır',
        style: 'cancel',
        onPress: () => {
          // Hiçbir şey yapma, forma geri dön
        }
      },
      {
        text: 'Evet',
        onPress: async () => {
          setIsLoading(true);
          await processForm();
        }
      }
    ]
  );
};

// Form işleme fonksiyonu
const processForm = async () => {
  let userData = null;
  let company_id = null;
  
  try {
    // ✅ Enterprise sistemden user data al
    const hasEnterpriseToken = await EnterpriseTokenManager.hasValidToken();
    if (hasEnterpriseToken) {
      userData = await EnterpriseTokenManager.getUserData();
      company_id = userData?.company_id || userData?.id;
      console.log('✅ Enterprise user data:', userData);
    }
    
    // Fallback: Legacy sistem
    if (!userData) {
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser && storedUser !== 'null') {
        userData = JSON.parse(storedUser);
        company_id = userData.company_id;
        console.log('✅ Legacy user data:', userData);
      }
    }
    
    if (!userData || !company_id) {
      Alert.alert('Hata', 'Kullanıcı bilgileri bulunamadı');
      return;
    }
    
    const formNo = generateFormNo(company_id);
    
    // ✅ Medya URL'leri için boş array başlat
    let mediaUrls: string[] = [];

    try {
      // ✅ Medya dosyaları varsa sırayla yükle
      console.log('📎 Medya dosyaları yükleniyor:', mediaAttachments.length, 'adet');
      
      for (const media of mediaAttachments) {
        const formData = new FormData();
        
        // Android için dosya bilgilerini düzelt
        const fileUri = Platform.OS === 'android' ? media.uri : media.uri.replace('file://', '');
        
        formData.append('file', {
          uri: fileUri,
          type: media.type || 'image/jpeg',
          name: media.name || `file-${Date.now()}.jpg`,
        } as any);

        console.log('📤 Yüklenen dosya bilgisi:', {
          uri: fileUri,
          type: media.type,
          name: media.name
        });

        const uploadResponse = await api.post('/api/upload-media', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000,
        });

        if (uploadResponse.data && uploadResponse.data.fileUrl) {
          mediaUrls.push(uploadResponse.data.fileUrl);
          console.log('✅ Dosya yüklendi:', uploadResponse.data.fileUrl);
        }
      }
      
      console.log('✅ Tüm medya dosyaları yüklendi:', mediaUrls.length, 'adet');
    } catch (uploadError) {
      console.error('❌ Medya yükleme hatası:', uploadError);
      console.error('❌ Hata detayı:', uploadError.response?.data || uploadError.message);
      Alert.alert('Hata', 'Dosyalar yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.');
      return;
    }
    
    // ✅ Payload oluştur
    const payload = {
      seri_no: formNo,
      tarih: new Date().toISOString().slice(0, 10),
      firma_adi: firmaAdi,
      aciklamalar: aciklamalar,
      media_urls: JSON.stringify(mediaUrls), // ✅ Artık tanımlı
      company_id: company_id,
      company_name: userData.company_name,
      email: userData.email,
      phone_number: userData.phone_number,
      address: userData.address,
    };

    console.log('📋 Form payload hazırlandı:', {
      seri_no: payload.seri_no,
      company_id: payload.company_id,
      media_count: mediaUrls.length
    });

    await submitForm(payload);

  } catch (error) {
    console.error('❌ Form işleme hatası:', error);
    Alert.alert('Hata', 'Form işlenirken bir sorun oluştu: ' + error.message);
  } finally {
    setIsLoading(false);
  }
};
  
    
    // Formu sunucuya gönder
const submitForm = async (payload: any) => {
  try {
    console.log('Gönderilen form verisi:', payload);
    
    const response = await api.post('/api/talep-form', payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.status === 201) {
      Alert.alert(
        'Başarılı', 
        'Talep formu kaydedildi.', 
        [{ text: 'Tamam', onPress: () => router.replace('/uye-panel') }]
      );
    } else {
      console.error('Sunucu hatası:', response.data);
      Alert.alert('Hata', response.data.error || 'Bir hata oluştu.');
    }
  } catch (err) {
    console.error('İstek hatası:', err);
    Alert.alert('Bağlantı hatası', 'Sunucuya ulaşılamadı.');
  }
};
  
  

  return (
    <View style={styles.mainContainer}>
    <StatusBar
      barStyle="light-content"
      backgroundColor="#2C3E50"
      translucent
    />

        {/* ⬇️ Loading Modal buraya */}
        {isLoading && (
      <Modal transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 10,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>İşleniyor</Text>
            <Text style={{ marginBottom: 15 }}>Dosyalar yükleniyor, lütfen bekleyin...</Text>
            <ActivityIndicator size="large" color="#007BFF" />
          </View>
        </View>
      </Modal>
    )}

    <LinearGradient 
      colors={['#2C3E50', '#34495E']} 
      style={styles.headerGradient}
    >
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Talep Formu</Text>
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
      <View>
        <Image 
          source={require('../assets/images/logo-white.png')} 
          style={styles.logo} 
        />
      </View>
        <View style={styles.formInfoContainer}>
          <Text style={styles.formTitle}>TALEP FORMU</Text>
          <Text style={styles.formDate}>Tarih: {formatliTarih}</Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Firmanın Adı:</Text>
          <TextInput 
            style={styles.infoInput} 
            value={firmaAdi} 
            onChangeText={setFirmaAdi}
          />
        </View>
        

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Adresi:</Text>
          <TextInput 
            style={[styles.infoInput, { height: 70 }]} // yüksekliği artırdık
            value={adres} 
            onChangeText={setAdres}
            multiline={true}
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tel:</Text>
          <TextInput 
            style={styles.infoInput} 
            value={telefon} 
            onChangeText={setTelefon}
            keyboardType="phone-pad"
          />
        </View>
      </View>
      

      {/* Açıklamalar Alanı */}
      <View style={styles.commentsContainer}>
        <Text style={styles.commentsHeader}>AÇIKLAMALAR:</Text>
        <TextInput
          style={styles.commentsInput}
          multiline
          numberOfLines={10}
          value={aciklamalar}
          onChangeText={setAciklamalar}
        />
        
        {/* Medya Ekleme Düğmesi */}
        <TouchableOpacity 
          style={styles.mediaButton}
          onPress={() => setMediaPickerVisible(true)}
        >
          <Ionicons name="attach-outline" size={24} color="#007BFF" />
          <Text style={styles.mediaButtonText}>Dosya/Görsel Ekle</Text>
        </TouchableOpacity>
        
        {/* Eklenen Medya Önizlemeleri */}
        {mediaAttachments.length > 0 && (
          <View style={styles.mediaPreviewContainer}>
            <Text style={styles.mediaPreviewTitle}>Eklenmiş Dosyalar:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {mediaAttachments.map((media, index) => (
            <View key={index} style={styles.mediaPreviewItem}>
              {(media.type && media.type.startsWith('image')) ? (
                <Image source={{ uri: media.uri }} style={styles.mediaPreviewImage} />
              ) : media.type === 'video/mp4' ? (
                <View style={styles.documentPreview}>
                  <Ionicons name="videocam" size={24} color="#007BFF" />
                  <Text style={styles.documentName} numberOfLines={1}>
                    Video
                  </Text>
                </View>
              ) : (
                <View style={styles.documentPreview}>
                  <Ionicons name="document" size={24} color="#007BFF" />
                  <Text style={styles.documentName} numberOfLines={1}>
                    {media.name}
                  </Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.removeMediaButton}
                onPress={() => removeAttachment(index)}
              >
                <Ionicons name="close-circle" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ))}
            </ScrollView>
          </View>
        )}
        
        {/* Medya Seçici Modal */}
        <Modal
          visible={mediaPickerVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setMediaPickerVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMediaPickerVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Dosya Ekle</Text>
              
              <TouchableOpacity style={styles.modalOption} onPress={pickImage}>
                <Ionicons name="images-outline" size={24} color="#007BFF" />
                <Text style={styles.modalOptionText}>Galeriden Seç</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalOption} onPress={openCamera}>
                <Ionicons name="camera-outline" size={24} color="#007BFF" />
                <Text style={styles.modalOptionText}>Kamera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalOption} onPress={pickDocument}>
                <Ionicons name="document-outline" size={24} color="#007BFF" />
                <Text style={styles.modalOptionText}>Belge Seç</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setMediaPickerVisible(false)}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>

      {/* Kaydet Butonu */}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>KAYDET</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  dualButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // SAĞA HİZALAR
    gap: 10, // React Native >= 0.71 için
    marginBottom: 10,
  },
  
  
  mainContainer: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  container: {
    flexGrow: 1,
    padding: 15,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: height * 0.02,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    padding: 10,
  },
  logo: {
    width: 150,
    height: 80,
    resizeMode: 'contain',
  },  
  formInfoContainer: {
    alignItems: 'flex-end',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  formNumber: {
    fontSize: 16,
    color: '#C62828',
    marginBottom: 5,
  },
  formDate: {
    fontSize: 14,
  },
  infoContainer: {
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  infoLabel: {
    width: 150,
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoInput: {
    flex: 1,
    height: 35,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    padding: 5,
  },
  kontrolTable: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tableHeader: {
    padding: 5,
    backgroundColor: '#f5f5f5',
  },
  tableHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 5,
  },
  parameterHeaderColumn: {
    width: '40%',
    paddingLeft: 5,
  },
  parameterHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  columnsContainer: {
    flex: 1,
  },
  categoryHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusHeaderText: {
    fontSize: 12,
    textAlign: 'center',
    width: '50%',
  },
  columnsDivider: {
    width: 1,
    backgroundColor: '#ddd',
    alignSelf: 'stretch', // Dikey olarak uzamasını sağlar
    
  },
  tableContent: {
    // Tablo içeriği
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 30,
    alignItems: 'center',
    paddingVertical: 5,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  parameterText: {
    width: '40%',
    paddingLeft: 5,
    fontSize: 12,
  },
  checkboxGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tableCell: {
    width: '45%',
    height: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    margin: 2,
  },
  tableCellSelected: {
    backgroundColor: '#007BFF',
  },
  sampleTable: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sampleTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
  },
  sampleHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sampleTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  sampleRowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
  },
  sampleInput: {
    flex: 1,
    height: 35,
    borderWidth: 1,
    borderColor: '#ddd',
    margin: 2,
    padding: 5,
    textAlign: 'center',
  },
  commentsContainer: {
    marginBottom: 15,
  },
  commentsHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  commentsInput: {
    height: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    textAlignVertical: 'top',
  },
  signatureContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  signatureColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  signatureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  signatureBox: {
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  submitButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginBottom: 10,
    alignItems: 'center',
  },
  
  fillButton: {
    backgroundColor: '#28a745', // Yeşil renk
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  
  fillButtonText: {
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 14,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#007BFF',
    borderRadius: 5,
    backgroundColor: 'rgba(0, 123, 255, 0.1)',
  },
  mediaButtonText: {
    color: '#007BFF',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  mediaPreviewContainer: {
    marginTop: 15,
  },
  mediaPreviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  mediaPreviewItem: {
    width: 100,
    height: 100,
    margin: 5,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    position: 'relative',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  documentPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  documentName: {
    fontSize: 10,
    marginTop: 5,
    width: 80,
    textAlign: 'center',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 15,
  },
  cancelButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF3B30',
  },
  videoPreview: {
    width: '100%', 
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e6f7ff',
  },
}); 