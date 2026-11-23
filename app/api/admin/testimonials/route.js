import { getDbTestimonials, saveDbTestimonial, deleteDbTestimonial } from '@/lib/db';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';

export async function GET(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  const testimonials = await getDbTestimonials(true);
  return Response.json(testimonials);
}

export async function POST(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  try {
    const data = await request.json();
    if (!data?.customerName || !data?.quote) {
      return Response.json({ error: 'Customer name and quote are required' }, { status: 400 });
    }

    const saved = await saveDbTestimonial(data);
    return Response.json(saved);
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to save testimonial' }, { status: 500 });
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
      return Response.json({ error: 'Missing testimonial ID' }, { status: 400 });
    }

    await deleteDbTestimonial(id);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to delete testimonial' }, { status: 500 });
  }
}
