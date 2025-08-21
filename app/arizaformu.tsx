//app/arizaformu.tsx
import React, { useState, useEffect, useRef } from 'react';

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
  TouchableWithoutFeedback,
  ActivityIndicator
} from 'react-native';

import SignatureView from 'react-native-signature-canvas';
import CustomDropdownModal from '../components/CustomDropdownModal';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router, useRouter } from 'expo-router';
// VerificationCodeModal bileşenini import et
// bileşen component klasöründe olmalı
import VerificationCodeModal from '../components/VerificationCodeModal';
import api from '../utils/enterpriseApi'; // axios yerine bunu kullan
import { StatusBar, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { launchCameraAsync } from 'expo-image-picker';

import offlineStorage from '../artemis-api/utils/offlineStorage';
import syncManager from '../artemis-api/utils/syncManager';
import NetInfo from '@react-native-community/netinfo';
import OfflineIndicator from '../components/OfflineIndicator';

const { width, height } = Dimensions.get('window');


// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

type Durum = {
  mekanikCalisir: boolean;
  mekanikArizali: boolean;
  elektrikliCalisir: boolean;
  elektrikliArizali: boolean;
};

type KontrolDurumlari = {
  [key: string]: Durum;
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



export default function TeknikServisFormu() {
  const firmaImzaRef = useRef(null);
  const servisImzaRef = useRef(null);
  const bugun = new Date();
  const formatliTarih = `${String(bugun.getDate()).padStart(2, '0')}/${String(bugun.getMonth() + 1).padStart(2, '0')}/${bugun.getFullYear()}`;
  
  // Yerel parametreleri al
  const { firmaAdi: routeFirmaAdi, telefon: routeTelefon, company_id } = useLocalSearchParams();
  
  const [firmaAdi, setFirmaAdi] = useState('');
  const [adres, setAdres] = useState('');
  const [telefon, setTelefon] = useState('');
  const [model, setModel] = useState('');
  const [aciklamalar, setAciklamalar] = useState('');
  const [servisImza, setServisImza] = useState('');
  const [firmaImza, setFirmaImza] = useState('');
  const [girisNumune, setGirisNumune] = useState('L');
  const [cikisNumune, setCikisNumune] = useState('L');
  const [girisLitre, setGirisLitre] = useState('');
  const [cikisLitre, setCikisLitre] = useState('');
  const [calisirAktif, setCalisirAktif] = useState(false);
  const [arizaliAktif, setArizaliAktif] = useState(false);
  const [calisanAd, setCalisanAd] = useState('');
  const [calisanSoyad, setCalisanSoyad] = useState('');
  const [firmaYetkiliAd, setFirmaYetkiliAd] = useState('');
  const [firmaYetkiliSoyad, setFirmaYetkiliSoyad] = useState('');

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownField, setDropdownField] = useState<'giris' | 'cikis' | null>(null);

  const [onayTipi, setOnayTipi] = useState('sms'); // 'sms' veya 'imza'
  const [imzaAlanAktif, setImzaAlanAktif] = useState(false);
  const [aktifImzaAlani, setAktifImzaAlani] = useState<'firma' | 'servis' | null>(null);
  const [cizimModu, setCizimModu] = useState(false); // İmza çizimi aktif mi?

  const [errors, setErrors] = useState({
    firmaAdi: false,
    adres: false, 
    telefon: false,
    model: false,
    girisLitre: false,
    cikisLitre: false,
    aciklamalar: false,
    firmaYetkiliAd: false,
    firmaYetkiliSoyad: false,
    kontrolParametreleri: false
  });

  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  

  type MediaAttachment = {
    uri: string;
    type: string;
    name: string;
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };
  


const openDropdown = (field: 'giris' | 'cikis') => {
  setDropdownField(field);
  setDropdownVisible(true);
};



const handleDropdownSelect = (value: string) => {
  if (dropdownField === 'giris') {
    setGirisNumune(value);
  } else if (dropdownField === 'cikis') {
    setCikisNumune(value);
  }
  setDropdownVisible(false);
};

const imzaAlaniAktifEt = (alan: 'firma' | 'servis') => {
  setImzaAlanAktif(true); // Bu satırı ekleyin
  setAktifImzaAlani(alan);
};

const cizimBaslat = () => {
  console.log('Çizim başladı - Sayfa kilitleniyor');
  setCizimModu(true); // Çizim başladığında sayfa kitlenir
};

const cizimBitir = () => {
  console.log('Çizim bitti - Sayfa kilidi kaldırılıyor');
  setCizimModu(false); // Çizim bittiğinde sayfa kilidi kaldırılır
};

const clearFirmaImza = () => {
  if (firmaImzaRef.current) {
    firmaImzaRef.current.clearSignature();
  }
};

const clearServisImza = () => {
  if (servisImzaRef.current) {
    servisImzaRef.current.clearSignature();
  }
};


// İmza tamamlandığında çalışacak fonksiyon
const imzaTamamla = (data) => {
  if (aktifImzaAlani === 'firma') {
    handleFirmaImza(data);
  } else if (aktifImzaAlani === 'servis') {
    handleServisImza(data);
  }
  setCizimModu(false);
};


  
  // SMS doğrulama için state değişkenleri
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  
  // Sayfa yüklendiğinde parametreleri doldur
  useEffect(() => {
    if (routeFirmaAdi) setFirmaAdi(routeFirmaAdi as string);
    if (routeTelefon) setTelefon(routeTelefon as string);
   
    // company_id varsa firmayı backend'den çek
    if (company_id) {
      // Önce network durumunu kontrol et
      NetInfo.fetch().then(state => {
        if (state.isConnected) {
          // Online - API'den çek
          api.get(`/api/firma/${company_id}`)
            .then(response => {
              const firma = response.data;
              if (firma?.address) {
                setAdres(firma.address);
              }
            })
            .catch(err => {
              console.error("Firma bilgileri alınamadı:", err);
            });
        } else {
          // Offline - Yerel storage'dan çek
          offlineStorage.getCompanyInfo(company_id)
            .then(companyInfo => {
              if (companyInfo?.address) {
                setAdres(companyInfo.address);
                console.log('📴 Offline: Firma adresi yerel veritabanından alındı');
              }
            })
            .catch(err => {
              console.log('⚠️ Yerel firma bilgisi bulunamadı:', err);
            });
        }
      });
    }
   }, [routeFirmaAdi, routeTelefon, company_id]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setCalisanAd(parsed.ad || '');
          setCalisanSoyad(parsed.soyad || '');
        }
      } catch (e) {
        console.error('Kullanıcı bilgisi alınamadı', e);
      }
    };
  
    fetchUserData();
  }, []);

  // Sync manager ve network durumu için yeni useEffect
  useEffect(() => {
    // Sync manager'ı başlat
    const initSync = async () => {
      try {
        await syncManager.initialize();
        console.log('✅ Sync manager başlatıldı');
      } catch (error) {
        console.error('❌ Sync manager başlatma hatası:', error);
      }
    };
    initSync();

    // Network durumunu dinle
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
      console.log('🌐 Network durumu:', state.isConnected ? 'Online' : 'Offline');
    });

    return () => {
      unsubscribe();
      syncManager.destroy(); // stopSync() yerine destroy()
    };
  }, []);

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
  
  // 5. Galeriden görsel seçme fonksiyonu
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
  
  // 6. Video çekme fonksiyonu
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
  
  // 7. Belge seçme fonksiyonu
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
  
  // 8. Kamera açma ve seçenek sunma fonksiyonu
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
  
  // 9. Medya eklentiyi kaldırma fonksiyonu
  const removeAttachment = (index: number) => {
    const updatedAttachments = [...mediaAttachments];
    updatedAttachments.splice(index, 1);
    setMediaAttachments(updatedAttachments);
  };
  
  
  // İmza kaydedildiğinde çalışacak fonksiyon
  const handleServisImza = (signatureData: string) => {
    console.log('Servis İmza Başlangıcı:', signatureData ? signatureData.substring(0, 50) + '...' : 'yok');
    console.log('Servis İmza Uzunluğu:', signatureData ? signatureData.length : 0);
    setServisImza(signatureData);
  };
  const handleFirmaImza = (signatureData: string) => {
    console.log('Firma İmza Uzunluğu:', signatureData ? signatureData.length : 0);
    setFirmaImza(signatureData);
  };

  // Kontrol parametre durumları
  const [kontrolDurumlari, setKontrolDurumlari] = useState<KontrolDurumlari>({
    // Tüm parametreler tek bir listede
    izgaralar: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    dengeleme: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    terfi_pompasi: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    kalibrasyon_vanalari: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    reaktor_tanki: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    mekanik_karistiriciler: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    blower: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    desarj_pompasi: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    camur_pompasi: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    filtrepress_pompasi: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    filtrepress: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    suzuntu_pompasi: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    boru_hatlari: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    vana_adedi: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    camur_kurutma_yatagi: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    selenoid_valf: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    torba_filtre: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    ph_metre: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    ph_probu: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    redox_metre: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    redox_probu: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
    kumanda_panosu: { mekanikCalisir: false, mekanikArizali: false, elektrikliCalisir: false, elektrikliArizali: false },
  });

  const [isOffline, setIsOffline] = useState(false);
  const [offlineFormId, setOfflineFormId] = useState<number | null>(null);
  

  // Tüm parametre isimlerini bir array'e alıyoruz
  const parametreIsimleri = [
    { id: 'izgaralar', text: 'Izgaralar' },
    { id: 'dengeleme', text: 'Dengeleme' },
    { id: 'terfi_pompasi', text: 'Terfi Pompası' },
    { id: 'kalibrasyon_vanalari', text: 'Kalibrasyon Vanaları' },
    { id: 'reaktor_tanki', text: 'Reaktör Tankı' },
    { id: 'mekanik_karistiriciler', text: 'Mekanik Karıştırıcılar' },
    { id: 'blower', text: 'Blower' },
    { id: 'desarj_pompasi', text: 'Deşarj Pompası' },
    { id: 'camur_pompasi', text: 'Çamur Pompası' },
    { id: 'filtrepress_pompasi', text: 'Filtrepress Pompası' },
    { id: 'filtrepress', text: 'Filtrepress' },
    { id: 'suzuntu_pompasi', text: 'Süzüntü Pompası' },
    { id: 'boru_hatlari', text: 'Boru Hatları' },
    { id: 'vana_adedi', text: 'Vana Adedi' },
    { id: 'camur_kurutma_yatagi', text: 'Çamur Kurutma Yatağı' },
    { id: 'selenoid_valf', text: 'Selenoid Valf' },
    { id: 'torba_filtre', text: 'Torba Filtre' },
    { id: 'ph_metre', text: 'pH Metre' },
    { id: 'ph_probu', text: 'pH Probu' },
    { id: 'redox_metre', text: 'Redox Metre' },
    { id: 'redox_probu', text: 'Redox Probu' },
    { id: 'kumanda_panosu', text: 'Kumanda Panosu' },
  ];  

  // Durum değiştirme fonksiyonu
  const handleDurumChange = (
    parametre: keyof KontrolDurumlari,
    alan: keyof Durum,
    deger: boolean
  ) => {
    setKontrolDurumlari(prevState => {
      const newState = { ...prevState };
      
      // Eğer seçilen değer true ise, aynı kategorideki diğerini false yap
      if (deger) {
        if (alan === 'mekanikCalisir') {
          newState[parametre].mekanikArizali = false;
        } else if (alan === 'mekanikArizali') {
          newState[parametre].mekanikCalisir = false;
        } else if (alan === 'elektrikliCalisir') {
          newState[parametre].elektrikliArizali = false;
        } else if (alan === 'elektrikliArizali') {
          newState[parametre].elektrikliCalisir = false;
        }
      }
      
      // Seçilen alanı güncelle
      newState[parametre][alan] = deger;
      
      return newState;
    });
  
    // Kontrol parametreleri hatasını temizle (eğer bir seçim yapıldıysa)
    if (deger && errors.kontrolParametreleri) {
      clearError('kontrolParametreleri');
    }
  };

    // SMS doğrulama kodu gönderme
    const sendVerificationCode = async () => {
      try {
        console.log('Doğrulama kodu isteniyor...', telefon);
        // Telefon numarası kontrol
        if (!telefon || telefon.length < 10) {
          Alert.alert('Hata', 'Lütfen geçerli bir telefon numarası girin.');
          return false;
        }
        
        // ✅ Header yok - interceptor ekleyecek
        const response = await api.post('/api/send-verification', {
          telefon: telefon
        });
    
        console.log('Doğrulama kodu yanıtı:', response.data);
        
        if (response.data) {
          setVerificationModalVisible(true);
          return true;
        }
      } catch (error) {
        console.error('Doğrulama kodu gönderme hatası:', error);
        Alert.alert('Hata', 'Doğrulama kodu gönderilemedi.');
        return false;
      }
    };

    // TeknikServisFormu bileşenine eklenecek yeni fonksiyon

    const tumCalisirDoldur = () => {
      const yeniDurumlar = { ...kontrolDurumlari };
    
      const yeniDurum = !calisirAktif; // toggle mantığı
    
      Object.keys(yeniDurumlar).forEach(parametre => {
        yeniDurumlar[parametre].mekanikCalisir = yeniDurum;
        yeniDurumlar[parametre].elektrikliCalisir = yeniDurum;
        yeniDurumlar[parametre].mekanikArizali = false;
        yeniDurumlar[parametre].elektrikliArizali = false;
      });
    
      setKontrolDurumlari(yeniDurumlar);
      setCalisirAktif(yeniDurum);
      setArizaliAktif(false); // Diğeri seçildiyse onu pasif yap
      
      // Hata varsa ve seçim yapıldıysa hatayı temizle
      if (yeniDurum && errors.kontrolParametreleri) {
        clearError('kontrolParametreleri');
      }
    };
    
    const tumArizaliDoldur = () => {
      const yeniDurumlar = { ...kontrolDurumlari };
    
      const yeniDurum = !arizaliAktif;
    
      Object.keys(yeniDurumlar).forEach(parametre => {
        yeniDurumlar[parametre].mekanikCalisir = false;
        yeniDurumlar[parametre].elektrikliCalisir = false;
        yeniDurumlar[parametre].mekanikArizali = yeniDurum;
        yeniDurumlar[parametre].elektrikliArizali = yeniDurum;
      });
    
      setKontrolDurumlari(yeniDurumlar);
      setArizaliAktif(yeniDurum);
      setCalisirAktif(false); // Diğeri seçildiyse onu pasif yap
      
      // Hata varsa ve seçim yapıldıysa hatayı temizle
      if (yeniDurum && errors.kontrolParametreleri) {
        clearError('kontrolParametreleri');
      }
    };
    

      // Doğrulama kodunu kontrol et
      const verifyCode = async (code: string) => {
        try {
          // ✅ Header yok - interceptor ekleyecek
          const response = await api.post('/api/verify-code', {
            telefon: telefon,
            code: code
          });
          
          if (response.data && response.data.message === 'Doğrulama başarılı') {
            // Doğrulama başarılı olduğunda formu gönder
            submitForm();
            return true;
          } else {
            Alert.alert('Hata', 'Doğrulama kodu yanlış.');
            return false;
          }
        } catch (error) {
          console.error('Kod doğrulama hatası:', error);
          Alert.alert('Hata', 'Doğrulama kodu kontrol edilemedi.');
          return false;
        }
      };
  

  const toSnakeCase = (str: string) => str.replace(/([A-Z])/g, "_$1").toLowerCase();
  // Formu gönderme işlemi

