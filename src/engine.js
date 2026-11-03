/* ---------- Engine: the rules the skill files describe ---------- */
const total = a => a.reduce((s, x) => s + x.value, 0);
const RESERVE = HH.monthlySpend * HH.reserveMonths;
const CASH = total(HH.cash), SET_ASIDE = total(HH.setAside);
const AVAIL = CASH - RESERVE - SET_ASIDE;
const TAXABLE = total(HH.lots), RESTRICTED = total(HH.restricted);
const CAPACITY = HH.lots.reduce((s, l) => s + l.value * l.advance, 0);
const GAIN = HH.lots.reduce((s, l) => s + l.value - l.basis, 0);
const LOSS_LOTS = HH.lots.filter(l => l.value < l.basis);

const trimNum = x => x.indexOf('.') > -1 ? x.replace(/\.?0+$/, '') : x;
function money(n) {
  const neg = n < 0; n = Math.abs(n); let s;
  if (n >= 999500) s = '$' + trimNum((n / 1e6).toFixed(2)) + 'M';
  else if (n >= 1e5) s = '$' + Math.round(n / 1e3) + 'K';
  else if (n >= 1e3) s = '$' + trimNum((n / 1e3).toFixed(1)) + 'K';
  else s = '$' + Math.round(n);
  return (neg ? '−' : '') + s;
}
const dollars = n => '$' + Math.round(n).toLocaleString('en-US');
const pct = (x, d = 1) => trimNum((x * 100).toFixed(d)) + '%';
const rate = x => (x * 100).toFixed(2) + '%';

function loanInfo(kind, amt, r, years) {
  const i = r / 12, m = amt * i / (1 - Math.pow(1 + i, -years * 12));
  let b = amt, interest = 0;
  for (let k = 0; k < 12; k++) { const x = b * i; interest += x; b -= m - x; }
  return {kind, amt, rate: r, years, monthly: m, annual: m * 12, interest};
}
function lineInfo(amt, months) {
  if (amt <= 0.5) return null;
  return {amt, months, rate: RATES.line, annual: amt * RATES.line, interest: amt * RATES.line * months / 12,
          util: amt / CAPACITY, drop: Math.max(0, 1 - amt / CAPACITY), feasible: amt <= CAPACITY};
}
const gainPct = l => (l.value - l.basis) / l.value;
const SALE_ORDER = HH.lots.slice().sort((a, b) => {
  const g = l => l.term === 'short' ? 2 : (l.value < l.basis ? 0 : 1);
  return g(a) - g(b) || gainPct(a) - gainPct(b);
});
function sellPlan(amount) {
  if (amount <= 0.5) return null;
  let left = amount, lt = 0, st = 0; const parts = [];
  for (const l of SALE_ORDER) {
    if (left <= 0.5) break;
    const a = Math.min(left, l.value), g = gainPct(l) * a;
    parts.push({lot: l, amt: a, gain: g});
    if (l.term === 'short') st += g; else lt += g;
    left -= a;
  }
  const net = lt + st; let tax = 0;
  if (lt >= 0 && st >= 0) tax = lt * RATES.ltcg + st * RATES.stcg;
  else if (net > 0) tax = net * (lt < 0 ? RATES.stcg : RATES.ltcg);
  return {amount, parts, gain: net, tax, carry: net < 0 ? -net : 0, feasible: left <= 0.5, short: Math.max(0, left)};
}

function opt(o) {
  o.tax = o.sale ? o.sale.tax : 0;
  o.interest = (o.loan ? o.loan.interest : 0) + (o.line ? o.line.interest : 0) + (o.irs ? o.irs.cost : 0);
  o.cost = o.tax + o.interest;
  o.newDebt = (o.loan ? o.loan.amt : 0) + (o.line ? o.line.amt : 0);
  o.debt = o.debt || 0;
  o.feasible = !(o.sale && !o.sale.feasible) && !(o.line && !o.line.feasible);
  o.blocker = o.sale && !o.sale.feasible ? `it needs ${money(o.sale.short)} more than the taxable account holds`
    : (o.line && !o.line.feasible ? `it needs ${money(o.line.amt - CAPACITY)} more than the borrowing capacity` : '');
  o.parts = (o.sale ? 1 : 0) + (o.loan ? 1 : 0) + (o.line ? 1 : 0) + (o.irs ? 1 : 0);
  return o;
}

