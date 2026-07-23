module.exports = ({ config }) => {
  return {
    ...config,
    scheme: 'libreshop',
    plugins: [
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'LibreShop a besoin de votre position pour trouver les boutiques à proximité de vous.',
          locationAlwaysPermission: 'LibreShop a besoin d\'accéder à votre position en permanence pour vous envoyer des notifications de boutiques proches.',
          locationAlwaysAndWhenInUsePermission: 'LibreShop a besoin d\'accéder à votre position pour trouver les boutiques à proximité de vous.',
        },
      ],
    ],
    extra: {
      ...config.extra,
      // Only public-safe variables should be here
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
      EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      EXPO_PUBLIC_WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_BASE_URL,
      // AI keys — prefixed EXPO_PUBLIC_ = intentionally client-side per Expo spec
      EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      EXPO_PUBLIC_GROC_API_KEY: process.env.EXPO_PUBLIC_GROC_API_KEY,
    },
  };
};
