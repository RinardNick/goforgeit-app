import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { checkUserOrganizationMembership } from './lib/db/utils';

// Allowed emails for access (fallback/admin override)
const ADMIN_EMAILS = (process.env.ALLOWED_EMAILS || 'nickarinard@gmail.com').split(',').map(e => e.trim());

const isTestMode = process.env.NODE_ENV === 'test' || process.env.IS_E2E_TEST === 'true';

/**
 * Full auth configuration with database callbacks.
 * Use this for server-side auth (API routes, server components).
 * For middleware, use auth.config.ts instead (edge-compatible).
 *
 * IMPORTANT: This config does NOT include the 'authorized' callback
 * to avoid 'searchParams' errors when auth() is called from API routes.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
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
      // Defensive: handle case where request or nextUrl might be undefined
      const nextUrl = request?.nextUrl;
      if (!nextUrl) {
        return true;
      }
      return !!auth?.user;
    },
    // Only include signIn and session callbacks
    async signIn({ user }) {
      const email = user.email || '';

      // 1. Allow admins explicitly
      if (ADMIN_EMAILS.includes(email)) return true;

      // 2. Check organization membership
      try {
        const isMember = await checkUserOrganizationMembership(email);
        return isMember;
      } catch (error) {
        console.error('Error checking auth membership:', error);
        return false;
      }
    },
    async session({ session }) {
      return session;
    },
  },
});

/**
 * Server-side auth check for protected routes
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}
