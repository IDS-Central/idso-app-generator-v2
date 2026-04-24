/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Ensure google-auth-library and google-cloud libs work in the standalone bundle.
    serverComponentsExternalPackages: [
      'google-auth-library',
      '@google-cloud/secret-manager',
      'google-gax',
    ],
  },
};

export default nextConfig;
