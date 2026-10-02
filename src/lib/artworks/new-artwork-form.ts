import { parseYear } from './year';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export type NewArtworkFields = {
  title: string;
  description: string;
  price: number;
  heightCm: number;
  widthCm: number;
  categoryId: string;
  techniqueId: string;
  year: number | null;
  image: File;
};

// The "add a painting" form, whether the artist fills it or an admin does it
// for them; undefined when a field is missing or out of range.
export function parseNewArtwork(formData: FormData): NewArtworkFields | undefined {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const price = Number(formData.get('price'));
  const heightCm = Number(formData.get('heightCm'));
  const widthCm = Number(formData.get('widthCm'));
  const categoryId = String(formData.get('categoryId') ?? '').trim();
  const techniqueId = String(formData.get('techniqueId') ?? '').trim();
  const year = parseYear(formData.get('year'));
  const image = formData.get('image');

  const validNumbers =
    Number.isFinite(price) && price > 0 && Number.isFinite(heightCm) && heightCm > 0 && Number.isFinite(widthCm) && widthCm > 0;

  if (
    !title ||
    !description ||
    title.length > MAX_TITLE_LENGTH ||
    description.length > MAX_DESCRIPTION_LENGTH ||
    !validNumbers ||
    !categoryId ||
    !techniqueId ||
    year === undefined ||
    !(image instanceof File) ||
    image.size === 0
  ) {
    return undefined;
  }
  return { title, description, price, heightCm, widthCm, categoryId, techniqueId, year, image };
}
