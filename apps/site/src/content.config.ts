import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blogSchema = z.object({
  draft: z.boolean(),
  title: z.string(),
  snippet: z.string(),
  image: z.object({
    src: z.string(),
    alt: z.string(),
  }),
  publishDate: z.string().transform(str => new Date(str)),
  author: z.string().default('EdgeEver Team'),
  category: z.string(),
  tags: z.array(z.string()),
});

export const collections = {
  'blog': defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
    schema: blogSchema,
  }),
  'blog_en': defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog_en' }),
    schema: blogSchema,
  }),
};
