  // app/barkod-ekrani.tsx

  import React, { useState, useEffect, useRef } from 'react';
  import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform,
    Dimensions,
    StatusBar,
    Share,
    Image,
    PermissionsAndroid,
    NativeModules
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
  import { useRouter, useLocalSearchParams } from 'expo-router';
  import * as Haptics from 'expo-haptics';
  import QRCode from 'react-native-qrcode-svg';
  import * as MediaLibrary from 'expo-media-library';
  import { captureRef } from 'react-native-view-shot';
  import api from '../utils/enterpriseApi';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { getCurrentUser } from '../artemis-api/middleware/auth';
  import NetInfo from '@react-native-community/netinfo';
  import offlineStorage from '../artemis-api/utils/offlineStorage';
  import OfflineIndicator from '../components/OfflineIndicator';


  // Arayüzleri dosya dışına taşı
  interface BluetoothDevice {
    name?: string;
    address: string;
  }

  interface NumuneData {
    qr_kod?: string;
    firma_adi?: string;
    alinan_yer?: string;
    numune_giris?: string;
    numune_cikis?: string;
    alma_noktasi?: string;
    numune_turu?: string;
    alan_kisi?: string;
    durum?: string;
  }

  const { BixolonPrinter } = NativeModules;

  // BIXOLON utility fonksiyonları
  const bluetoothIzinleriKontrolEt = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }
  
    try {
      const permissions = [];
      
      if (Platform.Version >= 31) {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
      } else {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      }
  
      // İzinleri kontrol et
      const checkResults = await Promise.all(
        permissions.map(async (permission) => {
          const result = await PermissionsAndroid.check(permission);
          console.log(`${permission}: ${result}`);
          return result;
        })
      );
  
      const allGranted = checkResults.every(result => result === true);
      
      if (allGranted) {
        console.log("✅ All permissions granted");
        return true;
      }
  
      // İzinleri iste
      const requestResults = await PermissionsAndroid.requestMultiple(permissions);
      console.log("📝 Request results:", requestResults);
      
      const newAllGranted = Object.values(requestResults).every(
        status => status === PermissionsAndroid.RESULTS.GRANTED
      );
  
    // Android 9 bypass kısmını daha güvenli yap:
    if (!newAllGranted && Platform.Version <= 29) {
      console.log("⚠️ Android 9 detected, using bypass");
      Alert.alert(
        "İzin Uyarısı",
        "Bazı izinler verilmedi, ancak Android 9'da bu normal olabilir. Bluetooth çalışmazsa:\n\n1. Ayarlar > Uygulamalar > Artemis > İzinler\n2. Konum > İZİN VER\n3. Uygulamayı yeniden başlatın",
        [
          { text: "Tamam", onPress: () => {} }
        ]
      );
      return true; // ✅ Bypass
    }
  
      return newAllGranted;
    } catch (error) {
      console.error('🚨 Bluetooth izin kontrolü hatası:', error);
      
      // Android 9 için hata durumunda da bypass
      if (Platform.Version <= 29) {
        console.log("🚨 Error bypass for Android 9");
        return true;
      }
      
      return false;
    }
  };



// Bu fonksiyonu değiştirin:
const cihazlariTara = async () => {
  try {
    if (!BixolonPrinter) {
      console.log("❌ BixolonPrinter module not found");
      return [];
    }
    
    console.log("🔍 Scanning for paired Bixolon devices...");
    const devices = await BixolonPrinter.scanForDevices();
    console.log("📡 Found devices:", devices);
    
    // EĞER BIXOLON CİHAZ BULUNAMAZSA, TÜM CİHAZLARI GÖSTER (DEBUG İÇİN)
    if (devices.length === 0) {
      console.log("⚠️ No Bixolon devices found, trying all paired devices...");
      try {
        const allDevices = await BixolonPrinter.getAllPairedDevices(); // Bu fonksiyonu Java'da ekleyeceğiz
        console.log("📱 All paired devices:", allDevices);
        return allDevices;
      } catch (error) {
        console.log("❌ Could not get all paired devices");
      }
    }
    
    return devices;
  } catch (error) {
    console.error("💥 Scan error:", error);
    return [];
  }
};

const cihazaBaglan = async (deviceAddress: string) => {
  try {
    if (!BixolonPrinter) {
      console.log("❌ BixolonPrinter module not found");
      return false;
    }
    
    console.log("🔄 Trying to connect to:", deviceAddress);
    
    // Önce mevcut bağlantıyı kes
    try {
      await BixolonPrinter.disconnectPrinter();
      console.log("🔌 Previous connection disconnected");
    } catch (disconnectError) {
      console.log("⚠️ No previous connection to disconnect");
    }
    
    // Yeni bağlantı kur
    const result = await BixolonPrinter.connectPrinter(deviceAddress);
    console.log("✅ Connection result:", result);
    
    // Kısa bekle
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Bağlantı durumunu kontrol et
    const connectionStatus = await BixolonPrinter.isConnected();
    console.log("📊 Connection status:", connectionStatus);
    
    return connectionStatus;
  } catch (error) {
    console.error("💥 Connection error:", error);
    return false;
  }
};