// handleOnayTipiDegis fonksiyonunu güncelleyin
const handleOnayTipiDegis = (tip) => {
  setOnayTipi(tip);
  
  if (tip === 'imza') {
    // İmza tipi seçildiğinde iki imza alanını da direkt aktif hale getir
    setImzaAlanAktif(true);
    // Sayfa henüz kitlenmeyecek çünkü kullanıcı henüz çizime başlamadı
    setCizimModu(false);
  } else {
    // SMS seçildiğinde imza alanlarını kapatın
    setImzaAlanAktif(false);
    setAktifImzaAlani(null);
    setCizimModu(false);
  }
};


// handleSubmit fonksiyonunu güncelleyin
const handleSubmit = async () => {
  console.log('Form gönderme başlatıldı');

  // Error state'ini sıfırla
  const newErrors = {
    firmaAdi: false,
    adres: false,
    telefon: false,
    model: false,
    girisLitre: false,
    cikisLitre: false,
    aciklamalar: false,
    firmaYetkiliAd: false,
    firmaYetkiliSoyad: false,
    kontrolParametreleri: false
  };

  let hasError = false;

  // Temel zorunlu alanlar
  if (!firmaAdi) {
    newErrors.firmaAdi = true;
    hasError = true;
  }
  if (!adres) {
    newErrors.adres = true;
    hasError = true;
  }
  if (!telefon) {
    newErrors.telefon = true;
    hasError = true;
  }
  if (!model) {
    newErrors.model = true;
    hasError = true;
  }

  // Numune bilgileri
  if (!girisLitre) {
    newErrors.girisLitre = true;
    hasError = true;
  }
  if (!cikisLitre) {
    newErrors.cikisLitre = true;
    hasError = true;
  }

  // Açıklamalar
  if (!aciklamalar.trim()) {
    newErrors.aciklamalar = true;
    hasError = true;
  }

  // Firma yetkili bilgileri
  if (!firmaYetkiliAd.trim()) {
    newErrors.firmaYetkiliAd = true;
    hasError = true;
  }
  if (!firmaYetkiliSoyad.trim()) {
    newErrors.firmaYetkiliSoyad = true;
    hasError = true;
  }

  // Kontrol parametreleri
  const parametreSecimleri = Object.values(kontrolDurumlari).some(durum => 
    durum.mekanikCalisir || durum.mekanikArizali || 
    durum.elektrikliCalisir || durum.elektrikliArizali
  );
  
  if (!parametreSecimleri) {
    newErrors.kontrolParametreleri = true;
    hasError = true;
  }

  // Error state'ini güncelle
  setErrors(newErrors);

  if (hasError) {
    Alert.alert('Uyarı', 'Kırmızı işaretli alanları lütfen doldurunuz.');
    return;
  }

  // company_id kontrol et
  if (!company_id) {
    Alert.alert('Hata', 'Firma bilgisi eksik. Lütfen tekrar deneyin.');
    return;
  }

  // Payload hazırla
  const payload = {
    company_id: parseInt(company_id as string),
    seri_no: Date.now().toString(),
    tarih: new Date().toISOString().slice(0, 10),
    firma_adi: firmaAdi,
    adres,
    telefon,
    model,
    calisan_ad: calisanAd,
    calisan_soyad: calisanSoyad,
    firma_yetkili_ad: firmaYetkiliAd,
    firma_yetkili_soyad: firmaYetkiliSoyad,
    aciklamalar,
    servis_imza: servisImza,
    firma_imza: firmaImza,
    giris_numune: girisNumune,
    giris_litre: parseFloat(girisLitre) || 0,
    cikis_numune: cikisNumune,
    cikis_litre: parseFloat(cikisLitre) || 0,
    media_urls: JSON.stringify([]), // Başlangıçta boş bir array
  
    // Kontrol parametreleri
    ...Object.entries(kontrolDurumlari).reduce((acc: Record<string, boolean>, [parametre, durumlar]) => {
      Object.entries(durumlar).forEach(([durum, value]) => {
        const key = `${parametre}_${toSnakeCaseAscii(durum)}`;
        acc[key] = value;
      });
      return acc;
    }, {})
  };

  setFormData(payload);

  const networkState = await NetInfo.fetch();
  
  if (!networkState.isConnected) {
    // 📴 Offline mode - SQLite'a kaydet
    try {
      console.log('📴 Offline mode - Form yerel veritabanına kaydediliyor...');
      
      const offlineId = await offlineStorage.saveForm(
        'teknik_servis', 
        payload, 
        mediaAttachments
      );
      
      setOfflineFormId(offlineId);
      
      Alert.alert(
        'Offline Kayıt', 
        'İnternet bağlantısı yok. Form yerel olarak kaydedildi ve bağlantı kurulduğunda otomatik gönderilecek.',
        [{ 
          text: 'Tamam', 
          onPress: () => router.replace('/teknisyen-panel') 
        }]
      );
      
    } catch (error) {
      console.error('❌ Offline kayıt hatası:', error);
      Alert.alert('Hata', 'Form kaydedilemedi. Lütfen tekrar deneyin.');
    }
    return;
  }

  // Form verilerini kaydet
  setFormData(payload);
  
  // İmza ile onay için ayrı bir submit fonksiyonu
  const submitForSignature = (data) => {
    api.post('/api/teknik-servis', data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    })
    .then(response => {
      if (response.status === 201) {
        Alert.alert(
          'Başarılı', 
          'Teknik servis formu kaydedildi.', 
          [{ text: 'Tamam', onPress: () => router.replace('/teknisyen-panel') }]
        );
      } else {
        console.error('Sunucu hatası:', response.data);
        Alert.alert('Hata', response.data.error || 'Bir hata oluştu.');
      }
    })
    .catch(err => {
      console.error('İstek hatası detayları:', err.response?.data || err.message);
      Alert.alert('Hata', 'Form gönderilemedi: ' + (err.message || 'Bilinmeyen hata'));
    });
  };
  
  // Onay tipine göre işlem yap
  if (onayTipi === 'sms') {
    console.log('Form verileri hazırlandı, doğrulama kodu isteniyor...');
    sendVerificationCode();
  } else {
    // İmza ile onay - direkt gönder
    await submitFormOnline(payload);
  }
};
    
    // Formu sunucuya gönder
    const submitForm = async () => {
      if (!formData) {
        console.error('Form verileri bulunamadı (formData null)');
        Alert.alert('Hata', 'Form verileri bulunamadı, lütfen tekrar deneyin.');
        return;
      }
      
      await submitFormOnline(formData);
    };
  

