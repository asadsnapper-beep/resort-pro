/**
 * blog.ts
 * Simple file-based blog system for stay.resortpro.site
 * Articles stored as .mdx files in /content/blog/
 */

import fs   from 'fs';
import path from 'path';

export interface BlogPost {
  slug:        string;
  title:       string;
  description: string;
  date:        string;        // ISO date string
  author:      string;
  coverImage?: string;
  tags:        string[];
  readTime:    number;        // minutes
  content:     string;        // raw MDX/markdown
}

const BLOG_DIR = path.join(process.cwd(), '../../content/blog');

/** Parse front-matter from a markdown file (simple regex, no extra deps) */
function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw };

  const meta: Record<string, string> = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
  });

  return { meta, content: match[2].trim() };
}

function estimateReadTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Read all blog posts sorted by date desc */
export function getBlogPosts(): BlogPost[] {
  try {
    if (!fs.existsSync(BLOG_DIR)) return DEMO_POSTS;

    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));
    if (files.length === 0) return DEMO_POSTS;

    return files
      .map(file => {
        const slug = file.replace(/\.(mdx?|md)$/, '');
        const raw  = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
        const { meta, content } = parseFrontmatter(raw);

        return {
          slug,
          title:       meta.title       ?? slug,
          description: meta.description ?? '',
          date:        meta.date         ?? new Date().toISOString(),
          author:      meta.author       ?? 'stay.resortpro.site',
          coverImage:  meta.coverImage,
          tags:        meta.tags ? meta.tags.split(',').map(t => t.trim()) : [],
          readTime:    estimateReadTime(content),
          content,
        } satisfies BlogPost;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return DEMO_POSTS;
  }
}

export function getBlogPost(slug: string): BlogPost | null {
  const posts = getBlogPosts();
  return posts.find(p => p.slug === slug) ?? null;
}

// ─── Demo posts (shown when no content/blog/*.mdx files exist) ────────────────

const DEMO_POSTS: BlogPost[] = [
  {
    slug:        'best-eco-resorts-bangladesh',
    title:       'Best Eco Resorts in Bangladesh 2025',
    description: 'Discover the top eco-friendly resorts in Bangladesh — from the Sundarbans to the hills of Bandarban.',
    date:        '2025-03-15',
    author:      'stay.resortpro.site',
    coverImage:  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
    tags:        ['eco', 'bangladesh', 'travel'],
    readTime:    5,
    content: `
# Best Eco Resorts in Bangladesh 2025

Bangladesh is home to some of the most breathtaking natural landscapes in South Asia.
From the world's largest mangrove forest to the mist-covered hills of the Chittagong Hill Tracts,
eco-tourism in Bangladesh is growing fast.

## 1. Sundarbans Eco Lodge

Nestled in the heart of the Sundarbans, this eco-lodge offers an unparalleled wildlife experience.
Wake up to the sounds of Bengal tigers roaming nearby and explore the waterways by boat.

**Best for:** Wildlife enthusiasts, nature lovers
**Price:** From ৳8,000/night

## 2. Bandarban Hill Retreat

Perched at 1,200 feet above sea level, this resort offers panoramic views of the misty hills.
Trek to nearby tribal villages and experience authentic hill culture.

**Best for:** Trekkers, cultural explorers
**Price:** From ৳5,500/night

## 3. Cox's Bazar Beachfront Eco-Resort

The world's longest natural sea beach meets sustainable living at this eco-certified resort.
Solar-powered, rainwater harvesting, and locally-sourced food.

**Best for:** Beach lovers, families
**Price:** From ৳7,000/night

## How to Book

All these resorts are listed on [stay.resortpro.site](/discover).
Browse by category, filter by price, and book directly through the resort's website.
    `.trim(),
  },
  {
    slug:        'agro-tourism-south-asia',
    title:       'Rise of Agro-Tourism in South Asia',
    description: 'Farm stays, harvest experiences, and rural tourism are booming. Here\'s why travelers are choosing agro-resorts.',
    date:        '2025-02-20',
    author:      'stay.resortpro.site',
    coverImage:  'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80',
    tags:        ['agro', 'farm-stay', 'south-asia', 'travel'],
    readTime:    4,
    content: `
# Rise of Agro-Tourism in South Asia

Agro-tourism — travel centered around agricultural experiences — is rapidly gaining popularity
across Bangladesh, India, Sri Lanka, and Nepal.

## What is Agro-Tourism?

Agro-tourism combines agriculture with hospitality. Guests stay on working farms,
participate in harvests, learn traditional farming methods, and eat farm-to-table meals.

## Why South Asia?

South Asia's agricultural diversity is staggering:
- **Bangladesh:** Rice paddies, tea gardens, fish farms
- **India:** Spice plantations in Kerala, apple orchards in Himachal
- **Sri Lanka:** Tea estates, cinnamon farms, rubber plantations
- **Nepal:** Cardamom farms, honey bee farms, terraced rice fields

## Top Agro-Resort Experiences

1. **Tea garden stays** — Wake up to the aroma of fresh tea leaves
2. **Rice harvest festivals** — Join local farmers during harvest season
3. **Organic farm dinners** — Everything on your plate grown 50 meters away

Discover agro-resorts near you on [stay.resortpro.site/discover?category=agro](/discover?category=agro).
    `.trim(),
  },
  {
    slug:        'hill-resorts-bandarban-rangamati',
    title:       'Hill Resorts in Bandarban & Rangamati: A Complete Guide',
    description: 'Everything you need to know about staying in the beautiful hill districts of Bangladesh.',
    date:        '2025-01-10',
    author:      'stay.resortpro.site',
    coverImage:  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    tags:        ['hill', 'bandarban', 'rangamati', 'bangladesh'],
    readTime:    6,
    content: `
# Hill Resorts in Bandarban & Rangamati

The Chittagong Hill Tracts of Bangladesh offer some of the most spectacular mountain scenery
in South Asia, yet remain relatively undiscovered by international travelers.

## Bandarban

Home to Bangladesh's highest peaks, Bandarban is a trekker's paradise.

### Best Resorts

**1. Nilgiri Resort**
At 2,200 feet, Nilgiri offers cloud-level views. The army-run resort is well-maintained
with clean rooms and good food.

**2. Chimbuk Resort**
Near the famous Chimbuk Hill, this resort is popular with Dhaka weekenders.

## Rangamati

Known as the "Lake City," Rangamati sits on the banks of the stunning Kaptai Lake.

### Best Resorts

**1. Zia Pahar Resort**
Perched on a hilltop with lake views, this resort offers boat excursions and tribal cultural shows.

**2. Sufia Resort**
Budget-friendly with lake access and local cuisine.

## Getting There

- **Bandarban:** 4-5 hours from Dhaka by bus, 1 hour from Chittagong
- **Rangamati:** 3 hours from Chittagong, 5-6 hours from Dhaka

Browse hill resorts on [stay.resortpro.site](/discover?category=hill).
    `.trim(),
  },
];
