// The site's legal documents and who runs the site. Every document page reads
// the operator's details from here, so they are filled in once.
// Plain values, no brackets; an empty `registration` is left out of the pages.
export const OPERATOR = {
  name: 'Rasuljon Muminov',
  // Taxpayer id (ИНН) or registration number; leave empty if not applicable.
  registration: '',
  address: 'Dushanbe',
  telegram: '@xzrasul',
  email: 'xzrasul13@gmail.com',
};

// When the documents last changed; shown on every document page.
export const LEGAL_UPDATED = '29 сентября 2026 г.';

export const LEGAL_DOCS = [
  { href: '/terms', title: 'Пользовательское соглашение' },
  { href: '/privacy', title: 'Политика конфиденциальности' },
  { href: '/rules/sellers', title: 'Правила для продавцов' },
  { href: '/contacts', title: 'Контакты и жалобы' },
] as const;

// The seller application's consent checkbox (publication of the artist's data
// and acceptance of the seller rules). Browsers send "on" for a checked box.
export const SELLER_CONSENT_FIELD = 'consent';
export const hasSellerConsent = (formData: FormData) => formData.get(SELLER_CONSENT_FIELD) === 'on';
