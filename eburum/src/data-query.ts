type QueryResult<Row> = { data: Row[] | null; error: unknown };

export async function fetchAllRows<Row>(
  build: () => {
    range: (from: number, to: number) => PromiseLike<QueryResult<Row>>;
  },
): Promise<QueryResult<Row>> {
  const data: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await build().range(offset, offset + 499);
    if (result.error) return { data: null, error: result.error };
    const rows = result.data || [];
    data.push(...rows);
    if (rows.length < 500) return { data, error: null };
  }
}
