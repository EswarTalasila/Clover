import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eswartalasila.clover',
  appName: 'Clover',
  webDir: 'dist',
  server: {
    url: 'http://100.83.62.115:5173',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
