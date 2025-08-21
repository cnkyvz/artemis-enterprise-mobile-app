# 🚀 Artemis Enterprise Mobile Application

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![Google Cloud](https://img.shields.io/badge/GoogleCloud-%234285F4.svg?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com/)

A comprehensive enterprise mobile application built with React Native, featuring offline capabilities and real-time tracking system.

## 🌟 Features

### Core Functionality
- 📱 **Offline-First Architecture** - Works without internet connection
- 🗺️ **Real-time Vehicle Tracking** - Live GPS monitoring
- 📊 **Automated Reporting** - PDF generation and email integration
- 🔄 **Data Synchronization** - Seamless online/offline sync
- 📋 **Service Form Management** - Digital form processing

### Business Impact
- ⚡ **60% efficiency improvement** in field operations
- 🚀 **40% faster sample tracking** with QR code integration
- 📈 **Reduced manual errors** through automation
- 💼 **Streamlined workflows** for technical service teams

## 🛠️ Tech Stack

### Frontend
- **React Native** - Cross-platform mobile development
- **TypeScript** - Type-safe development
- **Redux/Context API** - State management
- **React Navigation** - Navigation system

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **PostgreSQL** - Primary database
- **Socket.io** - Real-time communication

### Cloud & DevOps
- **Google Cloud Platform** - Cloud infrastructure
- **Firebase** - Push notifications & analytics
- **AWS S3** - File storage
- **Docker** - Containerization

### Mobile Features
- **React Native Maps** - Map integration
- **React Native Camera** - QR code scanning
- **Async Storage** - Local data persistence
- **Push Notifications** - Real-time alerts

## 📱 App Screenshots

[Add screenshots here - remove any sensitive company data]

## 🏗️ Architecture
artemis-enterprise-mobile-app/
├── app/                  # Main application screens (React Native)
├── components/           # Reusable UI components
├── utils/               # API integration and helper functions
├── assets/              # Images and static files
└── package.json         # Dependencies and scripts

## 🚀 Key Achievements

### Performance Optimizations
- Implemented offline-first architecture
- Optimized bundle size for mobile devices
- Efficient data synchronization strategies
- Battery-optimized location tracking

### User Experience
- Intuitive interface design
- Seamless offline/online transitions
- Fast loading times
- Responsive design for all screen sizes

### Business Solutions
- Automated PDF report generation
- Real-time vehicle location sharing
- QR code integration for asset tracking
- Appointment scheduling system

## 🔐 Advanced Authentication System

### Multi-Layer Token Architecture
- **Access Token** - Short-lived (15 min) for API requests
- **Refresh Token** - Medium-lived (7 days) for token renewal  
- **Device Token** - Long-lived (30 days) for device recognition
- **Automatic Token Rotation** - Seamless background refresh

### Enterprise-Level Session Management
- Netflix/Spotify-style persistent sessions
- Maintains login state until explicit logout
- Cross-app session sharing
- Background token refresh without user interruption
- Secure token storage with encryption

### Device & Activity Monitoring
- Real-time device fingerprinting and tracking
- App state monitoring (foreground/background/closed)
- Session activity logging and analytics
- Multi-device session management
- Suspicious activity detection and automatic logout
- Login location and IP tracking

### Smart Token Strategy
```typescript
// enterpriseTokenManager.ts implements:
{
  accessToken: "15min expiry - API requests",
  refreshToken: "7days expiry - token renewal", 
  deviceToken: "30days expiry - device binding",
  sessionId: "persistent until logout"
}
🔧 Installation & Setup
bash# Clone the repository
git clone https://github.com/cnkyvz/artemis-enterprise-mobile-app.git

# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
📊 Performance Metrics

App Size: < 50MB
Cold Start: < 2s
API Response: < 500ms average
Offline Capability: 100% core features
Crash Rate: < 0.1%

🎯 Future Enhancements

 Machine Learning integration for predictive maintenance
 Advanced analytics dashboard
 Multi-language support
 Biometric authentication
 AR features for technical guidance

🤝 Contributing
This is a showcase project demonstrating enterprise mobile app development capabilities.
📄 License
This project is for portfolio demonstration purposes.
📞 Contact
Cenk Yavuz - Full Stack Developer

Email: cnkyvzz@gmail.com
LinkedIn: linkedin.com/in/yavuzcenk
GitHub: @cnkyvz
