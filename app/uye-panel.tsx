// app/uye-panel
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
import { useRouter, useNavigation, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';
import { logout } from '../artemis-api/middleware/auth';
import { getCurrentUser } from '../artemis-api/middleware/auth';
import EnterpriseTokenManager from '../utils/enterpriseTokenManager';

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

export default function UyePanel() {
    const router = useRouter();
    const navigation = useNavigation();
    const [unreadCount, setUnreadCount] = useState(0);

    // Bildirim sayısını almak için
    useEffect(() => {
      fetchUnreadBildirimCount();
      
      // Uygulama önplana geldiğinde yeniden sayı kontrolü
      const unsubscribe = navigation.addListener('focus', () => {
        fetchUnreadBildirimCount();
      });
      
      return unsubscribe;
    }, []);
    
    // Okunmamış bildirim sayısını çek
// Okunmamış bildirim sayısını çek
const fetchUnreadBildirimCount = async () => {
    try {
      console.log('🔍 Bildirim sayısı alınıyor...');
      
      // ✅ Enterprise token kontrolü
      const hasEnterpriseToken = await EnterpriseTokenManager.hasValidToken();
      console.log('🔐 Enterprise token var mı?', hasEnterpriseToken);
      
      let company_id = null;
      
      if (hasEnterpriseToken) {
        // ✅ Enterprise sistemden user data al
        const enterpriseUserData = await EnterpriseTokenManager.getUserData();
        if (enterpriseUserData) {
          company_id = enterpriseUserData.company_id || enterpriseUserData.id;
        }
      }
      
      // ✅ Fallback: Legacy sistem kontrolü
      if (!company_id) {
        const userData = await AsyncStorage.getItem('userData');
        if (userData && userData !== 'null') {
          const user = JSON.parse(userData);
          company_id = user.company_id;
        }
      }
      
      if (!company_id) {
        console.log('❌ Company ID bulunamadı');
        setUnreadCount(0);
        return;
      }
      
      console.log('📤 Bildirimler API isteği gönderiliyor...');
      const response = await api.get(`/api/bildirimler/${company_id}`);
      
      // Okunmamış bildirim sayısını hesapla
      const unreadMessages = response.data.filter(b => !b.okundu).length;
      console.log('✅ Okunmamış bildirim sayısı:', unreadMessages);
      setUnreadCount(unreadMessages);
      
    } catch (err) {
      console.error('❌ Bildirim sayısı alınamadı:', err);
      console.error('❌ API Error Status:', err.response?.status);
      
      // ✅ 401 hatası kontrolü
      if (err.response?.status === 401) {
        console.log('⚠️ Token süresi dolmuş olabilir');
      }
      
      // Hata durumunda bildirimleri gösterme
      setUnreadCount(0);
    }
  };

    const handlePress = (action: () => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action();
    };

    const handleCall = () => {
        Linking.openURL("tel:+905555555555");
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
                                <View style={styles.badgeContainer}>
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
            <Stack.Screen 
                options={{
                    headerLeft: () => (
                        <TouchableOpacity 
                            onPress={() => router.push('/(tabs)')} 
                            style={styles.backButton}
                        >
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                    )
                }} 
            />
            
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
                    <Text style={styles.headerTitle}>Üye Paneli</Text>
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
                    ]} 
                />

                <MenuSection 
                    title="Servis Bilgileri" 
                    items={[
                        {
                            icon: 'build-outline', 
                            text: 'Bakım Geçmişi', 
                            onPress: async () => {
                              try {
                                // ✅ YENİ KOD
                                const userData = await getCurrentUser();
                                if (!userData) {
                                  Alert.alert('Hata', 'Kullanıcı bilgileri bulunamadı');
                                  return;
                                }
                                
                                const companyId = userData.company_id || userData.id;
                                
                                if (!companyId) {
                                  console.log('Kullanıcı verileri:', userData);
                                  Alert.alert('Hata', 'Kullanıcı ID bilgisi eksik');
                                  return;
                                }
                                
                                console.log(`Bakım geçmişine yönlendiriliyor. company_id: ${companyId}`);
                                
                                router.push({
                                  pathname: '/bakim-gecmisi',
                                  params: { company_id: companyId }
                                });
                              } catch (error) {
                                console.error('Bakım geçmişine yönlendirme hatası:', error);
                                Alert.alert('Hata', 'Bakım geçmişine erişilemedi');
                              }
                            }
                          },
                        {
                            icon: 'calendar-outline', 
                            text: 'Servis Takvimi', 
                            onPress: () => router.push('/servis_takvimi')
                        },
                        {
                            icon: 'document-text-outline', 
                            text: 'Talep Formu', 
                            onPress: () => router.push('/talepformu')
                        }
                    ]} 
                />

                <MenuSection 
                    title="Uygulama" 
                    items={[
                        {
                            icon: 'mail-outline', 
                            text: 'Gelen Kutusu',
                            onPress: () => router.push('/gelen-bildirimler'),
                            badge: unreadCount > 0 ? unreadCount : undefined
                        },
                        {
                            icon: 'call-outline', 
                            text: 'Teknik Destek', 
                            onPress: handleCall
                        },
                    ]} 
                />

                <MenuSection 
                    title="Numune Takip Sistemi" 
                    items={[
                        {
                            icon: 'flask-outline', 
                            text: 'Numune Geçmişim',
                            onPress: () => router.push('/numune-gecmis'),
                            color: '#8B5CF6'
                        }
                    ]} 
                />

                <MenuSection 
                    title="Hesap" 
                    items={[
                        {
                            icon: 'person-outline', 
                            text: 'Profil Bilgileri', 
                            onPress: () => router.push('/profil')
                        },
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
    },
    backButton: {
        padding: 10,
    },
});