// barkodYazdir fonksiyonunu şöyle güncelleyin (118. satır):
const barkodYazdir = async (numuneData: NumuneData) => {
  try {
    if (!BixolonPrinter) {
      console.log("❌ BixolonPrinter module not found");
      return false;
    }
    
    // ÖNCE BAĞLANTI DURUMUNU KONTROL ET
    const connectionStatus = await BixolonPrinter.isConnected();
    console.log("🔗 Connection status before print:", connectionStatus);
    
    if (!connectionStatus) {
      console.log("❌ Printer not connected for printing");
      return false;
    }
    
    const formData = JSON.stringify(numuneData);
    console.log("🖨️ Print formatted label:", formData);
    
    // YAZICI DURUMUNU KONTROL ET
    try {
      const printerStatus = await BixolonPrinter.getPrinterStatus();
      console.log("📊 Printer status:", printerStatus);
    } catch (statusError) {
      console.log("⚠️ Cannot get printer status:", statusError);
    }
    
    const result = await BixolonPrinter.printFormattedLabel(formData);
    console.log("✅ Print result:", result);
    
    return true;
  } catch (error) {
    console.error("💥 Print error:", error);
    return false;
  }
};


  const { width, height } = Dimensions.get('window');
  const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

  // Uygulama ilk açıldığında izin kontrolü
  const izinleriKontrolEt = async () => {
    // Sadece MediaLibrary izni kontrolü
    const { status: mediaStatus } = await MediaLibrary.getPermissionsAsync();
    if (mediaStatus !== 'granted') {
      await MediaLibrary.requestPermissionsAsync();
    }
  };


  // Burada export default olduğundan emin ol
  export default function BarkodEkrani() {
    const router = useRouter();
    const [numune, setNumune] = useState<{
      giris: string;
      cikis: string;
      firmaAdi?: string;
      alinanYer?: string;
      numuneTarihi?: string;
      labGelisTarihi?: string;
      alanKisi?: string;
    }>({ 
      giris: '', 
      cikis: '',
      firmaAdi: '',
      alinanYer: '',
      numuneTarihi: new Date().toLocaleDateString('tr-TR'),
      labGelisTarihi: new Date().toLocaleDateString('tr-TR'),
      alanKisi: '',
    });
    const [cihazlar, setCihazlar] = useState<BluetoothDevice[]>([]);
    const [secilenCihaz, setSecilenCihaz] = useState<BluetoothDevice | null>(null);
    const [yukleniyor, setYukleniyor] = useState<boolean>(false);
    const [baglanti, setBaglanti] = useState<boolean>(false);
    const [barkodKodu, setBarkodKodu] = useState<string>('');
    const [numuneData, setNumuneData] = useState<NumuneData | null>(null);
    const [qrKodFromParams, setQrKodFromParams] = useState<string | null>(null);
    const [companies, setCompanies] = useState<{id: number, name: string, address: string}[]>([]);
    const [showFirmaDropdown, setShowFirmaDropdown] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [filteredCompanies, setFilteredCompanies] = useState<{id: number, name: string, address: string}[]>([]);
    const barkodFormRef = useRef(null);

    // Numune verilerini QR kod ile yükle
    const loadNumuneData = async (qrKod: string) => {
      try {
        const networkState = await NetInfo.fetch();
        
        if (!networkState.isConnected) {
          console.log('📴 Offline: Numune verisi yüklenemez');
          Alert.alert(
            'Offline Mod', 
            'İnternet bağlantısı olmadığından numune verisi yüklenemiyor. Manuel olarak bilgileri girebilirsiniz.'
          );
          return;
        }
    
        console.log('🔍 Numune verisi yükleniyor:', qrKod);
        const response = await api.get(`/api/numune-sorgula/${qrKod}`);
        
        if (response.data) {
          setNumuneData(response.data);
    
          // Mevcut kullanıcı bilgilerini al
          let defaultAlanKisi = '';
          try {
            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
              const user = JSON.parse(userData);
              defaultAlanKisi = `${user.ad || ''} ${user.soyad || ''}`.trim();
            }
          } catch (userError) {
            console.log('Kullanıcı bilgisi alınamadı:', userError);
          }
          
          // Form verilerini numune verileriyle doldur
          setNumune({
            giris: response.data.numune_giris?.toString() || '',
            cikis: response.data.numune_cikis?.toString() || '',
            firmaAdi: response.data.firma_adi || '',
            alinanYer: response.data.alinan_yer || '',
            numuneTarihi: response.data.numune_alis_tarihi ? 
              new Date(response.data.numune_alis_tarihi).toLocaleDateString('tr-TR') : 
              new Date().toLocaleDateString('tr-TR'),
            labGelisTarihi: response.data.lab_gelis_tarihi ? 
              new Date(response.data.lab_gelis_tarihi).toLocaleDateString('tr-TR') : 
              new Date().toLocaleDateString('tr-TR'),
            alanKisi: response.data.alan_kisi || defaultAlanKisi,
          });
          
          console.log('✅ Numune verisi yüklendi:', response.data);
        }
      } catch (error) {
        console.error('❌ Numune verisi yüklenemedi:', error);
        Alert.alert('Hata', 'Numune verisi yüklenemedi. Manuel olarak bilgileri girebilirsiniz.');
      }
    };

    // Barkodu paylaşma fonksiyonu
    const barkodPaylas = async () => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // React Native Share API ile paylaşım
        await Share.share({
          message: `Artemis Arıtım Barkod: ${barkodKodu}\nFirma: ${numune.firmaAdi}\nNumune Alış Tarihi: ${numune.numuneTarihi}`,
          title: 'Barkod Paylaş'
        });
      } catch (error) {
        // Kullanıcı paylaşım penceresini kapattığında da hata fırlatır, bu normal
        console.error("Paylaşım hatası:", error);
        Alert.alert("Paylaşım Hatası", "Barkod paylaşılırken bir hata oluştu");
      }
    };

    const barkodKaydet = async () => {
      try {
        // Uygulamanın başlangıcında izinleri kontrol edin
        const { status } = await MediaLibrary.getPermissionsAsync();
        
        // İzinleri iste
        if (status !== 'granted') {
          const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
          
          if (newStatus !== 'granted') {
            Alert.alert(
              'İzin Reddedildi', 
              'Barkod kaydedebilmek için Ayarlar\'a gidip uygulamaya galeri erişim izni vermeniz gerekiyor.',
              [
                { text: 'Tamam', style: 'cancel' }
              ]
            );
            return;
          }
        }
        
        // Haptik geri bildirim
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // QR kod ve form görüntüsünü yakalayın
        const uri = await captureRef(barkodFormRef, {
          quality: 1,
          format: 'png',
          result: 'file',
        });
        
        console.log("Yakalanan görüntü URI:", uri);
        
        try {
          // Galeriye kaydedin
          const asset = await MediaLibrary.createAssetAsync(uri);
          
          if (!asset) {
            throw new Error("Asset oluşturulamadı");
          }
          
          // Albüm oluşturmayı dene
          try {
            await MediaLibrary.createAlbumAsync('Artemis', asset, false);
          } catch (albumError) {
            console.warn("Albüm oluşturma hatası, ana galeriye kaydedildi:", albumError);
            // Albüm oluşturulamazsa bile asset kaydediliyor, bu yüzden devam et
          }
          
          Alert.alert('Başarılı', 'Barkod galeriye kaydedildi');
        } catch (assetError) {
          console.error('Asset oluşturma hatası:', assetError);
          Alert.alert('Hata', 'Barkod galeriye kaydedilemedi');
        }
      } catch (error) {
        console.error('Kaydetme hatası:', error);
        
        // Daha detaylı hata mesajı göster
        let errorMessage = 'Barkod kaydedilemedi';
        
        if (error.message) {
          errorMessage += `: ${error.message}`;
        }
        
        if (Platform.OS === 'android') {
          errorMessage += '\n\nAndroid için: Ayarlar > Uygulamalar > Artemis > İzinler > Depolama iznini kontrol edin';
        } else if (Platform.OS === 'ios') {
          errorMessage += '\n\niOS için: Ayarlar > Gizlilik > Fotoğraflar > Artemis iznini kontrol edin';
        }
        
        Alert.alert('Hata', errorMessage);
      }
    };

  // İlk yüklemede firmalar listesini çek
  const loadCompanies = async () => {
    try {
      const networkState = await NetInfo.fetch();
      setIsOffline(!networkState.isConnected);
      
      if (networkState.isConnected) {
        // ✅ Online - API'den çek
        const response = await api.get('/api/companies');
        if (response.data) {
          const companyList = response.data
            .filter((company: any) => company.rol === 2)
            .map((company: any) => ({
              id: company.company_id,
              name: company.company_name,
              address: company.address || ''
            }));
          setCompanies(companyList);
          setFilteredCompanies(companyList);
        }
      } else {
        // ✅ Offline - Cache'den çek
        console.log('📴 Offline: Firmalar cache\'den yükleniyor...');
        const cachedCompanies = await offlineStorage.getCachedCompanies();
        const companyList = cachedCompanies.map((company: any) => ({
          id: company.company_id,
          name: company.company_name,
          address: company.address || ''
        }));
        setCompanies(companyList);
        setFilteredCompanies(companyList);
      }
    } catch (error) {
      console.error('❌ Firmalar yüklenirken hata:', error);
      
      // Hata durumunda cache'den yükle
      try {
        const cachedCompanies = await offlineStorage.getCachedCompanies();
        const companyList = cachedCompanies.map((company: any) => ({
          id: company.company_id,
          name: company.company_name,
          address: company.address || ''
        }));
        setCompanies(companyList);
        setFilteredCompanies(companyList);
      } catch (cacheError) {
        console.error('❌ Cache\'den firma yükleme hatası:', cacheError);
      }
    }
  };

    // Firma arama fonksiyonu
    const handleFirmaSearch = (text: string) => {
      setNumune({...numune, firmaAdi: text});
      
      // Eğer tam eşleşen firma yoksa ve kullanıcı manuel yazıyorsa
      // alinanYer'i temizleme (kullanıcı manuel yazıyor)
      const exactMatch = companies.find(company => 
        company.name.toLowerCase() === text.toLowerCase()
      );
      
      if (!exactMatch && text.length > 0) {
        // Manuel yazıyorsa alinanYer'i temizleme
        // Sadece firmaAdi'yi güncelle
      }
      
      if (text.length > 0) {
        const filtered = companies.filter(company => 
          company.name.toLowerCase().includes(text.toLowerCase())
        );
        setFilteredCompanies(filtered);
        setShowFirmaDropdown(filtered.length > 0);
      } else {
        setFilteredCompanies(companies);
        setShowFirmaDropdown(false);
      }
    };

    // Firma seçme fonksiyonu
    const selectFirma = (company: {id: number, name: string, address: string}) => {
      setNumune({
        ...numune, 
        firmaAdi: company.name,
        alinanYer: company.address || '' // Otomatik address ekle
      });
      setShowFirmaDropdown(false);
      setFilteredCompanies(companies);
    };

    // İlk yüklemede izinleri kontrol et
    useEffect(() => {
      izinleriKontrolEt();
      loadCompanies();
      
      // Async fonksiyonu ayrı tanımla ve çağır
      const initializeData = async () => {
        try {
          // Kullanıcı bilgilerini çek ve alan kişi alanını doldur
          const userData = await AsyncStorage.getItem('userData');
          if (userData) {
            const user = JSON.parse(userData);
            const alanKisiAdi = `${user.ad || ''} ${user.soyad || ''}`.trim();
            
            // Alan kişi alanını otomatik doldur
            setNumune(prev => ({
              ...prev,
              alanKisi: alanKisiAdi || prev.alanKisi
            }));
          }
          
          const params = useLocalSearchParams();
          const qrKod = params.qr_kod as string;
          
          if (qrKod) {
            setQrKodFromParams(qrKod);
            await loadNumuneData(qrKod);
          }
        } catch (error) {
          console.log('QR kod parametresi bulunamadı');
        }
      };
      
      initializeData();
    }, []);

    // Barkod kodunu oluştur
    // ✅ DÜZELTME: QR kod oluşturma standardize edildi
    useEffect(() => {
      if (qrKodFromParams) {
        setBarkodKodu(qrKodFromParams);
      } else if (numune.giris || numune.cikis) {
        // ✅ Backend ile aynı format kullan
        const timestamp = Date.now();
        const kod = `AR${new Date().getFullYear()}${String(timestamp).slice(-6)}`;
        setBarkodKodu(kod);
      } else {
        setBarkodKodu('');
      }
    }, [numune.giris, numune.cikis, qrKodFromParams]);

    // Bluetooth cihazlarını tara
    const taramayiBaslat = async () => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setYukleniyor(true);
        
        // Önce Bluetooth izinlerini kontrol et
        const izinVarMi = await bluetoothIzinleriKontrolEt();
        
        if (!izinVarMi) {
          Alert.alert(
            "Bluetooth İzinleri", 
            "Bluetooth cihazlarını taramak için gerekli izinler verilmedi. Lütfen ayarlardan izinleri etkinleştirin.",
            [
              { text: "Tamam", style: "default" }
            ]
          );
          return;
        }

        Alert.alert("Bluetooth Durumu", "Bluetooth hazır, cihazlar taranıyor...");
        
        const bulunanCihazlar = await cihazlariTara();
        setCihazlar(bulunanCihazlar);
        
        if (bulunanCihazlar.length === 0) {
          Alert.alert(
            "Cihaz Bulunamadı", 
            "Bixolon yazıcı bulunamadı. Lütfen yazıcının eşleştirildiğinden emin olun."
          );
        } else {
          Alert.alert("Başarılı", `${bulunanCihazlar.length} adet Bixolon yazıcı bulundu`);
        }
        
      } catch (error) {
        console.error("Bluetooth tarama hatası:", error);
        Alert.alert("Hata", "Cihazlar taranırken bir hata oluştu");
      } finally {
        setYukleniyor(false);
      }
    };

  // connectAndPrintBitmap fonksiyonu ekle
