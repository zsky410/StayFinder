import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureArrayOfStrings,
  formatDistance,
  parseBoolean,
  parseStringList,
} from "../src/utils.js";

test("parseStringList handles csv strings and trims duplicates", () => {
  assert.deepEqual(parseStringList(" hotel,homestay,hotel , ,villa "), [
    "hotel",
    "homestay",
    "villa",
  ]);
});

test("parseBoolean supports common string values", () => {
  assert.equal(parseBoolean("true", false), true);
  assert.equal(parseBoolean("0", true), false);
  assert.equal(parseBoolean(undefined, true), true);
});

test("formatDistance returns meters and kilometers", () => {
  assert.equal(formatDistance(320), "320 m");
  assert.equal(formatDistance(1250), "1.3 km");
});

test("ensureArrayOfStrings normalizes values and rejects invalid input", () => {
  assert.deepEqual(ensureArrayOfStrings([" wifi ", "pool", "wifi"], "amenities"), [
    "wifi",
    "pool",
  ]);
  assert.throws(
    () => ensureArrayOfStrings("wifi", "amenities"),
    /must be an array of strings/i,
  );
});
