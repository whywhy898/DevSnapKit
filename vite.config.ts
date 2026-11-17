import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { beaconPlugin } from './scripts/cf-beacon.mjs';

export default defineConfig({
  // Builds accept explicitly supplied process variables without opening local
  // credential files. The beacon token is public and optional.
  envDir: false,
  plugins: [react(), beaconPlugin(process.env.VITE_CF_BEACON_TOKEN)],
  server: {
    port: 3001,
  }
});
