import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { checkUserOrganizationMembership } from './lib/db/utils';

// Allowed emails for access (fallback/admin override)
const ADMIN_EMAILS = (process.env.ALLOWED_EMAILS || 'nickarinard@gmail.com').split(',').map(e => e.trim());

/**
 * Full auth configuration with database callbacks.
 * Use this for server-side auth (API routes, server components).
 * For middleware, use auth.config.ts instead (edge-compatible).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
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
