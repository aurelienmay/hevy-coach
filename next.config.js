/** @type {import('next').NextConfig} */

// CSP removed for now -- Next's App Router injects inline scripts for RSC
// streaming, so a bare `script-src 'self'` broke every page. Needs a
// nonce-based policy (Next has built-in support for that), not a static one
// from next.config.js. Tracked as a follow-up, not silently dropped.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
