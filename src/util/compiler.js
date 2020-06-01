/* compile needles to hierarchical map object */
const parser = require('./parser');
const { defineProperty, findLast, parseWildcard } = require('./helper');

const LEAF = Symbol('leaf');
const markLeaf = (input, match, readonly) => defineProperty(input, LEAF, match, readonly);
const isLeaf = (input) => input[LEAF] !== undefined;
const isMatch = (input) => input !== undefined && input[LEAF] === true;
module.exports.isLeaf = isLeaf;
module.exports.isMatch = isMatch;

const HAS_MATCHES = Symbol('has-matches');
const setHasMatches = (input) => defineProperty(input, HAS_MATCHES, true);
const hasMatches = (input) => input[HAS_MATCHES] === true;
module.exports.hasMatches = hasMatches;

const NEEDLE = Symbol('needle');
const setNeedle = (input, needle, readonly) => defineProperty(input, NEEDLE, needle, readonly);
const getNeedle = (input) => (input[NEEDLE] === undefined ? null : input[NEEDLE]);
module.exports.getNeedle = getNeedle;

const NEEDLES = Symbol('needles');
const addNeedle = (input, needle) => {
  if (input[NEEDLES] === undefined) {
    defineProperty(input, NEEDLES, new Set());
  }
  input[NEEDLES].add(needle);
};
const getNeedles = (input) => [...input[NEEDLES]];
module.exports.getNeedles = getNeedles;

const WILDCARD_REGEX = Symbol('wildcard-regex');
const setWildcardRegex = (input, wildcard) => defineProperty(input, WILDCARD_REGEX, parseWildcard(wildcard));
const getWildcardRegex = (input) => input[WILDCARD_REGEX];
module.exports.getWildcardRegex = getWildcardRegex;

const RECURSIVE = Symbol('recursive');
const markRecursive = (input) => defineProperty(input, RECURSIVE, true);
const isRecursive = (input) => input[RECURSIVE] === true;
module.exports.isRecursive = isRecursive;

const RECURSION_POS = Symbol('recursion-pos');
const setRecursionPos = (input, pos, readonly) => defineProperty(input, RECURSION_POS, pos, readonly);
const getRecursionPos = (input) => input[RECURSION_POS] || 0;
module.exports.getRecursionPos = getRecursionPos;

const ENTRIES = Symbol('entries');
const setEntries = (input, entries) => defineProperty(input, ENTRIES, entries);
const getEntries = (input) => input[ENTRIES];
module.exports.getEntries = getEntries;

const extractNeedles = (searches) => Array.from(new Set(searches.map((e) => getNeedle(e)).filter((e) => e !== null)));
module.exports.isLastLeafMatch = (searches) => isMatch(findLast(searches, (s) => isLeaf(s)));
module.exports.matchedBy = (searches) => extractNeedles(searches.filter((e) => isMatch(e)));
module.exports.excludedBy = (searches) => extractNeedles(searches.filter((e) => !isMatch(e)));
module.exports.traversedBy = (searches) => Array.from(new Set([].concat(...searches.map((e) => getNeedles(e)))));

const buildRecursive = (tower, path, ctx, excluded, root = false) => {
  addNeedle(tower, ctx.needle);
  if (path.length === 0) {
    if (tower[NEEDLE] !== undefined && ctx.strict) {
      throw new Error(`Redundant Needle Target: "${tower[NEEDLE]}" vs "${ctx.needle}"`);
    }
    setNeedle(tower, ctx.needle, ctx.strict);
    markLeaf(tower, !excluded, ctx.strict);
    if (isRecursive(tower)) {
      setRecursionPos(tower, Object.keys(tower).length, ctx.strict);
    }
    return;
  }
  if (Array.isArray(path[0])) {
    buildRecursive(tower, [...path[0], ...path.slice(1)], ctx, excluded);
    return;
  }
  if (path[0] instanceof Set) {
    path[0].forEach((c) => buildRecursive(tower, [c, ...path.slice(1)], ctx, excluded));
    return;
  }
  if (tower[path[0]] === undefined) {
    Object.assign(tower, { [path[0]]: {} });
    if (String(path[0]) === '**') {
      markRecursive(tower[path[0]]);
    }
    setWildcardRegex(tower[path[0]], path[0]);
  }
  if (excluded && path[0].isExcluded()) {
    throw new Error(`Redundant Exclusion: "${ctx.needle}"`);
  }
  if (root === false && String(path[0]) === '**') {
    buildRecursive(tower, path.slice(1), ctx, excluded || path[0].isExcluded());
  }
  buildRecursive(tower[path[0]], path.slice(1), ctx, excluded || path[0].isExcluded());
};

const finalizeRecursive = (tower) => {
  const towerValues = Object.values(tower);
  towerValues.forEach((v) => finalizeRecursive(v));
  if (isMatch(tower) || towerValues.some((v) => hasMatches(v))) {
    setHasMatches(tower);
  }
  setEntries(tower, Object.entries(tower).filter(([k]) => k !== ''));
};

const iterate = (tree, cb) => {
  const stack = [tree];
  const parent = [-1];
  const count = [];
  const depth = [];
  const path = [];
  let idx = 0;
  let inc = true;

  while (idx >= 0) {
    const e = stack[idx];
    if (e instanceof Set) {
      stack[idx] = [...e];
      stack[idx].or = true;
    } else if (Array.isArray(e)) {
      if (e.or !== true) {
        stack.splice(idx, 1, ...e);
        parent.splice(idx, 1, ...new Array(e.length).fill(parent[idx]));
        depth[parent[idx]] += e.length - 1;
      } else {
        if (count[idx] === undefined) {
          count[idx] = 0;
          depth[idx] = 0;
        } else if (depth[idx] !== 0) {
          stack.splice(idx + 1, depth[idx]);
          parent.splice(idx + 1, depth[idx]);
          depth[idx] = 0;
        }

        if (count[idx] < e.length) {
          stack.splice(idx + 1, 0, e[count[idx]]);
          parent.splice(idx + 1, 0, idx);
          count[idx] = (count[idx] || 0) + 1;
          depth[idx] += 1;
          inc = true;
          idx += 1;
        } else {
          count[idx] = 0;
          inc = false;
          idx -= 1;
        }
      }
    } else if (inc === true) {
      path.push(e);
      cb('ADD', e);
      if (idx === stack.length - 1) {
        cb('FIN', path);
        inc = false;
      } else {
        idx += 1;
      }
    } else {
      cb('RM', path.pop());
      idx -= 1;
    }
  }
};
module.exports.iterate = iterate;

module.exports.compile = (needles, strict = true) => {
  const tower = {};
  for (let idx = 0; idx < needles.length; idx += 1) {
    const needle = needles[idx];
    const tree = parser(needle);
    buildRecursive(tower, [tree], { needle, strict }, false, true);
  }
  finalizeRecursive(tower);
  return tower;
};
