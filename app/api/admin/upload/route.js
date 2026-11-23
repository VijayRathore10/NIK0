import fs from 'fs';
import path from 'path';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';

const CHUNK_SIZE = 650 * 1024; // 650KB chunks for Firestore 1MB doc limit safety
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.heic',
  '.avif',
  '.bmp',
]);

function resolveSafeImageExt(filename, mime = '') {
  const rawExt = path.extname(filename || '').toLowerCase();
  if (ALLOWED_IMAGE_EXTENSIONS.has(rawExt)) {
    return rawExt;
  }
  const lowerMime = String(mime || '').toLowerCase();
  if (lowerMime.includes('jpeg') || lowerMime.includes('jpg')) return '.jpg';
  if (lowerMime.includes('png')) return '.png';
  if (lowerMime.includes('webp')) return '.webp';
  if (lowerMime.includes('gif')) return '.gif';
  if (lowerMime.includes('svg')) return '.svg';
  if (lowerMime.includes('avif')) return '.avif';
  return '.jpg';
}

// Safely write to local disk with path confinement and without crashing on read-only filesystems (Cloud Run EROFS)
function safeSaveToDisk(filename, buffer) {
  const safeName = path.basename(filename);

  // 1. Write to /tmp/uploads (guaranteed writable in Linux/Cloud Run environments)
  try {
    const tmpDir = path.resolve('/tmp', 'uploads');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const targetPath = path.resolve(tmpDir, safeName);
    if (targetPath.startsWith(tmpDir + path.sep)) {
      fs.writeFileSync(targetPath, buffer);
    }
  } catch (tmpErr) {
    console.warn('Could not write to /tmp/uploads:', tmpErr?.message);
  }

  // 2. Attempt write to public/uploads (works in local dev, ignored on EROFS read-only containers)
  try {
    const publicDir = path.resolve(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    const targetPath = path.resolve(publicDir, safeName);
    if (targetPath.startsWith(publicDir + path.sep)) {
      fs.writeFileSync(targetPath, buffer);
    }
  } catch {
    // EROFS (Read-only file system) in Cloud Run - safely ignore because /tmp and Firestore handle it
  }
}

// Persist image permanently in Firestore database
async function saveToFirestore(filename, buffer, mimeType) {
  try {
    const base64Data = buffer.toString('base64');
    const docRef = doc(db, 'uploadedImages', filename);

    if (base64Data.length <= 800 * 1024) {
      await setDoc(docRef, {
        filename,
        contentType: mimeType || 'image/jpeg',
        base64: base64Data,
        size: buffer.length,
        isChunked: false,
        createdAt: new Date().toISOString(),
      });
    } else {
      const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
      await setDoc(docRef, {
        filename,
        contentType: mimeType || 'image/jpeg',
        size: buffer.length,
        isChunked: true,
        totalChunks,
        createdAt: new Date().toISOString(),
      });

      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkRef = doc(db, 'uploadedImages', filename, 'chunks', String(i));
        await setDoc(chunkRef, { index: i, chunk });
      }
    }
  } catch (err) {
    console.warn('[Firestore upload persistence warning]:', err?.message || err);
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse('Unauthorized. Please log in to admin again.');
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    const uploadedUrls = [];

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const rawList = Array.isArray(body.files) ? body.files : (body.file ? [body.file] : []);

      for (const item of rawList) {
        if (!item?.data || typeof item.data !== 'string') continue;
        const cleanBase64 = item.data.replace(/^data:image\/[a-z0-9-+.]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const mime = item.type || 'image/jpeg';
        const ext = resolveSafeImageExt(item.name || '', mime);

        const originalBase = path
          .basename(item.name || 'image', path.extname(item.name || ''))
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .toLowerCase()
          .slice(0, 32);

        const uniqueName = `${originalBase || 'img'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;

        safeSaveToDisk(uniqueName, buffer);
        await saveToFirestore(uniqueName, buffer, mime);

        uploadedUrls.push(`/uploads/${uniqueName}`);
      }
    } else {
      const formData = await request.formData();
      const files = formData.getAll('files');
      const singleFile = formData.get('file');
      const fileList = files.length > 0 ? files : (singleFile ? [singleFile] : []);

      if (fileList.length === 0) {
        return Response.json({ error: 'No files provided for upload' }, { status: 400 });
      }

      for (const file of fileList) {
        if (!file || typeof file.arrayBuffer !== 'function') continue;

        const buffer = Buffer.from(await file.arrayBuffer());
        const mime = file.type || '';
        const ext = resolveSafeImageExt(file.name || '', mime);

        const originalBase = path
          .basename(file.name || 'image', path.extname(file.name || ''))
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .toLowerCase()
          .slice(0, 32);

        const uniqueName = `${originalBase || 'img'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;

        safeSaveToDisk(uniqueName, buffer);
        await saveToFirestore(uniqueName, buffer, mime);

        uploadedUrls.push(`/uploads/${uniqueName}`);
      }
    }

    if (uploadedUrls.length === 0) {
      return Response.json({ error: 'No valid image files could be processed' }, { status: 400 });
    }

    return Response.json({
      success: true,
      urls: uploadedUrls,
      url: uploadedUrls[0] || null,
      count: uploadedUrls.length,
    });
  } catch (err) {
    console.error('File upload failed:', err);
    return Response.json({ error: err.message || 'File upload failed' }, { status: 500 });
  }
}
