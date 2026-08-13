/**
 * Guest ID / Passport OCR
 *
 * POST /api/guests/scan-id
 *   multipart: file (image), docType? (PASSPORT|NATIONAL_ID|DRIVERS_LICENSE|OTHER)
 *   → runs Tesseract OCR → attempts MRZ parse → returns extracted fields
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth';

// ── MRZ parser ────────────────────────────────────────────────────────────────

async function tryParseMRZ(text: string): Promise<Record<string, string> | null> {
  const lines = text
    .split('\n')
    .map(l => l.replace(/\s+/g, '').toUpperCase())
    .filter(l => /^[A-Z0-9<]{30,44}$/.test(l));

  if (lines.length < 2) return null;

  try {
    const { parse: parseMRZ } = await import('mrz');
    if (lines.some(l => l.length === 44)) {
      const td3Lines = lines.filter(l => l.length === 44).slice(0, 2);
      if (td3Lines.length === 2) return flattenMRZ(parseMRZ(td3Lines));
    }
    if (lines.some(l => l.length === 30)) {
      const td1Lines = lines.filter(l => l.length === 30).slice(0, 3);
      if (td1Lines.length >= 2) return flattenMRZ(parseMRZ(td1Lines));
    }
  } catch {
    // MRZ parse failed — not a standard document
  }
  return null;
}

function flattenMRZ(result: any): Record<string, string> {
  const fields: Record<string, string> = {};
  const fieldMap: Record<string, string> = {
    firstName:       'firstName',
    lastName:        'lastName',
    nationality:     'nationality',
    birthDate:       'dateOfBirth',
    expirationDate:  'expiryDate',
    documentNumber:  'documentNumber',
    sex:             'gender',
  };
  for (const [mrzKey, ourKey] of Object.entries(fieldMap)) {
    const val = result.fields?.[mrzKey];
    if (val?.value) fields[ourKey] = String(val.value);
  }
  return fields;
}

// ── Heuristic text parser (non-MRZ fallback) ──────────────────────────────────

function parseRawText(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Bangladesh NID patterns
  const nidMatch = text.match(/\b(\d{10,17})\b/);
  if (nidMatch) fields.documentNumber = nidMatch[1];

  // Name patterns: "Name:", "নাম:", "Holder:", bold-looking ALL CAPS line
  for (const line of lines) {
    const nameMatch = line.match(/(?:name|holder|নাম)[:\s]+([A-Za-z\s]{3,40})/i);
    if (nameMatch) {
      const parts = nameMatch[1].trim().split(/\s+/);
      if (parts.length >= 2) {
        fields.firstName = parts[0];
        fields.lastName  = parts.slice(1).join(' ');
      }
      break;
    }
  }

  // Date of birth — BD NIDs print this as "12 Feb 1994" (month name), not
  // the numeric DD/MM/YYYY this used to assume exclusively. Try month-name
  // form first since it's the actual NID format; fall back to numeric.
  const MONTHS: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const dobMonthName = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (dobMonthName) {
    const month = MONTHS[dobMonthName[2].slice(0, 3).toLowerCase()];
    if (month) fields.dateOfBirth = `${dobMonthName[3]}-${month}-${dobMonthName[1].padStart(2, '0')}`;
  }
  if (!fields.dateOfBirth) {
    const dobMatch = text.match(/(?:dob|birth|born|জন্ম)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i)
      || text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/);
    if (dobMatch) fields.dateOfBirth = dobMatch[1];
  }

  return fields;
}

// ── Date normalization ─────────────────────────────────────────────────────────
// OCR/MRZ extraction hands back raw, ambiguous date strings (commonly
// DD/MM/YYYY for BD ID documents). Passing that straight to `new Date()`
// downstream either misparses silently (JS reads slash dates as MM/DD/YYYY)
// or produces an Invalid Date whenever the day exceeds 12 — which then
// throws deep inside a booking/guest-update transaction. Normalize to ISO
// here, once, for every caller, and drop the field rather than guess wrong.
function isValidYMD(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return isValidYMD(+y, +m, +d) ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : undefined;
  }

  // Day-first (DD/MM/YYYY or DD-MM-YYYY) — the convention used by BD IDs
  // and by this file's own regexes above.
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const currentYY = new Date().getFullYear() % 100;
    const year = yRaw.length === 2
      ? (Number(yRaw) <= currentYY ? 2000 + Number(yRaw) : 1900 + Number(yRaw))
      : Number(yRaw);
    return isValidYMD(year, +m, +d) ? `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : undefined;
  }

  return undefined; // unrecognized shape — drop rather than guess
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function idScanRoutes(app: FastifyInstance) {
  app.post('/scan-id', {
    schema: { tags: ['guests'], summary: 'OCR a guest ID / passport image' },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const parts = request.parts();
      let fileBuffer: Buffer | null = null;
      let mimeType = 'image/jpeg';
      let docType  = 'OTHER';

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          mimeType = part.mimetype;
          if (!mimeType.startsWith('image/')) {
            return reply.status(400).send({ success: false, error: 'Only image files allowed' });
          }
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk as Buffer);
          fileBuffer = Buffer.concat(chunks);
        } else if (part.type === 'field' && part.fieldname === 'docType') {
          docType = String(part.value).toUpperCase();
        }
      }

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        return reply.status(400).send({ success: false, error: 'No image uploaded' });
      }
      if (fileBuffer.byteLength > 10 * 1024 * 1024) {
        return reply.status(400).send({ success: false, error: 'Image too large (max 10 MB)' });
      }

      // ── Run OCR ──────────────────────────────────────────────────────────
      let rawText  = '';
      let confidence = 0;
      try {
        const Tesseract = await import('tesseract.js');
        const result = await Tesseract.default.recognize(fileBuffer, 'eng+ben', {
          // @ts-ignore — logger not in types but valid
          logger: () => {},
        });
        rawText    = result.data.text;
        confidence = result.data.confidence;
      } catch (err) {
        app.log.error(`[id-scan] Tesseract error: ${err}`);
        return reply.status(500).send({ success: false, error: 'OCR failed. Try a clearer image.' });
      }

      // ── Parse fields ─────────────────────────────────────────────────────
      const mrzFields = await tryParseMRZ(rawText);
      const fields = mrzFields ?? parseRawText(rawText);
      if (fields.dateOfBirth) {
        const normalized = normalizeDate(fields.dateOfBirth);
        if (normalized) fields.dateOfBirth = normalized;
        else delete fields.dateOfBirth;
      }

      return reply.send({
        success: true,
        data: {
          fields,
          docType,
          confidence: Math.round(confidence),
          method: mrzFields ? 'mrz' : 'ocr',
          // rawText only in dev (don't leak full doc text in prod)
          ...(process.env.NODE_ENV !== 'production' ? { rawText } : {}),
        },
      });
    },
  });
}
