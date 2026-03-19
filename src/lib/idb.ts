import { get, set, del } from 'idb-keyval';

export async function saveImageLocally(id: string, base64Data: string) {
  await set(`image_${id}`, base64Data);
}

export async function getImageLocally(id: string): Promise<string | undefined> {
  return await get(`image_${id}`);
}

export async function deleteImageLocally(id: string) {
  await del(`image_${id}`);
}
