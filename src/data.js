/* ---------- Sample data (made up for the demo) ---------- */
const HH = {
  id: 'HH-20417', name: 'The Whitfields',
  income: 650000, monthlySpend: 20000, reserveMonths: 6,
  cash: [{label: 'Checking & savings', value: 185000}, {label: 'Money market fund', value: 240000}],
  setAside: [{label: 'Q4 estimated tax, due Jan 15', value: 62000}],
  lots: [
    {id: 'intl',   label: 'Intl. equity fund', value: 150000,  basis: 172000,  term: 'long',  advance: .70},
    {id: 'etf',    label: 'US index ETFs',     value: 2000000, basis: 1378000, term: 'long',  advance: .70},
    {id: 'stocks', label: 'Single stocks',     value: 850000,  basis: 380000,  term: 'long',  advance: .50},
    {id: 'recent', label: 'Bought this year',  value: 200000,  basis: 170000,  term: 'short', advance: .50}
  ],
  restricted: [
    {label: 'IRA & 401(k)', value: 1450000, why: 'income tax plus a 10% penalty before 59½'},
    {label: 'Private funds', value: 600000, why: 'locked up until 2029'}
  ]
};
/* Placeholder rates and the guardrail limits the super skill enforces */
const RATES = {ltcg: .238, stcg: .408, mortgage: .064, line: .069, marine: .075, irs: .12, closing: .025, carry: .015, boatFees: .06};
const LIMITS = {tax: 50000, line: .5, housing: .28, debt: .36};

const AGENTS = [
  {id: 'banking', name: 'Banking Agent', mono: 'BK', short: 'balances, accounts', does: 'Accounts, balances and how payments get made.',
   tools: ['get_balances(household)', 'get_payment_account()']},
  {id: 'investment', name: 'Investment Agent', mono: 'IN', short: 'holdings, tax lots', does: 'Holdings, tax lots and trade proposals.',
   tools: ['get_positions(household, pledgeable?)', 'get_tax_lots(household)', 'stage_trades(orders)']},
  {id: 'lending', name: 'Lending Agent', mono: 'LN', short: 'pledged lines, loans', does: 'Pledged asset lines and asset-backed loans.',
   tools: ['get_borrowing_capacity(household)', 'quote_pledged_line()', 'quote_marine_loan(amount, years)']},
  {id: 'mortgage', name: 'Mortgage Agent', mono: 'MG', short: 'home loans', does: 'Home loan quotes and pre-approval.',
   tools: ['quote_jumbo(price, down)', 'start_preapproval(household, amount)']},
  {id: 'tax', name: 'Tax Agent', mono: 'TX', short: 'gains, due dates', does: 'Gain estimates, due dates and penalty checks.',
   tools: ['estimate_gains_tax(sell)', 'get_due_dates(household)', 'check_safe_harbor(year)', 'quote_irs_plan(balance)']},
  {id: 'planning', name: 'Planning Agent', mono: 'PL', short: 'rules, ratios', does: 'Household rules, set-asides and affordability ratios.',
   tools: ['get_set_asides(household)', 'check_ratios(options)']}
];

const FAMILIES = [
  {id: 'funding-liquidity', name: 'Funding & Liquidity', super: true},
  {id: 'retirement-income', name: 'Retirement income', inside: 'withdrawal order, Roth conversions, Social Security timing, RMDs'},
  {id: 'estate-gifting', name: 'Estate & gifting', inside: 'annual exclusion gifts, trust funding, beneficiary reviews'},
  {id: 'portfolio-review', name: 'Portfolio review', inside: 'drift, rebalancing, concentrated positions, fees'},
  {id: 'risk-insurance', name: 'Risk & insurance', inside: 'life, disability, umbrella and property coverage'}
];

const SUPER_FILE = {
  path: 'skills/funding-liquidity/SKILL.md',
  fm: [['name', 'funding-liquidity'], ['type', 'super skill'],
       ['description', 'Use when an advisor asks how a client can pay for something, raise cash or cover a bill. Picks one playbook and loads only the building blocks that playbook lists.'],
       ['playbooks', 'buy-a-home, buy-a-boat, pay-a-tax-bill, raise-cash'],
       ['building_blocks', 'check-liquidity, compare-mortgages, borrow-against-portfolio, sell-tax-smart, pay-taxes, check-plan-impact']],
  secs: [
    {h: 'Route the question', ul: ['Home, condo, property, mortgage → buy-a-home', 'Boat, yacht, vessel → buy-a-boat', 'Taxes, IRS, estimated payment → pay-a-tax-bill', 'Liquidity, capital call, bridge, raise cash → raise-cash', 'No match → run check-liquidity on its own and say no playbook fit']},
    {h: 'Guardrails for every playbook', ol: ['Keep 6 months of spending as an emergency reserve.', 'Keep tax from selling under $50K unless the client approves more.', 'Keep a pledged line under 50% of borrowing capacity.', 'Keep housing cost under 28% and all debt payments under 36% of gross income.', 'Never draw on retirement accounts or private funds.']},
    {h: 'Pick an option', p: 'Drop options that break a guardrail. Rank the rest by tax now plus interest for the period. If every option breaks one, show the closest and flag it for a planning conversation.'},
    {h: 'Answer format', p: 'Recommendation first, then the options compared, then the points to cover with the client. The coach only answers the advisor; it never moves money. Mark every rate as a placeholder until an agent returns a live quote.'}
  ]
};

