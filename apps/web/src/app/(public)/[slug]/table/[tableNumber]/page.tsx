import { TableOrderingApp } from './TableOrderingApp';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchTableMenu(slug: string, tableNumber: string) {
  try {
    const res = await fetch(`${API}/table/${slug}/${tableNumber}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export default async function TablePage({
  params,
}: {
  params: { slug: string; tableNumber: string };
}) {
  const data = await fetchTableMenu(params.slug, params.tableNumber);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="text-6xl">🍽️</div>
          <h1 className="text-2xl font-bold">Table not found</h1>
          <p className="text-gray-400">Please ask a staff member for assistance.</p>
        </div>
      </div>
    );
  }

  return (
    <TableOrderingApp
      slug={params.slug}
      tableNumber={parseInt(params.tableNumber, 10)}
      initialData={data}
    />
  );
}
