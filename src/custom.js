/* ---------- Expert-authored skills ---------- */
/* Each check asks one agent for one number about the household and flags it past the expert's limit. */
const METRICS = {
  concentration: {agent: 'investment', short: 'Single-stock share of portfolio', label: 'Single-stock holdings as a share of the taxable portfolio', fn: 'get_concentration', unit: 'pct', dir: 'max', def: 20,
    calc: () => HH.lots.find(l => l.id === 'stocks').value / TAXABLE},
  cashMonths: {agent: 'banking', short: 'Cash left after closing', label: 'Cash left after closing, in months of spending', fn: 'cash_after_purchase', unit: 'months', dir: 'min', def: 12,
    calc: (P, sol) => (CASH - sol.opts[0].cashUse) / HH.monthlySpend},
  reserve: {agent: 'planning', short: 'Emergency reserve on file', label: 'Emergency reserve on file, in months of spending', fn: 'get_set_asides', unit: 'months', dir: 'min', def: 6,
    calc: () => HH.reserveMonths},
  capacityUse: {agent: 'lending', short: 'Closing money vs borrowing capacity', label: 'Money due at closing as a share of borrowing capacity', fn: 'get_borrowing_capacity', unit: 'pct', dir: 'max', def: 50,
    calc: (P, sol) => sol.opts[0].due / CAPACITY},
  existingDebt: {agent: 'lending', short: 'Existing debt payments', label: 'Existing debt payments as a share of income', fn: 'get_existing_debt', unit: 'pct', dir: 'max', def: 10,
    calc: () => 0},
  saleTax: {agent: 'tax', short: 'Tax if closing money comes from selling', label: 'Tax if the closing money is raised by selling', fn: 'estimate_gains_tax', unit: 'usd', dir: 'max', def: 100000,
    calc: (P, sol) => { const sp = sellPlan(Math.max(0, sol.opts[0].due - AVAIL)); return sp ? sp.tax : 0; }},
  housing: {agent: 'planning', short: 'Housing cost vs income', label: 'Housing or payment cost as a share of gross income', fn: 'check_ratios', unit: 'pct', dir: 'max', def: 28,
    calc: (P, sol) => sol.opts[0].debt},
  loanSize: {agent: 'mortgage', short: 'Loan size', label: 'Loan amount', fn: 'quote_jumbo', unit: 'usd', dir: 'max', def: 3000000,
    calc: (P, sol) => { const o = sol.opts.find(x => x.loan); return o ? o.loan.amt : 0; }}
};
const thrTxt = (m, t) => !isFinite(t) ? '?' : m.unit === 'pct' ? `${t}%` : m.unit === 'months' ? `${t} months` : money(t);
const valTxt = (m, v) => m.unit === 'pct' ? pct(v) : m.unit === 'months' ? `${trimNum(v.toFixed(1))} months` : money(v);
const ruleTxt = (m, t) => `flag if ${m.dir === 'max' ? 'over' : 'under'} ${thrTxt(m, t)}`;
const agentName = id => (AGENTS.find(a => a.id === id) || {name: id}).name;

const DEFAULT_CUSTOM = [{
  custom: true, id: 'buy-a-home-over-5m', name: 'Buy a home over $5M', author: 'Private client lending lead', base: 'buy-a-home',
  desc: 'Use when an advisor asks how a client should fund a home priced at $5M or more.',
  triggers: ['house', 'home', 'estate', 'property', 'condo', 'penthouse'], minAmount: 5000000,
  checks: [
    {metric: 'concentration', thr: 20, fail: 'Talk about trimming the single stocks before pledging or selling them.'},
    {metric: 'cashMonths', thr: 12, fail: 'Keep a year of spending in cash after closing and size the down payment around it.'},
    {metric: 'reserve', thr: 6, fail: 'Rebuild the emergency reserve before closing.'},
    {metric: 'existingDebt', thr: 10, fail: 'Pull a full credit picture before quoting.'},
    {metric: 'saleTax', thr: 100000, fail: 'Bring in the client’s CPA before any sale.'},
    {metric: 'housing', thr: 28, fail: 'Show the carrying cost and test a lower price or a larger down payment.'},
    {metric: 'loanSize', thr: 3000000, fail: 'Send it to the private bank jumbo desk for a manual underwrite.'}],
  questions: ['Is this a primary home, a second home or an investment property?', 'Will the title be held in the clients’ names, a trust or an LLC?',
    'Do they need to sell a current home first, and when?', 'Would they keep a mortgage for liquidity even if they could pay cash?',
    'What is the closing date, and does a cash offer help win the deal?'],
  test: 'My clients want to buy a $10 million house in Palm Beach. How should they fund it?'
}];
const LS_KEY = 'coach-expert-skills-v1';
let CUSTOM = (() => {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (Array.isArray(s)) return s.filter(x => x && x.id && Array.isArray(x.checks)); } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_CUSTOM));
})();
function saveCustom() { try { localStorage.setItem(LS_KEY, JSON.stringify(CUSTOM)); } catch (e) {} }
PRESETS.push({id: 'lux', label: 'Buy a $10M home', q: DEFAULT_CUSTOM[0].test});

function runExpertChecks(skill, P, sol) {
  const rows = skill.checks.filter(c => METRICS[c.metric]).map(c => {
    const m = METRICS[c.metric], v = m.calc(P, sol), t = m.unit === 'pct' ? c.thr / 100 : c.thr;
    return {...c, m, v, pass: m.dir === 'max' ? v <= t : v >= t, val: valTxt(m, v), rule: ruleTxt(m, c.thr)};
  });
  const flagged = rows.filter(r => !r.pass).length, id = 'p:' + skill.id, agents = [...new Set(rows.map(r => r.m.agent))];
  return {rows, flagged, step: {skill: skill.id + ' · expert checks', title: 'Ran the expert checks first', calls: rows.map(r => ({a: r.m.agent, fn: `${r.m.fn}("${HH.id}")`, out: `${r.m.short}: ${r.val}, ${r.rule} → ${r.pass ? 'OK' : 'flagged'}`})),
    nodes: [id, ...agents.map(a => 'a:' + a)], edges: agents.map(a => [id, 'a:' + a]),
    result: flagged ? `${flagged} of ${rows.length} checks flagged. ${skill.questions.length} questions go to the advisor.` : `All ${rows.length} checks passed.`}};
}
function skillDoc(c) {
  const agents = [...new Set(c.checks.filter(k => METRICS[k.metric]).map(k => METRICS[k.metric].agent))];
  return {
    fm: [['name', c.id || 'new-skill'], ['parent', 'funding-liquidity'], ['extends', c.base], ['author', c.author || '(not set)'],
         ['description', c.desc || '(not set)'], ['triggers', c.triggers.join(', ') || '(none yet)'], ...(c.minAmount ? [['when', `amount ≥ ${money(c.minAmount)}`]] : []),
         ['agents', agents.map(agentName).join(', ')]],
    secs: [
      {h: 'Check first', ol: c.checks.filter(k => METRICS[k.metric]).map(k => { const m = METRICS[k.metric]; return `${agentName(m.agent)}: ${m.label}. ${ruleTxt(m, k.thr).replace(/^f/, 'F')}.${k.fail ? ` If flagged: ${k.fail}` : ''}`; })},
      {h: 'Questions to raise with the client', ol: c.questions.filter(q => q && q.trim())},
      {h: 'Then', p: `Run the ${c.base} steps and compare its options. Lead the answer with any flagged checks and the questions to ask.`}]
  };
}
