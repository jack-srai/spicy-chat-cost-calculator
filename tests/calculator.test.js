const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, cheapest, csvCell } = require("../calculator.js");
const usage = { daily: 50, days: 30 };
const plan = { mode: "metered", fee: 9, included: 1000, perMessage: 2, topups: true, bundle: 500, bundlePrice: 5 };

test("whole-pack top-ups change a $9 subscription to a $29 month", () => {
  const r = calculate(plan, usage);
  assert.equal(r.messages, 1500); assert.equal(r.creditsNeeded, 3000);
  assert.equal(r.packs, 4); assert.equal(r.total, 29); assert.equal(r.unused, 0);
});
test("rounds up partial packs and reports unused credits", () => {
  const r = calculate({ ...plan, included: 900 }, usage);
  assert.equal(r.packs, 5); assert.equal(r.total, 34); assert.equal(r.unused, 400);
});
test("unlimited plan ignores inactive quota fields", () => {
  const r = calculate({ mode: "unlimited", fee: 19 }, usage);
  assert.equal(r.total, 19); assert.equal(r.unused, null); assert.equal(r.packs, 0);
});
test("quota-limited plans are excluded from cheapest, not shown as cheap", () => {
  const r = calculate({ ...plan, topups: false }, usage);
  assert.equal(r.possible, false); assert.equal(r.total, null); assert.equal(r.capacity, 500);
  assert.equal(cheapest([r, calculate({ mode: "unlimited", fee: 19 }, usage)]), 19);
  assert.equal(cheapest([r]), null);
});
test("exact quota and zero usage do not buy a pack", () => {
  assert.equal(calculate({ ...plan, included: 3000 }, usage).packs, 0);
  const r = calculate(plan, { ...usage, daily: 0 });
  assert.equal(r.total, 9); assert.equal(r.per100, null);
});
test("free plans can be valid winners", () => {
  const r = calculate({ ...plan, fee: 0, included: 5000, topups: false }, usage);
  assert.equal(r.total, 0); assert.equal(cheapest([r]), 0);
});
test("decimal credit precision does not add a phantom pack", () => {
  assert.equal(calculate({ ...plan, included: 0, perMessage: 0.1, bundle: 0.3 }, { daily: 3, days: 1 }).packs, 1);
  assert.equal(calculate({ ...plan, included: 0.3, perMessage: 0.1 }, { daily: 3, days: 1 }).packs, 0);
  assert.equal(calculate({ ...plan, included: 0, perMessage: 0.10001, bundle: 0.3 }, { daily: 3, days: 1 }).packs, 2);
});
test("rejects incomplete, negative, non-finite and oversized input", () => {
  for (const bad of ["", null, undefined, -1, Infinity, NaN, 1000001]) assert.throws(() => calculate({ ...plan, fee: bad }, usage));
  assert.throws(() => calculate({ ...plan, perMessage: 0 }, usage));
  assert.throws(() => calculate({ ...plan, bundle: 0 }, usage));
  assert.throws(() => calculate(plan, { daily: 2.5, days: 30 }));
  assert.throws(() => calculate(plan, { daily: 50, days: 0 }));
  assert.throws(() => calculate(plan, { daily: 50, days: 32 }));
  assert.throws(() => calculate({ ...plan, mode: "unknown" }, usage));
});
test("missing pack price is rejected even when no top-up is needed", () => {
  assert.throws(() => calculate({ ...plan, included: 5000, bundlePrice: "" }, usage));
});
test("CSV escapes names and blocks spreadsheet formulas", () => {
  assert.equal(csvCell('My "Plan", one'), '"My ""Plan"", one"');
  for (const name of ["=1+1", "+SUM(A1)", " @evil", "-1+2", "\tcalc"]) assert.ok(csvCell(name).startsWith('"\''));
});
