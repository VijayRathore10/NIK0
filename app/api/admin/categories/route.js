import { getDbCategories, saveDbCategory, deleteDbCategory } from '@/lib/db';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';

export async function GET(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  const categories = await getDbCategories(true);
  return Response.json(categories);
}

export async function POST(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  try {
    const data = await request.json();
    if (!data?.title) {
      return Response.json({ error: 'Category title is required' }, { status: 400 });
    }

    const saved = await saveDbCategory(data);
    return Response.json(saved);
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to save category' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return Response.json({ error: 'Missing category ID' }, { status: 400 });
    }

    await deleteDbCategory(id);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to delete category' }, { status: 500 });
  }
}
