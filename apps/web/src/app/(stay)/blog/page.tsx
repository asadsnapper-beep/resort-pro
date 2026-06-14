import { Metadata } from 'next';
import Link from 'next/link';
import { getBlogPosts } from '@/lib/blog';
import { Clock, Tag, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title:       'Travel Blog — Eco & Agro Resorts South Asia',
  description: 'Travel guides, resort reviews, and tips for eco, agro, beach and hill resorts across South Asia.',
  openGraph: {
    title:       'Travel Blog — stay.resortpro.site',
    description: 'Discover the best resorts in South Asia through our travel guides and reviews.',
    type:        'website',
  },
  alternates: { canonical: 'https://stay.resortpro.site/blog' },
};

// Schema.org for the blog index
function BlogListSchema({ posts }: { posts: ReturnType<typeof getBlogPosts> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type':    'Blog',
          name:       'stay.resortpro.site Travel Blog',
          url:        'https://stay.resortpro.site/blog',
          description:'Travel guides and resort reviews for South Asia eco & agro tourism.',
          blogPost:   posts.map(p => ({
            '@type':         'BlogPosting',
            headline:        p.title,
            description:     p.description,
            datePublished:   p.date,
            author: { '@type': 'Person', name: p.author },
            url:             `https://stay.resortpro.site/blog/${p.slug}`,
          })),
        }),
      }}
    />
  );
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

export default function BlogPage() {
  const posts = getBlogPosts();

  return (
    <>
      <BlogListSchema posts={posts} />

      {/* Hero */}
      <div className="bg-gradient-to-r from-[#1a6b5e] to-[#145a4f] text-white px-4 py-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Travel Blog</h1>
          <p className="text-white/70 text-sm sm:text-base max-w-xl mx-auto">
            Resort guides, eco-travel tips, and destination stories from across South Asia
          </p>
        </div>
      </div>

      {/* Posts grid */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p>No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured post (first) */}
            {posts[0] && (
              <Link
                href={`/blog/${posts[0].slug}`}
                className="group block bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all overflow-hidden">
                {posts[0].coverImage && (
                  <div className="h-52 sm:h-64 overflow-hidden">
                    <img
                      src={posts[0].coverImage}
                      alt={posts[0].title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {posts[0].tags.slice(0, 3).map(tag => (
                      <span key={tag} className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TAG_COLORS[tag] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 group-hover:text-[#1a6b5e] transition-colors mb-2">
                    {posts[0].title}
                  </h2>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">{posts[0].description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {posts[0].readTime} min read
                    </span>
                    <span className="flex items-center gap-1 text-[#1a6b5e] font-semibold">
                      Read article <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Rest of posts */}
            <div className="grid sm:grid-cols-2 gap-5">
              {posts.slice(1).map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#b2ddd6] transition-all overflow-hidden">
                  {post.coverImage && (
                    <div className="h-36 overflow-hidden">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {post.tags.slice(0, 2).map(tag => (
                        <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TAG_COLORS[tag] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 group-hover:text-[#1a6b5e] transition-colors mb-1 line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{post.description}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" /> {post.readTime} min read
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
