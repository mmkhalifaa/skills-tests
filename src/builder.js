/* ---------- Skill builder ---------- */
let draft = null, editingId = null, delArmed = false;
const blankSkill = () => ({custom: true, id: '', name: '', author: '', base: 'buy-a-home', desc: '', triggers: [], minAmount: null, minText: '',
  checks: [{metric: 'concentration', thr: METRICS.concentration.def, fail: ''}], questions: [''], test: ''});
const slug = s => s.toLowerCase().replace(/\$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
function parseMoney(s) {
  const t = String(s || '').toLowerCase().replace(/[$,\s]/g, ''); if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)(k|thousand|m|mm|million)?$/); if (!m) return NaN;
  return parseFloat(m[1]) * (/^(k|thousand)$/.test(m[2] || '') ? 1e3 : /^(m|mm|million)$/.test(m[2] || '') ? 1e6 : 1);
}
const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };

function openBuilder(id, scroll) {
  const src = findCustom(id);
  editingId = src ? id : null; delArmed = false;
  draft = JSON.parse(JSON.stringify(src || blankSkill()));
  draft.minText = draft.minAmount ? money(draft.minAmount) : '';
  if (!draft.questions.length) draft.questions = [''];
  renderBuilder('');
  if (scroll) $('#builder').scrollIntoView({behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start'});
}
function renderList() {
  $('#b-list').innerHTML = CUSTOM.map(c => `<button type="button" class="chip" data-edit="${esc(c.id)}" aria-pressed="${c.id === editingId}">${esc(c.name)}</button>`).join('')
    + `<button type="button" class="chip" data-new="1" aria-pressed="${!editingId}">+ New skill</button>`;
  $('#b-list').querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openBuilder(b.dataset.edit)));
  $('#b-list').querySelector('[data-new]').addEventListener('click', () => openBuilder(null));
}
const metricOptions = sel => AGENTS.map(a => {
  const ms = Object.entries(METRICS).filter(([, m]) => m.agent === a.id);
  return ms.length ? `<optgroup label="${esc(a.name)}">${ms.map(([k, m]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(m.short)}</option>`).join('')}</optgroup>` : '';
}).join('');
const unitWord = m => m.unit === 'pct' ? '%' : m.unit === 'months' ? 'months' : 'dollars';

function renderBuilder(msg, kind) {
  renderList();
  const d = draft;
  $('#b-form').innerHTML = `
    <div class="f-row">
      <label class="fld"><span>Skill name</span><input id="b-name" value="${esc(d.name)}" placeholder="Buy a home over $5M"></label>
      <label class="fld"><span>Written by</span><input id="b-author" value="${esc(d.author)}" placeholder="Your name or team"></label>
    </div>
    <div class="f-row">
      <label class="fld"><span>Builds on playbook</span><select id="b-base">${PLAYBOOKS.map(p => `<option value="${p.id}"${p.id === d.base ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>Only when the amount is at least</span><input id="b-min" value="${esc(d.minText)}" placeholder="Optional, e.g. $5M" inputmode="decimal"></label>
    </div>
    <label class="fld"><span>Use when</span><textarea id="b-desc" rows="2" placeholder="Use when an advisor asks…">${esc(d.desc)}</textarea></label>
    <label class="fld"><span>Trigger words, separated by commas</span><input id="b-trig" value="${esc(d.triggers.join(', '))}" placeholder="house, home, estate"></label>
    <fieldset class="fs"><legend>Check first</legend>
      <p class="fs-note">Each check asks one agent for one number about the client and flags it past your limit.</p>
      ${d.checks.map((c, i) => { const m = METRICS[c.metric]; return `<div class="ck-row">
        <select id="b-ck-${i}-m" aria-label="Check ${i + 1}: what to look at">${metricOptions(c.metric)}</select>
        <label class="thr"><span>flag if ${m.dir === 'max' ? 'over' : 'under'}</span><input id="b-ck-${i}-t" type="number" step="any" value="${isFinite(c.thr) ? c.thr : ''}" aria-label="Limit for check ${i + 1}"><em>${unitWord(m)}</em></label>
        <input class="fl" id="b-ck-${i}-f" value="${esc(c.fail || '')}" placeholder="If flagged, the coach should…" aria-label="What to do if check ${i + 1} is flagged">
        <button type="button" class="x" data-rm-ck="${i}" aria-label="Remove check ${i + 1}">×</button></div>`; }).join('')}
      <button type="button" class="add" data-add="ck">+ Add a check</button>
    </fieldset>
    <fieldset class="fs"><legend>Questions to raise with the client</legend>
      ${d.questions.map((q, i) => `<div class="q-row"><span class="qn">${i + 1}</span><input id="b-q-${i}" value="${esc(q)}" placeholder="Is this a primary home or a second home?" aria-label="Question ${i + 1}"><button type="button" class="x" data-rm-q="${i}" aria-label="Remove question ${i + 1}">×</button></div>`).join('')}
      <button type="button" class="add" data-add="q">+ Add a question</button>
    </fieldset>
    <label class="fld"><span>Test question</span><input id="b-test" value="${esc(d.test || '')}" placeholder="My clients want to buy a $10 million house. How should they fund it?"></label>
    <div class="b-actions"><button type="submit" class="run">Save and test</button>${editingId ? `<button type="button" class="danger" id="b-del">${delArmed ? 'Select again to delete' : 'Delete skill'}</button>` : ''}<p class="b-msg${kind ? ' ' + kind : ''}" id="b-msg" role="status">${esc(msg || '')}</p></div>`;
  renderPreview();
}
function readForm() {
  const d = draft;
  d.name = val('b-name'); d.author = val('b-author'); d.base = val('b-base'); d.desc = val('b-desc');
  d.triggers = val('b-trig').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  d.minText = val('b-min'); d.minAmount = parseMoney(d.minText);
  d.checks.forEach((c, i) => { c.metric = val(`b-ck-${i}-m`) || c.metric; c.thr = parseFloat(val(`b-ck-${i}-t`)); c.fail = val(`b-ck-${i}-f`); });
  d.questions = d.questions.map((q, i) => val(`b-q-${i}`));
  d.test = val('b-test');
}
function renderPreview() {
  const d = {...draft, id: slug(draft.name), minAmount: isFinite(draft.minAmount) ? draft.minAmount : null}, doc = skillDoc(d);
  $('#b-path').textContent = `skills/funding-liquidity/playbooks/${d.id || 'new-skill'}/SKILL.md`;
  $('#b-prev').innerHTML = fmBlock(doc.fm) + secsHtml(doc.secs);
}

function saveDraft() {
  readForm();
  const d = draft, id = slug(d.name), errs = [];
  if (!d.name.trim()) errs.push('Give the skill a name.');
  if (!d.triggers.length) errs.push('Add at least one trigger word so the router can find it.');
  if (Number.isNaN(d.minAmount)) errs.push('Write the amount like 5000000 or $5M.');
  if (!d.checks.length) errs.push('Add at least one check.');
  if (d.checks.some(c => !isFinite(c.thr))) errs.push('Give every check a limit.');
  if (id && (PLAYBOOKS.some(p => p.id === id) || CUSTOM.some(c => c.id === id && c.id !== editingId))) errs.push('Another skill already has that name.');
  if (errs.length) { renderBuilder(errs.join(' '), 'err'); return; }
  const saved = {custom: true, id, name: d.name.trim(), author: d.author.trim(), base: d.base, desc: d.desc.trim(), triggers: d.triggers,
    minAmount: d.minAmount || null, checks: d.checks.map(c => ({metric: c.metric, thr: c.thr, fail: c.fail.trim()})),
    questions: d.questions.map(q => q.trim()).filter(Boolean), test: d.test.trim()};
  const i = CUSTOM.findIndex(c => c.id === editingId);
  if (i > -1) CUSTOM[i] = saved; else CUSTOM.unshift(saved);
  editingId = id; saveCustom(); renderMap();
  draft = JSON.parse(JSON.stringify(saved)); draft.minText = saved.minAmount ? money(saved.minAmount) : ''; if (!draft.questions.length) draft.questions = [''];
  const q = saved.test || `My clients want to buy a ${saved.minAmount ? money(saved.minAmount * 2) : '$3M'} ${saved.triggers[0]}. How should they fund it?`;
  const routed = parseQuestion(q).pb;
  renderBuilder(routed && routed.id === id ? 'Saved. The coach is running your test question above.' : `Saved, but the test question went to ${routed ? routed.name : 'no skill'}. Check the trigger words and the amount threshold.`, routed && routed.id === id ? 'ok' : 'err');
  $('#q').value = q; setPressed(null); run(q);
  document.querySelector('.map-card').scrollIntoView({behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start'});
}

$('#b-form').addEventListener('submit', e => { e.preventDefault(); saveDraft(); });
$('#b-form').addEventListener('input', e => { readForm(); renderPreview(); if (delArmed) { delArmed = false; const b = $('#b-del'); if (b) b.textContent = 'Delete skill'; } });
$('#b-form').addEventListener('change', e => {
  const m = e.target.id.match(/^b-ck-(\d+)-m$/);
  if (m) { readForm(); draft.checks[+m[1]].thr = METRICS[e.target.value].def; renderBuilder(''); const el = document.getElementById(e.target.id); if (el) el.focus(); }
});
$('#b-form').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.add || t.dataset.rmCk || t.dataset.rmQ) readForm();
  if (t.dataset.add === 'ck') { draft.checks.push({metric: 'cashMonths', thr: METRICS.cashMonths.def, fail: ''}); renderBuilder(''); document.getElementById(`b-ck-${draft.checks.length - 1}-m`).focus(); }
  else if (t.dataset.add === 'q') { draft.questions.push(''); renderBuilder(''); document.getElementById(`b-q-${draft.questions.length - 1}`).focus(); }
  else if (t.dataset.rmCk) { draft.checks.splice(+t.dataset.rmCk, 1); renderBuilder(''); }
  else if (t.dataset.rmQ) { draft.questions.splice(+t.dataset.rmQ, 1); if (!draft.questions.length) draft.questions = ['']; renderBuilder(''); }
  else if (t.id === 'b-del') {
    if (!delArmed) { delArmed = true; t.textContent = 'Select again to delete'; return; }
    const name = draft.name; CUSTOM = CUSTOM.filter(c => c.id !== editingId); saveCustom(); renderMap();
    openBuilder(null); renderBuilder(`Deleted ${name}.`, 'ok'); run($('#q').value, false);
  }
});
$('#to-builder').addEventListener('click', () => openBuilder(CUSTOM[0] ? CUSTOM[0].id : null, true));
openBuilder(CUSTOM[0] ? CUSTOM[0].id : null);
