import crypto from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_AUTH_COOKIE = 'nik_admin_auth';

/**
 * Constant-time string comparison using SHA-256 digests so that neither
 * value contents nor lengths leak via timing side channels.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) {
    return false;
  }
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function getAdminPassword() {
  const value = process.env.ADMIN_PASSWORD;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function getAdminSessionSecret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function verifyAdminPassword(submittedPassword) {
  const configuredPassword = getAdminPassword();
  const configuredSecret = getAdminSessionSecret();

  if (!configuredPassword || !configuredSecret) {
    return { configured: false, valid: false };
  }

  if (typeof submittedPassword !== 'string' || submittedPassword.length === 0) {
    return { configured: true, valid: false };
  }

  return {
    configured: true,
    valid: safeCompare(submittedPassword, configuredPassword),
  };
}

export async function verifyAdminRequest(request) {
  const sessionSecret = getAdminSessionSecret();
  if (!sessionSecret) {
    return false;
  }

  try {
    if (request?.headers) {
      const xAdminToken = request.headers.get('x-admin-token');
      if (xAdminToken && safeCompare(xAdminToken, sessionSecret)) {
        return true;
      }

      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.slice(7);
        if (bearerToken && safeCompare(bearerToken, sessionSecret)) {
          return true;
        }
      }
    }

    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
    if (cookieToken && safeCompare(cookieToken, sessionSecret)) {
      return true;
    }
  } catch (err) {
    console.warn('[AdminAuth] Verification error:', err?.message || err);
  }

  return false;
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export function getClearedAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  };
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json({ error: message }, { status: 401 });
}
