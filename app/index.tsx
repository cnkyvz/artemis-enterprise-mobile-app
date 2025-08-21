  //app/index.tsx
  import React, { useEffect } from 'react';
  import { 
    Image, 
    StyleSheet, 
    Text, 
    TouchableOpacity, 
    View, 
    Dimensions,
    Platform,
    SafeAreaView,
    Animated
  } from 'react-native';
  import { BlurView } from 'expo-blur';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Link, router } from 'expo-router';
  import { StatusBar } from 'expo-status-bar';
  import { useFonts } from 'expo-font';
  import * as SplashScreen from 'expo-splash-screen';
  import { Feather } from '@expo/vector-icons';
  import EnterpriseTokenManager from '../utils/enterpriseTokenManager';
  import appStateMonitor from '../utils/appStateMonitor';


  // Screen dimensions
  const { width, height } = Dimensions.get('window');
  SplashScreen.preventAutoHideAsync();



  export default function GirisScreen() {
    // Animated value for button interactions
    const buttonScale = new Animated.Value(1);

    const [fontsLoaded] = useFonts({
      'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
      'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
      'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
      'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    });

    useEffect(() => {
      if (fontsLoaded) {
        SplashScreen.hideAsync();
      }
    }, [fontsLoaded]);

    // ✅ YENİ useEffect EKLE - Auto redirect kontrolü
    useEffect(() => {
      const checkAutoRedirect = async () => {
        try {
          console.log('🔍 Ana sayfa auto-redirect kontrolü...');
          
          const authStatus = await EnterpriseTokenManager.getAuthStatus();
          
          if (authStatus.isAuthenticated) {
            console.log('✅ Kullanıcı zaten giriş yapmış, panele yönlendiriliyor');

            const backgroundSync = require('../artemis-api/utils/backgroundSync').default;
            backgroundSync.startupSync().catch(console.error);
            
            // Role göre yönlendirme
            if (authStatus.userType === 'employee') {
              if (authStatus.userRole === 1) {
                router.replace('/teknisyen-panel');
              } else {
                router.replace('/uye-panel');
              }
            } else if (authStatus.userType === 'company') {
              router.replace('/uye-panel');
            }
          } else if (authStatus.needsRefresh) {
            console.log('🔄 Sessiz token refresh deneniyor...');
            
            try {
              await appStateMonitor.triggerTokenCheck();
              const newAuthStatus = await EnterpriseTokenManager.getAuthStatus();
              
              if (newAuthStatus.isAuthenticated) {
                console.log('✅ Sessiz refresh başarılı, panele yönlendiriliyor');
                // Yönlendirme kodu aynı...
              }
            } catch (refreshError) {
              console.log('⚠️ Sessiz refresh başarısız, ana sayfada kalıyor');
            }
          } else {
            console.log('📱 Ana sayfa - kullanıcı giriş yapmamış');
          }
        } catch (error) {
          console.error('❌ Auto-redirect kontrol hatası:', error);
        }
      };
      
      // Component mount olduktan 500ms sonra kontrol et
      const timer = setTimeout(checkAutoRedirect, 500);
      
      return () => clearTimeout(timer);
    }, []);

    // Button press animation
    const onPressIn = () => {
      Animated.spring(buttonScale, {
        toValue: 0.95,
        useNativeDriver: true
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(buttonScale, {
        toValue: 1,
        useNativeDriver: true
      }).start();
    };

    if (!fontsLoaded) {
      return null;
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#2C3E50', '#34495E', '#2980B9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.container, { 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0 
          }]} // Bu satırı ekleyin
        >
          {/* Animated Background Elements */}
          <View style={styles.backgroundCircle1} />
          <View style={styles.backgroundCircle2} />
          
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/logo-whitee.png')}
                style={styles.logo}
              />
              <Text style={styles.slogan}>Su Arıtım Teknolojileri</Text>
            </View>

            <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Hoş Geldiniz</Text>
                  <Text style={styles.cardSubtitle}>
                    Su Arıtım Sistemleri
                  </Text>
                </View>

                {/* Animated Button Component */}
                {['Üye Firma Giriş', 'Artemis Giriş'].map((buttonText, index) => (
                  <Animated.View 
                    key={buttonText}
                    style={[
                      styles.buttonContainer, 
                      { 
                        transform: [{ scale: buttonScale }],
                        backgroundColor: index === 0 ? '#3498DB' : '#2980B9'
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.button}
                      onPressIn={onPressIn}
                      onPressOut={onPressOut}
                      onPress={() => router.push(index === 0 ? '/uye-giris' : '/calisan-giris')}
                    >
                      <Feather 
                        name={index === 0 ? "user" : "briefcase"} 
                        size={20} 
                        color="white" 
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.buttonText}>{buttonText}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}

                <View style={styles.registerContainer}>
                  <Text style={styles.registerText}>Henüz firma kaydınız yok mu?</Text>
                  <Link href="/uye-ol" asChild>
                    <TouchableOpacity>
                      <Text style={styles.registerLink}>Firma Kaydı</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>
            </BlurView>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2025 Artemis Arıtım. Tüm hakları saklıdır.</Text>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#2C3E50',
    },
    container: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    },
    // Animasyonlu Arka Plan Daireler
    backgroundCircle1: {
      position: 'absolute',
      top: -width * 0.3,
      left: -width * 0.2,
      width: width * 0.8,
      height: width * 0.8,
      borderRadius: width * 0.4,
      backgroundColor: 'rgba(52, 152, 219, 0.2)',
    },
    backgroundCircle2: {
      position: 'absolute',
      bottom: -width * 0.3,
      right: -width * 0.2,
      width: width * 0.8,
      height: width * 0.8,
      borderRadius: width * 0.4,
      backgroundColor: 'rgba(41, 128, 185, 0.2)',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: width * 0.05,
      paddingTop: height * 0.05,
      paddingBottom: height * 0.02,
    },
    blurContainer: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      overflow: 'hidden',
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: height * 0.03,
      transform: [{ translateY: height * 0.10 }],     
    },
    logo: {
      width: width * 0.5,
      height: height * 0.08,
      resizeMode: 'contain',

    },
    slogan: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 16,
      marginTop: 8,
      fontFamily: 'Poppins-Medium',
      letterSpacing: 0.5,
    },
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 20,
      padding: width * 0.06,
    },
    cardHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    cardTitle: {
      fontSize: 26,
      fontFamily: 'Poppins-Bold',
      color: 'white',
      marginBottom: 8,
    },
    cardSubtitle: {
      fontSize: 15,
      fontFamily: 'Poppins-Regular',
      textAlign: 'center',
      color: 'rgba(255, 255, 255, 0.7)',
      lineHeight: 22,
    },
    buttonContainer: {
      borderRadius: 15,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
    },
    buttonIcon: {
      marginRight: 10,
    },
    buttonText: {
      color: 'white',
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
      textAlign: 'center',
    },
    registerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
      flexWrap: 'wrap',
    },
    registerText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      marginRight: 4,
    },
    registerLink: {
      color: '#3498DB',
      fontSize: 14,
      fontFamily: 'Poppins-SemiBold',
    },
    footer: {
      marginTop: height * 0.04,
    },
    footerText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 12,
      fontFamily: 'Poppins-Regular',
      textAlign: 'center',
    },
  });