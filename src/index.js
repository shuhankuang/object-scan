const uniq = require("lodash.uniq");
const parser = require("./util/parser");

const escape = input => String(input).replace(/[,.*[\]{}]/g, "\\$&");

const compare = (wildcard, input, arr, ctx) => {
  if (arr && !wildcard.match(/^\[.*]$/)) {
    return false;
  }
  if (ctx.regexCache[wildcard] === undefined) {
    ctx.regexCache[wildcard] = new RegExp(`^${wildcard
      .split(/(?<!\\)(?:\\\\)*\*/)
      .map(p => p.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&'))
      .join(".*")}$`);
  }
  return input.match(ctx.regexCache[wildcard]);
};

const matches = (wildcard, input, arr, ctx) => (Array.isArray(wildcard)
  ? wildcard.some(wc => matches(wc, input, arr, ctx))
  : (wildcard === (arr ? "[*]" : "*") || compare(wildcard, input, arr, ctx)));

const pathToString = (input, ctx) => input.reduce((p, c) => {
  const isNumber = typeof c === "number";
  // eslint-disable-next-line no-nested-ternary
  return `${p}${p === "" || isNumber ? "" : "."}${isNumber ? `[${c}]` : (ctx.escapePaths ? escape(c) : c)}`;
}, "");

const find = (haystack, checks, pathIn, ctx) => {
  const result = [];
  if (checks.some(check => check.length === 0)) {
    if (ctx.filterFn === undefined || ctx.filterFn(pathToString(pathIn, ctx), haystack) !== false) {
      if (ctx.callbackFn !== undefined) {
        ctx.callbackFn(pathToString(pathIn, ctx), haystack);
      }
      result.push(ctx.joined ? pathToString(pathIn, ctx) : pathIn);
    }
  }
  if (ctx.breakFn === undefined || ctx.breakFn(pathToString(pathIn, ctx), haystack) !== true) {
    if (haystack instanceof Object) {
      if (Array.isArray(haystack)) {
        for (let i = 0; i < haystack.length; i += 1) {
          const pathOut = pathIn.concat(i);
          checks
            .filter(check => check.length !== 0)
            .forEach((check) => {
              if (ctx.useArraySelector === false) {
                result.push(...find(haystack[i], [check], pathOut, ctx));
              } else if (check[0] === "**") {
                result.push(...find(haystack[i], [check, check.slice(1)], pathOut, ctx));
              } else if (matches(check[0], `[${i}]`, true, ctx)) {
                result.push(...find(haystack[i], [check.slice(1)], pathOut, ctx));
              }
            });
        }
      } else {
        Object.entries(haystack).forEach(([key, value]) => {
          const escapedKey = escape(key);
          const pathOut = pathIn.concat(key);
          checks
            .filter(check => check.length !== 0)
            .forEach((check) => {
              if (check[0] === "**") {
                result.push(...find(value, [check, check.slice(1)], pathOut, ctx));
              } else if (matches(check[0], escapedKey, false, ctx)) {
                result.push(...find(value, [check.slice(1)], pathOut, ctx));
              }
            });
        });
      }
    }
  }
  return result;
};

module.exports = (needles, {
  filterFn = undefined,
  breakFn = undefined,
  callbackFn = undefined,
  joined = true,
  escapePaths = true,
  useArraySelector = true
} = {}) => {
  const search = uniq(needles).map(parser);
  const regexCache = {};

  return haystack => uniq(find(haystack, search, [], {
    filterFn, breakFn, callbackFn, joined, regexCache, escapePaths, useArraySelector
  }));
};
