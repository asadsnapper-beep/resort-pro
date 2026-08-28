/**
 * Operational counters for global search — Phase D of plan/global-search.md.
 *
 * The plan asks for open rate, successful-selection rate, no-result rate, time
 * to first result and API p95. Latency and p95 already come free: every request
 * goes through the metrics ring buffer in utils/metrics.ts, so /api/search is
 * already measured there. What that cannot tell you is whether search actually
 * *worked* — a fast query returning nothing looks identical to a fast query
 * that found the booking.
 *
 * So this records the three things only the search itself knows: how many
 * queries ran, how many came back empty, and how many led to someone opening a
 * result. In memory and lossy on restart, matching utils/metrics.ts — this is a
 * pilot signal, not an analytics product, and it deliberately stores no query
 * text. A guest's name typed into a search box is personal data, and keeping it
 * to compute a percentage is not a trade worth making.
 */

interface Counters {
  queries: number;
  empty: number;
  selections: number;
  /** Per result type, so a category nobody ever opens is visible. */
  selectionsByType: Record<string, number>;
  totalResults: number;
  startedAt: number;
}

const counters: Counters = {
  queries: 0,
  empty: 0,
  selections: 0,
  selectionsByType: {},
  totalResults: 0,
  startedAt: Date.now(),
};

export const searchMetrics = {
  /** One executed query. `resultCount` of 0 is what makes the no-result rate. */
  recordQuery(resultCount: number) {
    counters.queries++;
    counters.totalResults += resultCount;
    if (resultCount === 0) counters.empty++;
  },

  /** Someone opened a result — the signal that the search did its job. */
  recordSelection(type: string) {
    counters.selections++;
    counters.selectionsByType[type] = (counters.selectionsByType[type] ?? 0) + 1;
  },

  snapshot() {
    const { queries, empty, selections, totalResults, selectionsByType, startedAt } = counters;
    const pct = (n: number) => (queries === 0 ? 0 : Math.round((n / queries) * 1000) / 10);
    return {
      queries,
      selections,
      /** Of the queries that ran, how many returned nothing. */
      noResultRatePct: pct(empty),
      /** Of the queries that ran, how many ended in someone opening a result. */
      selectionRatePct: pct(selections),
      avgResultsPerQuery: queries === 0 ? 0 : Math.round((totalResults / queries) * 10) / 10,
      selectionsByType,
      sinceMs: Date.now() - startedAt,
    };
  },

  /** Tests only — the counters are process-wide. */
  reset() {
    counters.queries = 0;
    counters.empty = 0;
    counters.selections = 0;
    counters.selectionsByType = {};
    counters.totalResults = 0;
    counters.startedAt = Date.now();
  },
};
