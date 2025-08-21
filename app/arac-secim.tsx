// arac-secim.tsx 

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  StatusBar,
  Platform,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

type Vehicle = {
  deviceId: string;
  plaka: string;
  model: string;
  konum?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  durum?: {
    hiz: number;
    ignition: boolean;
    son_guncelleme: string;
  };
};

export default function AracSecim() {
  const router = useRouter();
  const { aracIds, grupAdi } = useLocalSearchParams();
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVehicleDetails();
  }, []);

  const fetchVehicleDetails = async () => {
    try {
      if (!aracIds) return;
      
      const aracIdArray = Array.isArray(aracIds) ? aracIds : [aracIds];
      const vehiclePromises = aracIdArray[0].split(',').map(deviceId => 
        api.get(`/api/arac-konum/${deviceId}`)
      );
      
      const responses = await Promise.all(vehiclePromises);
      const vehicleData = responses.map(response => response.data);
      
      setVehicles(vehicleData);
      console.log('✅ Araç detayları yüklendi:', vehicleData.length);
      
    } catch (error) {
      console.error('❌ Araç detay yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSelect = (deviceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/arac-takip/${deviceId}?grupAdi=${encodeURIComponent(grupAdi as string)}`);
  };

  const renderVehicleItem = ({ item }: { item: Vehicle }) => (
    <TouchableOpacity
      style={styles.vehicleCard}
      onPress={() => handleVehicleSelect(item.deviceId)}
      activeOpacity={0.7}
    >
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehiclePlate}>{item.plaka}</Text>
          <Text style={styles.vehicleModel}>{item.model}</Text>
        </View>
        
        <View style={[
          styles.statusIndicator,
          { backgroundColor: item.durum?.ignition ? '#27ae60' : '#e74c3c' }
        ]}>
          <Ionicons 
            name={item.durum?.ignition ? "car-sport" : "car-sport-outline"} 
            size={20} 
            color="white" 
          />
        </View>
      </View>
      
      {item.konum && (
        <View style={styles.locationInfo}>
          <Ionicons name="location-outline" size={16} color="#7f8c8d" />
          <Text style={styles.locationText} numberOfLines={2}>
            {item.konum.address}
          </Text>
        </View>
      )}
      
      {item.durum && (
        <View style={styles.statusInfo}>
          <View style={styles.statusItem}>
            <Ionicons name="speedometer-outline" size={14} color="#3498db" />
            <Text style={styles.statusText}>{item.durum.hiz} km/h</Text>
          </View>
          
          <View style={styles.statusItem}>
            <Ionicons name="time-outline" size={14} color="#95a5a6" />
            <Text style={styles.statusText}>
              {new Date(item.durum.son_guncelleme).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        </View>
      )}
      
      <View style={styles.cardFooter}>
        <Text style={styles.trackText}>Takip Et</Text>
        <Ionicons name="chevron-forward" size={20} color="#0088cc" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.mainContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#2C3E50" translucent />
        
        <LinearGradient colors={['#2C3E50', '#34495E']} style={styles.headerGradient}>
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
            
            <Text style={styles.headerTitle}>Araç Seçimi</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0088cc" />
          <Text style={styles.loadingText}>Araç bilgileri yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#2C3E50" translucent />
      
      <LinearGradient colors={['#2C3E50', '#34495E']} style={styles.headerGradient}>
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
          
          <Text style={styles.headerTitle}>Araç Seçimi</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={styles.container}>
        <View style={styles.infoContainer}>
          <Text style={styles.groupName}>{grupAdi}</Text>
          <Text style={styles.infoText}>
            {vehicles.length} araç takip için hazır
          </Text>
        </View>

        <FlatList
          data={vehicles}
          renderItem={renderVehicleItem}
          keyExtractor={(item) => item.deviceId}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
  container: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  listContainer: {
    paddingBottom: 20,
  },
  vehicleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  vehicleModel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#7f8c8d',
    flex: 1,
  },
  statusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#7f8c8d',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  trackText: {
    fontSize: 14,
    color: '#0088cc',
    fontWeight: '500',
  },
});