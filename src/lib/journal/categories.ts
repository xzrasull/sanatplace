// The journal's rubrics. Kept apart from the schema so browser code can use it
// without pulling in the database layer.
export const POST_CATEGORIES = ['exhibition', 'event', 'news', 'article'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
