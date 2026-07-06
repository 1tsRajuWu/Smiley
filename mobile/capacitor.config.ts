import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smiley.rpc.mobile',
  appName: 'Smiley',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0f1117',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f1117',
    },
  },
  android: {
    minWebViewVersion: 60,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: false,
  },
};

export default config;
