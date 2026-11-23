import { cookies } from 'next/headers';
import {
  ADMIN_AUTH_COOKIE,
  getAdminSessionSecret,
  getAdminCookieOptions,
  getClearedAdminCookieOptions,
  verifyAdminPassword,
  verifyAdminRequest,
} from '@/lib/adminAuth';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const password = typeof body?.password === 'string' ? body.password : '';

    const { configured, valid } = verifyAdminPassword(password);

    if (!configured) {
      return Response.json(
        { error: 'Admin authentication is not configured on the server.' },
        { status: 503 }
      );
    }

    if (!valid) {
      return Response.json(
        { error: 'Incorrect administrator password' },
        { status: 401 }
      );
    }

    const sessionSecret = getAdminSessionSecret();
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_AUTH_COOKIE, sessionSecret, getAdminCookieOptions());

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

export async function GET(request) {
  const isAuthenticated = await verifyAdminRequest(request);
  return Response.json({ authenticated: isAuthenticated });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_AUTH_COOKIE, '', getClearedAdminCookieOptions());
  return Response.json({ success: true });
}
