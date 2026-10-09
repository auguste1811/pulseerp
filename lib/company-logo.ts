import { inflateSync } from "node:zlib";

export const LOGO_MAX_BYTES = 1_500_000; // ~1.5 Mo
export const LOGO_ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

export function parseLogoDataUrl(dataUrl: string | null | undefined): {
  mime: string;
  bytes: Buffer;
} | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = /^data:(image\/(png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl.trim(),
  );
  if (!match) return null;
  const mime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  if (!LOGO_ALLOWED_MIME.has(mime)) return null;
  try {
    const bytes = Buffer.from(match[3], "base64");
    if (bytes.length === 0 || bytes.length > 4_000_000) return null;
    return { mime, bytes };
  } catch {
    return null;
  }
}

export function validateLogoUpload(bytes: Buffer, mime: string | null): string | null {
  if (!mime || !LOGO_ALLOWED_MIME.has(mime)) {
    return "Format accepté : PNG ou JPEG uniquement.";
  }
  if (bytes.length === 0) return "Fichier vide.";
  if (bytes.length > LOGO_MAX_BYTES) {
    return "Logo trop lourd : 1,5 Mo maximum. Compressez l'image.";
  }
  // Vérifie les magic bytes
  const isPng =
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png" && !isPng) return "Fichier PNG invalide.";
  if (mime === "image/jpeg" && !isJpeg) return "Fichier JPEG invalide.";
  return null;
}

// --- Dimensions JPEG (SOF0/SOF1/SOF2) ---
export function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  let i = 2; // skip SOI
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) return null;
    if (
      marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
      marker === 0xc5 || marker === 0xc6 || marker === 0xc7 ||
      marker === 0xc9 || marker === 0xca || marker === 0xcb ||
      marker === 0xcd || marker === 0xce || marker === 0xcf
    ) {
      if (i + 9 >= bytes.length) return null;
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

// --- Décodage PNG 8-bit non-entrelacé -> RGB brut ---
export function decodePngToRgb(bytes: Buffer): { width: number; height: number; rgb: Buffer } | null {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIG)) return null;
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (pos + 8 <= bytes.length) {
    const len = bytes.readUInt32BE(pos);
    const type = bytes.toString("ascii", pos + 4, pos + 8);
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (!width || !height || width > 4000 || height > 4000) return null;
  if (bitDepth !== 8 || interlace !== 0) return null; // V1 : 8-bit non-entrelacé
  if (![0, 2, 6].includes(colorType)) return null;
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 1;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) return null;
  const rgb = Buffer.alloc(width * height * 3);
  let p = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const recon = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? recon[x - channels] : 0;
      const b = prev[x] ?? 0;
      const c = x >= channels ? prev[x - channels] : 0;
      let val: number;
      switch (filter) {
        case 0: val = row[x]; break;
        case 1: val = (row[x] + a) & 0xff; break;
        case 2: val = (row[x] + b) & 0xff; break;
        case 3: val = (row[x] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          val = (row[x] + pr) & 0xff;
          break;
        }
        default: return null;
      }
      recon[x] = val;
    }
    prev = recon;
    for (let x = 0; x < width; x += 1) {
      let r: number; let g: number; let b: number;
      if (channels === 3) {
        r = recon[x * 3]; g = recon[x * 3 + 1]; b = recon[x * 3 + 2];
      } else if (channels === 4) {
        // Aplatit l'alpha sur fond blanc
        const alpha = recon[x * 4 + 3] / 255;
        r = Math.round(recon[x * 4] * alpha + 255 * (1 - alpha));
        g = Math.round(recon[x * 4 + 1] * alpha + 255 * (1 - alpha));
        b = Math.round(recon[x * 4 + 2] * alpha + 255 * (1 - alpha));
      } else {
        r = g = b = recon[x];
      }
      const o = (y * width + x) * 3;
      rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
    }
  }
  return { width, height, rgb };
}