const connectAndPrintBitmap = async () => {
  try {
    setYukleniyor(true);
    
    // Bağlantı kontrolü
    let isConnected = await BixolonPrinter.isConnected();
    
    if (!isConnected) {
      console.log("🚀 Otomatik bağlanıyor...");
      const result = await BixolonPrinter.connectAndPrint("dummy");
      await new Promise(resolve => setTimeout(resolve, 2000));
      setBaglanti(true);
    }
    
    // Bitmap yazdır
    await bitmapYazdir();
    
  } catch (error) {
    console.error("Bağlantı ve bitmap yazdırma hatası:", error);
    Alert.alert("Hata", "Bağlantı kurulamadı");
  } finally {
    setYukleniyor(false);
  }
};

  // Cihaza bağlanma
  const cihazSec = async (device: BluetoothDevice) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setYukleniyor(true);
      
      console.log("🔌 Connecting to device:", device);
      const baglantiDurumu = await cihazaBaglan(device.address);
      
      if (baglantiDurumu) {
        setSecilenCihaz(device);
        setBaglanti(true);
        Alert.alert("Başarılı", `${device.name || 'Bilinmeyen Cihaz'} yazıcısına bağlandı`);
      } else {
        setBaglanti(false);
        Alert.alert("Bağlantı Hatası", "Yazıcıya bağlanılamadı");
      }
      
    } catch (error) {
      console.error("Connection process error:", error);
      setBaglanti(false);
      Alert.alert("Hata", "Bağlantı sırasında bir hata oluştu");
    } finally {
      setYukleniyor(false);
    }
  };

  
  // Gerçek yazıcı durumunu kontrol et
  const gercekDurumKontrol = async () => {
    try {
      if (!BixolonPrinter) {
        Alert.alert("Hata", "BixolonPrinter modülü bulunamadı");
        return;
      }
      
      console.log("🔍 Checking real printer status...");
      const status = await BixolonPrinter.checkRealPrinterStatus();
      console.log("📊 Real status:", status);
      
      Alert.alert(
        "Yazıcı Durumu", 
        `Bağlantı: ${status.isConnected ? 'Aktif' : 'Yok'}\nMesaj: ${status.message}`
      );
      
      setBaglanti(status.isConnected);
      
    } catch (error) {
      console.error("💥 Status check error:", error);
      Alert.alert("Durum Hatası", `Durum kontrolü başarısız: ${error.message}`);
    }
  };
  
  // Gelişmiş debug yazdırma
  const debugYazdir = async () => {
    if (!numune.giris || !numune.cikis) {
      Alert.alert("Hata", "Lütfen numune giriş ve çıkış değerlerini girin");
      return;
    }
  
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setYukleniyor(true);
      
      // Debug için detaylı log
      const debugData = {
        ...numune,
        timestamp: Date.now(),
        debug: true
      };
      
      console.log("🐛 Debug print data:", JSON.stringify(debugData, null, 2));
      
      const isCurrentlyConnected = await BixolonPrinter.isConnected();
      console.log("🔍 Current connection status:", isCurrentlyConnected);
      
      if (!isCurrentlyConnected) {
        console.log("🚀 Auto-connecting and printing...");
        const qrData = JSON.stringify(debugData);
        const result = await BixolonPrinter.connectAndPrint(qrData);
        console.log("🎯 ConnectAndPrint result:", result);
        Alert.alert("Debug Başarılı", `Barkod otomatik olarak yazdırıldı!\n\nResult: ${result}`);
        setBaglanti(true);
      } else {
        console.log("📝 Printing with existing connection...");
        const yazdirmaDurumu = await BixolonPrinter.printFormattedLabel(JSON.stringify(debugData));
        console.log("✅ Print result:", yazdirmaDurumu);
        
        Alert.alert("Debug Başarılı", `Barkod yazdırıldı!\n\nResult: ${yazdirmaDurumu}`);
      }
      
    } catch (error) {
      console.error("💥 Debug print error:", error);
      Alert.alert("Debug Hatası", `Debug yazdırma başarısız:\n\n${error.message}`);
    } finally {
      setYukleniyor(false);
    }
  };

  // Sisteme kaydetme fonksiyonu - DÜZELTİLMİŞ
  const sistemKaydet = async () => {
    try {
      setYukleniyor(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
      let company_id = '1';
      let actualFirmaAdi = numune.firmaAdi;
      
      // ✅ Auth ve firma bilgilerini al (online/offline)
      try {
        const enterpriseUser = await getCurrentUser();
        
        if (enterpriseUser) {
          if (enterpriseUser.userType === 'company') {
            company_id = (enterpriseUser.company_id || enterpriseUser.id).toString();
          } else if (enterpriseUser.userType === 'employee') {
            if (numune.firmaAdi) {
              // ✅ Cache'den firma ara (offline-safe)
              const cachedCompanies = await offlineStorage.getCachedCompanies();
              const selectedFirma = cachedCompanies.find(firma => 
                firma.company_name.toLowerCase() === numune.firmaAdi.toLowerCase()
              );
              
              if (selectedFirma) {
                company_id = selectedFirma.company_id.toString();
                actualFirmaAdi = selectedFirma.company_name;
              }
            }
          }
        }
      } catch (authError) {
        console.error('❌ Auth sistem hatası:', authError);
      }
  
      const submitData = {
        firma_adi: actualFirmaAdi,
        alinan_yer: numune.alinanYer,
        numune_giris: numune.giris ? parseFloat(numune.giris) : null,
        numune_cikis: numune.cikis ? parseFloat(numune.cikis) : null,
        alma_noktasi: 'Manuel Giriş',
        numune_turu: 'Su',
        alma_notlari: `Barkod ekranından oluşturuldu - ${new Date().toLocaleString('tr-TR')}`,
        alan_kisi: numune.alanKisi,
        company_id: parseInt(company_id),
        durum: 'numune_alindi'
      };
  
      // ✅ Network kontrolü
      const networkState = await NetInfo.fetch();
      
      if (networkState.isConnected) {
        // ✅ Online - Direkt API'ye gönder
        console.log('🌐 Online: API\'ye gönderiliyor...');
        const response = await api.post('/api/numune-al', submitData);
        
        if (response.data && response.data.data) {
          const qrKod = response.data.data.qr_kod;
          setQrKodFromParams(qrKod);
          setBarkodKodu(qrKod);
          
          Alert.alert(
            'Başarılı!', 
            `Numune sisteme kaydedildi!\n\nFirma: ${submitData.firma_adi}\nQR Kod: ${qrKod}`
          );
        }
      } else {
        // ✅ Offline - Cache'e kaydet, sync için beklet
        console.log('📴 Offline: Numune offline kaydediliyor...');
        
        // Geçici QR kod oluştur
        const timestamp = Date.now();
        const tempQrKod = `TEMP_AR${new Date().getFullYear()}${String(timestamp).slice(-6)}`;
        
        // Offline storage'a kaydet
        await offlineStorage.saveForm('numune_kayit', {
          ...submitData,
          temp_qr_kod: tempQrKod,
          created_offline: true,
          offline_timestamp: new Date().toISOString()
        }, []);
        
        setQrKodFromParams(tempQrKod);
        setBarkodKodu(tempQrKod);
        
        Alert.alert(
          'Offline Kayıt', 
          `Numune offline kaydedildi!\n\nFirma: ${submitData.firma_adi}\nGeçici QR: ${tempQrKod}\n\nİnternet bağlantısı kurulduğunda otomatik sisteme gönderilecek.`
        );
      }
  
    } catch (error) {
      console.error('❌ Sistem kaydetme hatası:', error);
      
      // ✅ Hata durumunda da offline kaydet
      try {
        const timestamp = Date.now();
        const tempQrKod = `ERR_AR${new Date().getFullYear()}${String(timestamp).slice(-6)}`;
        
        await offlineStorage.saveForm('numune_kayit', {
          firma_adi: numune.firmaAdi,
          alinan_yer: numune.alinanYer,
          numune_giris: numune.giris ? parseFloat(numune.giris) : null,
          numune_cikis: numune.cikis ? parseFloat(numune.cikis) : null,
          alan_kisi: numune.alanKisi,
          temp_qr_kod: tempQrKod,
          error_fallback: true,
          error_message: error.message,
          offline_timestamp: new Date().toISOString()
        }, []);
        
        setBarkodKodu(tempQrKod);
        
        Alert.alert(
          'Hata - Offline Kayıt', 
          `API hatası oldu, numune offline kaydedildi.\n\nGeçici QR: ${tempQrKod}\n\nİnternet bağlantısı kurulduğunda tekrar denenecek.`
        );
      } catch (offlineError) {
        Alert.alert('Kritik Hata', 'Numune ne online ne de offline kaydedilemedi.');
      }
    } finally {
      setYukleniyor(false);
    }
  };

  // Bitmap yazdırma fonksiyonu
  const bitmapYazdir = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setYukleniyor(true);
      
      if (!barkodFormRef.current) {
        Alert.alert("Hata", "Barkod önizlemesi bulunamadı");
        return;
      }
      
      console.log("🖼️ Bitmap yakalama başlıyor...");
      
      // Barkod önizlemesini base64 olarak yakala
      const base64Image = await captureRef(barkodFormRef, {
        quality: 1,
        format: 'png',
        result: 'base64',
      });
      
      console.log("📷 Bitmap yakalandı, yazdırma başlıyor...");
      
      // Bitmap'i yazdır
      const result = await BixolonPrinter.printBitmapFromBase64(base64Image);
      console.log("✅ Bitmap yazdırma sonucu:", result);
      
      Alert.alert("Başarılı", "Barkod bitmap olarak yazdırıldı!");
      
    } catch (error) {
      console.error("💥 Bitmap yazdırma hatası:", error);
      Alert.alert("Hata", `Bitmap yazdırma başarısız: ${error.message}`);
    } finally {
      setYukleniyor(false);
    }
  };

  const yazdir = async () => {
    if (!numune.giris && !numune.cikis) {
      Alert.alert("Hata", "Lütfen en az bir numune değeri (giriş veya çıkış) girin");
      return;
    }
  
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setYukleniyor(true);
      
      // BAĞLANTI DURUMUNU KONTROL ET
      let isCurrentlyConnected = false;
      try {
        isCurrentlyConnected = await BixolonPrinter.isConnected();
        console.log("🔍 Current connection status:", isCurrentlyConnected);
      } catch (statusError) {
        console.log("⚠️ Could not check connection status:", statusError);
        isCurrentlyConnected = false;
      }
      
      if (!isCurrentlyConnected) {
        console.log("🚀 Auto-connecting...");
        try {
          // Dummy data ile bağlantı kur
          const result = await BixolonPrinter.connectAndPrint("dummy");
          console.log("🎯 ConnectAndPrint result:", result);
          
          // Kısa bekle
          await new Promise(resolve => setTimeout(resolve, 2000));
          setBaglanti(true);
          
          // Bağlantı kurulduktan sonra bitmap yazdır
          await bitmapYazdir();
          
        } catch (connectPrintError) {
          console.error("💥 ConnectAndPrint error:", connectPrintError);
          Alert.alert("Bağlantı Hatası", 
            `Yazıcıya bağlanılamadı:\n${connectPrintError.message || 'Bilinmeyen hata'}`);
        }
      } else {
        // Zaten bağlıysa direkt bitmap yazdır
        console.log("📝 Printing bitmap with existing connection...");
        await bitmapYazdir();
      }
      
    } catch (error) {
      console.error("💥 General print error:", error);
      Alert.alert("Yazdırma Hatası", 
        `Genel yazdırma hatası:\n${error.message || 'Bilinmeyen hata'}`);
    } finally {
      setYukleniyor(false);
    }
  };

    return (
      <View style={styles.mainContainer}>
        <OfflineIndicator />
        <StatusBar
          barStyle="light-content"
          backgroundColor="#1E3A8A"
          translucent
        />
        <LinearGradient 
          colors={['#1E3A8A', '#2563EB']} 
          style={styles.headerGradient}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Barkod Yazdırma</Text>
        </LinearGradient>

        <ScrollView 
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Numune Bilgileri */}
          <View style={styles.card}>
            <View style={styles.cardHeaderWithIcon}>
              <MaterialCommunityIcons name="flask-outline" size={24} color="#1E3A8A" />
              <Text style={styles.cardTitle}>Numune Bilgileri</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Firma Adı:</Text>
              <View style={styles.dropdownContainer}>
                <TextInput
                  style={styles.input}
                  value={numune.firmaAdi}
                  onChangeText={handleFirmaSearch}
                  onFocus={() => {
                    if (companies.length > 0) {
                      setFilteredCompanies(companies);
                      setShowFirmaDropdown(true);
                    }
                  }}
                  placeholder="Firma adını girin veya listeden seçin"
                  placeholderTextColor="#94A3B8"
                />
                
                {showFirmaDropdown && (
                  <View style={styles.dropdown}>
                    <ScrollView 
                      style={styles.dropdownScrollView}
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredCompanies.map((company) => (
                        <TouchableOpacity
                          key={company.id}
                          style={styles.dropdownItem}
                          onPress={() => selectFirma(company)}
                        >
                          <Text style={styles.dropdownItemText}>{company.name}</Text>
                        </TouchableOpacity>
                      ))}
                      {filteredCompanies.length === 0 && numune.firmaAdi && (
                        <View style={styles.dropdownItem}>
                          <Text style={styles.dropdownNoResult}>
                            Sonuç bulunamadı. Yeni firma adı olarak eklenecek.
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Alınan Yer:</Text>
              <TextInput
                style={styles.input}
                value={numune.alinanYer}
                onChangeText={(text) => setNumune({...numune, alinanYer: text})}
                placeholder="Numune alınan yeri girin"
              />
            </View>
            
            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, {flex: 1, marginRight: 10}]}>
                <Text style={styles.inputLabel}>Numune Giriş (L):</Text>
                <TextInput
                  style={styles.input}
                  value={numune.giris}
                  onChangeText={(text) => setNumune({...numune, giris: text})}
                  keyboardType="numeric"
                  placeholder="Giriş değeri"
                />
              </View>
              
              <View style={[styles.inputContainer, {flex: 1}]}>
                <Text style={styles.inputLabel}>Numune Çıkış (L):</Text>
                <TextInput
                  style={styles.input}
                  value={numune.cikis}
                  onChangeText={(text) => setNumune({...numune, cikis: text})}
                  keyboardType="numeric"
                  placeholder="Çıkış değeri"
                />
              </View>
            </View>
            
            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, {flex: 1, marginRight: 10}]}>
                <Text style={styles.inputLabel}>Numune Alış Tarihi:</Text>
                <TextInput
                  style={styles.input}
                  value={numune.numuneTarihi}
                  onChangeText={(text) => setNumune({...numune, numuneTarihi: text})}
                  placeholder="GG/AA/YYYY"
                />
              </View>
              
              {/*
              <View style={[styles.inputContainer, {flex: 1}]}>
                <Text style={styles.inputLabel}>Lab. Geliş Tarihi:</Text>
                <TextInput
                  style={styles.input}
                  value={numune.labGelisTarihi}
                  onChangeText={(text) => setNumune({...numune, labGelisTarihi: text})}
                  placeholder="GG/AA/YYYY"
                />
              </View>
              */}
            </View>
            
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Alan Kişi:</Text>
              <TextInput
                style={styles.input}
                value={numune.alanKisi}
                onChangeText={(text) => setNumune({...numune, alanKisi: text})}
                placeholder="Numune alan kişinin adını girin"
              />
            </View>
          </View>

          {/* Barkod Önizleme */}
          {(barkodKodu || qrKodFromParams) ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderWithIcon}>
                  <FontAwesome5 name="qrcode" size={22} color="#1E3A8A" />
                  <Text style={styles.cardTitle}>
                    {qrKodFromParams ? 'Numune Barkodu' : 'Barkod Önizleme'}
                  </Text>
                  {numuneData && (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{numuneData.durum || 'Bilinmiyor'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.headerButtons}>
                  <TouchableOpacity 
                    style={styles.iconButton} 
                    onPress={barkodKaydet}
                  >
                    <Ionicons name="save-outline" size={24} color="#1E3A8A" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.iconButton} 
                    onPress={barkodPaylas}
                  >
                    <Ionicons name="share-outline" size={24} color="#1E3A8A" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.barkodContainer} ref={barkodFormRef}>
                {/* Artemis Logo */}
                <View style={styles.logoContainer}>
                  <Text style={styles.logoText}>ARTEMİS ARITIM</Text>
                </View>
                
                {/* Barkod Form */}
                <View style={styles.barkodForm}>
                <View style={styles.formContainer}>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Firma:</Text>
                    <Text style={styles.formValue}>{numune.firmaAdi || '-'}</Text>
                  </View>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>QR Kod:</Text>
                    <Text style={styles.formValue}>{qrKodFromParams || barkodKodu}</Text>
                  </View>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Yer:</Text>
                    <Text style={styles.formValue}>{numune.alinanYer || '-'}</Text>
                  </View>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Giriş:</Text>
                    <Text style={styles.formValue}>{numune.giris || '-'} L</Text>
                  </View>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Çıkış:</Text>
                    <Text style={styles.formValue}>{numune.cikis || '-'} L</Text>
                  </View>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Kişi:</Text>
                    <Text style={styles.formValue}>{numune.alanKisi || '-'}</Text>
                  </View>
                </View>
                  
                  <View style={styles.qrCodeContainer}>
                  <QRCode
                      value={qrKodFromParams || barkodKodu}
                      size={70}
                      backgroundColor="white"
                      color="black"
                    />
                    <Text style={styles.barkodText}>{qrKodFromParams || barkodKodu}</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {/* Yazıcı Bağlantısı */}
          <View style={styles.card}>
            <View style={styles.cardHeaderWithIcon}>
              <Ionicons name="print-outline" size={24} color="#1E3A8A" />
              <Text style={styles.cardTitle}>Yazıcı Bağlantısı</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.button}
              onPress={taramayiBaslat}
              disabled={yukleniyor}
            >
              <Ionicons name="bluetooth" size={20} color="white" />
              <Text style={styles.buttonText}>
                {yukleniyor ? "Taranıyor..." : "Bluetooth Cihazlarını Tara"}
              </Text>
              {yukleniyor && <ActivityIndicator color="white" style={{marginLeft: 10}} />}
            </TouchableOpacity>

            {/* Bulunan Cihazlar Listesi */}
            {cihazlar.length > 0 && (
              <View style={styles.cihazlarContainer}>
                <Text style={styles.cihazlarBaslik}>Bulunan Cihazlar:</Text>
                {cihazlar.map((device, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[
                      styles.cihazItem,
                      secilenCihaz && secilenCihaz.address === device.address ? 
                        styles.secilenCihaz : {}
                    ]}
                    onPress={() => cihazSec(device)}
                  >
                    <Ionicons 
                      name={baglanti ? "print" : "print-outline"} 
                      size={20} 
                      color="white" 
                    />
                    <Text style={[
                      styles.cihazIsim,
                      secilenCihaz && secilenCihaz.address === device.address ? 
                        {color: "white"} : {}
                    ]}>
                      {device.name || "İsimsiz Cihaz"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Bağlantı Durumu */}
            <View style={styles.baglatiDurumuContainer}>
              <View style={styles.baglatiDurumuIcerik}>
                <View style={[
                  styles.baglatiDurumuIndikator, 
                  {backgroundColor: baglanti ? '#10B981' : '#EF4444'}
                ]} />
                <Text style={styles.baglatiDurumuText}>
                  Bağlantı Durumu: 
                  <Text style={{
                    color: baglanti ? '#10B981' : '#EF4444',
                    fontWeight: 'bold'
                  }}>
                    {baglanti ? ' Bağlı' : ' Bağlı Değil'}
                  </Text>
                </Text>
              </View>
              {baglanti && secilenCihaz && (
                <Text style={styles.baglatiCihazText}>
                  Yazıcı: {secilenCihaz.name || 'Bilinmeyen Cihaz'}
                </Text>
              )}
            </View>

            {/* Sisteme Kaydet Butonu */}
            {!qrKodFromParams && (
              <TouchableOpacity 
                style={[
                  styles.buttonKaydet, 
                  (!numune.firmaAdi || !numune.alinanYer || (!numune.giris && !numune.cikis) || yukleniyor) ? styles.disabledButton : {}
                ]}
                onPress={sistemKaydet}
                disabled={!numune.firmaAdi || !numune.alinanYer || (!numune.giris && !numune.cikis) || yukleniyor}
              >
                <Ionicons name="cloud-upload" size={20} color="white" />
                <Text style={styles.buttonText}>
                  {yukleniyor ? "Kaydediliyor..." : "Sisteme Kaydet ve QR Oluştur"}
                </Text>
                {yukleniyor && <ActivityIndicator color="white" style={{marginLeft: 10}} />}
              </TouchableOpacity>
            )}

            {/* Yolda durumundaki numuneler için uyarı mesajı */}
            {qrKodFromParams && numuneData && numuneData.durum === 'numune_alindi' && (
              <View style={styles.warningContainer}>
                <Ionicons name="information-circle" size={20} color="#F59E0B" />
                <Text style={styles.warningText}>
                  Bu numune henüz lab'a teslim edilmemiştir. Sadece bilgileri görüntüleyebilirsiniz.
                </Text>
              </View>
            )}

            {/* Yazdırma Butonu */}
            <TouchableOpacity 
              style={[
                styles.buttonYazdir, 
                (!barkodKodu || yukleniyor || (!numune.giris && !numune.cikis)) ? styles.disabledButton : {}
              ]}
              onPress={yazdir}
              disabled={!barkodKodu || yukleniyor || (!numune.giris && !numune.cikis)}
            >
              <Ionicons name="print" size={20} color="white" />
              <Text style={styles.buttonText}>
                {yukleniyor ? "Yazdırılıyor..." : (baglanti ? "Barkodu Yazdır" : "Bağlan ve Yazdır")}
              </Text>
              {yukleniyor && <ActivityIndicator color="white" style={{marginLeft: 10}} />}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  const styles = StyleSheet.create({
    mainContainer: {
      flex: 1,
      backgroundColor: '#F1F5F9',
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 30,
    },
    warningContainer: {
      backgroundColor: '#FEF3C7',
      padding: 12,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 10,
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    warningText: {
      fontSize: 14,
      color: '#92400E',
      marginLeft: 8,
      flex: 1,
      lineHeight: 20,
    },
    headerGradient: {
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
    card: {
      backgroundColor: 'white',
      borderRadius: 16,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
      paddingBottom: 12,
      marginBottom: 16,
    },
    cardHeaderWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1E3A8A',
      marginLeft: 8,
    },
    inputContainer: {
      marginBottom: 16,
    },
    rowInputs: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 15,
      color: '#334155',
      marginBottom: 8,
      fontWeight: '500',
    },
    input: {
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      backgroundColor: '#F8FAFC',
    },
    button: {
      backgroundColor: '#1E3A8A',
      borderRadius: 10,
      padding: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 6,
      marginBottom: 16,
    },
    buttonYazdir: {
      backgroundColor: '#10B981',
      borderRadius: 10,
      padding: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 10,
    },
    buttonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    disabledButton: {
      backgroundColor: '#94A3B8',
    },
    cihazlarContainer: {
      marginBottom: 16,
      backgroundColor: '#F1F5F9',
      padding: 12,
      borderRadius: 10,
    },
    cihazlarBaslik: {
      fontSize: 16,
      fontWeight: '600',
      color: '#334155',
      marginBottom: 12,
    },
    cihazItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: 'white',
    },
    secilenCihaz: {
      backgroundColor: '#1E3A8A',
      borderColor: '#1E3A8A',
    },
    cihazIsim: {
      fontSize: 15,
      color: '#334155',
      marginLeft: 10,
      fontWeight: '500',
    },
    barkodContainer: {
      backgroundColor: 'white',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      overflow: 'hidden',
      width: 290,        // 58mm genişlik
      height: 200,       // 40mm yükseklik
      alignSelf: 'center',
    },
    
    logoContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#E2E8F0',
      height: 35,
    },
    logoText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: 'black',
      textAlign: 'center',
    },
    barkodForm: {
      padding: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flex: 1,
    },
    formContainer: {
      flex: 2,           // 1.5'ten 2'ye çıkar
      paddingRight: 8,   // 4'ten 8'e çıkar
    },
    formRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    formLabel: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#0F172A',
      width: 80,
    },
    
    formValue: {
      fontSize: 11,
      color: '#334155',
      flex: 1,
    },
    
    qrCodeContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 0,
      marginLeft: 0,
      maxWidth: 100,     // 90'dan 100'e çıkar
    },
    
    barkodText: {
      marginTop: 4,
      fontSize: 8,
      fontWeight: 'bold',
      color: '#0F172A',
      textAlign: 'center',
    },
    baglatiDurumuContainer: {
      marginBottom: 16,
      padding: 14,
      backgroundColor: '#F8FAFC',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    baglatiDurumuIcerik: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    baglatiDurumuIndikator: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },
    baglatiDurumuText: {
      fontSize: 15,
      color: '#334155',
      fontWeight: '500',
    },
    baglatiCihazText: {
      fontSize: 14,
      color: '#64748B',
      marginTop: 6,
      marginLeft: 18,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: {
      padding: 8,
      marginLeft: 10,
      backgroundColor: '#F1F5F9',
      borderRadius: 8,
    },
    statusBadge: {
      backgroundColor: '#10B981',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
    },
    buttonKaydet: {
      backgroundColor: '#059669',
      borderRadius: 10,
      padding: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 10,
    },
    dropdownContainer: {
      position: 'relative',
      zIndex: 1000,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 10,
      maxHeight: 200,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      zIndex: 1001,
    },
    dropdownScrollView: {
      maxHeight: 200,
    },
    dropdownItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    dropdownItemText: {
      fontSize: 16,
      color: '#334155',
    },
    dropdownNoResult: {
      fontSize: 14,
      color: '#94A3B8',
      fontStyle: 'italic',
    },
  });