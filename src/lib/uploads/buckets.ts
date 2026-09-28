// Public Supabase Storage buckets. Anyone can read the files; only the server
// (with the service role key) uploads or deletes them.
export const ARTWORK_IMAGES_BUCKET = 'artworks';
export const BANNERS_BUCKET = 'banners';
export const AVATARS_BUCKET = 'avatars';
export const POSTS_BUCKET = 'posts';

// Our own stored files go through next/image's optimiser; anything else (old
// or test URLs) is shown as it is.
export const isStorageUrl = (url: string) => url.includes('/storage/v1/object/public/');
