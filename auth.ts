import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const isTestMode = process.env.NODE_ENV === 'test' || process.env.IS_E2E_TEST === 'true';

// Allowed emails for access (configure via environment variable)
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || 'nickarinard@gmail.com').split(',').map(e => e.trim());

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || (isTestMode ? 'test-secret-key-for-testing-only' : undefined),
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow emails in the allowed list
      return ALLOWED_EMAILS.includes(user.email || '');
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: '/login',
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
