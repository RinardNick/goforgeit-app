import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

/**
 * Edge-compatible middleware using auth.config.ts (no database calls).
 * The authorization logic is handled in authConfig.callbacks.authorized.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Exclude API routes from middleware - they handle their own auth
  // This fixes the 'searchParams' error in NextAuth v5 beta
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/).*)"],
};