const PLAYBOOKS = [
  {id: 'buy-a-home', name: 'Buy a home', unit: 'price', def: 2400000,
   triggers: [['house', 2], ['home', 2], ['condo', 2], ['apartment', 2], ['townhouse', 2], ['real estate', 2], ['down payment', 2], ['mortgage', 2], ['property', 1]],
   uses: ['check-liquidity', 'compare-mortgages', 'borrow-against-portfolio', 'sell-tax-smart', 'check-plan-impact'],
   fm: [['description', 'Use when an advisor asks how a client should pay for or finance a home.'], ['triggers', 'house, home, condo, property, down payment, mortgage']],
   secs: [
     {h: 'Steps', ol: ['Run check-liquidity to find cash available now.', 'Get a jumbo quote at 20% down from compare-mortgages.', 'Get borrowing capacity and a line rate from borrow-against-portfolio.', 'Price every sale with sell-tax-smart.', 'Check housing and debt ratios with check-plan-impact.']},
     {h: 'Options to build', ul: ['A. Jumbo mortgage. Closing money from cash, then a tax-smart sale.', 'B. Jumbo mortgage. Borrow the down-payment gap on a pledged line and sell nothing.', 'C. All cash: cash first, then a tax-smart sale.']},
     {h: 'Pick one', p: 'Use the super skill guardrails and ranking. Closing costs are 2.5% of the price. Count property tax and insurance (1.5% a year) in housing cost.'}
   ]},
  {id: 'buy-a-boat', name: 'Buy a boat', unit: 'price', def: 650000,
   triggers: [['boat', 2], ['yacht', 2], ['sailboat', 2], ['catamaran', 2], ['vessel', 2], ['marine', 1]],
   uses: ['check-liquidity', 'borrow-against-portfolio', 'sell-tax-smart', 'check-plan-impact'],
   fm: [['description', 'Use when an advisor asks how a client should pay for a boat or yacht.'], ['triggers', 'boat, yacht, sailboat, catamaran, vessel']],
   secs: [
     {h: 'Steps', ol: ['Run check-liquidity.', 'Add about 6% for sales tax, registration and survey.', 'Ask borrow-against-portfolio for a line rate and a marine loan quote (20% down, 20 years).', 'Price the cash option with sell-tax-smart.', 'Check debt payments with check-plan-impact.']},
     {h: 'Options to build', ul: ['A. Cash first, then a pledged line for the rest.', 'B. Marine loan with 20% down.', 'C. Pay cash: cash first, then a tax-smart sale.']},
     {h: 'Pick one', p: 'Use the super skill guardrails and ranking. A boat loses value, so say so when financing costs more than the tax from selling.'}
   ]},
  {id: 'pay-a-tax-bill', name: 'Pay a tax bill', unit: 'amount', def: 600000,
   triggers: [['tax bill', 2], ['taxes', 2], ['irs', 2], ['estimated payment', 2], ['estimated tax', 2], ['april 15', 2], ['tax', 1], ['owe', 1]],
   uses: ['check-liquidity', 'pay-taxes', 'sell-tax-smart', 'borrow-against-portfolio'],
   fm: [['description', 'Use when a client owes a large tax bill and the advisor asks how to pay it.'], ['triggers', 'taxes, tax bill, IRS, estimated tax, April 15']],
   secs: [
     {h: 'Steps', ol: ['Run check-liquidity. Money set aside for the January 15 estimate stays set aside.', 'Run pay-taxes for due dates, safe-harbor status and what an IRS plan would cost.', 'Price the gap with sell-tax-smart and borrow-against-portfolio.']},
     {h: 'Options to build', ul: ['A. Cash first, then a tax-smart sale.', 'B. Cash first, then a pledged line repaid over the stated period (12 months if none).', 'C. Pay what cash covers and put the rest on an IRS payment plan.']},
     {h: 'Pick one', p: 'Never pick an option that triggers IRS penalties. Otherwise use the super skill ranking.'}
   ]},
  {id: 'raise-cash', name: 'Raise cash', unit: 'amount', def: 750000,
   triggers: [['liquidity', 2], ['capital call', 2], ['bridge', 2], ['tuition', 2], ['raise', 1], ['cash', 1], ['liquid', 1]],
   uses: ['check-liquidity', 'borrow-against-portfolio', 'sell-tax-smart', 'check-plan-impact'],
   fm: [['description', 'Use when a client needs a lump of cash soon: a capital call, tuition, a bridge before a sale.'], ['triggers', 'liquidity, raise cash, capital call, bridge, tuition']],
   secs: [
     {h: 'Steps', ol: ['Run check-liquidity.', 'Find out how long the money is needed. If the question does not say, treat it as permanent (12 months).', 'Price a pledged line for that period and a tax-smart sale.', 'Check debt payments with check-plan-impact.']},
     {h: 'Options to build', ul: ['A. Cash first, then a pledged line as a bridge.', 'B. Cash first, then a tax-smart sale.', 'C. Pledged line for the full amount; keep the cash.']},
     {h: 'Pick one', p: 'Short needs usually favor borrowing and permanent ones favor selling. Let the numbers decide: tax now against interest for the period.'}
   ]}
];