/* One builder per playbook: the "Options to build" section of each SKILL.md */
const BUILD = {
  'buy-a-home'(P) {
    const due = P * (.2 + RATES.closing), cash = Math.min(AVAIL, due), gap = due - cash, carry = P * RATES.carry;
    const loan = loanInfo('Jumbo mortgage', P * .8, RATES.mortgage, 30), housing = (loan.annual + carry) / HH.income;
    const note = '20% down + 2.5% closing';
    const A = opt({key: 'A', name: 'Jumbo mortgage, 20% down', blurb: 'Closing money from cash, the rest from a tax-smart sale', cashUse: cash, sale: sellPlan(gap), loan, housing, debt: housing, due, dueNote: note, ready: '30–45 days'});
    A.headline = `Finance it with a jumbo mortgage. Cover the ${money(due)} due at closing with ${money(cash)} of cash${A.sale ? ` and a ${money(A.sale.amount)} tax-smart sale` : ''}.`;
    const line = lineInfo(gap, 12);
    const B = opt({key: 'B', name: 'Jumbo mortgage + pledged line', blurb: 'Borrow the down-payment gap against the portfolio and sell nothing', cashUse: cash, line, loan, housing, debt: (loan.annual + carry + (line ? line.annual : 0)) / HH.income, due, dueNote: note, ready: '30–45 days'});
    B.headline = line ? `Finance it with a jumbo mortgage and borrow ${money(line.amt)} of the ${money(due)} due at closing on a pledged line, so nothing is sold.` : A.headline;
    const all = P * (1 + RATES.closing), cashC = Math.min(AVAIL, all);
    const C = opt({key: 'C', name: 'All cash', blurb: 'Cash first, then a tax-smart sale for the rest', cashUse: cashC, sale: sellPlan(all - cashC), housing: carry / HH.income, debt: carry / HH.income, due: all, dueNote: 'price + 2.5% closing', ready: 'About a week'});
    C.headline = `Pay all cash: ${money(cashC)} from cash${C.sale ? ` and a ${money(C.sale.amount)} tax-smart sale` : ''}.`;
    return {opts: [A, B, C], dest: "closing attorney's escrow", period: 'year one'};
  },
  'buy-a-boat'(P) {
    const all = P * (1 + RATES.boatFees), cash = Math.min(AVAIL, all), note = 'price + about 6% tax and fees';
    const A = opt({key: 'A', name: 'Pledged line', blurb: 'Cash first, then borrow the rest against the portfolio', cashUse: cash, line: lineInfo(all - cash, 12), due: all, dueNote: note, ready: '3–5 days'});
    A.debt = A.line ? A.line.annual / HH.income : 0;
    A.headline = A.line ? `Put ${money(cash)} of cash toward the boat and borrow ${money(A.line.amt)} on a pledged line.` : `Pay the ${money(all)} from cash on hand.`;
    const down = P * (.2 + RATES.boatFees), cashB = Math.min(AVAIL, down), loan = loanInfo('Marine loan', P * .8, RATES.marine, 20);
    const B = opt({key: 'B', name: 'Marine loan, 20% down', blurb: 'Down payment and fees from cash; 20-year loan', cashUse: cashB, sale: sellPlan(down - cashB), loan, debt: loan.annual / HH.income, due: all, dueNote: note, ready: '2–3 weeks'});
    B.down = down;
    B.headline = `Take a ${money(loan.amt)} marine loan and pay the ${money(down)} down payment and fees from ${B.sale ? 'cash and a small tax-smart sale' : 'cash'}.`;
    const C = opt({key: 'C', name: 'Pay cash', blurb: 'Cash first, then a tax-smart sale', cashUse: cash, sale: sellPlan(all - cash), due: all, dueNote: note, ready: '2–3 days'});
    C.headline = `Pay cash: ${money(cash)} from cash${C.sale ? ` plus a ${money(C.sale.amount)} tax-smart sale` : ''}.`;
    return {opts: [A, B, C], dest: 'dealer escrow', period: 'year one'};
  },
  'raise-cash'(amt, M) {
    const cash = Math.min(AVAIL, amt), gap = amt - cash, note = 'amount needed';
    const A = opt({key: 'A', name: 'Cash + pledged line', blurb: `Cash first; bridge the rest for ${M} months`, cashUse: cash, line: lineInfo(gap, M), due: amt, dueNote: note, ready: '3–5 days'});
    A.debt = A.line ? A.line.annual / HH.income : 0;
    A.headline = A.line ? `Use ${money(cash)} of cash and bridge the other ${money(A.line.amt)} with a pledged line until the money comes back${M < 12 ? ` in about ${M} months` : ''}.` : `Cover the ${money(amt)} from cash on hand.`;
    const B = opt({key: 'B', name: 'Cash + tax-smart sale', blurb: 'Cash first; sell the rest', cashUse: cash, sale: sellPlan(gap), due: amt, dueNote: note, ready: '2–3 days'});
    B.headline = B.sale ? `Use ${money(cash)} of cash and sell ${money(B.sale.amount)} of investments, starting with the lots that cost the least tax.` : A.headline;
    const line = lineInfo(amt, M);
    const C = opt({key: 'C', name: 'Pledged line for all of it', blurb: 'Keep the cash as a cushion; borrow the full amount', cashUse: 0, line, debt: line ? line.annual / HH.income : 0, due: amt, dueNote: note, ready: '3–5 days'});
    C.headline = `Borrow the full ${money(amt)} on a pledged line and keep the cash as a cushion.`;
    return {opts: [A, B, C], dest: 'capital call account', period: M < 12 ? `over ${M} months` : 'year one'};
  },
  'pay-a-tax-bill'(T, M) {
    const cash = Math.min(AVAIL, T), gap = T - cash, note = 'due April 15';
    const A = opt({key: 'A', name: 'Cash + tax-smart sale', blurb: 'Cash first; sell the rest', cashUse: cash, sale: sellPlan(gap), due: T, dueNote: note, ready: '2–3 days'});
    A.headline = `Pay the ${money(T)} from ${money(cash)} of cash${A.sale ? ` and a ${money(A.sale.amount)} tax-smart sale` : ''}, through EFTPS before April 15.`;
    const B = opt({key: 'B', name: 'Cash + pledged line', blurb: `Cash first; borrow the rest and repay over ${M} months`, cashUse: cash, line: lineInfo(gap, M), due: T, dueNote: note, ready: '3–5 days'});
    B.debt = B.line ? B.line.annual / HH.income : 0;
    B.headline = B.line ? `Pay from ${money(cash)} of cash and a ${money(B.line.amt)} pledged-line draw, then repay the line over ${M} months.` : A.headline;
    const irs = gap > 0.5 ? {amt: gap, cost: gap * RATES.irs * M / 12} : null;
    const C = opt({key: 'C', name: 'Cash + IRS payment plan', blurb: 'Pay what cash covers; pay the IRS the rest over time', cashUse: cash, irs, due: T, dueNote: note, ready: 'Plan setup'});
    C.headline = irs ? `Pay ${money(cash)} now and put ${money(irs.amt)} on an IRS payment plan.` : A.headline;
    return {opts: [A, B, C], dest: 'IRS via EFTPS', period: M < 12 ? `over ${M} months` : 'year one'};
  }
};

