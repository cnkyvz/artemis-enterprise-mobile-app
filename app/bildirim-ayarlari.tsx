// app/bildirim-ayarlari.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Switch, 
  Alert, 
  Linking, 
  TouchableOpacity, 
  StatusBar, 
  Platform,
  Dimensions,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

export default function BildirimAyarlari() {
  const [isEnabled, setIsEnabled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const hapticFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Bildirim izin durumunu kontrol et
  const checkNotificationPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setIsEnabled(status === 'granted'); // Eğer izin verildiyse isEnabled true olsun
  };

  // Kullanıcı bildirimi açıp kapattığında çalışır
  const toggleSwitch = async () => {
    hapticFeedback();
    
    if (!isEnabled) {
      // Kullanıcı bildirimleri açmak istiyor
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("İzin Gerekli", "Bildirimleri açmak için izne ihtiyacımız var.");
        return;
      }
      setIsEnabled(true);
    } else {
      // Kullanıcı bildirimleri kapatmak istiyor, ayarlara yönlendirme yap
      Alert.alert(
        "Bildirimleri Kapat",
        "Bildirimleri tamamen kapatmak için telefonunuzun ayarlarına gitmeniz gerekiyor.",
        [
          { text: "İptal", style: "cancel" },
          { 
            text: "Ayarları Aç", 
            onPress: () => {
              hapticFeedback();
              Linking.openSettings();
            } 
          } 
        ]
      );
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#2C3E50"
        translucent
      />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}                     // iOS'ta bouncing efektini engeller
        overScrollMode="never"              // Android'de overscroll efektini engeller
      >
        <LinearGradient 
          colors={['#2C3E50', '#34495E']} 
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Bildirim Ayarları</Text>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                hapticFeedback();
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.switchContainer}>
            <View style={styles.switchInfo}>
              <Ionicons 
                name="notifications" 
                size={24} 
                color={isEnabled ? "#1E88E5" : "#777"} 
                style={styles.icon}
              />
              <View>
                <Text style={styles.label}>Bildirimlere İzin Ver</Text>
                <Text style={styles.sublabel}>
                  {isEnabled ? 
                    "Önemli bilgileri size anında ileteceğiz" : 
                    "Önemli bilgileri kaçırabilirsiniz"
                  }
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: "#FF6B6B", true: "#4CD964" }}
              thumbColor={isEnabled ? "#fff" : "#fff"}
              ios_backgroundColor="#ddd"
              onValueChange={toggleSwitch}
              value={isEnabled}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <LinearGradient
            colors={isEnabled ? ['#E3F2FD', '#BBDEFB'] : ['#FFEBEE', '#FFCDD2']}
            style={styles.infoCardGradient}
          >
            <Ionicons 
              name={isEnabled ? "information-circle" : "alert-circle"} 
              size={28} 
              color={isEnabled ? "#1E88E5" : "#FF5252"}
              style={styles.infoIcon}
            />
            <Text style={[
              styles.infoText,
              {color: isEnabled ? "#1E88E5" : "#FF5252"}
            ]}>
              {isEnabled ? 
                "Bildirimler açık! Servis randevuları ve diğer önemli güncellemeler hakkında bildirim alacaksınız." : 
                "Bildirimler kapalı. Önemli güncellemeleri kaçırabilirsiniz."
              }
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            Not: Bildirim ayarlarını değiştirmek için telefonunuzun ayarlar menüsünden uygulama bildirimlerini yönetebilirsiniz.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  contentContainer: {
    paddingBottom: 20,
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
  card: {
    margin: 15,
    backgroundColor: 'white',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sublabel: {
    fontSize: 13,
    color: '#777',
  },
  infoCard: {
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  infoCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  noteContainer: {
    margin: 20,
    marginTop: 30,
  },
  noteText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
  }
});