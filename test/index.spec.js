const expect = require('chai').expect;
const objectScan = require("./../src/index");

const haystack = {
  simple: "a",
  parent1: {
    child: "b"
  },
  parent2: {
    child: "c"
  },
  grandparent1: {
    parent: {
      child: "d"
    }
  },
  array1: ["a", "b", "c"],
  array2: {
    nested: ["a", "b", "c"]
  },
  array3: [{
    item: "e"
  }, {
    item: "f"
  }],
  array4: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
};

describe("Testing Find", () => {
  it("Testing Top Level Exact", () => {
    const find = objectScan(["simple"]);
    expect(find(haystack)).to.deep.equal([
      "simple"
    ]);
  });

  it("Testing Path Exact", () => {
    const find = objectScan(["parent1.child"]);
    expect(find(haystack)).to.deep.equal([
      "parent1.child"
    ]);
  });

  it("Testing Key Wildcard", () => {
    const find = objectScan(["pa*nt*"]);
    expect(find(haystack)).to.deep.equal([
      "parent1",
      "parent2"
    ]);
  });

  it("Testing Array Wildcard", () => {
    const find = objectScan(["**[1*]"]);
    expect(find(haystack)).to.deep.equal([
      "array1[1]",
      "array2.nested[1]",
      "array3[1]",
      "array4[1]",
      "array4[10]",
      "array4[11]",
      "array4[12]"
    ]);
  });

  it("Testing Results Unique", () => {
    const find = objectScan(["array*.**[1*]", "array*.*[1*]"]);
    expect(find(haystack)).to.deep.equal([
      "array2.nested[1]"
    ]);
  });

  it("Testing Path Star", () => {
    const find = objectScan(["*.child"]);
    expect(find(haystack)).to.deep.equal([
      "parent1.child",
      "parent2.child"
    ]);
  });

  it("Testing Path Multi Matching", () => {
    const find = objectScan(["*.child", "*.parent"]);
    expect(find(haystack)).to.deep.equal([
      "parent1.child",
      "parent2.child",
      "grandparent1.parent"
    ]);
  });

  it("Testing Path Or Matching", () => {
    const find = objectScan(["*.{child,parent}"]);
    expect(find(haystack)).to.deep.equal([
      "parent1.child",
      "parent2.child",
      "grandparent1.parent"
    ]);
  });

  it("Testing Path Double Star", () => {
    const find = objectScan(["**.child"]);
    expect(find(haystack)).to.deep.equal([
      "parent1.child",
      "parent2.child",
      "grandparent1.parent.child"
    ]);
  });

  it("Testing Path Double Star (Separated)", () => {
    const find = objectScan(["**.child"], { joined: false });
    expect(find(haystack)).to.deep.equal([
      ["parent1", "child"],
      ["parent2", "child"],
      ["grandparent1", "parent", "child"]
    ]);
  });

  it("Testing Array Top Level", () => {
    const find = objectScan(["[*]"]);
    expect(find(haystack.array1)).to.deep.equal([
      "[0]",
      "[1]",
      "[2]"
    ]);
  });

  it("Testing Array Top Level Or", () => {
    const find = objectScan(["[{0,1}]"]);
    expect(find(haystack.array1)).to.deep.equal([
      "[0]",
      "[1]"
    ]);
  });

  it("Testing Array Star", () => {
    const find = objectScan(["array1[*]"]);
    expect(find(haystack)).to.deep.equal([
      "array1[0]",
      "array1[1]",
      "array1[2]"
    ]);
  });

  it("Testing Array Exact", () => {
    const find = objectScan(["array1[1]"]);
    expect(find(haystack)).to.deep.equal([
      "array1[1]"
    ]);
  });

  it("Testing Array Nested Star", () => {
    const find = objectScan(["array2.nested[*]"]);
    expect(find(haystack)).to.deep.equal([
      "array2.nested[0]",
      "array2.nested[1]",
      "array2.nested[2]"
    ]);
  });

  it("Testing Object Array", () => {
    const find = objectScan(["array3[*].item"]);
    expect(find(haystack)).to.deep.equal([
      "array3[0].item",
      "array3[1].item"
    ]);
  });

  it("Testing Filter Function", () => {
    const find = objectScan(["**"], {
      filterFn: (key, value) => typeof value === "string" && value === "a"
    });
    expect(find(haystack)).to.deep.equal([
      "simple",
      "array1[0]",
      "array2.nested[0]"
    ]);
  });

  it("Testing Escaped Char Matching", () => {
    [',', '.', '*', '[', ']', '{', '}'].forEach((char) => {
      const find = objectScan([`\\${char}`]);
      expect(find({ [char]: "a", b: "c" })).to.deep.equal([char]);
    });
  });

  it("Testing Escaped Star", () => {
    const find = objectScan([`a.\\[\\*\\]`]);
    expect(find({ a: { "[*]": "b", "[x]": "c" } })).to.deep.equal([
      "a.[*]"
    ]);
  });

  it("Testing Escaped Comma", () => {
    const find = objectScan([`{a\\,b,c\\,d,f\\\\\\,g}`]);
    expect(find({ "a,b": "c", "c,d": "e", "f\\\\,g": "h" })).to.deep.equal([
      "a,b",
      "c,d",
      "f\\\\,g"
    ]);
  });

  it("Testing Escaped Dot", () => {
    const find = objectScan([`{a\\.b,c\\.d,f\\\\\\.g}`]);
    expect(find({ "a.b": "c", "c.d": "e", "f\\\\.g": "h" })).to.deep.equal([
      "a.b",
      "c.d",
      "f\\\\.g"
    ]);
  });

  it("Testing Misc Tests", () => {
    const input = {
      a: {
        b: {
          c: 'd',
          e: 'f',
          g: 'h',
          i: { j: 'k' },
          l: { g: 'k' }
        },
        i: 'j'
      }
    };
    expect(objectScan(["a.**"])(input)).to.deep.equal([
      'a.b',
      'a.b.c',
      'a.b.e',
      'a.b.g',
      'a.b.i',
      'a.b.i.j',
      'a.b.l',
      'a.b.l.g',
      'a.i'
    ]);
    expect(objectScan(["a.*"])(input)).to.deep.equal(['a.b', 'a.i']);
    expect(objectScan(["a.b.c"])(input)).to.deep.equal(['a.b.c']);
    expect(objectScan(["**.{b,i}"])(input)).to.deep.equal(['a.b.i', 'a.b', "a.i"]);
    expect(objectScan(["*.{b,i}"])(input)).to.deep.equal(['a.b', "a.i"]);
    expect(objectScan(["a.*.{c,e}"])(input)).to.deep.equal(['a.b.c', "a.b.e"]);
    expect(objectScan(["a.*.g"])(input)).to.deep.equal(['a.b.g']);
    expect(objectScan(["a.**.g"])(input)).to.deep.equal(['a.b.g', 'a.b.l.g']);
    expect(objectScan(["*"])(input)).to.deep.equal(['a']);
    expect(objectScan(["a"])(input)).to.deep.equal(['a']);
    expect(objectScan(["c"])(input)).to.deep.equal([]);
    expect(objectScan(["**"])(input)).to.deep.equal([
      "a",
      'a.b',
      'a.b.c',
      'a.b.e',
      'a.b.g',
      'a.b.i',
      'a.b.i.j',
      'a.b.l',
      'a.b.l.g',
      'a.i'
    ]);
    expect(objectScan([])({ a: 'a', b: 'b', c: 'c' })).to.deep.equal([]);
    expect(objectScan(["b*"])({ foo: 'a', bar: 'b', baz: 'c' })).to.deep.equal(["bar", "baz"]);
    expect(objectScan(["b"])({ foo: 'a', bar: 'b', baz: 'c' })).to.deep.equal([]);
    expect(objectScan(["b", "c"])({ a: 'a', b: 'b', c: 'c' })).to.deep.equal(["b", "c"]);
  });

  it("Testing Readme Example", () => {
    const input = { a: { b: { c: 'd' }, e: { f: 'g' }, h: ["i", "j"] }, k: "l" };
    expect(objectScan(["*"])(input)).to.deep.equal(["a", "k"]);
    expect(objectScan(["a.*.{c,f}"])(input)).to.deep.equal(["a.b.c", "a.e.f"]);
    expect(objectScan(["a.*.{c,f}"], { joined: false })(input)).to.deep.equal([["a", "b", "c"], ["a", "e", "f"]]);
    expect(objectScan(["a.*.f"])(input)).to.deep.equal(["a.e.f"]);
    expect(objectScan(["*.*.*"])(input)).to.deep.equal(["a.b.c", "a.e.f"]);
    expect(objectScan(["**"])(input)).to
      .deep.equal(["a", "a.b", "a.b.c", "a.e", "a.e.f", "a.h", "a.h[0]", "a.h[1]", "k"]);
    expect(objectScan(["**.f"])(input)).to.deep.equal(["a.e.f"]);
    expect(objectScan(["**"], { filterFn: (key, value) => typeof value === "string" })(input)).to
      .deep.equal(["a.b.c", "a.e.f", "a.h[0]", "a.h[1]", "k"]);
    expect(objectScan(["**"], { breakFn: key => key === "a.b" })(input)).to
      .deep.equal(["a", "a.b", "a.e", "a.e.f", "a.h", "a.h[0]", "a.h[1]", "k"]);
    expect(objectScan(["**[*]"])(input)).to.deep.equal(["a.h[0]", "a.h[1]"]);
    expect(objectScan(["*.*[*]"])(input)).to.deep.equal(["a.h[0]", "a.h[1]"]);
    expect(objectScan(["*[*]"])(input)).to.deep.equal([]);
  });
});
