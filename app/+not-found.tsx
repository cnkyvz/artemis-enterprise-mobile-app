import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 404 Not Found sayfası
function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>404</Text>
      <Text style={styles.text}>Aradığınız sayfa bulunamadı</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
  },
});

// Default export ekleniyor
export default NotFoundScreen;