/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isUserPagesRepository = repositoryName.endsWith('.github.io');
const githubPagesBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ?? (repositoryName && !isUserPagesRepository ? `/${repositoryName}` : '');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isGithubPages
    ? {
        output: 'export',
        trailingSlash: true,
        basePath: githubPagesBasePath || undefined,
        assetPrefix: githubPagesBasePath || undefined,
      }
    : {}),

  ...(isGithubPages
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
              ],
            },
          ];
        },
      }),

  images: {
    formats: ['image/avif', 'image/webp'],
    unoptimized: isGithubPages,
  },
};

export default nextConfig;
