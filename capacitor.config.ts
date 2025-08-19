import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.my.vivica',
  appName: 'vivica',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      style: 'DEFAULT',
      overlaysWebView: false
    }
  }
};

export default config;
