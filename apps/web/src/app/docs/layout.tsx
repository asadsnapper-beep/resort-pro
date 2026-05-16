import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center — ResortPro',
  description: 'Guides and documentation for ResortPro resort management platform.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased">
      {children}
    </div>
  );
}
