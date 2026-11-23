import { getRawDatabase, restoreDatabase } from '@/lib/db';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';

export async function GET(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  const raw = await getRawDatabase();
  return new Response(JSON.stringify(raw, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="nikexports-backup-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}

export async function POST(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  try {
    const data = await request.json();
    await restoreDatabase(data);
    return Response.json({ success: true, message: 'Database successfully restored from backup' });
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to restore database' }, { status: 500 });
  }
}
