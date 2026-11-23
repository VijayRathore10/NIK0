import { getDbSiteSettings, saveDbSiteSettings } from '@/lib/db';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';

export async function GET(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  const settings = await getDbSiteSettings(true);
  return Response.json(settings);
}

export async function POST(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  try {
    const data = await request.json();
    const saved = await saveDbSiteSettings(data);
    return Response.json(saved);
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to save settings' }, { status: 500 });
  }
}
