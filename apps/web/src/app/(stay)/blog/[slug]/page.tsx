import { notFound }       from 'next/navigation';
import { Metadata }        from 'next';
import Link                from 'next/link';
import { getBlogPost, getBlogPosts } from '@/lib/blog';
import { ChevronLeft, Clock, Tag, Calendar } from 'lucide-react';

// Generate static params for all blog posts
export async function generateStaticParams() {
  return getBlogPosts().map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title:       `${post.title} — stay.resortpro.site`,
    description: post.description,
    keywords:    post.tags.join(', '),
    authors:     [{ name: post.author }],
    openGraph: {
      title:           post.title,
      description:     post.description,
      type:            'article',
      publishedTime:   post.date,
      authors:         [post.author],
      images:          post.coverImage ? [{ url: post.coverImage }] : [],
    },
    twitter: {
      card:        'summary_large_image',
      title:       post.title,
      description: post.description,
      images:      post.coverImage ? [post.coverImage] : [],
    },
    alternates: { canonical: `https://stay.resortpro.site/blog/${post.slug}` },
  };
}

const TAG_COLORS: Record<string, string> = {
  eco:         'bg-green-50  text-green-700  border-green-200',
  agro:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  beach:       'bg-blue-50   text-blue-700   border-blue-200',
  hill:        'bg-stone-50  text-stone-700  border-stone-200',
  bangladesh:  'bg-red-50    text-red-700    border-red-200',
  'south-asia':'bg-purple-50 text-purple-700 border-purple-200',
  travel:      'bg-teal-50   text-teal-700   border-teal-200',
};

/** Minimal markdown → HTML renderer (no external deps) */
function renderMarkdown(md: string): string {
  return md
    // H1, H2, H3
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-gray-800 mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-xl font-bold text-gray-800 mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-2xl font-bold text-gray-800 mt-8 mb-4">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[#1a6b5e] underline hover:opacity-80">$1</a>')
    // Bullet points
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-600">$1</li>')
    // Numbered list
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-600">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-8 border-gray-100" />')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="text-gray-600 leading-relaxed mb-4">')
    // Wrap in paragraph
    .replace(/^(.)/m, '<p class="text-gray-600 leading-relaxed mb-4">$1')
    + '</p>'
    // Clean up empty paragraphs
    .replace(/<p[^>]*>\s*(<h[123]|<li|<hr)[^>]*>/g, '$1');
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const allPosts    = getBlogPosts();
  const relatedPosts = allPosts
    .filter(p => p.slug !== post.slug && p.tags.some(t => post.tags.includes(t)))
    .slice(0, 3);

  return (
    <>
      {/* Schema.org BlogPosting */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context':      'https://schema.org',
            '@type':         'BlogPosting',
            headline:        post.title,
            description:     post.description,
            datePublished:   post.date,
            dateModified:    post.date,
            author: { '@type': 'Person', name: post.author },
            publisher: {
              '@type': 'Organization',
              name:    'stay.resortpro.site',
              url:     'https://stay.resortpro.site',
            },
            image:           post.coverImage,
            keywords:        post.tags.join(', '),
            url:             `https://stay.resortpro.site/blog/${post.slug}`,
            mainEntityOfPage: { '@type': 'WebPage', '@id': `https://stay.resortpro.site/blog/${post.slug}` },
          }),
        }}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-[#1a6b5e] hover:underline mb-6">
          <ChevronLeft className="w-4 h-4" /> Back to Blog
        </Link>

        {/* Cover image */}
        {post.coverImage && (
          <div className="rounded-2xl overflow-hidden h-52 sm:h-72 mb-6">
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.map(tag => (
            <span key={tag} className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TAG_COLORS[tag] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 leading-tight">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mb-8 pb-6 border-b border-gray-100">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {post.readTime} min read
          </span>
          <span>By {post.author}</span>
        </div>

        {/* Content */}
        <article
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />

        {/* CTA */}
        <div className="mt-10 p-5 bg-gradient-to-r from-[#f0faf8] to-[#e8f5f2] rounded-2xl border border-[#b2ddd6]">
          <p className="text-sm font-semibold text-[#1a6b5e] mb-1">Ready to explore?</p>
          <p className="text-xs text-gray-500 mb-3">Find and book the resorts mentioned in this article.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/discover"
              className="inline-flex items-center gap-1.5 bg-[#1a6b5e] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#145a4f] transition-colors">
              Browse Resorts on Map →
            </Link>
            {post.tags[0] && (
              <Link href={`/discover?category=${post.tags[0]}`}
                className="inline-flex items-center gap-1.5 border border-[#1a6b5e] text-[#1a6b5e] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#f0faf8] transition-colors">
                Browse {post.tags[0]} resorts
              </Link>
            )}
          </div>
        </div>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-10">
            <h2 className="text-base font-bold text-gray-700 mb-4">Related Articles</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {relatedPosts.map(related => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group bg-white rounded-xl border border-gray-100 p-3 hover:border-[#b2ddd6] hover:shadow-sm transition-all">
                  {related.coverImage && (
                    <img src={related.coverImage} alt={related.title}
                      className="w-full h-20 object-cover rounded-lg mb-2" />
                  )}
                  <p className="text-xs font-semibold text-gray-700 group-hover:text-[#1a6b5e] transition-colors line-clamp-2">
                    {related.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{related.readTime} min read</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
