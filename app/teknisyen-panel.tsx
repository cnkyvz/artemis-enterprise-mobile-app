//app/teknisyen-panel.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Linking, 
  Alert, 
  StatusBar,
  Platform,
  Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';
import { logout } from '../artemis-api/middleware/auth';
import appStateMonitor from '../utils/appStateMonitor';
import EnterpriseTokenManager from '../utils/enterpriseTokenManager';
import NetInfo from '@react-native-community/netinfo';


const { width, height } = Dimensions.get('window');

// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const openWifiSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:root=WIFI');
    } else if (Platform.OS === 'android') {
      Linking.openSettings();
    }
};

export default function TekniksyenPanel() {
    const router = useRouter();
    const navigation = useNavigation();
    const [bekleyenTalepCount, setBekleyenTalepCount] = useState(0);
    const [okunmamisBildirimCount, setOkunmamisBildirimCount] = useState(0);

    // Bekleyen talep sayısını almak için
    useEffect(() => {
        // ✅ initializePanel FONKSİYONUNU DEĞİŞTİR
        const initializePanel = async () => {
            try {
            console.log('🔍 Teknisyen panel auth kontrolü...');
            
            // Detaylı auth kontrolü
            const authStatus = await EnterpriseTokenManager.getAuthStatus();
            
            console.log('📊 Panel Auth Status:', authStatus);
            
            if (!authStatus.isAuthenticated) {
                if (authStatus.needsRefresh) {
                console.log('🔄 Token refresh deneniyor...');
                
                try {
                    await appStateMonitor.triggerTokenCheck();
                    const newAuthStatus = await EnterpriseTokenManager.getAuthStatus();
                    
                    if (!newAuthStatus.isAuthenticated) {
                    console.log('❌ Token refresh başarısız, ana sayfaya yönlendiriliyor');
                    router.replace('/');
                    return;
                    }
                    
                    // Refresh sonrası role kontrolü
                    if (newAuthStatus.userType !== 'employee' || newAuthStatus.userRole !== 1) {
                    console.log('❌ Yanlış rol, doğru panele yönlendiriliyor');
                    if (newAuthStatus.userType === 'company' || newAuthStatus.userRole === 2) {
                        router.replace('/uye-panel');
                    } else {
                        router.replace('/');
                    }
                    return;
                    }
                } catch (refreshError) {
                    console.error('❌ Token refresh hatası:', refreshError);
                    router.replace('/');
                    return;
                }
                } else {
                console.log('❌ Auth yok, ana sayfaya yönlendiriliyor');
                router.replace('/');
                return;
                }
            }
            
            // Role kontrolü - Sadece teknisyenler (employee, rol=1) erişebilir
            if (authStatus.userType !== 'employee' || authStatus.userRole !== 1) {
                console.log('❌ Yanlış rol, doğru panele yönlendiriliyor');
                if (authStatus.userType === 'company' || authStatus.userRole === 2) {
                router.replace('/uye-panel');
                } else {
                router.replace('/');
                }
                return;
            }
            
            // App state monitor'ü başlat (eğer başlamamışsa)
            const monitorStatus = appStateMonitor.getStatus();
            if (!monitorStatus.isActive) {
                console.log('🔄 App state monitor başlatılıyor...');
                appStateMonitor.start();
            }
            
            console.log('✅ Teknisyen panel başarıyla başlatıldı');
            } catch (error) {
            console.error('❌ Panel başlatma hatası:', error);
            router.replace('/');
            }
        };
        
        initializePanel();
    }, []);

    // Bekleyen talep sayısını almak için (mevcut useEffect)
    useEffect(() => {
        fetchBekleyenTalepCount();
        fetchOkunmamisBildirimCount(); // YENİ EKLENEN
        
        const unsubscribe = navigation.addListener('focus', () => {
            fetchBekleyenTalepCount();
            fetchOkunmamisBildirimCount(); // YENİ EKLENEN
        });
        
        return unsubscribe;
    }, []);

    const fetchOkunmamisBildirimCount = async () => {
        try {
          // ✅ Offline kontrolü ekle
          const networkState = await NetInfo.fetch();
          if (!networkState.isConnected) {
            console.log('📴 Offline - Bildirim sayısı kontrolü atlandı');
            setOkunmamisBildirimCount(0);
            return;
          }
      
          const userInfo = await AsyncStorage.getItem('userData');
          if (userInfo) {
            const user = JSON.parse(userInfo);
            const personelId = user.personel_id;
            
            const response = await api.get(`/api/calisan-bildirimleri/${personelId}`);
            
            if (response.data && Array.isArray(response.data)) {
              const okunmamisBildirimler = response.data.filter(bildirim => !bildirim.okundu).length;
              setOkunmamisBildirimCount(okunmamisBildirimler);
            } else {
              setOkunmamisBildirimCount(0);
            }
          }
        } catch (err) {
          setOkunmamisBildirimCount(0);
          
          if (__DEV__) {
            console.log('Bildirim endpoint\'i hatası:', err.message);
          }
        }
      };
    

    const fetchBekleyenTalepCount = async () => {
        try {
          // ✅ Offline kontrolü ekle
          const networkState = await NetInfo.fetch();
          if (!networkState.isConnected) {
            console.log('📴 Offline - Talep sayısı kontrolü atlandı');
            setBekleyenTalepCount(0);
            return;
          }
      
          const response = await api.get('/api/teknisyen-talepler');
          if (response.data && Array.isArray(response.data)) {
            const bekleyenTalepler = response.data.filter(talep => talep.durum === 'bekliyor').length;
            setBekleyenTalepCount(bekleyenTalepler);
          } else {
            setBekleyenTalepCount(0);
          }
        } catch (err) {
          setBekleyenTalepCount(0);
          
          if (__DEV__) {
            console.log('Teknisyen talep endpoint\'i hatası:', err.message);
          }
        }
    };

    const handlePress = (action: () => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action();
    };
    const handleLogout = () => {
        Alert.alert(
            'Çıkış Yap', 
            'Çıkış yapmak istediğinizden emin misiniz?',
            [
                {
                    text: 'İptal',
                    style: 'cancel'
                },
                {
                    text: 'Çıkış Yap',
                    style: 'destructive',
                    onPress: logout // ✅ Yeni auth sistemi kullan
                }
            ]
        );
    };

    const MenuSection = ({ 
        title, 
        items 
    }: { 
        title: string, 
        items: Array<{
            icon: string, 
            text: string, 
            onPress?: () => void,
            color?: string,
            badge?: number
        }> 
    }) => (
        <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{title}</Text>
            {items.map((item, index) => (
                <TouchableOpacity 
                    key={index} 
                    style={styles.menuItem}
                    onPress={() => item.onPress && handlePress(item.onPress)}
                >
                    <View style={styles.menuItemContent}>
                        <View style={[styles.iconContainer, { backgroundColor: `${item.color || '#0088cc'}20` }]}>
                            <Ionicons 
                                name={item.icon} 
                                size={24} 
                                color={item.color || '#0088cc'} 
                            />
                            {item.badge ? (
                                <View style={[styles.badgeContainer, { backgroundColor: '#f39c12' }]}>
                                    <Text style={styles.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
                                </View>
                            ) : null}
                        </View>
                        <Text style={[
                            styles.menuItemText, 
                            item.color ? { color: item.color } : {}
                        ]}>
                            {item.text}
                        </Text>
                    </View>
                    <Ionicons 
                        name="chevron-forward" 
                        size={20} 
                        color="#aaa" 
                    />
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <View style={styles.mainContainer}>
        <StatusBar
            barStyle="light-content"
            backgroundColor="#2C3E50"
            translucent
        />
        <ScrollView 
            style={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <LinearGradient 
                colors={['#2C3E50', '#34495E']} 
                style={styles.headerGradient}
            >
                <Text style={styles.headerTitle}>Teknisyen Paneli</Text>
            </LinearGradient>

            <MenuSection 
                title="Cihaz Ayarları" 
                items={[
                    {
                        icon: 'wifi-outline', 
                        text: 'Ağ Bağlantısı', 
                        onPress: openWifiSettings
                    },
                    {
                        icon: 'notifications-outline', 
                        text: 'Bildirim Ayarları', 
                        onPress: () => router.push('/bildirim-ayarlari')
                    },
                    /*{
                        icon: 'shield-outline', 
                        text: 'Güvenlik'
                    }*/
                ]} 
            />

            <MenuSection 
                title="Servis Bilgileri" 
                items={[
                    {
                        icon: 'build-outline', 
                        text: 'Bakım Geçmişi', 
                        onPress: () => router.push('/firmalar')
                    },
                    {
                        icon: 'calendar-outline', 
                        text: 'Servis Takvimi', 
                        onPress: () => router.push('/randevu-firmalar')
                    },
                    {
                        icon: 'document-text-outline', 
                        text: 'Teknik Servis Formu', 
                        onPress: () => router.push('/firmalar-arizaformu')
                    }
                ]} 
            />

            <MenuSection 
                title="Uygulama" 
                items={[
                    {
                        icon: 'mail-outline', 
                        text: 'Gelen Kutusu',
                        onPress: () => router.push('/teknisyen-gelen-kutusu'),
                        badge: (bekleyenTalepCount + okunmamisBildirimCount) > 0 ? (bekleyenTalepCount + okunmamisBildirimCount) : undefined // DEĞİŞTİRİLEN
                    },
                    {
                        icon: 'barcode-outline', 
                        text: 'Barkod Yazdırma',
                        onPress: () => router.push('/barkod-ekrani'),
                        color: '#3498db'
                    },
                ]} 
            />

            <MenuSection 
                title="Laboratuvar İşlemleri" 
                items={[
                    {
                        icon: 'flask-outline', 
                        text: 'Lab Numune Girişi',
                        onPress: () => router.push('/lab-numune-giris'),
                        color: '#8B5CF6'
                    },
                    {
                        icon: 'document-outline', 
                        text: 'Rapor Listesi',
                        onPress: () => router.push('/lab-rapor-listesi'),
                        color: '#10B981'
                    },
                    {
                        icon: 'document-outline', 
                        text: 'Rapor Oluştur',
                        onPress: () => router.push('/lab-numune-kartlari'),
                        color: '#10B981'
                    },
                    {
                        icon: 'barcode-outline', 
                        text: 'Barkod Okuma',
                        onPress: () => router.push('/qr_okuyucu'),
                        color: '#3498db'
                    },
                    /*
                    {
                        icon: 'car-outline', 
                        text: 'Araç Takibi',
                        onPress: () => router.push('/AracTakibi'),
                        color: '#3498db'
                    }
                    */
                ]} 
            />

            <MenuSection 
                title="Oturup Kapat" 
                items={[
                    {
                        icon: 'log-out-outline', 
                        text: 'Çıkış Yap', 
                        color: '#F44336',
                        onPress: handleLogout
                    }
                ]} 
            />
            

            <Text style={styles.versionText}>Artemis Arıtım: Artemis v1.0.0</Text>
        </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    headerGradient: {
        paddingTop: STATUSBAR_HEIGHT + (height * 0.03), // StatusBar yüksekliğini ekleyin
        paddingBottom: height * 0.03,
        paddingHorizontal: width * 0.05,
        marginBottom: height * 0.02,
    },
    headerTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    menuSection: {
        backgroundColor: 'white',
        borderRadius: 15,
        marginHorizontal: width * 0.04,
        marginBottom: height * 0.02,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    menuSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2C3E50',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        position: 'relative', // Badge için gerekli
    },
    menuItemText: {
        fontSize: 16,
        color: '#2C3E50',
    },
    badgeContainer: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#e74c3c',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
    },
    versionText: {
        textAlign: 'center',
        color: '#888',
        marginVertical: height * 0.03,
        fontSize: 12,
    }
});