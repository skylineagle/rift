import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Rift';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const gitConfig = {
  user: 'skylineagle',
  repo: 'rift',
  branch: 'main',
};

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
