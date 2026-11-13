import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center — ResortPro',
  description: 'Guides and documentation for ResortPro resort management platform.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f6f1] font-sans text-resort-900 antialiased">
      {children}
    </div>
  );
}
