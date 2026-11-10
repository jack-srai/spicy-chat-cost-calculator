(function () {
  "use strict";
  const { calculate, cheapest, number, csvCell } = window.SpicyCalculator;
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const digits = value => new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  let nextId = 3;
  let plans = [
    { id: 1, name: "Credit plan (example)", mode: "metered", fee: "9", included: "1000", perMessage: "2", topups: true, bundle: "500", bundlePrice: "5" },
    { id: 2, name: "Unlimited plan (example)", mode: "unlimited", fee: "19", included: "0", perMessage: "1", topups: false, bundle: "500", bundlePrice: "5" },
  ];
  let latest = null;
  const letter = index => String.fromCharCode(65 + index);
  const field = (p, key, label, max, step = "0.01", min = "0") => `<div><label for="p${p.id}-${key}">${label}</label><input id="p${p.id}-${key}" data-field="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${escape(p[key])}" inputmode="decimal"></div>`;
  function renderPlans() {
    $("plans").innerHTML = plans.map((p, i) => `<section class="plan-card" data-id="${p.id}" aria-label="Plan ${letter(i)} settings">
      <div class="plan-heading"><span class="plan-label">PLAN ${letter(i)}</span>${plans.length > 2 ? `<button type="button" class="remove" data-remove="${p.id}" aria-label="Remove plan ${letter(i)}">Remove ×</button>` : ""}</div>
      <label for="p${p.id}-name">Plan name</label><input id="p${p.id}-name" data-field="name" maxlength="60" value="${escape(p.name)}" autocomplete="off">
      <label for="p${p.id}-mode">Message allowance</label><select id="p${p.id}-mode" data-field="mode"><option value="metered" ${p.mode === "metered" ? "selected" : ""}>Credits / message quota</option><option value="unlimited" ${p.mode === "unlimited" ? "selected" : ""}>Unlimited messages</option></select>
      <div class="field-grid">${field(p, "fee", "Subscription / month ($)", "1000000")}</div>
      <div data-metered ${p.mode === "unlimited" ? "hidden" : ""}>
        <div class="field-grid">${field(p, "included", "Monthly credits included", "1000000000", "0.001")}${field(p, "perMessage", "Credits per sent message", "1000000", "0.001", "0.001")}</div>
        <label class="check-row" for="p${p.id}-topups"><input id="p${p.id}-topups" data-field="topups" type="checkbox" ${p.topups ? "checked" : ""}>Extra credit packs are available</label>
        <div class="field-grid" data-topups ${!p.topups ? "hidden" : ""}>${field(p, "bundle", "Credits per extra pack", "1000000000", "0.001", "0.001")}${field(p, "bundlePrice", "Price per extra pack ($)", "1000000")}</div>
      </div>
      <p class="unlimited-note" data-unlimited ${p.mode !== "unlimited" ? "hidden" : ""}>A flat monthly price for messages. Check the provider’s fair-use policy and any model-specific charges.</p>
    </section>`).join("");
    $("add-plan").disabled = plans.length >= 4;
  }
  function readUsage() {
    return { daily: $("daily").value, days: $("days").value, budget: $("budget").value };
  }
  function renderResults() {
    const usage = readUsage();
    $("action-status").textContent = "";
    document.querySelectorAll("[data-daily]").forEach(button => {
      const active = button.dataset.daily === usage.daily;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    try {
      const messages = number(usage.daily, "daily", true) * number(usage.days, "days", true);
      number(usage.budget, "budget");
      $("monthly-count").textContent = digits(messages);
    } catch (error) {
      $("monthly-count").textContent = "—";
      $("usage-error").textContent = error.message;
      $("usage-error").hidden = false;
      $("results").replaceChildren();
      $("result-summary").textContent = "Complete your usage to compare.";
      latest = null;
      $("copy").disabled = $("csv").disabled = true;
      return;
    }
    $("usage-error").hidden = true;
    const results = plans.map(p => {
      try { return calculate(p, usage); } catch (error) { return { error: error.message }; }
    });
    const lowest = cheapest(results);
    const valid = results.every(result => !result.error);
    const winnerCount = results.filter(r => r.possible && r.total === lowest).length;
    $("results").innerHTML = results.map((r, i) => {
      const name = escape(plans[i].name.trim() || `Plan ${letter(i)}`);
      if (r.error) return `<article class="result-card"><span class="result-badge neutral">CHECK INPUTS</span><h3 class="result-name">${name}</h3><p class="error">${escape(r.error)}</p></article>`;
      if (!r.possible) return `<article class="result-card"><span class="result-badge neutral">QUOTA TOO SMALL</span><h3 class="result-name">${name}</h3><p class="blocked-total">Won’t cover your usage.</p><div class="cost-lines"><div>Subscription <b>${money(r.fee)}/mo</b></div><div>Message capacity <b>${digits(r.capacity)}</b></div><div>Messages needed <b>${digits(r.messages)}</b></div></div><p class="cost-detail">${digits(r.shortfall)} credits short; no extra packs available. Excluded from the cost comparison.</p></article>`;
      const winner = r.total === lowest;
      const over = r.total > Number(usage.budget);
      const baseWidth = r.total > 0 ? r.fee / r.total * 100 : 100;
      return `<article class="result-card ${winner ? "winner" : ""}"><span class="result-badge ${winner ? "" : "neutral"}">${winner ? (winnerCount > 1 ? "TIED LOWEST COST" : "LOWEST ESTIMATED COST") : "ESTIMATED TOTAL"}</span><h3 class="result-name">${name}</h3><div class="result-total"><strong>${money(r.total)}</strong><span>/ month</span></div><div class="cost-bar" aria-hidden="true"><span class="base" style="width:${baseWidth}%"></span><span class="topup" style="width:${100 - baseWidth}%"></span></div><div class="cost-lines"><div>Subscription <b>${money(r.fee)}</b></div><div>Extra packs ${r.packs ? `(${digits(r.packs)})` : ""}<b>${money(r.topup)}</b></div><div>Per 100 messages <b>${r.per100 === null ? "—" : money(r.per100)}</b></div></div><p class="budget-status ${over ? "over" : ""}">${over ? `${money(r.total - Number(usage.budget))} over` : `${money(Number(usage.budget) - r.total)} within`} your ${money(Number(usage.budget))} budget</p><p class="cost-detail">${r.unused === null ? "Assumes unlimited messages at no extra charge." : `${digits(r.creditsNeeded)} credits used · ${digits(r.unused)} left over this month`}</p></article>`;
    }).join("");
    $("result-summary").textContent = `${digits(Number(usage.daily) * Number(usage.days))} messages · ${usage.days} days · USD${!valid ? " · Fix incomplete plans to export" : ""}`;
    latest = valid ? { usage, results } : null;
    $("copy").disabled = $("csv").disabled = !latest;
  }
  function summary() {
    if (!latest) return "";
    const { usage, results } = latest;
    return ["Spicy Ranks — AI Chat Cost Comparison", `${usage.daily} messages/day × ${usage.days} days = ${digits(Number(usage.daily) * Number(usage.days))} messages/month`, `Budget: ${money(Number(usage.budget))} (USD)`, "", ...results.map((r, i) => `${plans[i].name.trim() || `Plan ${letter(i)}`}: ${r.possible ? `${money(r.total)}/month (${money(r.fee)} subscription + ${r.packs} extra packs at ${money(r.topup)} total)` : `insufficient quota (${digits(r.capacity)} messages)`}`), "", "Based on user-entered plan figures, not live prices. Whole packs rounded up. Excludes tax, rollover, daily resets and variable model/token charges. Cost is not a quality ranking.", "Calculator by https://spicyranks.ai/"].join("\n");
  }
  $("plans").addEventListener("input", event => {
    const input = event.target;
    if (!input.dataset.field) return;
    const plan = plans.find(p => p.id === Number(input.closest("[data-id]").dataset.id));
    plan[input.dataset.field] = input.type === "checkbox" ? input.checked : input.value;
    if (input.dataset.field === "mode" || input.dataset.field === "topups") {
      const card = input.closest("[data-id]");
      card.querySelector("[data-metered]").hidden = plan.mode === "unlimited";
      card.querySelector("[data-unlimited]").hidden = plan.mode !== "unlimited";
      card.querySelector("[data-topups]").hidden = !plan.topups;
    }
    renderResults();
  });
  $("plans").addEventListener("click", event => {
    const remove = event.target.closest("[data-remove]");
    if (!remove || plans.length <= 2) return;
    plans = plans.filter(p => p.id !== Number(remove.dataset.remove));
    renderPlans(); renderResults(); $("add-plan").focus();
  });
  $("add-plan").addEventListener("click", () => {
    if (plans.length >= 4) return;
    const id = nextId++;
    plans.push({ id, name: `Plan ${letter(plans.length)}`, mode: "metered", fee: "0", included: "100", perMessage: "1", topups: false, bundle: "500", bundlePrice: "5" });
    renderPlans(); renderResults(); $(`p${id}-name`).focus();
  });
  ["daily", "days", "budget"].forEach(id => $(id).addEventListener("input", renderResults));
  document.querySelectorAll("[data-daily]").forEach(button => button.addEventListener("click", () => { $("daily").value = button.dataset.daily; renderResults(); }));
  $("copy").addEventListener("click", async () => {
    if (!latest) return;
    const text = summary();
    let timer;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Clipboard unavailable")), 1500); }),
      ]);
      $("action-status").textContent = "Comparison copied. Paste it anywhere you like.";
    } catch {
      $("copy-text").value = text;
      $("copy-dialog").showModal();
      $("copy-text").focus(); $("copy-text").select();
    } finally {
      clearTimeout(timer);
    }
  });
  $("close-copy").addEventListener("click", () => $("copy-dialog").close());
  $("csv").addEventListener("click", () => {
    if (!latest) return;
    const { usage, results } = latest;
    const rows = [["Plan", "Currency", "Messages per day", "Days", "Monthly messages", "Monthly budget", "Plan type", "Subscription", "Included credits", "Credits per message", "Extra packs available", "Credits per pack", "Price per pack", "Can cover usage", "Packs needed", "Top-up cost", "Total monthly cost", "Cost per 100 messages", "Unused credits"]];
    results.forEach((r, i) => {
      const p = plans[i]; const metered = p.mode === "metered";
      rows.push([p.name.trim() || `Plan ${letter(i)}`, "USD", usage.daily, usage.days, r.messages, usage.budget, p.mode, r.fee, metered ? p.included : "", metered ? p.perMessage : "", metered ? (p.topups ? "yes" : "no") : "", metered && p.topups ? p.bundle : "", metered && p.topups ? p.bundlePrice : "", r.possible ? "yes" : "no", r.possible ? r.packs : "", r.possible ? r.topup.toFixed(2) : "", r.total === null ? "" : r.total.toFixed(2), r.per100 === null ? "" : r.per100.toFixed(4), r.unused === null ? "" : r.unused]);
    });
    rows.push([], ["Estimates from user-entered data. Whole extra packs rounded up. No tax, rollover, daily resets, or variable token costs."], ["Made by Spicy Ranks", "https://spicyranks.ai/"]);
    const blob = new Blob(["\uFEFF", rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "spicy-ranks-chat-costs.csv";
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("action-status").textContent = "CSV downloaded with your inputs and calculated results.";
  });
  renderPlans(); renderResults();
})();
