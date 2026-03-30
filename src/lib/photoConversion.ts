/**
 * Photo conversion utilities
 * Handles HEIC to JPEG conversion for member photos
 */

import convert from 'heic-convert';

/**
 * Detect if a buffer is a HEIC/HEIF image
 */
export function isHEIC(buffer: Buffer): boolean {
  // HEIC files start with specific magic bytes
  // Check for 'ftyp' box with 'heic', 'heix', 'hevc', 'hevx', 'mif1' brands
  const header = buffer.toString('ascii', 4, 12);
  return header.includes('ftyp') && (
    buffer.toString('ascii', 8, 12) === 'heic' ||
    buffer.toString('ascii', 8, 12) === 'heix' ||
    buffer.toString('ascii', 8, 12) === 'hevc' ||
    buffer.toString('ascii', 8, 12) === 'hevx' ||
    buffer.toString('ascii', 8, 12) === 'mif1'
  );
}

/**
 * Convert HEIC image to JPEG
 * @param buffer - Image buffer (HEIC or other format)
 * @returns Buffer in JPEG format
 */
export async function convertToJPEG(buffer: Buffer): Promise<Buffer> {
  // Check if it's a HEIC file
  if (isHEIC(buffer)) {
    console.log('[photoConversion] Detected HEIC format, converting to JPEG...');

    try {
      const jpegBuffer = await convert({
        buffer: buffer,
        format: 'JPEG',
        quality: 0.9
      });

      console.log('[photoConversion] Converted HEIC to JPEG:', {
        originalSize: buffer.length,
        convertedSize: jpegBuffer.length
      });

      return Buffer.from(jpegBuffer);
    } catch (error) {
      console.error('[photoConversion] Failed to convert HEIC:', error);
      throw new Error('Failed to convert HEIC image. Please try a different format.');
    }
  }

  // If not HEIC, return as-is (already JPEG/PNG/etc)
  console.log('[photoConversion] Image is not HEIC, using as-is');
  return buffer;
}

/**
 * Get appropriate MIME type after conversion
 */
export function getConvertedMimeType(originalMimeType: string | null | undefined): string {
  // If original was HEIC, it's now JPEG
  if (originalMimeType === 'image/heic' || originalMimeType === 'image/heif') {
    return 'image/jpeg';
  }

  // Otherwise return original
  return originalMimeType || 'image/jpeg';
}
