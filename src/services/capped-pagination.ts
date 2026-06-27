export type PaginatedResponse<T> = {
  data: T[];
  headers?: {
    link?: string | null;
  };
};

export type CappedItemsResult<T> = {
  items: T[];
  capped: boolean;
};

export type CappedCountResult = {
  count: number;
  capped: boolean;
};

export async function collectPaginatedItems<T>(
  pages: AsyncIterable<PaginatedResponse<T>>,
  limit: number
): Promise<CappedItemsResult<T>> {
  if (
    !Number.isInteger(limit) ||
    limit <= 0
  ) {
    throw new Error(
      "Pagination limit must be a positive integer."
    );
  }

  const items: T[] = [];

  for await (const page of pages) {
    const remaining =
      limit - items.length;

    if (page.data.length >= remaining) {
      items.push(
        ...page.data.slice(0, remaining)
      );

      const hasMoreItems =
        page.data.length > remaining ||
        (
          page.headers?.link?.includes(
            'rel="next"'
          ) ?? false
        );

      return {
        items,
        capped: hasMoreItems
      };
    }

    items.push(...page.data);
  }

  return {
    items,
    capped: false
  };
}

export async function countPaginatedItems<T>(
  pages: AsyncIterable<PaginatedResponse<T>>,
  limit: number
): Promise<CappedCountResult> {
  const result =
    await collectPaginatedItems(
      pages,
      limit
    );

  return {
    count: result.items.length,
    capped: result.capped
  };
}
