// Optional offset paging for list endpoints. Paging is used only when the client sends ?limit=,
// so older app versions that call without it keep getting the full list exactly as before.

const DEFAULT_LIMIT = 20;

/**
 * Reads ?limit= and ?offset=. Returns null when the client did not ask for paging.
 * @param {object} query  req.query
 * @param {{ max?: number }} [options]  largest page the endpoint allows
 */
const readOffsetPage = (query, { max = 50 } = {}) => {
  if (query.limit === undefined) return null;
  const limit = Math.min(max, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const offset = Math.max(0, parseInt(query.offset, 10) || 0);
  return { limit, offset };
};

/** Rows were read with limit + 1: the extra row only tells whether more exist. */
const toPage = (rows, limit) => ({ hasMore: rows.length > limit, rows: rows.slice(0, limit) });

module.exports = { readOffsetPage, toPage };