const BLOCKS = [
  {id: 'check-liquidity', name: 'Check liquidity', agents: ['banking', 'investment', 'planning'],
   desc: 'Finds how much money a household can use now and how fast the rest could be ready.',
   secs: [{h: 'Steps', ol: ['Banking Agent: balances for checking, savings and money market.', 'Planning Agent: the emergency reserve rule and money set aside for known bills.', 'Investment Agent: holdings, grouped by how fast they turn into cash.']},
          {h: 'Liquidity tiers', ul: ['T+0: cash and money market, minus the reserve and set-asides', 'T+1: listed securities (US trades settle the next business day)', '3–5 days: borrowing capacity on a pledged line', 'Restricted: retirement accounts, private funds, real estate']},
          {h: 'Return', p: 'Available now, each tier, and anything that blocks a tier.'}]},
  {id: 'compare-mortgages', name: 'Compare mortgages', agents: ['mortgage'],
   desc: 'Gets home loan quotes and the monthly payment.',
   secs: [{h: 'Steps', ol: ['Mortgage Agent: jumbo quote at 20% down, 30-year fixed.', 'Return loan amount, rate, monthly principal and interest, and year-one interest.', 'Flag it if the price or credit profile needs more than 20% down.']}]},
  {id: 'borrow-against-portfolio', name: 'Borrow against portfolio', agents: ['investment', 'lending'],
   desc: 'Prices a pledged asset line, and asset-backed loans, against the taxable portfolio.',
   secs: [{h: 'Steps', ol: ['Investment Agent: positions eligible to pledge.', 'Lending Agent: advance rate per position (about 70% on diversified funds, 50% on single stocks) and the line rate.', 'Return capacity, how much of it each draw uses, and how far markets could fall before a margin call.', 'For a boat or plane, also get an asset-backed loan quote.']}]},
  {id: 'sell-tax-smart', name: 'Sell tax-smart', agents: ['investment', 'tax'],
   desc: 'Chooses which lots to sell and estimates the tax.',
   secs: [{h: 'Steps', ol: ['Investment Agent: tax lots with cost basis and holding period.', 'Sell lots at a loss first, then long-term lots with the smallest gain, and short-term lots last.', 'Tax Agent: estimate tax at 23.8% on long-term gains (20% plus 3.8% NIIT) and 40.8% on short-term gains.', 'Do not buy the same fund back within 30 days of a loss sale (wash-sale rule).']}]},
  {id: 'pay-taxes', name: 'Pay taxes', agents: ['tax', 'banking'],
   desc: 'Works out what is due when, and how to pay it.',
   secs: [{h: 'Steps', ol: ['Tax Agent: amounts and due dates (January 15 estimate, April 15 balance, state).', 'Tax Agent: safe-harbor check (110% of last year’s tax for high earners).', 'Tax Agent: what an IRS payment plan would cost in interest and penalties.', 'Banking Agent: the account that will pay, through IRS Direct Pay or EFTPS.']}]},
  {id: 'check-plan-impact', name: 'Check plan impact', agents: ['planning'],
   desc: 'Tests each option against the household’s affordability ratios.',
   secs: [{h: 'Steps', ol: ['Planning Agent: gross income and current debt payments.', 'Work out housing cost (principal, interest, property tax, insurance) and all debt payments as a share of income.', 'Compare to 28% and 36%, and confirm the reserve is intact.']}]}
];

const PRESETS = [
  {id: 'home', label: 'Buy a $2.4M home', q: 'My client wants to buy a $2.4M house in Greenwich. How should they fund it?'},
  {id: 'boat', label: 'Buy a $650K boat', q: 'Client wants to buy a $650K boat next spring. Should they pay cash or finance it?'},
  {id: 'raise', label: 'Raise $750K for 4 months', q: 'The Whitfields need $750K for a capital call in two weeks. Their business sale should close in about 4 months. What is the best way to raise the cash?'},
  {id: 'tax', label: 'Pay a $600K tax bill', q: 'They owe $600K in federal taxes on April 15 after selling a rental property. What is the best way to pay the IRS?'}
];
