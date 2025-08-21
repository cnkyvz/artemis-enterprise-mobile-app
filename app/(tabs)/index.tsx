// app/(tabs)/index.tsx
import React, { useState } from 'react';
import { 
  Image, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
  Linking, 
  Dimensions,
  Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [activeService, setActiveService] = useState<number | null>(null);

  React.useEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
      animation: 'none'
    });
  }, []);

  const handleCall = () => {
    Linking.openURL("tel:+905555555555");
  };

  const services = [
    {
      icon: 'water-outline',
      title: 'Endüstriyel Arıtım',
      description: 'Endüstriyel tesisler için özel su arıtım çözümleri sunuyoruz.',
      color: '#1E88E5',
      detailedIcon: <MaterialIcons name="precision-manufacturing" size={32} color="#1E88E5" />
    },
    {
      icon: 'flask-outline',
      title: 'Su Analizi',
      description: 'Profesyonel ekibimizle su analizleri yapıyor ve raporluyoruz.',
      color: '#00BCD4',
      detailedIcon: <FontAwesome5 name="microscope" size={32} color="#00BCD4" />
    },
    {
      icon: 'construct-outline',
      title: 'Bakım & Servis',
      description: 'Tüm arıtım sistemleriniz için bakım ve servis hizmetleri.',
      color: '#4CAF50',
      detailedIcon: <Ionicons name="settings-outline" size={32} color="#4CAF50" />
    }
  ];

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}                     // iOS'ta bouncing efektini engeller
      overScrollMode="never"              // Android'de overscroll efektini engeller
      scrollEnabled={Platform.OS === 'ios' ? false : true} 

      disableScrollViewPanResponder={true} // Scroll hareketlerini tamamen devre dışı bırakır
      nestedScrollEnabled={false} // İç içe scroll'u engeller
      keyboardShouldPersistTaps="handled" // Klavye davranışını kontrol eder
    >
      {/* Hero Section with Gradient and Overlay */}
      <View style={styles.heroContainer}>
        <LinearGradient
          colors={['#1E88E5', '#0D47A1']}
          style={styles.heroGradient}
        >
          <Animatable.View 
            animation="fadeInDown" 
            duration={800} 
            style={styles.heroTextContainer}
          >
            <Text style={styles.heroTitle}>Artemis Arıtım</Text>
            <Text style={styles.heroSubtitle}>Su Arıtım Teknolojileri</Text>
          </Animatable.View>
          
          <Animatable.Image
            animation="fadeIn"
            duration={1000}
            source={require('../../assets/images/water-treatment.png')}
            style={styles.heroImage}
          />
        </LinearGradient>
      </View>

      {/* Services Section */}
      <View style={styles.contentContainer}>
        <Text style={styles.sectionTitle}>Hizmetlerimiz</Text>
        
        <View style={styles.servicesContainer}>
          {services.map((service, index) => (
            <Animatable.View 
              key={index}
              animation={activeService === index ? 'pulse' : undefined}
              style={[
                styles.serviceCard,
                activeService === index && styles.activeServiceCard
              ]}
            >
              <TouchableOpacity 
                onPress={() => setActiveService(activeService === index ? null : index)}
                style={styles.serviceCardContent}
              >
                <View style={[styles.serviceIconContainer, { backgroundColor: `${service.color}10` }]}>
                  {service.detailedIcon}
                </View>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceDescription}>
                  {activeService === index 
                    ? 'Detaylı bilgi için tıklayın' 
                    : service.description}
                </Text>
              </TouchableOpacity>
            </Animatable.View>
          ))}
        </View>

        {/* Contact Card */}
        <Animatable.View 
          animation="fadeInUp" 
          duration={800} 
          style={styles.contactCard}
        >
          <Text style={styles.contactTitle}>İletişime Geçin</Text>
          <Text style={styles.contactText}>
            Su arıtım ihtiyaçlarınız için bizimle iletişime geçin. Uzman ekibimiz
            size özel çözümler sunmaya hazır.
          </Text>
          <TouchableOpacity 
            style={styles.contactButton} 
            onPress={handleCall}
          >
            <Ionicons 
              name="call-outline" 
              size={20} 
              color="white" 
              style={styles.contactIcon} 
            />
            <Text style={styles.contactButtonText}>Bizi Arayın</Text>
          </TouchableOpacity>
        </Animatable.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  heroContainer: {
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  heroGradient: {
    padding: 25,
    paddingBottom: 70,
    alignItems: 'center',
  },
  heroTextContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 50,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  heroImage: {
    width: '90%',
    height: 180,
    resizeMode: 'contain',
  },
  contentContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0D47A1',
    marginTop: 25,
    marginBottom: 20,
    textAlign: 'center',
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '48%',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  activeServiceCard: {
    borderWidth: 2,
    borderColor: '#1E88E5',
    transform: [{ scale: 1.05 }],
  },
  serviceCardContent: {
    padding: 15,
    alignItems: 'center',
  },
  serviceIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0D47A1',
    marginBottom: 8,
    textAlign: 'center',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
  },
  contactCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
    padding: 20,
    marginVertical: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0D47A1',
    marginBottom: 10,
    textAlign: 'center',
  },
  contactText: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 15,
    textAlign: 'center',
  },
  contactButton: {
    backgroundColor: '#1E88E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 2,
  },
  contactIcon: {
    marginRight: 8,
  },
  contactButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});