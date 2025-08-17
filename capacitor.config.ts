import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.my.vivica',
  appName: 'vivica',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'DEFAULT',
      overlaysWebView: false
    }
  }
};

export default config;
