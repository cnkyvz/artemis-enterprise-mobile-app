// React Native için avatar utility fonksiyonları
//MyReactNativeApp/utils/avatarUtils.ts

export interface PersonInfo {
    id?: string | number;
    name?: string;
    firstName?: string;
    lastName?: string;
    ad?: string;
    soyad?: string;
    avatar?: string;
    resim?: string;
    teknisyen_resmi?: string;
    teknisyen_adi?: string;
    personel_id?: string | number;
  }
  
  // Kişi adını al (farklı formatlarda)
  export const getPersonName = (person: PersonInfo): string => {
    if (person.name) return person.name;
    if (person.teknisyen_adi) return person.teknisyen_adi;
    if (person.ad && person.soyad) return `${person.ad} ${person.soyad}`;
    if (person.firstName && person.lastName) return `${person.firstName} ${person.lastName}`;
    if (person.ad) return person.ad;
    if (person.firstName) return person.firstName;
    return 'Kullanıcı';
  };
  
  // İsmin baş harflerini al
  export const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };
  
  // Server URL'i al
  export const getServerUrl = (): string => {
    // .env dosyasından al
    return process.env.EXPO_PUBLIC_API_URL || 'http://34.140.8.78:3000';
  };
  
  // Avatar URL'i oluştur
  export const getAvatarUrl = (person: PersonInfo): string => {
    // 1. Önce mevcut resim alanlarını kontrol et
    const imageField = person.avatar || person.resim || person.teknisyen_resmi;
    
    if (imageField && imageField.trim()) {
      // Eğer tam URL ise direkt kullan
      if (imageField.startsWith('http')) {
        return imageField;
      }
      
      // Eğer dosya adı ise server URL'i ile birleştir
      return `${getServerUrl()}/uploads/avatars/${imageField}`;
    }
    
    // 2. Resim yoksa online avatar servisi kullan
    const name = getPersonName(person);
    const encodedName = encodeURIComponent(name);
    
    return `https://ui-avatars.com/api/?name=${encodedName}&background=3498db&color=fff&size=150&bold=true&rounded=true`;
  };
  
  // Renk paleti oluştur (isim bazlı tutarlı renkler)
  export const getAvatarColor = (name: string): string => {
    const colors = [
      '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
      '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  // Avatar verisi hazırla
  export const prepareAvatarData = (person: PersonInfo) => {
    const name = getPersonName(person);
    const initials = getInitials(name);
    const color = getAvatarColor(name);
    const avatarUrl = getAvatarUrl(person);
    
    return {
      name,
      initials,
      color,
      avatarUrl,
      hasImage: !!(person.avatar || person.resim || person.teknisyen_resmi)
    };
  };