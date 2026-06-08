import { prisma } from '@resort-pro/database';

const THEMES = [
  {
    key: 'luxe',
    name: 'Luxe',
    description: 'Elegant dark-gold luxury resort theme. Perfect for high-end properties.',
    author: 'ResortPro',
    version: '1.0.0',
    tags: ['luxury', 'dark', 'gold', 'elegant'],
    isActive: true,
    isDefault: true,
    isPremium: false,
    requiredPlan: 'FREE',
    sortOrder: 1,
  },
  {
    key: 'minimal',
    name: 'Minimal',
    description: 'Clean, white minimal theme with focus on photography and content.',
    author: 'ResortPro',
    version: '1.0.0',
    tags: ['minimal', 'clean', 'white', 'modern'],
    isActive: true,
    isDefault: false,
    isPremium: false,
    requiredPlan: 'FREE',
    sortOrder: 2,
  },
  {
    key: 'coastal',
    name: 'Coastal',
    description: 'Ocean-inspired theme with blue tones. Ideal for beachside resorts.',
    author: 'ResortPro',
    version: '1.0.0',
    tags: ['coastal', 'beach', 'blue', 'ocean'],
    isActive: true,
    isDefault: false,
    isPremium: false,
    requiredPlan: 'FREE',
    sortOrder: 3,
  },
];

async function main() {
  for (const t of THEMES) {
    await prisma.theme.upsert({
      where: { key: t.key },
      update: t,
      create: t,
    });
    console.log(`✅ ${t.key} — ${t.name}`);
  }
  console.log('\n🎨 Themes seeded!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