/* Guardrails from the super skill file */
function check(o, pb) {
  const c = [{label: 'Reserve kept', pass: true}];
  if (o.sale) c.push({label: 'Tax < $50K', pass: o.sale.tax <= LIMITS.tax, why: `tax from selling would be ${money(o.sale.tax)}, over the ${money(LIMITS.tax)} limit`});
  if (o.line) c.push({label: 'Line < 50%', pass: o.line.util <= LIMITS.line, why: `the line would use ${pct(o.line.util, 0)} of borrowing capacity, over the 50% limit`});
  if (pb === 'buy-a-home') c.push({label: 'Housing < 28%', pass: o.housing <= LIMITS.housing, why: `housing cost would be ${pct(o.housing)} of income, over 28%`});
  if (o.loan || o.line || pb === 'buy-a-home') c.push({label: 'Debt < 36%', pass: o.debt <= LIMITS.debt, why: `debt payments would be ${pct(o.debt)} of income, over 36%`});
  if (o.irs) c.push({label: 'No IRS penalty', pass: false, why: `it leaves ${money(o.irs.amt)} unpaid, which brings IRS interest and penalties`});
  c.push({label: 'Retirement untouched', pass: true});
  o.checks = c; o.fails = c.filter(x => !x.pass);
}
const sig = o => [Math.round(o.cashUse), o.sale ? Math.round(o.sale.amount) : 0, o.loan ? o.loan.kind : '', o.line ? Math.round(o.line.amt) : 0, o.irs ? 1 : 0].join('|');
function solve(pb, amount, months) {
  const r = BUILD[pb.id](amount, months), seen = new Set();
  r.opts = r.opts.filter(o => { const s = sig(o); if (seen.has(s)) return false; seen.add(s); return true; });
  r.opts.forEach(o => check(o, pb.id));
  r.ranked = r.opts.filter(o => o.feasible).sort((a, b) => a.fails.length - b.fails.length || a.cost - b.cost || a.parts - b.parts);
  r.rec = r.ranked[0] || null;
  return r;
}

