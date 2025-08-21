// app/(tabs)/explore.tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  }
});

export default function ExploreRedirect() {
  // Bu navigation listener kısmını tamamen kaldır
  /*
  const navigation = useNavigation();
  
  useEffect(() => {
    const unsubscribe = navigation.addListener('gestureStart', (e) => {
      if (e.data.gesture === 'swipeBack') {
        router.navigate('/(tabs)');
        e.preventDefault();
      }
    });

    return unsubscribe;
  }, [navigation]);
  */

  useEffect(() => {
    // Biraz gecikme ekle
    const timer = setTimeout(() => {
      router.replace('/uye-panel');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return <View style={styles.container} />;
}