import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseCollectionArgs } from "../src/domain/collection-args.js";

describe("parseCollectionArgs", () => {
  it("rejects a bare /collection with no username", () => {
    const r = parseCollectionArgs("/collection");
    assert.equal(r.ok, false);
  });

  it("accepts an @username", () => {
    const r = parseCollectionArgs("/collection @jvidalv");
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.username, "jvidalv");
  });

  it("accepts a bare username without @", () => {
    const r = parseCollectionArgs("/collection jvidalv");
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.username, "jvidalv");
  });

  it("handles the /collection@botname form", () => {
    const r = parseCollectionArgs("/collection@tractorbot @vidal");
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.username, "vidal");
  });

  it("rejects a handle with spaces or punctuation", () => {
    const r = parseCollectionArgs("/collection @no body");
    assert.equal(r.ok, false);
  });

  it("rejects an over-long handle", () => {
    const r = parseCollectionArgs(`/collection @${"x".repeat(40)}`);
    assert.equal(r.ok, false);
  });
});
