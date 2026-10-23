import encode, { init } from '@jsquash/webp/encode.js';
import regularWasm from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import simdWasm from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';
let initialized: Promise<unknown> | undefined;
/** Safari can decode WebP but may lack canvas WebP encoding. Use local libwebp. */
export async function encodeWebp(data: ImageData, quality: number): Promise<Blob> {
  if (!initialized)
    initialized = init({
      locateFile: (path: string) => (path.includes('_simd') ? simdWasm : regularWasm),
    }).catch((error) => {
      initialized = undefined;
      throw error;
    });
  await initialized;
  const bytes = await encode(data, {
    quality: Math.round(quality * 100),
    method: 6,
    alpha_quality: 100,
  });
  return new Blob([bytes], { type: 'image/webp' });
}