/* Router: trigger words pick the playbook; amounts and durations are pulled from the text */
const NUM_WORDS = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, 'a few': 3, 'a couple of': 2, 'a couple': 2, several: 4, a: 1};
function parseQuestion(q) {
  const s = q.toLowerCase();
  let amount = null;
  const m = s.match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|mm|m|million|thousand|bn|b|billion)?\b/) || s.match(/\b(\d+(?:\.\d+)?)\s*(k|mm|m|million|thousand)\b/);
  if (m) {
    const u = m[2] || '';
    const mult = /^(k|thousand)$/.test(u) ? 1e3 : /^(m|mm|million)$/.test(u) ? 1e6 : /^(b|bn|billion)$/.test(u) ? 1e9 : 1;
    const v = parseFloat(m[1].replace(/,/g, '')) * mult;
    if (v >= 1000) amount = v;
  }
  /* Expert skills are more specific, so a match (that also meets its amount threshold) beats the general playbook */
  let best = null;
  for (const pb of [...CUSTOM, ...PLAYBOOKS]) {
    let score = 0; const hits = [];
    const trig = pb.custom ? pb.triggers.map(w => [w, 2]) : pb.triggers;
    for (const [w, wt] of trig) {
      if (!w) continue;
      const re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ +/g, '\\s+') + '\\b');
      if (re.test(s)) { score += wt; hits.push(w); }
    }
    if (pb.custom && score > 0) { if (pb.minAmount && !(amount >= pb.minAmount)) continue; score += 10; }
    if (score > 0 && (!best || score > best.score)) best = {pb, score, hits};
  }
  let months = null;
  const mm = s.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a few|a couple of|a couple|several|a)\s+months?\b/);
  if (mm) months = /^\d/.test(mm[1]) ? parseInt(mm[1], 10) : NUM_WORDS[mm[1]];
  else if (/\b(\d|one|two|three|a)\s+years?\b|permanent|for good|long[- ]term|indefinitely/.test(s)) months = 12;
  const generic = /\b(fund|pay|afford|buy|purchase|money|loan|borrow|sell|financ\w*|spend)\b/.test(s);
  return {pb: best ? best.pb : null, hits: best ? best.hits : [], amount, months, generic};
}

