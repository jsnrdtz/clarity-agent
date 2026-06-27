import assert from "node:assert/strict";
import test from "node:test";

import {
  collectPaginatedItems,
  countPaginatedItems,
  type PaginatedResponse
} from "./capped-pagination.js";

async function* createPages(
  pages: PaginatedResponse<number>[],
  onRead?: () => void
): AsyncGenerator<PaginatedResponse<number>> {
  for (const page of pages) {
    onRead?.();
    yield page;
  }
}

test(
  "counts all items below the limit",
  async () => {
    const result =
      await countPaginatedItems(
        createPages([
          {
            data: [1, 2, 3]
          },
          {
            data: [4, 5]
          }
        ]),
        10
      );

    assert.deepEqual(result, {
      count: 5,
      capped: false
    });
  }
);

test(
  "stops at the limit and marks data as capped",
  async () => {
    let pagesRead = 0;

    const result =
      await countPaginatedItems(
        createPages(
          [
            {
              data: [1, 2],
              headers: {
                link: '<next>; rel="next"'
              }
            },
            {
              data: [3, 4],
              headers: {
                link: '<next>; rel="next"'
              }
            },
            {
              data: [5, 6],
              headers: {
                link: '<next>; rel="next"'
              }
            },
            {
              data: [7, 8]
            }
          ],
          () => {
            pagesRead += 1;
          }
        ),
        6
      );

    assert.deepEqual(result, {
      count: 6,
      capped: true
    });

    assert.equal(pagesRead, 3);
  }
);

test(
  "does not mark an exact complete result as capped",
  async () => {
    const result =
      await countPaginatedItems(
        createPages([
          {
            data: [1, 2, 3]
          }
        ]),
        3
      );

    assert.deepEqual(result, {
      count: 3,
      capped: false
    });
  }
);

test(
  "collects items up to the limit",
  async () => {
    let pagesRead = 0;

    const result =
      await collectPaginatedItems(
        createPages(
          [
            {
              data: [1, 2, 3]
            },
            {
              data: [4, 5, 6],
              headers: {
                link: '<next>; rel="next"'
              }
            },
            {
              data: [7, 8]
            }
          ],
          () => {
            pagesRead += 1;
          }
        ),
        5
      );

    assert.deepEqual(result, {
      items: [1, 2, 3, 4, 5],
      capped: true
    });

    assert.equal(pagesRead, 2);
  }
);
