import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jmarcos.noteapp',
  appName: 'NoteApp',
  webDir: 'dist',
  android: {
    backgroundColor: '#0b0f17',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config