// Kontrol Parametre Tablosu Hücre Render Fonksiyonu
const renderTableCell = (
  parametre: keyof KontrolDurumlari,
  alan: keyof Durum
) => {
  const isSelected = kontrolDurumlari[parametre][alan];
  const isError = alan.includes('Arizali');
  
  return (
    <TouchableOpacity 
      style={[
        styles.tableCell, 
        isSelected && (isError ? styles.tableCellSelectedError : styles.tableCellSelected)
      ]}
      onPress={() =>
        handleDurumChange(parametre, alan, !kontrolDurumlari[parametre][alan])
      }
    />
  );
};

// Yeni fonksiyon: Online form gönderimi
const submitFormOnline = async (data: any) => {
  try {
    setIsLoading(true);
    
    // Medya dosyaları varsa önce yükle
    if (mediaAttachments.length > 0) {
      console.log('📤 Medya dosyaları yükleniyor...');
      const mediaUrls = await uploadMediaFiles();
      data.media_urls = JSON.stringify(mediaUrls);
    }
    
    console.log('📨 Form online gönderiliyor...');
    
    // ✅ Manuel header kaldırıldı - interceptor ekleyecek
    const response = await api.post('/api/teknik-servis', data, {
      timeout: 60000
    });

    if (response.status === 201) {
      Alert.alert(
        'Başarılı', 
        'Teknik servis formu kaydedildi.', 
        [{ text: 'Tamam', onPress: () => router.replace('/teknisyen-panel') }]
      );
    } else {
      throw new Error(response.data.error || 'Bir hata oluştu.');
    }
    
  } catch (err) {
    console.error('❌ Online form gönderim hatası:', err);
    
    // 🔄 Online gönderim başarısız, offline'a kaydet
    try {
      const offlineId = await offlineStorage.saveForm(
        'teknik_servis', 
        data, 
        mediaAttachments
      );
      
      Alert.alert(
        'Bağlantı Hatası', 
        'Form gönderilmedi ancak yerel olarak kaydedildi. Bağlantı kurulduğunda otomatik gönderilecek.',
        [{ text: 'Tamam', onPress: () => router.replace('/teknisyen-panel') }]
      );
      
    } catch (offlineError) {
      console.error('❌ Offline yedekleme hatası:', offlineError);
      Alert.alert('Hata', 'Form kaydedilemedi. Lütfen tekrar deneyin.');
    }
  } finally {
    setIsLoading(false);
  }
};

