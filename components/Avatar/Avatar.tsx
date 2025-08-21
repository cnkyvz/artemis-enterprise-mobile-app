// React Native Avatar komponenti
//MyReactNativeApp/components/Avatar/Avatar.tsx

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getPersonName, getInitials, getAvatarColor, getAvatarUrl, PersonInfo } from '../../utils/avatarUtils';

interface AvatarProps {
  person: PersonInfo;
  size?: number;
  showOnline?: boolean;
  style?: any;
  borderColor?: string;
  borderWidth?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ 
  person, 
  size = 60, 
  showOnline = false, 
  style,
  borderColor = '#fff',
  borderWidth = 3
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const name = getPersonName(person);
  const initials = getInitials(name);
  const avatarUrl = getAvatarUrl(person);
  const backgroundColor = getAvatarColor(name);
  
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth,
    borderColor,
  };
  
  const onlineIndicatorSize = size * 0.25;
  
  return (
    <View style={[styles.container, style]}>
      {/* Text Avatar (Fallback) */}
      <View style={[styles.textAvatar, avatarStyle, { backgroundColor }]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>
          {initials}
        </Text>
      </View>
      
      {/* Gerçek resim (yüklenirse text avatar'ın üzerine gelir) */}
      {!imageError && (
        <Image
          source={{ uri: avatarUrl }}
          style={[
            styles.realImage, 
            avatarStyle,
            { opacity: imageLoaded ? 1 : 0 }
          ]}
          onLoad={() => {
            setImageLoaded(true);
            setImageError(false);
          }}
          onError={() => {
            setImageError(true);
            setImageLoaded(false);
          }}
        />
      )}
      
      {/* Online göstergesi */}
      {showOnline && (
        <View style={[
          styles.onlineIndicator, 
          { 
            width: onlineIndicatorSize, 
            height: onlineIndicatorSize,
            borderRadius: onlineIndicatorSize / 2,
            bottom: size * 0.05,
            right: size * 0.05,
          }
        ]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  textAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3498db',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  realImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  onlineIndicator: {
    position: 'absolute',
    backgroundColor: '#27ae60',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default Avatar;