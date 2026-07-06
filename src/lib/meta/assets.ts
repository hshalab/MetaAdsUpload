// Fetch a Meta user's ad accounts and pages, following pagination so we never
// stop at the first page of results (the old 50-item cap silently dropped any
// page/account beyond the first batch — newly created pages just never showed).

const GRAPH = "https://graph.facebook.com/v21.0";

async function fetchAllEdge<T>(token: string, edge: string, fields: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null =
    `${GRAPH}/${edge}?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(token)}`;
  let guard = 0;
  // Meta's paging.next already carries the cursor + token, so we follow it as-is.
  while (url && guard < 50) {
    guard++;
    const res: Response = await fetch(url);
    const data: { data?: T[]; error?: { message?: string }; paging?: { next?: string } } = await res.json();
    if (data.error) throw new Error(data.error.message || `Failed to fetch ${edge}`);
    if (Array.isArray(data.data)) items.push(...data.data);
    url = data.paging?.next || null;
  }
  return items;
}

export interface MetaAdAccount { id: string; name: string; currency: string; status: number; }
export interface MetaPage { id: string; name: string; }

export async function fetchAdAccountsAndPages(
  token: string
): Promise<{ adAccounts: MetaAdAccount[]; pages: MetaPage[] }> {
  const [rawAccounts, rawPages] = await Promise.all([
    fetchAllEdge<{ id: string; name: string; currency: string; account_status: number }>(
      token,
      "me/adaccounts",
      "id,name,currency,account_status"
    ),
    fetchAllEdge<{ id: string; name: string }>(token, "me/accounts", "id,name"),
  ]);

  const adAccounts = rawAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    status: a.account_status,
  }));
  const pages = rawPages.map((p) => ({ id: p.id, name: p.name }));

  return { adAccounts, pages };
}
