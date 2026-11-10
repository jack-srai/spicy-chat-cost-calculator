/* Pure calculation functions, shared by the browser and Node's test runner. */
(function (root) {
  "use strict";
  const bounds = {
    fee: [0, 1000000], included: [0, 1000000000],
    perMessage: [0.001, 1000000], bundle: [0.001, 1000000000],
    bundlePrice: [0, 1000000], daily: [0, 10000], days: [1, 31],
    budget: [0, 1000000],
  };
  function number(value, key, integer = false) {
    if (value === "" || value === null || value === undefined || typeof value === "boolean") {
      throw new Error("Complete all required number fields.");
    }
    const result = Number(value);
    const [min, max] = bounds[key];
    if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) {
      throw new Error("Use numbers within the displayed limits. Messages and days must be whole numbers.");
    }
    return result;
  }
  function calculate(plan, usage) {
    const messages = number(usage.daily, "daily", true) * number(usage.days, "days", true);
    const fee = number(plan.fee, "fee");
    if (!["metered", "unlimited"].includes(plan.mode)) throw new Error("Choose a plan type.");
    if (plan.mode === "unlimited") {
      return { messages, fee, topup: 0, total: fee, packs: 0, shortfall: 0,
        creditsNeeded: null, capacity: null, unused: null, possible: true,
        per100: messages > 0 ? fee / messages * 100 : null };
    }
    const included = number(plan.included, "included");
    const perMessage = number(plan.perMessage, "perMessage");
    const creditsNeeded = messages * perMessage;
    // Tolerate only floating-point representation noise, not actual credit deficits.
    const tolerance = Number.EPSILON * Math.max(1, creditsNeeded, included) * 8;
    const rawShortfall = creditsNeeded - included;
    const shortfall = rawShortfall > tolerance ? rawShortfall : 0;
    let packs = 0;
    let topup = 0;
    let bought = 0;
    let possible = true;
    if (shortfall > 0) {
      if (plan.topups) {
        const bundle = number(plan.bundle, "bundle");
        const bundlePrice = number(plan.bundlePrice, "bundlePrice");
        const quotient = shortfall / bundle;
        packs = Math.ceil(quotient - Number.EPSILON * Math.max(1, quotient) * 8);
        bought = packs * bundle;
        topup = packs * bundlePrice;
      } else possible = false;
    } else if (plan.topups) {
      // An incomplete bundle field is still an invalid plan, even below the quota.
      number(plan.bundle, "bundle");
      number(plan.bundlePrice, "bundlePrice");
    }
    const total = possible ? fee + topup : null;
    return { messages, fee, topup, total, packs, shortfall, creditsNeeded,
      capacity: Math.floor((included + bought + tolerance) / perMessage),
      unused: possible ? Math.max(0, included + bought - creditsNeeded) : 0,
      possible, per100: possible && messages > 0 ? total / messages * 100 : null };
  }
  function cheapest(results) {
    const totals = results.filter(r => r && r.possible && Number.isFinite(r.total)).map(r => r.total);
    return totals.length ? Math.min(...totals) : null;
  }
  // Prevent spreadsheet formulas, including formulas after leading whitespace.
  function csvCell(value) {
    let text = String(value ?? "");
    if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  const api = { number, calculate, cheapest, csvCell };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SpicyCalculator = api;
})(typeof window !== "undefined" ? window : globalThis);
