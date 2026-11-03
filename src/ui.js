/* ---------- UI ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const AG = Object.fromEntries(AGENTS.map(a => [a.id, a]));
const BL = Object.fromEntries(BLOCKS.map(b => [b.id, b]));
const PB = Object.fromEntries(PLAYBOOKS.map(p => [p.id, p]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const STEP_MS = 520;
const state = {run: null, on: new Set(), edges: new Set(), stepOf: new Map(), calls: new Map(), sel: null, token: 0};
const nodeEl = {};

const allPB = () => [...CUSTOM, ...PLAYBOOKS];
const findCustom = id => CUSTOM.find(c => c.id === id);
const tiers = () => [
  {id: 'f', label: 'Skill families', note: 'Super skills the coach can load', items: FAMILIES.map(f => ({id: 'f:' + f.id, name: f.name, sub: f.id, kind: f.super ? 'Super skill' : ''}))},
  {id: 'p', label: 'Playbooks', note: 'One per client goal, inside the super skill', items: allPB().map(p => ({id: 'p:' + p.id, name: p.name, sub: p.id, kind: p.custom ? 'Expert skill' : ''}))},
  {id: 'b', label: 'Building blocks', note: 'Shared steps any playbook can call', items: BLOCKS.map(b => ({id: 'b:' + b.id, name: b.name, sub: b.id}))},
  {id: 'a', label: 'Agents', note: 'Our systems that hold the data and do the work', items: AGENTS.map(a => ({id: 'a:' + a.id, name: a.name, sub: a.short, mono: a.mono}))}
];
let STRUCT = [];
function buildStruct() {
  STRUCT = [];
  allPB().forEach(p => {
    STRUCT.push(['f:funding-liquidity', 'p:' + p.id]);
    (p.custom ? PB[p.base] : p).uses.forEach(u => STRUCT.push(['p:' + p.id, 'b:' + u]));
    if (p.custom) [...new Set(p.checks.filter(c => METRICS[c.metric]).map(c => METRICS[c.metric].agent))].forEach(a => STRUCT.push(['p:' + p.id, 'a:' + a]));
  });
  BLOCKS.forEach(b => b.agents.forEach(a => STRUCT.push(['b:' + b.id, 'a:' + a])));
}

function renderHH() {
  const rows = [...HH.cash.map(c => [c.label, money(c.value)]), ['Taxable brokerage', money(TAXABLE)], ...HH.restricted.map(r => [r.label, money(r.value)]),
                ['Gross income', money(HH.income) + '/yr'], ['Spending', money(HH.monthlySpend) + '/mo']];
  $('#hh').innerHTML = `<p class="label">Sample household · ${HH.id}</p><p class="hh-name">${esc(HH.name)}</p>
    <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
    <details><summary>Taxable lots and cost basis</summary><table class="lots"><tbody>${HH.lots.map(l => {
      const g = l.value - l.basis;
      return `<tr><td>${esc(l.label)}${l.term === 'short' ? ' (short-term)' : ''}</td><td>${money(l.value)}</td><td class="${g < 0 ? 'neg' : ''}">${g < 0 ? '' : '+'}${money(g)}</td></tr>`;
    }).join('')}</tbody></table></details>
    <p class="fine">Made-up household for this demo. ${money(SET_ASIDE)} is already set aside for the Jan 15 estimate.</p>`;
}

function renderMap() {
  buildStruct(); for (const k in nodeEl) delete nodeEl[k];
  $('#tiers').innerHTML = `<div class="scope" id="scope"><span>funding-liquidity/</span></div>` + tiers().map(t => `<div class="tier" data-tier="${t.id}">
    <div class="tier-head"><p class="label">${t.label}</p><span>${t.note}</span></div>
    <div class="tier-nodes">${t.items.map(n => `<button type="button" class="node${t.id === 'a' ? ' agent' : ''}" data-id="${n.id}">${n.mono ? `<span class="mono">${n.mono}</span>` : ''}${n.kind ? `<span class="kind">${n.kind}</span>` : ''}<span class="nm">${esc(n.name)}</span><span class="id">${esc(n.sub)}</span><span class="step" hidden></span></button>`).join('')}</div></div>`).join('');
  document.querySelectorAll('.node').forEach(el => { nodeEl[el.dataset.id] = el; el.addEventListener('click', () => select(el.dataset.id, true)); });
}

function paintMap() {
  const active = state.run && state.run.mode !== 'none' ? true : !!state.run;
  for (const id in nodeEl) {
    const el = nodeEl[id], on = state.on.has(id);
    el.classList.toggle('on', on);
    el.classList.toggle('dim', !on && active);
    el.classList.toggle('sel', state.sel === id);
    el.setAttribute('aria-pressed', state.sel === id ? 'true' : 'false');
    const b = el.querySelector('.step'), n = state.stepOf.get(id), c = state.calls.get(id);
    if (n) { b.hidden = false; b.textContent = n; } else if (c) { b.hidden = false; b.textContent = '×' + c; } else b.hidden = true;
  }
  $('#scope').classList.toggle('on', state.on.has('f:funding-liquidity'));
  const count = p => [...state.on].filter(x => x.startsWith(p)).length;
  $('#loaded').innerHTML = `Loaded <b>${count('f:')}</b>/${FAMILIES.length} families · <b>${count('p:')}</b>/${allPB().length} playbooks · <b>${count('b:')}</b>/${BLOCKS.length} blocks · <b>${count('a:')}</b>/${AGENTS.length} agents`;
}

function geom(a, b, mr, horiz) {
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  if (horiz) {
    const x1 = ra.right - mr.left, y1 = ra.top + ra.height / 2 - mr.top, x2 = rb.left - mr.left, y2 = rb.top + rb.height / 2 - mr.top, c = (x2 - x1) / 2;
    return `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`;
  }
  const x1 = ra.left + ra.width / 2 - mr.left, y1 = ra.bottom - mr.top, x2 = rb.left + rb.width / 2 - mr.left, y2 = rb.top - mr.top, c = Math.max(14, (y2 - y1) / 2);
  return `M${x1},${y1} C${x1},${y1 + c} ${x2},${y2 - c} ${x2},${y2}`;
}
function drawEdges(fresh = new Set()) {
  const map = $('#map'), svg = $('#edges'), mr = map.getBoundingClientRect();
  svg.setAttribute('width', map.offsetWidth); svg.setAttribute('height', map.offsetHeight);
  const t = map.querySelectorAll('.tier'), horiz = t[1].getBoundingClientRect().left > t[0].getBoundingClientRect().right - 1;
  const all = STRUCT.slice();
  state.edges.forEach(k => { const [a, b] = k.split('|'); if (!all.some(e => e[0] === a && e[1] === b)) all.push([a, b]); });
  all.sort((x, y) => state.edges.has(x.join('|')) - state.edges.has(y.join('|')));
  svg.innerHTML = all.map(([a, b]) => {
    const k = a + '|' + b, on = state.edges.has(k);
    return `<path d="${geom(nodeEl[a], nodeEl[b], mr, horiz)}" class="${on ? 'on' : ''}${fresh.has(k) ? ' draw' : ''}"/>`;
  }).join('');
  svg.querySelectorAll('path.draw').forEach(p => {
    const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    p.getBoundingClientRect(); p.style.transition = 'stroke-dashoffset .45s ease-out'; p.style.strokeDashoffset = 0;
  });
}

function select(id, fromClick) {
  state.sel = id; paintMap(); renderFile(id);
  if (fromClick) {
    const f = $('#file'), r = f.getBoundingClientRect();
    if (r.top > innerHeight - 60 || r.bottom < 0) f.scrollIntoView({behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start'});
  }
}
const fmBlock = rows => `<pre class="fm"><span class="d">---</span>\n${rows.map(([k, v]) => `<span class="k">${k}:</span> ${esc(v)}`).join('\n')}\n<span class="d">---</span></pre>`;
const secsHtml = secs => `<div class="md">${secs.map(s => `<h3>${esc(s.h)}</h3>${s.ol ? `<ol>${s.ol.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${s.ul ? `<ul>${s.ul.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${s.p ? `<p>${esc(s.p)}</p>` : ''}`).join('')}</div>`;
const callsHtml = calls => `<div class="calls">${calls.map(c => `<div class="call"><span class="ab">${AG[c.a].mono}</span><code>${esc(AG[c.a].name.split(' ')[0])}.${esc(c.fn)}</code><span class="out">${esc(c.out)}</span></div>`).join('')}</div>`;
const inrun = (on, h, p) => `<div class="inrun${on ? '' : ' off'}"><h4>${esc(h)}</h4><p>${esc(p)}</p></div>`;

function renderFile(id) {
  const [t, key] = id.split(/:(.+)/), run = state.run, ran = state.on.has(id);
  const where = run && run.skill ? `the ${run.skill.name} playbook` : 'no playbook';
  let type, path, body;
  if (t === 'f') {
    const f = FAMILIES.find(x => x.id === key);
    if (f.super) {
      type = 'Super skill'; path = SUPER_FILE.path;
      body = fmBlock(SUPER_FILE.fm) + secsHtml(SUPER_FILE.secs) + (ran ? inrun(true, 'Loaded for this question', !state.done ? 'The router matched it. It is choosing a playbook now.' : `The router matched it, and it sent the question to ${run.pb ? where : 'check-liquidity on its own'}.`) : inrun(false, 'Not loaded', 'Nothing in the question pointed to this skill.'));
    } else {
      type = 'Skill family'; path = `skills/${f.id}/SKILL.md`;
      body = fmBlock([['name', f.id], ['type', 'super skill'], ['contains', f.inside]]) + inrun(false, 'Not loaded for this question', 'The router only opens a skill family when the question matches its triggers, so none of its files were read.');
    }
  } else if (t === 'p' && findCustom(key)) {
    const c = findCustom(key), d = skillDoc(c); type = 'Expert skill'; path = `skills/funding-liquidity/playbooks/${c.id}/SKILL.md`;
    body = fmBlock(d.fm) + secsHtml(d.secs) + `<button type="button" class="add edit-skill" data-edit="${esc(c.id)}">Edit in the skill builder</button>`
      + (ran ? inrun(true, `In this run · step ${state.stepOf.get(id)}`, !state.done ? 'Loaded. Running its expert checks now.' : `Flagged ${run.expert.flagged} of ${run.expert.rows.length} checks and raised ${c.questions.length} questions for the advisor.`)
             : inrun(false, 'Not loaded', `This question went to ${where}.${c.minAmount ? ` This skill needs an amount of at least ${money(c.minAmount)}.` : ''}`));
  } else if (t === 'p') {
    const p = PB[key]; type = 'Playbook'; path = `skills/funding-liquidity/playbooks/${p.id}/SKILL.md`;
    body = fmBlock([['name', p.id], ['parent', 'funding-liquidity'], ...p.fm, ['uses', p.uses.join(', ')]]) + secsHtml(p.secs)
      + (ran ? inrun(true, `In this run · step ${state.stepOf.get(id)}`, !state.done ? `Loaded. Running its ${p.uses.length} building blocks now.` : run.sol.rec ? `Ran ${p.uses.length} building blocks and recommended option ${run.sol.rec.key}: ${run.sol.rec.name}.` : `Ran ${p.uses.length} building blocks; no option was possible.`)
             : inrun(false, 'Not loaded', `This question went to ${where}.`));
  } else if (t === 'b') {
    const b = BL[key], step = run && run.steps.find(s => s.block === key);
    type = 'Building block'; path = `skills/funding-liquidity/blocks/${b.id}/SKILL.md`;
    body = fmBlock([['name', b.id], ['type', 'building block'], ['description', b.desc], ['agents', b.agents.map(a => AG[a].name).join(', ')]]) + secsHtml(b.secs)
      + (step ? `<div class="inrun"><h4>In this run · step ${state.stepOf.get(id)}</h4>${callsHtml(step.calls)}<p>${esc(step.result)}</p></div>`
              : inrun(false, 'Not used in this run', run && run.skill ? `The ${run.skill.name} playbook doesn't list it, so it was never loaded.` : 'No playbook ran.'));
  } else {
    const a = AG[key], calls = run ? run.steps.flatMap(s => s.calls.filter(c => c.a === key)) : [];
    type = 'Agent'; path = `agents/${a.id}`;
    body = `<p class="agent-does">${esc(a.does)}</p><div class="md"><h3>Tools</h3><ul>${a.tools.map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ul><p>Skills decide when to call these and what to do with the answer. The agent owns the data and the action.</p></div>`
      + (calls.length ? `<div class="inrun"><h4>Called ${calls.length} time${calls.length > 1 ? 's' : ''} in this run</h4>${callsHtml(calls)}</div>` : inrun(false, 'Not called in this run', 'No building block in this run needed it.'));
  }
  $('#file').innerHTML = `<div class="file-top"><span class="ftype">${type}</span><code class="path">${esc(path)}</code></div><div class="file-body">${body}</div>`;
  const eb = $('#file .edit-skill'); if (eb) eb.addEventListener('click', () => openBuilder(eb.dataset.edit, true));
}

const tag = (k, v) => `<span class="tag"><i>${k}</i><b>${esc(v)}</b></span>`;
function renderParsed(r) {
  const P = r.P, t = [];
  t.push(tag('Skill', r.mode === 'none' ? 'none matched' : 'Funding & Liquidity'));
  if (r.skill) t.push(tag(r.expert ? 'Expert skill' : 'Playbook', r.skill.name)); else if (r.mode === 'liquidity') t.push(tag('Playbook', 'none, liquidity check only'));
  if (r.pb) t.push(tag(r.pb.unit === 'price' ? 'Price' : 'Amount', P.amountStated ? money(P.amount) : `${money(P.amount)} example, not in the question`));
  if (r.pb && (r.pb.id === 'raise-cash' || r.pb.id === 'pay-a-tax-bill')) t.push(tag(r.pb.id === 'raise-cash' ? 'Needed for' : 'Repay over', P.monthsStated ? `${P.months} month${P.months > 1 ? 's' : ''}` : 'not stated, so 12 months'));
  if (P.hits.length) t.push(tag('Matched', P.hits.map(h => '“' + h + '”').join(' ')));
  $('#parsed').innerHTML = t.join('');
}

function whyBullets(run) {
  const {P, pb, sol} = run, r = sol.rec, out = [], next = sol.ranked.find(o => o !== r);
  if (!r.fails.length && next) out.push(`Lowest tax plus interest (${sol.period}) of the options that pass every guardrail: ${money(r.cost)}, against ${money(next.cost)} for option ${next.key}.`);
  const B = sol.opts.find(o => o.key === 'B');
  if (pb.id === 'raise-cash' && r.key === 'A' && r.line && B && B.sale) out.push(`The money is needed for about ${P.months} months, so ${money(r.line.interest)} of interest costs less than the ${money(B.sale.tax)} tax from selling.`);
  if (pb.id === 'raise-cash' && r.key === 'B' && !P.monthsStated) out.push('The question gives no end date, so the playbook treats the need as permanent and compares a full year of line interest.');
  if (pb.id === 'buy-a-boat' && r.key === 'C') {
    const fin = sol.opts.filter(o => o.key !== 'C' && o.feasible).map(o => o.interest);
    if (fin.length) out.push(`Financing would cost at least ${money(Math.min(...fin))} a year in interest on an asset that loses value. Selling costs ${money(r.tax)} once.`);
  }
  if (pb.id === 'pay-a-tax-bill' && r.key !== 'C') { const C = sol.opts.find(o => o.irs); if (C) out.push(`An IRS payment plan would cost about ${money(C.irs.cost)} in interest and penalties, and the playbook never accepts IRS penalties.`); }
  if (r.sale) {
    const loss = r.sale.parts.find(p => p.gain < 0);
    if (loss && r.sale.tax > 0) out.push(`The sale starts with the ${loss.lot.label.toLowerCase()}, sold at a ${money(-loss.gain)} loss, which keeps the tax on ${money(r.sale.amount)} to about ${money(r.sale.tax)}.`);
    else if (loss) out.push(`The ${money(r.sale.amount)} sale comes from the ${loss.lot.label.toLowerCase()} at a loss, so it creates no tax and ${money(r.sale.carry)} of losses carry forward.`);
    else out.push(`The ${money(r.sale.amount)} sale creates about ${money(r.sale.tax)} in tax.`);
  }
  if (r.loan) out.push(r.loan.kind === 'Jumbo mortgage'
    ? `The ${money(r.loan.amt)} mortgage at a placeholder ${rate(r.loan.rate)} is ${dollars(r.loan.monthly)} a month. Housing cost is ${pct(r.housing)} of gross income, ${r.housing <= LIMITS.housing ? 'under' : 'over'} the 28% guideline.`
    : `The ${money(r.loan.amt)} marine loan at a placeholder ${rate(r.loan.rate)} is ${dollars(r.loan.monthly)} a month, ${pct(r.debt)} of gross income.`);
  if (r.line) out.push(`The ${money(r.line.amt)} draw uses ${pct(r.line.util, 0)} of the ${money(CAPACITY)} borrowing capacity. Markets would have to fall about ${pct(r.line.drop, 0)} before a margin call.`);
  out.push(`${r.cashUse > 0 ? `${money(r.cashUse)} comes from cash. ` : 'No cash is spent. '}The ${money(RESERVE)} emergency reserve and the ${money(SET_ASIDE)} set aside for January 15 stay put.`);
  const ruled = sol.opts.filter(o => o !== r && (!o.feasible || o.fails.length)).map(o => !o.feasible ? `Option ${o.key} is not possible: ${o.blocker}.` : `Option ${o.key} is out because ${o.fails.map(f => f.why).join(' and ')}.`);
  return out.concat(ruled);
}
function optsHtml(sol) {
  return `<div class="opts">${sol.opts.map(o => {
    const isRec = o === sol.rec;
    return `<div class="opt${isRec ? ' is-rec' : ''}${o.feasible ? '' : ' is-out'}"><span class="key">${o.key}</span>
      <div><div class="nm">${esc(o.name)}${isRec ? '<span class="pill sm">Pick</span>' : ''}</div><div class="bl">${esc(o.blurb)}</div></div>
      <div class="cost">${o.feasible ? money(o.cost) : '—'}<small>tax + interest</small></div>
      <div class="meta">${o.feasible ? `<span>Tax now <b>${money(o.tax)}</b></span><span>${o.irs ? 'IRS interest + penalty' : 'Interest'} <b>${money(o.interest)}</b></span><span>New debt <b>${money(o.newDebt)}</b></span><span>Ready <b>${esc(o.ready)}</b></span>` : `<span class="out-t">Not possible: ${esc(o.blocker)}</span>`}</div>
      ${o.feasible ? `<div class="checks">${o.checks.map(c => `<span class="ck ${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✕'} ${esc(c.label)}</span>`).join('')}</div>` : ''}</div>`;
  }).join('')}</div>`;
}
const footNote = '<p class="foot-note">Rates marked * are placeholders. Sample household. Not tax, legal or lending advice.</p>';
function renderAnswer(run) {
  const el = $('#answer');
  if (run.mode === 'none') {
    el.innerHTML = `<p class="headline">No skill matched this question.</p><p class="note">Try one of the examples, or say what the client wants to pay for: a home, a boat, a tax bill or a cash need.</p>`;
    return;
  }
  if (run.mode === 'liquidity') {
    const rows = [['Available now (T+0)', AVAIL, `Checking, savings and money market, minus the ${money(RESERVE)} reserve and ${money(SET_ASIDE)} set aside`],
      ['Next business day (T+1)', TAXABLE, `Listed securities. Selling realizes tax on part of ${money(GAIN)} of gains`],
      ['3–5 days', CAPACITY, 'Pledged line against the taxable portfolio'],
      ['Restricted', RESTRICTED, HH.restricted.map(r => `${r.label}: ${r.why}`).join('; ')]];
    el.innerHTML = `<p class="headline">${money(AVAIL)} is available today. Here is how fast the rest could be ready.</p>
      <table class="tiers-tbl"><tbody>${rows.map(([t, v, s]) => `<tr><td><span class="t">${t}</span><span class="s">${esc(s)}</span></td><td>${money(v)}</td></tr>`).join('')}</tbody></table>
      <p class="note">No playbook matched, so the coach stopped after check-liquidity. Saying what the money is for (a home, a boat, a tax bill, a capital call) gets a recommendation.</p>${footNote}`;
    return;
  }
  const {P, pb, sol} = run, r = sol.rec;
  let h = P.amountStated ? '' : `<p class="note">The question gives no ${pb.unit}, so this run uses a ${money(P.amount)} example. In production the coach would ask the advisor first.</p>`;
  const e = run.expert;
  const expertHtml = !e ? '' : `<div class="blk"><p class="label">Expert checks · ${esc(run.skill.name)}</p><div class="xchecks">${e.rows.map(x => `<div class="xc"><span class="ab">${AG[x.m.agent].mono}</span><div><div class="xl">${esc(x.m.label)}</div><div class="xs">${esc(x.val)}, ${esc(x.rule)}.${!x.pass && x.fail ? ` ${esc(x.fail)}` : ''}</div></div><span class="ck ${x.pass ? 'pass' : 'fail'}">${x.pass ? '✓ OK' : '✕ Flagged'}</span></div>`).join('')}</div></div>`
    + (run.skill.questions.length ? `<div class="blk"><p class="label">Questions to raise with the client first</p><ol class="why">${run.skill.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol></div>` : '');
  const expertFlag = e && e.flagged ? `<p class="flag">The ${esc(run.skill.name)} skill flagged ${e.flagged} of ${e.rows.length} checks. Cover these with the client before settling on a funding plan.</p>` : '';
  if (!r) { el.innerHTML = h + expertFlag + expertHtml + `<p class="headline">This is more than the household can fund without touching retirement or private funds.</p><div class="blk"><p class="label">Options the playbook tried</p>${optsHtml(sol)}</div>` + footNote; return; }
  const debtSub = r.loan ? `${dollars(r.loan.monthly)}/mo` : r.line ? `${rate(r.line.rate)}* variable` : 'none';
  const figs = [['Needed', money(r.due), r.dueNote], ['Tax now', money(r.tax), r.sale ? `on a ${money(r.sale.amount)} sale` : 'nothing sold'], ['New debt', money(r.newDebt), debtSub], ['Tax + interest', money(r.cost), sol.period]];
  h += `<div class="rec-line"><span class="pill">Recommended · option ${r.key}</span><span class="rec-name">${esc(r.name)}</span></div>
    <p class="headline">${esc(r.headline)}</p>
    <div class="figs">${figs.map(([k, v, s]) => `<div class="fig"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${esc(s)}</span></div>`).join('')}</div>`;
  h += expertFlag + expertHtml;
  if (r.fails.length) h += `<p class="flag">No option passes every guardrail. This one breaks ${r.fails.length}: ${esc(r.fails.map(f => f.why).join('; '))}. The coach flags it for a planning conversation before anything moves.</p>`;
  h += `<div class="blk"><p class="label">Why this option</p><ul class="why">${whyBullets(run).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="blk"><p class="label">Options the playbook compared</p>${optsHtml(sol)}</div>${footNote}`;
  el.innerHTML = h;
}

const stepHtml = (s, i, anim) => `<li${anim ? ' class="enter"' : ''}><span class="n">${i + 1}</span><div class="st"><div class="sk">${esc(s.skill)}</div><div class="t">${esc(s.title)}</div>${s.calls.length ? callsHtml(s.calls) : ''}${s.lines ? `<ul class="lines">${s.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}<p class="res">${esc(s.result)}</p></div></li>`;
function working(i, n, s) {
  $('#answer').innerHTML = `<div class="working"><div class="bar"><i style="width:${Math.round(i / n * 100)}%"></i></div><p>Running step ${i} of ${n}${s ? ` · <code>${esc(s.skill)}</code>` : ''}</p></div>`;
}
function run(q, animate = true) {
  const tok = ++state.token, r = buildRun(q);
  Object.assign(state, {run: r, on: new Set(), edges: new Set(), stepOf: new Map(), calls: new Map(), sel: null, done: false});
  renderParsed(r); $('#trace').innerHTML = '';
  const apply = (s, i, anim) => {
    s.nodes.forEach(n => { state.on.add(n); if (!n.startsWith('a:') && !state.stepOf.has(n)) state.stepOf.set(n, i + 1); });
    s.calls.forEach(c => state.calls.set('a:' + c.a, (state.calls.get('a:' + c.a) || 0) + 1));
    const fresh = new Set();
    s.edges.forEach(e => { const k = e.join('|'); if (!state.edges.has(k)) { state.edges.add(k); fresh.add(k); } });
    $('#trace').insertAdjacentHTML('beforeend', stepHtml(s, i, anim));
    paintMap(); drawEdges(anim ? fresh : new Set());
    if (anim) s.nodes.forEach(n => { const el = nodeEl[n]; if (el) { el.classList.remove('now'); void el.offsetWidth; el.classList.add('now'); } });
    if (anim && i < 2 && s.nodes.length) { state.sel = s.nodes[0]; paintMap(); renderFile(s.nodes[0]); }
  };
  const finish = () => {
    state.done = true;
    renderAnswer(r);
    const sel = r.skill ? 'p:' + r.skill.id : r.mode === 'liquidity' ? 'b:check-liquidity' : 'f:funding-liquidity';
    state.sel = sel; paintMap(); renderFile(sel);
  };
  if (!animate || reduceMotion.matches) { r.steps.forEach((s, i) => apply(s, i, false)); finish(); return; }
  paintMap(); drawEdges();
  let i = 0;
  const tick = () => {
    if (tok !== state.token) return;
    if (i < r.steps.length) { apply(r.steps[i], i, true); working(i + 1, r.steps.length, r.steps[i]); i++; setTimeout(tick, STEP_MS); }
    else finish();
  };
  working(0, r.steps.length, null); tick();
}

/* ---------- Boot ---------- */
function setPressed(id) { document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === id ? 'true' : 'false')); }
renderHH(); renderMap();
$('#presets').innerHTML = PRESETS.map(p => `<button type="button" class="chip" data-p="${p.id}" aria-pressed="false">${esc(p.label)}</button>`).join('');
document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const p = PRESETS.find(x => x.id === b.dataset.p); $('#q').value = p.q; setPressed(p.id); run(p.q); }));
$('#ask-form').addEventListener('submit', e => { e.preventDefault(); run($('#q').value); });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run($('#q').value); } });
$('#q').addEventListener('input', () => setPressed(null));
if (/Mac|iPhone|iPad/.test(navigator.platform || '')) $('#kbd').textContent = '⌘ ↵';
$('#q').value = PRESETS[0].q; setPressed('home');
run(PRESETS[0].q, false);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawEdges());
if ('ResizeObserver' in window) new ResizeObserver(() => drawEdges()).observe($('#map'));
