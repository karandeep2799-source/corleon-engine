import { z } from 'zod';
const schema = z.object({
 OPENAI_API_KEY:z.string().min(1), IMAGES_API_TOKEN:z.string().min(32),
 IMAGES_STORAGE_BUCKET:z.string().min(1), IMAGES_STORAGE_REGION:z.string().min(1),
 IMAGES_STORAGE_ENDPOINT:z.string().url().optional(),
 IMAGES_STORAGE_ACCESS_KEY_ID:z.string().min(1), IMAGES_STORAGE_SECRET_ACCESS_KEY:z.string().min(1),
 IMAGES_MODEL:z.string().default('gpt-image-2.5-sunburst')
});
export function getImageConfig(){ const r=schema.safeParse(process.env); if(!r.success) throw new Error('Image API is not configured; check server environment variables.'); return r.data; }
export const IMAGE_OWNER_ID='corleon-workspace';