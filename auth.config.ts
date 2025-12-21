import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

const isTestMode = process.env.NODE_ENV === 'test' || process.env.IS_E2E_TEST === 'true';

/**
 * Edge-compatible auth configuration.
 * This config is used by middleware and does NOT include database calls.
 * For full auth with database callbacks, use auth.ts instead.
 */
export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET || (isTestMode ? 'test-secret-key-for-testing-only' : undefined),
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    // Edge-compatible authorized callback for middleware
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;

      // Defensive: handle case where request or nextUrl might be undefined
      const nextUrl = request?.nextUrl;
      if (!nextUrl) {
        // If no nextUrl, allow the request to proceed (will be handled by route)
        return true;
      }

      const pathname = nextUrl.pathname;

      // Public routes that don't require authentication
      const publicRoutes = ['/login', '/api/auth', '/api/adk-router', '/api/validate-agent', '/api/mcp', '/api/debug'];
      const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

      if (isPublicRoute) {
        return true;
      }

      // Require authentication for all other routes
      return isLoggedIn;
    },
  },
};
