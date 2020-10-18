/* compile needles to hierarchical map object */
const parser = require('./parser');
const iterator = require('./iterator');
const traverser = require('./traverser');
const { defineProperty, parseWildcard } = require('./helper');

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

const LEAF_NEEDLES = Symbol('leaf-needles');
const addLeafNeedle = (input, needle) => {
  if (input[LEAF_NEEDLES] === undefined) {
    defineProperty(input, LEAF_NEEDLES, []);
  }
  if (!input[LEAF_NEEDLES].includes(needle)) {
    input[LEAF_NEEDLES].push(needle);
  }
};
const getLeafNeedles = (input) => input[LEAF_NEEDLES] || [];
module.exports.getLeafNeedles = getLeafNeedles;

const LEAF_NEEDLES_EXCLUDE = Symbol('leaf-needles-exclude');
const addLeafNeedleExclude = (input, needle) => {
  if (input[LEAF_NEEDLES_EXCLUDE] === undefined) {
    defineProperty(input, LEAF_NEEDLES_EXCLUDE, []);
  }
  if (!input[LEAF_NEEDLES_EXCLUDE].includes(needle)) {
    input[LEAF_NEEDLES_EXCLUDE].push(needle);
  }
};
const getLeafNeedlesExclude = (input) => input[LEAF_NEEDLES_EXCLUDE] || [];
module.exports.getLeafNeedlesExclude = getLeafNeedlesExclude;

const LEAF_NEEDLES_MATCH = Symbol('leaf-needles-match');
const addLeafNeedleMatch = (input, needle) => {
  if (input[LEAF_NEEDLES_MATCH] === undefined) {
    defineProperty(input, LEAF_NEEDLES_MATCH, []);
  }
  if (!input[LEAF_NEEDLES_MATCH].includes(needle)) {
    input[LEAF_NEEDLES_MATCH].push(needle);
  }
};
const getLeafNeedlesMatch = (input) => input[LEAF_NEEDLES_MATCH] || [];
module.exports.getLeafNeedlesMatch = getLeafNeedlesMatch;

const NEEDLES = Symbol('needles');
const addNeedle = (input, needle) => {
  if (input[NEEDLES] === undefined) {
    defineProperty(input, NEEDLES, []);
  }
  if (!input[NEEDLES].includes(needle)) {
    input[NEEDLES].push(needle);
  }
};
const getNeedles = (input) => input[NEEDLES];
module.exports.getNeedles = getNeedles;

const INDEX = Symbol('index');
const setIndex = (input, index, readonly) => defineProperty(input, INDEX, index, readonly);
const getIndex = (input) => (input[INDEX] === undefined ? null : input[INDEX]);
module.exports.getIndex = getIndex;

const WILDCARD_REGEX = Symbol('wildcard-regex');
const setWildcardRegex = (input, wildcard) => defineProperty(input, WILDCARD_REGEX, parseWildcard(wildcard));
const getWildcardRegex = (input) => input[WILDCARD_REGEX];
module.exports.getWildcardRegex = getWildcardRegex;

const RECURSIVE = Symbol('recursive');
const markRecursive = (input) => defineProperty(input, RECURSIVE, true);
const isRecursive = (input) => input[RECURSIVE] === true;
module.exports.isRecursive = isRecursive;

const ENTRIES = Symbol('entries');
const setEntries = (input, entries) => defineProperty(input, ENTRIES, entries);
const getEntries = (input) => input[ENTRIES];
module.exports.getEntries = getEntries;

module.exports.excludedBy = (searches) => Array
  .from(new Set([].concat(...searches.map((e) => getLeafNeedlesExclude(e)))));
module.exports.matchedBy = (searches) => Array
  .from(new Set([].concat(...searches.map((e) => getLeafNeedlesMatch(e)))));
module.exports.traversedBy = (searches) => Array
  .from(new Set([].concat(...searches.map((e) => getNeedles(e)))));

module.exports.isLastLeafMatch = (searches) => {
  let maxLeafIndex = Number.MIN_SAFE_INTEGER;
  let maxLeaf = null;
  searches.forEach((s) => {
    const index = getIndex(s);
    if (index !== null && index > maxLeafIndex) {
      maxLeafIndex = index;
      maxLeaf = s;
    }
  });
  return maxLeaf !== null && isMatch(maxLeaf);
};

const iterate = (tower, needle, { onAdd, onFin }) => {
  const tree = [parser.parse(needle)];
  const stack = [[tower]];
  let excluded = false;

  iterator.iterate(tree, (type, p) => {
    if (type === 'RM') {
      if (p.isExcluded()) {
        excluded = false;
      }
      stack.pop();
    } else if (type === 'ADD') {
      if (p.isExcluded()) {
        if (excluded) {
          throw new Error(`Redundant Exclusion: "${needle}"`);
        }
        excluded = true;
      }
      const toAdd = [];
      const next = (e) => toAdd.push(e);
      stack[stack.length - 1]
        .forEach((cur) => onAdd(cur, p, next));
      stack.push(toAdd);
    } else {
      stack[stack.length - 1]
        .filter((cur) => cur !== tower)
        .forEach((cur) => onFin(cur, excluded));
    }
  });
};

const applyNeedle = (tower, needle, strict, ctx) => {
  iterate(tower, needle, {
    onAdd: (cur, p, next) => {
      addNeedle(cur, needle);
      const isRec = String(p) === '**';
      if (cur[p] === undefined) {
        const child = {};
        // eslint-disable-next-line no-param-reassign
        cur[p] = child;
        if (isRec) {
          markRecursive(child);
        }
        setWildcardRegex(child, p);
      }
      next(cur[p]);
      if (isRec) {
        next(cur);
      }
    },
    onFin: (cur, excluded) => {
      addNeedle(cur, needle);
      if (strict && cur[LEAF_NEEDLES] !== undefined) {
        throw new Error(`Redundant Needle Target: "${cur[LEAF_NEEDLES].values().next().value}" vs "${needle}"`);
      }
      addLeafNeedle(cur, needle, strict);
      if (excluded) {
        addLeafNeedleExclude(cur, needle);
      } else {
        addLeafNeedleMatch(cur, needle);
      }
      markLeaf(cur, !excluded, strict);
      setIndex(cur, ctx.index, strict);
      ctx.index += 1;
    }
  });
};

const finalizeTower = (tower) => {
  const matches = [];
  let lastDepth = -1;

  traverser.traverse(tower, (type, obj, depth) => {
    if (type === 'ENTER') {
      if (lastDepth < depth) {
        matches.splice(depth);
      }
    } else {
      if ((lastDepth === depth + 1 && matches[lastDepth] === true) || isMatch(obj)) {
        matches[depth] = true;
        setHasMatches(obj);
      }
      setEntries(obj, Object.entries(obj).filter(([k]) => k !== ''));
    }
    lastDepth = depth;
  });
};

module.exports.compile = (needles, strict = true) => {
  const tower = {};
  const ctx = { index: 0 };
  for (let idx = 0; idx < needles.length; idx += 1) {
    const needle = needles[idx];
    applyNeedle(tower, needle, strict, ctx);
  }
  finalizeTower(tower);
  return tower;
};
