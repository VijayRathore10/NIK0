import { getDbProducts, saveDbProduct, deleteDbProduct } from '@/lib/db';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';

export async function GET(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  const products = await getDbProducts(true);
  return Response.json(products);
}

export async function POST(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  try {
    const productData = await request.json();
    if (!productData?.name) {
      return Response.json({ error: 'Product name is required' }, { status: 400 });
    }

    const saved = await saveDbProduct(productData);
    return Response.json(saved);
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to save product' }, { status: 500 });
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
      return Response.json({ error: 'Missing product ID' }, { status: 400 });
    }

    await deleteDbProduct(id);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to delete product' }, { status: 500 });
  }
}