/* What each building block asks its agents, and what comes back */
const CALLS = {
  'check-liquidity': () => ({title: 'Checked liquidity', calls: [
      {a: 'banking', fn: `get_balances("${HH.id}")`, out: HH.cash.map(c => `${c.label} ${money(c.value)}`).join(' · ')},
      {a: 'planning', fn: `get_set_asides("${HH.id}")`, out: `Reserve ${money(RESERVE)} (6 months × ${money(HH.monthlySpend)}) · Jan 15 estimate ${money(SET_ASIDE)}`},
      {a: 'investment', fn: `get_positions("${HH.id}")`, out: `Taxable ${money(TAXABLE)} · ` + HH.restricted.map(r => `${r.label} ${money(r.value)}`).join(' · ')}],
    result: `Available now ${money(AVAIL)}. Next business day: ${money(TAXABLE)} of listed securities. Restricted: ${money(RESTRICTED)}.`}),
  'compare-mortgages': (P, pb, sol) => {
    const L = sol.opts.find(o => o.loan && o.loan.kind === 'Jumbo mortgage').loan;
    return {title: 'Got a jumbo mortgage quote', calls: [
      {a: 'mortgage', fn: `quote_jumbo(price=${money(P.amount)}, down=20%)`, out: `${money(L.amt)} · 30-yr fixed · ${rate(L.rate)}* · ${dollars(L.monthly)}/mo`}],
      result: `Year-one interest about ${money(L.interest)}.`};
  },
  'borrow-against-portfolio': (P, pb, sol) => {
    const calls = [
      {a: 'investment', fn: 'get_positions(pledgeable=true)', out: `${HH.lots.length} taxable lots, ${money(TAXABLE)}`},
      {a: 'lending', fn: `get_borrowing_capacity("${HH.id}")`, out: `${money(CAPACITY)} (70% on funds, 50% on single stocks)`},
      {a: 'lending', fn: 'quote_pledged_line()', out: `${rate(RATES.line)}* variable, interest only`}];
    const ml = sol.opts.find(o => o.loan && o.loan.kind === 'Marine loan');
    if (ml) calls.push({a: 'lending', fn: `quote_marine_loan(${money(ml.loan.amt)}, years=20)`, out: `${rate(ml.loan.rate)}* · ${dollars(ml.loan.monthly)}/mo`});
    const draws = sol.opts.filter(o => o.line).map(o => `${o.key} draws ${money(o.line.amt)} (${pct(o.line.util, 0)} of capacity)`);
    return {title: 'Priced borrowing against the portfolio', calls, result: draws.length ? draws.join(' · ') + '.' : 'No option needs the line.'};
  },
  'sell-tax-smart': (P, pb, sol) => {
    const lossAmt = LOSS_LOTS.reduce((s, l) => s + l.basis - l.value, 0);
    const calls = [{a: 'investment', fn: `get_tax_lots("${HH.id}")`, out: `${HH.lots.length} lots · ${money(GAIN)} unrealized gain · ${LOSS_LOTS.length} lot at a ${money(lossAmt)} loss`}];
    const seen = new Set();
    sol.opts.filter(o => o.sale).forEach(o => {
      const k = Math.round(o.sale.amount); if (seen.has(k)) return; seen.add(k);
      calls.push({a: 'tax', fn: `estimate_gains_tax(sell=${money(o.sale.amount)})`, out: o.sale.gain > 0 ? `Gain ${money(o.sale.gain)} → tax ≈ ${money(o.sale.tax)}` : `Net loss ${money(-o.sale.gain)} → no tax`});
    });
    return {title: 'Priced each sale, lot by lot', calls, result: `Sale order: ${SALE_ORDER.map(l => l.label).join(' → ')}.`};
  },
  'check-plan-impact': (P, pb, sol) => ({title: 'Checked affordability', calls: [
      {a: 'planning', fn: 'check_ratios(options)', out: sol.opts.map(o => `${o.key}: ${pb.id === 'buy-a-home' ? `housing ${pct(o.housing)}, ` : ''}debt ${pct(o.debt)}`).join(' · ')}],
    result: 'Every option keeps the emergency reserve.'}),
  'pay-taxes': (P) => ({title: 'Checked due dates and penalties', calls: [
      {a: 'tax', fn: `get_due_dates("${HH.id}")`, out: `Jan 15: Q4 estimate ${money(SET_ASIDE)} · Apr 15: balance ${money(P.amount)}`},
      {a: 'tax', fn: 'check_safe_harbor(2026)', out: 'Estimates cover 110% of 2025 tax, so no underpayment penalty*'},
      {a: 'tax', fn: `quote_irs_plan(${money(Math.max(0, P.amount - AVAIL))})`, out: `Interest plus late-payment penalty ≈ ${pct(RATES.irs, 0)} a year*`},
      {a: 'banking', fn: 'get_payment_account()', out: 'Money market fund, enrolled in EFTPS'}],
    result: 'Pay by April 15 to avoid late-payment penalties.'})
};
function blockStep(id, parent, P, pb, sol) {
  const c = CALLS[id](P, pb, sol), agents = [...new Set(c.calls.map(x => x.a))];
  return {block: id, skill: id, title: c.title, calls: c.calls, result: c.result,
          nodes: ['b:' + id, ...agents.map(a => 'a:' + a)], edges: [[parent, 'b:' + id], ...agents.map(a => ['b:' + id, 'a:' + a])]};
}
function rankStep(pb, sol) {
  const lines = sol.opts.map(o => !o.feasible ? `${o.key}: not possible, ${o.blocker}`
    : `${o.key}: ${o.fails.length ? `breaks ${o.fails.map(f => f.label).join(', ')}` : `passes all ${o.checks.length} guardrails`} · tax + interest ${money(o.cost)}`);
  const r = sol.rec;
  return {skill: 'funding-liquidity · guardrails', title: 'Applied guardrails and ranked the options', nodes: ['f:funding-liquidity'], edges: [], calls: [], lines,
          result: !r ? 'No option is possible. Flagged for a planning conversation.'
            : r.fails.length ? `Every option breaks a guardrail. Showing ${r.key}, which breaks the fewest, with a flag.`
            : `Picked ${r.key}: lowest tax + interest of the options that pass.`};
}
function buildRun(q) {
  const P = parseQuestion(q);
  if (!P.pb && !P.generic) return {P, mode: 'none', steps: [{skill: 'coach · router', title: 'No skill family matched', nodes: [], edges: [], calls: [],
    result: 'Nothing in the question points to a skill. The coach would answer in general terms or ask what the client is trying to pay for.'}]};
  const skill = P.pb, pb = skill && skill.custom ? PLAYBOOKS.find(p => p.id === skill.base) : skill;
  if (pb) {
    P.amountStated = P.amount != null; if (!P.amountStated) P.amount = pb.def;
    P.monthsStated = P.months != null; P.months = Math.min(12, Math.max(1, P.months || 12));
  }
  const sol = pb ? solve(pb, P.amount, P.months) : null, steps = [];
  const expert = skill && skill.custom ? runExpertChecks(skill, P, sol) : null;
  steps.push({skill: 'coach · router', title: 'Matched the Funding & Liquidity super skill', nodes: ['f:funding-liquidity'], edges: [], calls: [],
    result: (P.hits.length ? `Trigger words: ${P.hits.map(h => '“' + h + '”').join(', ')}. ` : 'General money question. ')
      + (expert && skill.minAmount ? `${money(P.amount)} meets the ${money(skill.minAmount)} threshold, so the expert skill wins over ${pb.name}. ` : '')
      + 'The other 4 skill families stay unloaded.'});
  if (skill) {
    const skipped = BLOCKS.filter(b => !pb.uses.includes(b.id)).map(b => b.id);
    steps.push({skill: 'funding-liquidity', title: `Loaded the ${skill.name} playbook`, nodes: ['p:' + skill.id], edges: [['f:funding-liquidity', 'p:' + skill.id]], calls: [],
      result: expert ? `Written by ${skill.author || 'an expert'}. Builds on ${pb.id} and adds ${expert.rows.length} checks and ${skill.questions.length} questions.`
        : `It lists ${pb.uses.length} of the ${BLOCKS.length} building blocks.${skipped.length ? ` Not loaded: ${skipped.join(', ')}.` : ''}`});
  } else steps.push({skill: 'funding-liquidity', title: 'No playbook matched', nodes: [], edges: [], calls: [], result: 'The super skill falls back to check-liquidity on its own.'});
  const parent = skill ? 'p:' + skill.id : 'f:funding-liquidity';
  if (expert) steps.push(expert.step);
  for (const id of (pb ? pb.uses : ['check-liquidity'])) steps.push(blockStep(id, parent, P, pb, sol));
  if (pb) {
    steps.push(rankStep(pb, sol));
  }
  return {P, pb, skill, sol, steps, expert, mode: pb ? 'playbook' : 'liquidity'};
}