// Yeni fonksiyon: Medya dosyalarını yükle
const uploadMediaFiles = async (): Promise<string[]> => {
  const uploadedUrls: string[] = [];
  
  for (const media of mediaAttachments) {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: media.uri,
        type: media.type,
        name: media.name,
      } as any);

      const uploadResponse = await api.post('/api/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      if (uploadResponse.data && uploadResponse.data.fileUrl) {
        uploadedUrls.push(uploadResponse.data.fileUrl);
      }
    } catch (error) {
      console.error('❌ Medya yükleme hatası:', error);
    }
  }
  
  return uploadedUrls;
};


return (
  <View style={styles.mainContainer}>
    <OfflineIndicator />
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
        <Text style={styles.headerTitle}>Teknik Servis Formu</Text>
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

    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.container}
      enableOnAndroid={true}
      extraScrollHeight={100}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!cizimModu}
      enableAutomaticScroll={true}
    >
      <View style={styles.header}>
        <View>
          <Image 
            source={require('../assets/images/logo-white.png')} 
            style={styles.logo} 
          />
        </View>
        <View style={styles.formInfoContainer}>
          <Text style={styles.formTitle}>TEKNİK SERVİS FORMU</Text>
          <Text style={styles.formDate}>Tarih: {formatliTarih}</Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Firmanın Adı:</Text>
          <TextInput 
            style={[styles.infoInput, errors.firmaAdi && styles.inputError]} 
            value={firmaAdi} 
            onChangeText={(text) => {
              setFirmaAdi(text);
              clearError('firmaAdi');
            }}
          />
        </View>
        

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Adresi:</Text>
          <TextInput 
            style={[styles.infoInput, { height: 70 }, errors.adres && styles.inputError]} 
            value={adres} 
            onChangeText={(text) => {
              setAdres(text);
              clearError('adres');
            }}
            multiline={true}
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tel:</Text>
          <TextInput 
            style={[styles.infoInput, errors.telefon && styles.inputError]} 
            value={telefon} 
            onChangeText={(text) => {
              setTelefon(text);
              clearError('telefon');
            }}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Arıtma Sisteminin Modeli:</Text>
          <TextInput 
            style={[styles.infoInput, errors.model && styles.inputError]} 
            value={model} 
            onChangeText={(text) => {
              setModel(text);
              clearError('model');
            }}
          />
        </View>
      </View>

      <View style={styles.dualButtonContainer}>
        <TouchableOpacity style={styles.fillButton} onPress={tumCalisirDoldur}>
          <Text style={styles.fillButtonText}>Çalışır</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fillButton} onPress={tumArizaliDoldur}>
          <Text style={styles.fillButtonText}>Arızalı</Text>
        </TouchableOpacity>
      </View>


      {/* Kontrol Parametreleri Tablosu - Tek Tablo */}
      <View style={styles.kontrolTable}>
        {/* Tablo Başlığı */}
        <View style={styles.tableHeader}>
          <Text style={[
            styles.tableHeaderTitle, 
            errors.kontrolParametreleri && styles.errorText
          ]}>
            Kontrol Parametreleri
            {errors.kontrolParametreleri && <Text style={styles.errorStar}> *</Text>}
          </Text>
          <View style={styles.tableHeaderRow}>
            {/* Parametreler başlığı */}
            <View style={styles.parameterHeaderColumn}>
              <Text style={styles.parameterHeaderText}>Parametre</Text>
            </View>
            
            <View style={styles.columnsDivider} />
            
            {/* Mekanik başlıkları */}
            <View style={styles.columnsContainer}>
              <Text style={styles.categoryHeaderText}>Mekanik</Text>
              <View style={styles.statusHeaderRow}>
                <Text style={styles.statusHeaderText}>Çalışır</Text>
                <Text style={styles.statusHeaderText}>Arızalı</Text>
              </View>
            </View>
            
            <View style={styles.columnsDivider} />
            
            {/* Elektrikli başlıkları */}
            <View style={styles.columnsContainer}>
              <Text style={styles.categoryHeaderText}>Elektrikli</Text>
              <View style={styles.statusHeaderRow}>
                <Text style={styles.statusHeaderText}>Çalışır</Text>
                <Text style={styles.statusHeaderText}>Arızalı</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tablo İçeriği - Tüm parametreler alt alta */}
        <View style={styles.tableContent}>
          {parametreIsimleri.map((parametre, index) => (
            <View key={parametre.id} style={[
              styles.tableRow,
              index < parametreIsimleri.length - 1 && styles.tableRowBorder
            ]}>
              <Text style={styles.parameterText}>{parametre.text}</Text>
              <View style={styles.columnsDivider} />
              <View style={styles.checkboxGroup}>
                {renderTableCell(parametre.id, 'mekanikCalisir')}
                {renderTableCell(parametre.id, 'mekanikArizali')}
              </View>
              <View style={styles.columnsDivider} />
              <View style={styles.checkboxGroup}>
                {renderTableCell(parametre.id, 'elektrikliCalisir')}
                {renderTableCell(parametre.id, 'elektrikliArizali')}
              </View>
            </View>
          ))}
        </View>
      </View>
      

      {/* Numune ve Miktar Tablosu */}
      <View style={styles.sampleTable}>
        <View style={styles.sampleTableHeader}>
          <Text style={styles.sampleHeaderText}>Numune</Text>
          <Text style={styles.sampleHeaderText}>Birim</Text>
          <Text style={styles.sampleHeaderText}>Alınan Miktar</Text>
          <Text style={styles.sampleHeaderText}>Numune</Text>
          <Text style={styles.sampleHeaderText}>Birim</Text>
          <Text style={styles.sampleHeaderText}>Alınan Miktar</Text>
        </View>
        
        <View style={styles.sampleTableRow}>
          <Text style={styles.sampleRowText}>Giriş</Text>
          <View style={styles.pickerContainer}>
            <TouchableOpacity 
              style={styles.pickerButton} 
              onPress={() => openDropdown('giris')}
            >
              <Text style={styles.pickerButtonText}>{girisNumune}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
          <TextInput 
            style={[styles.sampleInput, errors.girisLitre && styles.inputError]}
            value={girisLitre}
            onChangeText={(text) => {
              setGirisLitre(text);
              clearError('girisLitre');
            }}
            keyboardType="numeric"
          />
          <Text style={styles.sampleRowText}>Çıkış</Text>
          <View style={styles.pickerContainer}>
            <TouchableOpacity 
              style={styles.pickerButton} 
              onPress={() => openDropdown('cikis')}
            >
              <Text style={styles.pickerButtonText}>{cikisNumune}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
          <TextInput 
            style={[styles.sampleInput, errors.cikisLitre && styles.inputError]}
            value={cikisLitre}
            onChangeText={(text) => {
              setCikisLitre(text);
              clearError('cikisLitre');
            }}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Açıklamalar Alanı */}
      <View style={styles.commentsContainer}>
        <Text style={styles.commentsHeader}>AÇIKLAMALAR:</Text>
        <TextInput
          style={[styles.commentsInput, errors.aciklamalar && styles.inputError]}
          multiline
          numberOfLines={10}
          value={aciklamalar}
          onChangeText={(text) => {
            setAciklamalar(text);
            clearError('aciklamalar');
          }}
        />
      </View>

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

      {/* Loading Modal - View'in en başına, </View> kapatma tag'inden hemen önce ekleyin */}
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

      {/* Onay Tipi Seçme */}
      <View style={styles.onayTipiContainer}>
        <Text style={styles.onayTipiHeader}>ONAY TİPİ:</Text>
        <View style={styles.onayTipiBtnContainer}>
          <TouchableOpacity 
            style={[styles.onayTipiBtn, onayTipi === 'sms' && styles.onayTipiAktif]} 
            onPress={() => handleOnayTipiDegis('sms')}
          >
            <Text style={[
              styles.onayTipiBtnText, onayTipi === 'sms' && styles.onayTipiAktifText]}>SMS Onay</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.onayTipiBtn, onayTipi === 'imza' && styles.onayTipiAktif]} 
            onPress={() => handleOnayTipiDegis('imza')}
          >
            <Text style={[styles.onayTipiBtnText, onayTipi === 'imza' && styles.onayTipiAktifText]}>İmza ile Onay</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* İmzalar */}
      <View style={styles.signatureContainer}>
        <View style={styles.signatureColumn}>
          <Text style={styles.signatureTitle}>{firmaAdi} Firma Yetkilisi</Text>
          <View style={styles.nameInputContainer}>
            <View style={styles.nameInputWrapper}>
              <Text style={styles.nameLabel}>Ad:</Text>
              <TextInput
                style={[styles.nameInput, errors.firmaYetkiliAd && styles.inputError]}
                value={firmaYetkiliAd}
                onChangeText={(text) => {
                  setFirmaYetkiliAd(text);
                  clearError('firmaYetkiliAd');
                }}
              />
            </View>
            <View style={styles.nameInputWrapper}>
              <Text style={styles.nameLabel}>Soyad:</Text>
              <TextInput
                style={[styles.nameInput, errors.firmaYetkiliSoyad && styles.inputError]}
                value={firmaYetkiliSoyad}
                onChangeText={(text) => {
                  setFirmaYetkiliSoyad(text);
                  clearError('firmaYetkiliSoyad');
                }}
              />
            </View>
          </View>
          {onayTipi === 'imza' && (
          <View style={styles.signatureBox}>
            {firmaImza ? (
              <View style={{ width: '100%', height: '100%' }}>
                <Image
                  source={{ uri: firmaImza }}
                  style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                />
                <TouchableOpacity 
                  style={styles.resetSignatureButton}
                  onPress={() => setFirmaImza('')}
                >
                  <Text style={styles.resetSignatureText}>Sıfırla</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                <SignatureView
                  ref={firmaImzaRef}
                  style={{ width: '100%', height: '100%' }}
                  onOK={(data) => {
                    console.log("İmza kaydedildi:", data ? data.substring(0, 20) + "..." : "boş");
                    handleFirmaImza(data);
                    setCizimModu(false); // İmza tamamlandığında kilidi kaldır
                  }}
                  clearText=""
                  confirmText=""
                  descriptionText=""
                  webStyle={`
                    body, html {
                      width: 100%; height: 100%;
                      margin: 0; padding: 0;
                      background-color: #f5f5f5;
                    }
                    .m-signature-pad {
                      width: 100%; height: 100%;
                      margin: 0; padding: 0;
                      position: relative;
                      border: none;
                      background-color: #f5f5f5;
                    }
                    .m-signature-pad--body {
                      position: absolute;
                      left: 0; right: 0; top: 0; bottom: 0;
                      border: none;
                      background-color: #f5f5f5;
                    }
                    .m-signature-pad--body canvas {
                      left: 0; top: 0; width: 100%; height: 100%;
                      border: none;
                      background-color: #f5f5f5 !important;
                      touch-action: none;
                    }
                    .m-signature-pad--footer {
                      display: none !important;
                      height: 0 !important;
                      visibility: hidden !important;
                    }
                  `}
                  autoClear={false}
                  imageType="image/png"
                  androidHardwareAccelerationDisabled={true}
                  onBegin={cizimBaslat} // Çizim başladığında
                  onEnd={cizimBitir}    // Çizim bittiğinde (parmak/kalem kaldırıldığında)
                  penColor={'#000000'}
                  dataURL="data:image/png;base64,iVBORw0="
                  minWidth={2}
                  maxWidth={4}
                  strokeWidth={2.5}
                  velocityFilterWeight={0.9}
                />
              </View>
            )}
            {/* Temizle butonu - Canvas dışında */}
            {!firmaImza && (
              <TouchableOpacity 
                style={styles.clearSignatureButton}
                onPress={clearFirmaImza} // ref kullanarak temizle
              >
                <Text style={styles.clearSignatureText}>Temizle</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        </View>
                
        <View style={styles.signatureColumn}>
          <Text style={styles.signatureTitle}>Artemis Teknik Servis</Text>
          <View style={styles.nameInputContainer}>
            <View style={styles.nameInputWrapper}>
              <Text style={styles.nameLabel}>Ad:</Text>
              <TextInput
                style={styles.nameInput}
                value={calisanAd}
                onChangeText={setCalisanAd}
              />
            </View>
            <View style={styles.nameInputWrapper}>
              <Text style={styles.nameLabel}>Soyad:</Text>
              <TextInput
                style={styles.nameInput}
                value={calisanSoyad}
                onChangeText={setCalisanSoyad}
              />
            </View>
          </View>
          {onayTipi === 'imza' && (
          <View style={styles.signatureBox}>
            {servisImza ? (
              <View style={{ width: '100%', height: '100%' }}>
                <Image
                  source={{ uri: servisImza }}
                  style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                />
                <TouchableOpacity 
                  style={styles.resetSignatureButton}
                  onPress={() => setServisImza('')}
                >
                  <Text style={styles.resetSignatureText}>Sıfırla</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                <SignatureView
                  ref={servisImzaRef} 
                  style={{ width: '100%', height: '100%' }}
                  onOK={(data) => {
                    console.log("İmza kaydedildi:", data ? data.substring(0, 20) + "..." : "boş");
                    handleServisImza(data);
                    setCizimModu(false); // İmza tamamlandığında kilidi kaldır
                  }}
                  clearText=""
                  confirmText=""
                  descriptionText=""
                  webStyle={`
                    body, html {
                      width: 100%; height: 100%;
                      margin: 0; padding: 0;
                      background-color: #f5f5f5;
                    }
                    .m-signature-pad {
                      width: 100%; height: 100%;
                      margin: 0; padding: 0;
                      position: relative;
                      border: none;
                      background-color: #f5f5f5;
                    }
                    .m-signature-pad--body {
                      position: absolute;
                      left: 0; right: 0; top: 0; bottom: 0;
                      border: none;
                      background-color: #f5f5f5;
                    }
                    .m-signature-pad--body canvas {
                      left: 0; top: 0; width: 100%; height: 100%;
                      border: none;
                      background-color: #f5f5f5 !important;
                      touch-action: none;
                    }
                    .m-signature-pad--footer {
                      display: none !important;
                      height: 0 !important;
                      visibility: hidden !important;
                    }
                  `}
                  autoClear={false}
                  imageType="image/png"
                  androidHardwareAccelerationDisabled={true}
                  onBegin={cizimBaslat} // Çizim başladığında
                  onEnd={cizimBitir}    // Çizim bittiğinde (parmak/kalem kaldırıldığında)
                  penColor={'#000000'}
                  dataURL="data:image/png;base64,iVBORw0="
                  minWidth={2}
                  maxWidth={4}
                  strokeWidth={2.5}
                  velocityFilterWeight={0.9}
                />
              </View>
            )}
            {/* Temizle butonu - Canvas dışında */}
            {!servisImza && (
              <TouchableOpacity 
                style={styles.clearSignatureButton}
                onPress={clearServisImza} // ref kullanarak temizle
              >
                <Text style={styles.clearSignatureText}>Temizle</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        </View>
      </View>

      {/* Kaydet Butonu */}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>KAYDET</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>

    <VerificationCodeModal
      visible={verificationModalVisible}
      phoneNumber={telefon}
      onClose={() => setVerificationModalVisible(false)}
      onVerify={verifyCode}
      onResend={async () => {
        await sendVerificationCode();
        // Burada hiçbir şey döndürmüyoruz, yani void döner
      }}
    />
    <CustomDropdownModal
      visible={dropdownVisible}
      options={['L', 'm³']}
      onSelect={handleDropdownSelect}
      onClose={() => setDropdownVisible(false)}
      title="Birim Seçin"
    />
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

  resetSignatureButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#f44336',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  resetSignatureText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
    marginTop:10,
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
    justifyContent: 'space-between', // İki kutuyu yan yana ve aralıklı yapar
  },
  signatureColumn: {
    width: '48%', // Her bir kutu ekranın yaklaşık yarısını kaplar
    marginHorizontal: 0, // Yan yana olduğu için kenar boşluğunu kaldırın
  },
  signatureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  onayTipiContainer: {
    marginBottom: 15,
    marginTop: 20,
  },
  onayTipiHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  onayTipiBtnContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  onayTipiBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 5,
    alignItems: 'center',
    marginTop: 6,
  },
  onayTipiAktif: {
    backgroundColor: '#007BFF',
    borderColor: '#0056b3',
  },
  onayTipiBtnText: {
    color: '#333',
    fontWeight: '500',
  },
  onayTipiAktifText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  signatureBox: {
    height: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  imzaPlaceholder: {
    color: '#999',
    fontStyle: 'italic',
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
  pickerContainer: {
    marginTop:2,
    flex: 1,
    paddingHorizontal: 2,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 35,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 8,
    backgroundColor: '#f9f9f9',
  },
  pickerButtonText: {
    fontSize: 12,
  },
  nameInputContainer: {
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    justifyContent: 'center', // İçeriği dikey olarak ortalama
  },
  nameInput: {
    borderBottomColor: '#ddd',
    marginBottom: 5,
    flex: 1,
  },
  prefilledName: {
    flex: 1,
    textAlignVertical: 'center',
    fontSize: 14,
    color: '#333',
  },
  nameInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  nameLabel: {
    width: 50,
    fontWeight: 'bold',
    marginRight: 10,
    color: '#333',
  },
  emptySignatureArea: {
    flex: 1,
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
  },
  signatureButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  clearSignatureButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#f44336',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    zIndex: 10,
  },
  clearSignatureText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tableCellSelectedError: {
    backgroundColor: '#dc3545', // Kırmızı renk
  },
  inputError: {
    borderColor: '#dc3545',
    borderWidth: 2,
  },
  errorText: {
    color: '#dc3545',
  },
  errorStar: {
    color: '#dc3545',
    fontSize: 18,
    fontWeight: 'bold',
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