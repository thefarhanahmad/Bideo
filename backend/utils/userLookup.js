const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Index-friendly replacement for `User.findOne({ $or: [...] })` lookups whose
 * $or includes regex conditions (which forced a full scan of every user).
 *
 * Each branch runs on its own index (key-only scan, no document reads), then the
 * matching user that a full collection scan would have returned first — the one
 * with the lowest $recordId — is fetched. So the user returned is the same as
 * before, even when several accounts match.
 *
 * @param {Array<{ filter: object, hint: object }>} branches
 * @param {string} [select] optional Mongoose select string (e.g. '+password')
 * @returns {Promise<import('mongoose').Document|null>}
 */
const isMissingIndexError = (err) =>
  err && (err.code === 2 || /hint/i.test(err.message || '')) && /index/i.test(err.message || '');

const findIdsForBranch = async ({ filter, hint }) => {
  try {
    return await User.find(filter).hint(hint).select('_id').lean();
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    console.error(`[userLookup] index ${JSON.stringify(hint)} missing, falling back to unhinted query`);
    return User.find(filter).select('_id').lean();
  }
};

const compareRecordIds = (a, b) => {
  const x = BigInt(a.$recordId.toString());
  const y = BigInt(b.$recordId.toString());
  if (x === y) return 0;
  return x < y ? -1 : 1;
};

const findFirstUser = async (branches, select) => {
  const results = await Promise.all(branches.map(findIdsForBranch));
  const uniqueIds = [...new Set(results.flat().map((u) => u._id.toString()))];
  if (uniqueIds.length === 0) return null;

  let chosenId = uniqueIds[0];
  if (uniqueIds.length > 1) {
    const rows = await User.collection
      .find(
        { _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { projection: { _id: 1 }, showRecordId: true },
      )
      .toArray();
    if (rows.length === 0) return null;
    chosenId = [...rows].sort(compareRecordIds)[0]._id;
  }

  const query = User.findById(chosenId);
  return select ? query.select(select) : query;
};

/**
 * Turns `$or` conditions that each test one field ({ phone: ... }, { name: ... })
 * into branches hinted on that field's single-field index.
 */
const branchesFromOr = (conditions) =>
  conditions.map((condition) => {
    const fields = Object.keys(condition);
    if (fields.length !== 1) {
      throw new Error(`[userLookup] expected single-field condition, got: ${fields.join(',')}`);
    }
    return { filter: condition, hint: { [fields[0]]: 1 } };
  });

const findFirstUserByOr = (conditions, select) => findFirstUser(branchesFromOr(conditions), select);

module.exports = { findFirstUser, findFirstUserByOr };
