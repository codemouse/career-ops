const trackerBody = document.querySelector('#trackerTable tbody');
const trackerTable = document.getElementById('trackerTable');
const trackerSummary = document.getElementById('trackerSummary');
const pipelineSearchInput = document.getElementById('pipelineSearchInput');
const pendingSummary = document.getElementById('pendingSummary');
const fitFilterSummary = document.getElementById('fitFilterSummary');
const pendingTable = document.getElementById('pendingTable');
const pendingTableBody = document.querySelector('#pendingTable tbody');
const opsChecklist = document.getElementById('opsChecklist');
const opsOutput = document.getElementById('opsOutput');
const baselineRefreshBtn = document.getElementById('baselineRefreshBtn');
const runVerifyPipelineBtn = document.getElementById('runVerifyPipelineBtn');
const runVerifyPortalsBtn = document.getElementById('runVerifyPortalsBtn');
const runStatsBtn = document.getElementById('runStatsBtn');
const pipelineTabBtn = document.getElementById('pipelineTabBtn');
const manageTabBtn = document.getElementById('manageTabBtn');
const analyticsTabBtn = document.getElementById('analyticsTabBtn');
const reportsTabBtn = document.getElementById('reportsTabBtn');
const evaluateTabBtn = document.getElementById('evaluateTabBtn');
const pipelinePanel = document.getElementById('pipelinePanel');
const managePanel = document.getElementById('managePanel');
const analyticsPanel = document.getElementById('analyticsPanel');
const reportsPanel = document.getElementById('reportsPanel');
const evaluatePanel = document.getElementById('evaluatePanel');
const refreshBtn = document.getElementById('refreshBtn');
const scanBtn = document.getElementById('scanBtn');
const dashboardTitle = document.getElementById('dashboardTitle');
const brandTagline = document.getElementById('brandTagline');
const themeButtons = Array.from(document.querySelectorAll('.theme-btn'));
const whimsyMeter = document.getElementById('whimsyMeter');
const whimsyMeterFill = document.getElementById('whimsyMeterFill');
const whimsyMeterText = document.getElementById('whimsyMeterText');
const goblinFortune = document.getElementById('goblinFortune');
const toastRack = document.getElementById('toastRack');
const mascot = document.querySelector('.mascot');
const goblinHint = document.getElementById('goblinHint');
const stateSelect = document.getElementById('stateSelect');
const statusForm = document.getElementById('statusForm');
const statusOutput = document.getElementById('statusOutput');
const sourceFilterSelect = document.getElementById('sourceFilterSelect');
const typeFilterSelect = document.getElementById('typeFilterSelect');
const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
const rejectModal = document.getElementById('rejectModal');
const rejectForm = document.getElementById('rejectForm');
const rejectReasonSelect = document.getElementById('rejectReasonSelect');
const rejectReasonHelp = document.getElementById('rejectReasonHelp');
const rejectCompanyChk = document.getElementById('rejectCompanyChk');
const rejectSourceChk = document.getElementById('rejectSourceChk');
const rejectTypeChk = document.getElementById('rejectTypeChk');
const rejectRoleKeywords = document.getElementById('rejectRoleKeywords');
const rejectLocationKeywords = document.getElementById('rejectLocationKeywords');
const rejectCancelBtn = document.getElementById('rejectCancelBtn');
const addJobModal = document.getElementById('addJobModal');
const addJobForm = document.getElementById('addJobForm');
const addToPipelineBtn = document.getElementById('addToPipelineBtn');
const addJobCancelBtn = document.getElementById('addJobCancelBtn');
const resumePickerModal = document.getElementById('resumePickerModal');
const resumePickerForm = document.getElementById('resumePickerForm');
const resumePickerSelect = document.getElementById('resumePickerSelect');
const resumeManualLabel = document.getElementById('resumeManualLabel');
const resumeManualInput = document.getElementById('resumeManualInput');

const pipelineState = {
  pending: [],
  processed: [],
  fitFilters: [],
  priorAppliedByCompany: {},
  sortKey: 'company',
  sortDir: 'asc',
  query: '',
  hintIndex: 0,
};

const trackerState = {
  sortKey: 'date',
  sortDir: 'desc',
};

const whimsyState = {
  titleClicks: [],
  hintTimer: null,
  taglineTimer: null,
  taglineIndex: 0,
  activeTheme: 'calm',
  lastMood: 'calm',
};

const taglinePool = [
  'Chaos-tested. Goblin-approved.',
  'Triage with fangs.',
  'One great application > fifty mediocre prayers.',
  'Refusing bad-fit matches since day one.',
  'Apply smarter. Ghost less. Win more.',
  'Where 3.9 scores go to die.',
  'Your pipeline, but with opinions.',
  'Sprinkle signal. Filter noise. Repeat.',
  'The ATS whisperer.',
  'Less spray. More precision. Same confetti.',
];

const rejectReasons = [
  { id: 'skills-mismatch', label: 'Skills mismatch', help: 'The role requires experience that is not a good match.' },
  { id: 'seniority-mismatch', label: 'Seniority mismatch', help: 'The role level is too junior or too senior for your target.' },
  { id: 'company-stage', label: 'Company/stage mismatch', help: 'The company size, funding stage, or environment is not your fit.' },
  { id: 'location-mismatch', label: 'Location mismatch', help: 'Location, on-site requirement, or timezone does not work.' },
  { id: 'employment-type-mismatch', label: 'Employment type mismatch', help: 'You prefer full-time vs fractional/contract (or vice versa).' },
  { id: 'source-quality', label: 'Low-quality source', help: 'This source tends to send poor-fit or noisy opportunities.' },
  { id: 'domain-mismatch', label: 'Industry/domain mismatch', help: 'The business domain is not one you want to target.' },
  { id: 'compensation-mismatch', label: 'Compensation mismatch', help: 'Compensation signal is too low or misaligned.' },
  { id: 'timing-mismatch', label: 'Not now / timing mismatch', help: 'Interesting role but wrong timing right now.' },
  { id: 'previously-applied', label: 'Previously Applied', help: 'You’ve already applied here and want to exclude repeat matches.' },
  { id: 'other', label: 'Already Applied', help: 'Use custom company/source/type/keywords filters for this pattern.' },
];

const pipelineFilters = {
  source: "all",
  type: "all",
};

refreshBtn.addEventListener('click', loadAll);
scanBtn.addEventListener('click', runScan);
statusForm.addEventListener('submit', submitStatus);
pipelineTabBtn?.addEventListener('click', () => setActiveTab('pipeline'));
manageTabBtn?.addEventListener('click', () => setActiveTab('manage'));
analyticsTabBtn?.addEventListener('click', () => setActiveTab('analytics'));
reportsTabBtn?.addEventListener('click', () => { setActiveTab('reports'); loadReports(); });
evaluateTabBtn?.addEventListener('click', () => setActiveTab('evaluate'));
baselineRefreshBtn?.addEventListener('click', loadOpsBaseline);
runVerifyPipelineBtn?.addEventListener('click', () => runOpsAction('verify-pipeline'));
runVerifyPortalsBtn?.addEventListener('click', () => runOpsAction('verify-portals'));
runStatsBtn?.addEventListener('click', () => runOpsAction('stats-summary'));
pipelineSearchInput?.addEventListener('input', (ev) => {
  pipelineState.query = String(ev.target.value || '').trim().toLowerCase();
  renderPipeline();
});
sourceFilterSelect?.addEventListener('change', (ev) => {
  pipelineFilters.source = String(ev.target.value || 'all');
  renderPipeline();
});
typeFilterSelect?.addEventListener('change', (ev) => {
  pipelineFilters.type = String(ev.target.value || 'all');
  renderPipeline();
});
clearAllFiltersBtn?.addEventListener('click', () => {  pipelineFilters.source = 'all';
  pipelineFilters.type = 'all';
  pipelineState.query = '';
  if (pipelineSearchInput) pipelineSearchInput.value = '';
  renderPipeline();
});
pendingTable?.querySelectorAll('button[data-sort-key]').forEach((btn) => {
  btn.addEventListener('click', () => togglePipelineSort(btn.dataset.sortKey || 'company'));
});

trackerTable?.querySelectorAll('button[data-tracker-sort-key]').forEach((btn) => {
  btn.addEventListener('click', () => toggleTrackerSort(btn.dataset.trackerSortKey || 'date'));
});

addToPipelineBtn?.addEventListener('click', () => {
  addJobForm?.reset();
  addJobModal?.showModal();
});
addJobCancelBtn?.addEventListener('click', () => addJobModal?.close());
addJobForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const url = document.getElementById('addJobUrl')?.value?.trim();
  const company = document.getElementById('addJobCompany')?.value?.trim();
  const role = document.getElementById('addJobRole')?.value?.trim();
  const location = document.getElementById('addJobLocation')?.value?.trim();
  const btn = document.getElementById('addJobSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  try {
    const result = await api('/api/pipeline/add', {
      method: 'POST',
      body: JSON.stringify({ url, company, role, location }),
    });
    if (result.ok) {
      addJobModal?.close();
      showToast(`Added${company ? ` ${company}` : ''}${role ? ` — ${role}` : ''} to pipeline`, 'success');
      await loadPipeline();
    } else {
      showToast(`Error: ${result.error || 'Failed to add'}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Add to Pipeline'; }
  }
});

document.getElementById('resumePickerCancelBtn')?.addEventListener('click', () => {
  resumePickerModal?.close();
  resumePickerModal._resolve?.(null);
});

resumePickerSelect?.addEventListener('change', () => {
  const isManual = resumePickerSelect.value === '__manual__';
  resumeManualLabel?.classList.toggle('is-hidden', !isManual);
});

resumePickerForm?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const val = resumePickerSelect?.value;
  const resolved = val === '__manual__' ? (resumeManualInput?.value?.trim() || '') : val;
  resumePickerModal?.close();
  resumePickerModal._resolve?.(resolved);
});

async function pickResume() {
  // fetch resume list lazily
  let resumes = [];
  try {
    const data = await api('/api/resumes');
    resumes = Array.isArray(data.resumes) ? data.resumes : [];
  } catch { /* ignore */ }

  if (!resumePickerSelect) return '';

  resumePickerSelect.innerHTML = '';
  resumes.forEach((r, i) => {
    const opt = document.createElement('option');
    opt.value = r.filename;
    opt.textContent = r.label + (i === 0 ? ' (most recent)' : '');
    resumePickerSelect.appendChild(opt);
  });
  const manualOpt = document.createElement('option');
  manualOpt.value = '__manual__';
  manualOpt.textContent = 'Manual entry…';
  resumePickerSelect.appendChild(manualOpt);
  resumeManualLabel?.classList.add('is-hidden');
  if (resumeManualInput) resumeManualInput.value = '';

  return new Promise((resolve) => {
    resumePickerModal._resolve = resolve;
    resumePickerModal?.showModal();
  });
}

loadAll();
setActiveTab('pipeline');
initWhimsy();

function setActiveTab(tab) {
  const tabs = ['pipeline', 'manage', 'analytics', 'reports', 'evaluate'];
  const btns = { pipeline: pipelineTabBtn, manage: manageTabBtn, analytics: analyticsTabBtn, reports: reportsTabBtn, evaluate: evaluateTabBtn };
  const panels = { pipeline: pipelinePanel, manage: managePanel, analytics: analyticsPanel, reports: reportsPanel, evaluate: evaluatePanel };
  for (const t of tabs) {
    const active = t === tab;
    btns[t]?.classList.toggle('active', active);
    btns[t]?.setAttribute('aria-selected', String(active));
    panels[t]?.classList.toggle('is-hidden', !active);
  }
  document.body.classList.toggle('tab-pipeline', tab === 'pipeline');
  document.body.classList.toggle('tab-manage', tab === 'manage');
  document.body.classList.toggle('tab-analytics', tab === 'analytics');
  document.body.classList.toggle('tab-reports', tab === 'reports');
  document.body.classList.toggle('tab-evaluate', tab === 'evaluate');
  if (tab === 'analytics') renderAnalytics();
}

async function loadAll() {
  await Promise.all([loadStates(), loadTracker(), loadPipeline(), loadFitFilters(), loadOpsBaseline()]);
}

async function loadFitFilters() {
  const data = await api('/api/fit-filters');
  pipelineState.fitFilters = Array.isArray(data.rules) ? data.rules : [];
  renderFitFilterSummary();
}

async function loadOpsBaseline() {
  const data = await api('/api/ops/baseline');
  if (!opsChecklist) return;

  opsChecklist.innerHTML = '';

  const c = data.checks || {};
  renderChip(opsChecklist, `Onboarding: ${c.onboardingReady ? 'ready' : 'needs setup'}`);
  renderChip(opsChecklist, `Version: ${c.upToDate ? 'up-to-date' : 'update available'}`);
  renderChip(opsChecklist, `Tracker file: ${c.trackerPresent ? 'present' : 'missing'}`);
  renderChip(opsChecklist, `Follow-ups file: ${c.followupsPresent ? 'present' : 'missing'}`);
  renderChip(opsChecklist, `Warnings: ${c.hasWarnings ? 'yes' : 'none'}`);

  if (opsOutput) {
    const stats = (data.statsSummary || '').trim();
    const warnings = Array.isArray(data.doctor?.warnings) ? data.doctor.warnings.join('\n') : '';
    const updateStatus = data.update?.status ? `Update: ${data.update.status}` : '';
    opsOutput.textContent = [
      'Baseline snapshot:',
      updateStatus,
      warnings ? `Warnings:\n${warnings}` : 'Warnings: none',
      '',
      stats || 'No stats summary available.',
    ].filter(Boolean).join('\n');
  }
}

async function runOpsAction(action) {
  const btnMap = {
    'verify-pipeline': runVerifyPipelineBtn,
    'verify-portals': runVerifyPortalsBtn,
    'stats-summary': runStatsBtn,
  };
  const btn = btnMap[action] || null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Running...';
  }
  try {
    const result = await api('/api/ops/run', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    if (opsOutput) {
      const body = [result.stdout || '', result.stderr || ''].filter(Boolean).join('\n\n');
      opsOutput.textContent = body || 'Completed.';
    }
    await loadOpsBaseline();
    await loadPipeline();
  } catch (err) {
    if (opsOutput) opsOutput.textContent = `Error: ${String(err.message || err)}`;
  } finally {
    if (btn) {
      btn.disabled = false;
      if (action === 'verify-pipeline') btn.textContent = 'Run Verify Pipeline';
      if (action === 'verify-portals') btn.textContent = 'Run Verify Portals';
      if (action === 'stats-summary') btn.textContent = 'Run Stats Summary';
    }
  }
}

async function loadStates() {
  const data = await api('/api/states');
  stateSelect.innerHTML = '';
  for (const s of data.states || []) {
    const option = document.createElement('option');
    option.value = s;
    option.textContent = s;
    stateSelect.appendChild(option);
  }
}

async function loadTracker() {
  const data = await api('/api/tracker');
  const rows = data.rows || [];
  window._trackerRows = rows;
  trackerBody.innerHTML = '';
  trackerSummary.innerHTML = '';

  if (!data.found) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7">No tracker file found yet.</td>';
    trackerBody.appendChild(tr);
    return;
  }

  Object.entries(data.summary || {}).forEach(([k, v]) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${k}: ${v}`;
    trackerSummary.appendChild(chip);
  });

  const sortedRows = sortTrackerRows(rows);
  for (const row of sortedRows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.num)}</td>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.company)}</td>
      <td>${escapeHtml(row.role)}</td>
      <td>${escapeHtml(row.score)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.notes || '')}</td>
    `;
    trackerBody.appendChild(tr);
  }

  updateTrackerSortIndicators();
}

function sortTrackerRows(rows) {
  const key = trackerState.sortKey || 'date';
  const dir = trackerState.sortDir === 'desc' ? -1 : 1;
  return [...(rows || [])].sort((a, b) => {
    const av = trackerSortValue(a, key);
    const bv = trackerSortValue(b, key);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;

    // Stable tie-breakers: keep most recent entries near the top.
    const ad = trackerSortValue(a, 'date');
    const bd = trackerSortValue(b, 'date');
    if (ad !== bd) return bd - ad;

    const an = trackerSortValue(a, 'num');
    const bn = trackerSortValue(b, 'num');
    return bn - an;
  });
}

function trackerSortValue(row, key) {
  switch (key) {
    case 'num': {
      const n = Number.parseInt(String(row?.num ?? '').replace(/[^0-9-]/g, ''), 10);
      return Number.isFinite(n) ? n : -1;
    }
    case 'date': {
      const raw = String(row?.date || '').trim();
      if (!raw) return Number.NEGATIVE_INFINITY;
      const ts = Date.parse(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
      return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
    }
    case 'score': {
      const n = Number.parseFloat(String(row?.score || '').replace('/5', ''));
      return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
    }
    case 'company':
      return String(row?.company || '').toLowerCase();
    case 'role':
      return String(row?.role || '').toLowerCase();
    case 'status':
      return String(row?.status || '').toLowerCase();
    case 'notes':
      return String(row?.notes || '').toLowerCase();
    default:
      return String(row?.date || '').toLowerCase();
  }
}

function toggleTrackerSort(sortKey) {
  if (trackerState.sortKey === sortKey) {
    trackerState.sortDir = trackerState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    trackerState.sortKey = sortKey;
    trackerState.sortDir = sortKey === 'date' ? 'desc' : 'asc';
  }
  loadTracker();
}

function updateTrackerSortIndicators() {
  if (!trackerTable) return;
  trackerTable.querySelectorAll('button[data-tracker-sort-key]').forEach((btn) => {
    const key = btn.dataset.trackerSortKey || '';
    if (!btn.dataset.baseLabel) btn.dataset.baseLabel = btn.textContent.trim();
    const active = key === trackerState.sortKey;
    const arrow = active ? (trackerState.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    btn.textContent = `${btn.dataset.baseLabel}${arrow}`;
    btn.setAttribute('aria-sort', active ? (trackerState.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

async function loadPipeline() {
  const data = await api('/api/pipeline');
  pipelineState.pending = data.pending || [];
  pipelineState.processed = data.processed || [];
  pipelineState.priorAppliedByCompany = data.priorAppliedCompanies || {};
  renderPipeline();
}

function renderPipeline() {
  pendingSummary.innerHTML = '';
  if (fitFilterSummary) fitFilterSummary.innerHTML = '';

  const filteredPending = applyPipelineFilters(pipelineState.pending);
  const sourceScopedPending = applyPipelineFilters(pipelineState.pending, { ignoreType: true });
  const typeScopedPending = applyPipelineFilters(pipelineState.pending, { ignoreSource: true });
  const exclusionSummary = summarizeExclusions(pipelineState.pending);
  const sortedPending = sortPipelineItems(filteredPending);

  const typeScopedSegments = segmentPending(sourceScopedPending);
  const summary = {
    total: sortedPending.length,
    fractional: sortedPending.filter((p) => p.employmentType === 'fractional').length,
    fullTime: sortedPending.filter((p) => p.employmentType === 'full-time').length,
  };

  renderMetric(pendingSummary, `Total: ${summary.total}`);
  renderMetric(pendingSummary, `Showing: ${summary.total} of ${pipelineState.pending.length} pending`);
  if (exclusionSummary.totalHidden > 0) {
    renderMetric(pendingSummary, `Hidden by fit rules: ${exclusionSummary.totalHidden}`);
  }
  renderChip(pendingSummary, `Fractional: ${typeScopedSegments.fractional.length}`, {
    clickable: true,
    active: pipelineFilters.type === 'fractional',
    onClick: () => toggleJobTypeFilter('fractional'),
  });
  renderChip(pendingSummary, `Full-time: ${typeScopedSegments.fullTime.length}`, {
    clickable: true,
    active: pipelineFilters.type === 'full-time',
    onClick: () => toggleJobTypeFilter('full-time'),
  });

  renderQuickFilters(pipelineState.pending);

  const selectedSource = pipelineFilters.source;
  let sourceEntries = Object.entries(summarizeSources(typeScopedPending))
    .sort((a, b) => b[1] - a[1]);

  if (selectedSource !== 'all' && !sourceEntries.some(([source]) => source === selectedSource)) {
    sourceEntries = [[selectedSource, 0], ...sourceEntries];
  }

  if (selectedSource !== 'all') {
    sourceEntries = [
      ...sourceEntries.filter(([source]) => source === selectedSource),
      ...sourceEntries.filter(([source]) => source !== selectedSource),
    ];
  }

  sourceEntries = sourceEntries.slice(0, 6);

  if (pipelineFilters.source !== "all" || pipelineFilters.type !== "all") {
    renderChip(pendingSummary, "Clear filters", {
      clickable: true,
      onClick: () => {
        pipelineFilters.source = "all";
        pipelineFilters.type = "all";
        renderPipeline();
      },
    });
  }
  sourceEntries.forEach(([source, count]) => {
    renderChip(pendingSummary, `${source}: ${count}`, {
      clickable: true,
      active: selectedSource === source,
      onClick: () => toggleSourceFilter(source),
    });
  });

  renderPendingTable(sortedPending);
  updateSortIndicators();

  renderFitFilterSummary(exclusionSummary);
  renderStepOneGuidance(filteredPending);
  renderGoblinHint(filteredPending, exclusionSummary);
  updateWhimsyMeter(filteredPending, exclusionSummary);
}

function renderQuickFilters(items) {
  const sourceOptions = Object.entries(summarizeSources(items || []))
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ value: source, label: `${source} (${count})` }));

  if (sourceFilterSelect) {
    const current = pipelineFilters.source || 'all';
    sourceFilterSelect.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All sources';
    sourceFilterSelect.appendChild(allOpt);
    for (const optionData of sourceOptions) {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      sourceFilterSelect.appendChild(option);
    }
    sourceFilterSelect.value = sourceOptions.some((opt) => opt.value === current) ? current : 'all';
  }

  if (typeFilterSelect) {
    const current = pipelineFilters.type || 'all';
    const options = [
      { value: 'all', label: 'All types' },
      { value: 'fractional', label: `Fractional (${segmentPending(items || []).fractional.length})` },
      { value: 'full-time', label: `Full-time (${segmentPending(items || []).fullTime.length})` },
    ];

    typeFilterSelect.innerHTML = '';
    for (const optionData of options) {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      typeFilterSelect.appendChild(option);
    }
    typeFilterSelect.value = options.some((opt) => opt.value === current) ? current : 'all';
  }
}

function renderPendingTable(items) {
  if (!pendingTableBody) return;

  pendingTableBody.innerHTML = '';
  if (!items || items.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="9" class="empty-state">No pending roles match the current filters.</td>';
    pendingTableBody.appendChild(tr);
    return;
  }

  for (const [index, item] of items.entries()) {
    pendingTableBody.appendChild(renderPipelineItem(item, true, index));
  }
}

function renderFitFilterSummary(exclusionSummary = { totalHidden: 0, byRule: {} }) {
  if (!fitFilterSummary) return;
  fitFilterSummary.innerHTML = '';

  const rules = pipelineState.fitFilters || [];
  renderChip(fitFilterSummary, `Auto-exclude rules: ${rules.length}`);
  if ((exclusionSummary.totalHidden || 0) > 0) {
    renderChip(fitFilterSummary, `Hidden jobs: ${exclusionSummary.totalHidden}`);
  }

  // Collapse all "Already Applied" rules into one grouped chicklet
  const alreadyAppliedRules = rules.filter((r) => r.reasonId === 'other');
  const otherRules = rules.filter((r) => r.reasonId !== 'other' && r.reasonId !== 'skills-mismatch');

  if (alreadyAppliedRules.length > 0) {
    const totalHidden = alreadyAppliedRules.reduce((sum, r) => sum + Number(exclusionSummary.byRule?.[r.id] || 0), 0);
    const companies = alreadyAppliedRules.map((r) => r.company).filter(Boolean);
    const label = `Already Applied (${alreadyAppliedRules.length})${companies.length ? ': ' + companies.join(', ') : ''}${totalHidden > 0 ? ` | hidden=${totalHidden}` : ''}`;
    renderChip(fitFilterSummary, label);
  }

  otherRules.slice(0, 10).forEach((rule) => {
    const hiddenCount = Number(exclusionSummary.byRule?.[rule.id] || 0);
    const text = `${formatRuleChipText(rule)}${hiddenCount > 0 ? ` | hidden=${hiddenCount}` : ''}`;
    renderChip(fitFilterSummary, text, {
      clickable: true,
      onClick: async () => {
        const ok = window.confirm(`Remove rule?\n\n${text}`);
        if (!ok) return;
        await api('/api/fit-filters/remove', {
          method: 'POST',
          body: JSON.stringify({ id: rule.id }),
        });
        await loadFitFilters();
        renderPipeline();
      },
    });
  });
}

function summarizeExclusions(items) {
  const result = {
    totalHidden: 0,
    byRule: {},
  };

  for (const item of items || []) {
    const match = firstMatchingFitRule(item);
    if (!match) continue;
    result.totalHidden += 1;
    result.byRule[match.id] = (result.byRule[match.id] || 0) + 1;
  }

  return result;
}

function renderStepOneGuidance(filteredPending) {
  if (!opsOutput) return;
  const first = filteredPending[0];
  if (!first) {
    opsOutput.textContent = `${opsOutput.textContent}\n\nStep 1 guide: No pending roles left. Run Scan to fetch new opportunities, then sort or filter the table and take action on a role.`.trim();
    return;
  }

  const role = first.role || '(no role)';
  const company = first.company || '(no company)';
  const source = inferSource(first);
  const type = first.employmentType || inferEmploymentType(first);
  const guidance = [
    'Step 1 (Now): Process your first role',
    `Open Posting: ${company} - ${role}`,
    `Source/type: ${source} / ${type}`,
    'Use the table headers to sort, filters above to narrow, and actions on the right to decide.',
  ].join('\n');

  opsOutput.textContent = `${opsOutput.textContent.split('Step 1 (Now):')[0].trim()}\n\n${guidance}`.trim();
}

function applyPipelineFilters(items, options = {}) {
  const { ignoreSource = false, ignoreType = false, ignoreExclusions = false } = options;
  const sourceValue = pipelineFilters.source;
  const typeValue = pipelineFilters.type;
  const query = String(pipelineState.query || '').trim().toLowerCase();
  return (items || []).filter((item) => {
    if (!ignoreExclusions && isExcludedByFitRules(item)) return false;
    const sourceOk = ignoreSource || sourceValue === 'all' || inferSource(item) === sourceValue;
    const itemType = item.employmentType || inferEmploymentType(item);
    const typeOk = ignoreType || typeValue === 'all' || itemType === typeValue;
    const queryText = query
      ? `${inferSource(item)} ${item.company || ''} ${item.role || ''} ${displayPipelineLocation(item)} ${displayPipelinePosted(item)} ${(item.extra || []).join(' ')}`.toLowerCase()
      : '';
    const queryOk = !query || queryText.includes(query);
    const glassdoorBlocked = inferSource(item) === 'Glassdoor';
    const hasCoreFields = Boolean(String(item.company || '').trim() && String(item.role || '').trim());
    return sourceOk && typeOk && queryOk && !glassdoorBlocked && hasCoreFields;
  });
}

function isExcludedByFitRules(item) {
  return Boolean(firstMatchingFitRule(item));
}

function firstMatchingFitRule(item) {
  const rules = pipelineState.fitFilters || [];
  if (!rules.length) return null;

  const source = inferSource(item).toLowerCase();
  const company = String(item?.company || '').trim().toLowerCase();
  const jobType = String(item?.employmentType || inferEmploymentType(item)).trim().toLowerCase();
  const role = String(item?.role || '').toLowerCase();
  const location = String(item?.location || '').toLowerCase();

  for (const rule of rules) {
    const hasCompany = Boolean(rule.company);
    const hasSource = Boolean(rule.source);
    const hasType = Boolean(rule.employmentType);
    const hasRoleKeywords = Array.isArray(rule.roleKeywords) && rule.roleKeywords.length > 0;
    const hasLocationKeywords = Array.isArray(rule.locationKeywords) && rule.locationKeywords.length > 0;

    if (hasCompany && company !== String(rule.company).toLowerCase()) continue;
    if (hasSource && source !== String(rule.source).toLowerCase()) continue;
    if (hasType && jobType !== String(rule.employmentType).toLowerCase()) continue;

    if (hasRoleKeywords) {
      const roleMatch = rule.roleKeywords.some((k) => role.includes(String(k).toLowerCase()));
      if (!roleMatch) continue;
    }

    if (hasLocationKeywords) {
      const locationMatch = rule.locationKeywords.some((k) => location.includes(String(k).toLowerCase()));
      if (!locationMatch) continue;
    }

    if (hasCompany || hasSource || hasType || hasRoleKeywords || hasLocationKeywords) {
      return rule;
    }
  }

  return null;
}

function toggleSourceFilter(source) {
  pipelineFilters.source = pipelineFilters.source === source ? "all" : source;
  renderPipeline();
}

function toggleJobTypeFilter(type) {
  pipelineFilters.type = pipelineFilters.type === type ? "all" : type;
  renderPipeline();
}

function summarizeSources(items) {
  const summary = {};
  for (const item of items || []) {
    const source = inferSource(item);
    summary[source] = (summary[source] || 0) + 1;
  }
  return summary;
}

function renderPipelineItem(item, allowProcess, rowIndex = 0) {
  const el = document.createElement('tr');
  el.className = `pipeline-row${priorAppliedStatusFor(item.company) ? ' prior-applied-row' : ''}`;
  el.style.setProperty('--row-index', String(Math.min(rowIndex, 40)));

  const source = inferSource(item);
  const sourceClass = sourceClassSlug(source);
  const sourceGlyph = sourceBadgeGlyph(source);
  const sourceGlyphLabel = sourceBadgeLabel(source);
  const company = displayPipelineCompany(item.company || '(no company)', source);
  const role = displayPipelineTitle(item, source) || '(no role)';
  const type = item.employmentType || inferEmploymentType(item);
  const location = displayPipelineLocation(item);
  const posted = displayPipelinePosted(item);
  const flags = renderFlagsCell(item);
  const openPostingLabel = 'Open Posting';
  const addedAt = formatAddedAt(item.addedAt);
  const subtitle = buildSubtitle(item, source);

  el.innerHTML = `
    <td>
      <span class="chip source-chip ${escapeHtml(sourceClass)}">
        <span class="source-icon" title="${escapeAttr(sourceGlyphLabel)}" aria-label="${escapeAttr(sourceGlyphLabel)}">${escapeHtml(sourceGlyph)}</span>
        <span class="source-label">${escapeHtml(source)}</span>
      </span>
    </td>
    <td class="added-cell">${escapeHtml(addedAt || '-')}</td>
    <td><div class="cell-title">${escapeHtml(company || '-')}</div></td>
    <td>
      <div class="cell-title">${escapeHtml(role)}</div>
      <div class="cell-subtitle">${escapeHtml(subtitle)}</div>
    </td>
    <td><span class="chip type-${escapeHtml(type)}">${escapeHtml(type)}</span></td>
    <td>${escapeHtml(location || '-')}</td>
    <td>${escapeHtml(posted || '-')}</td>
    <td>${flags}</td>
    <td class="actions-cell">
      <div class="action-stack">
        <div class="row item-actions"></div>
      </div>
    </td>
  `;

  if (allowProcess) {
    const row = el.querySelector('.item-actions');
    row.appendChild(makeOpenPostingLink(item.url, openPostingLabel));
    row.appendChild(makePipelineActionButton('Applied', item.raw, 'applied', 'action-applied'));
    row.appendChild(makePipelineActionButton('Ignore', item.raw, 'remove', 'action-processed'));
    row.appendChild(makeRejectActionButton(item));
    row.appendChild(makeEvaluateButton(item));
  }

  return el;
}

function displayPipelineTitle(item, source) {
  const rawRole = String(item?.role || '').trim();
  if (!rawRole) return '';

  const rawLower = rawRole.toLowerCase();
  const company = normalizeDisplayLabel(item?.company || '');
  const friendlyCompany = company || 'this company';

  const extractedTitle = extractEmbeddedTitle(rawRole);
  if (extractedTitle) return extractedTitle;

  if (rawLower === 'view' || rawLower === 'builtin lead') {
    if (source === 'LinkedIn') return `${friendlyCompany} LinkedIn posting`;
    if (source === 'BuiltIn') return company ? `${friendlyCompany} BuiltIn posting` : 'BuiltIn posting';
    return `${friendlyCompany} posting`;
  }

  if (
    rawLower === 'job lead (email)' ||
    rawLower === 'job lead' ||
    rawLower === 'role' ||
    rawLower.startsWith('brian, apply for') ||
    rawLower.startsWith('brian, apply now to') ||
    rawLower.startsWith('apply for') ||
    rawLower.startsWith('apply now to')
  ) {
    if (source === 'FractionalJobs') return company ? `${friendlyCompany} FractionalJobs email lead` : 'FractionalJobs email lead';
    if (source === 'BuiltIn') return company ? `${friendlyCompany} BuiltIn email lead` : 'BuiltIn email lead';
    if (source === 'LinkedIn') return company ? `${friendlyCompany} LinkedIn email lead` : 'LinkedIn email lead';
    if (source === 'Glassdoor') return company ? `${friendlyCompany} Glassdoor email lead` : 'Glassdoor email lead';
    return company ? `${friendlyCompany} lead` : 'Job lead';
  }

  return rawRole;
}

function extractEmbeddedTitle(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const patterns = [
    /^(?:brian,\s*)?apply\s+now\s+to\s+["'‘’“”]?(.+?)["'‘’“”]?(?:\s*|$)/i,
    /^(?:brian,\s*)?apply\s+for\s+["'‘’“”]?(.+?)["'‘’“”]?(?:\s*|$)/i,
    /^your application to\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match || !match[1]) continue;
    const title = normalizeDisplayLabel(match[1]).replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
    if (title && !/^view$/i.test(title) && !/^job lead(?: \(email\))?$/i.test(title)) return title;
  }

  return '';
}

function normalizeDisplayLabel(value) {
  return String(value || '')
    .trim()
    .replace(/[\s\u00A0]*[’'‘`]+$/u, '')
    .trim();
}

function displayPipelineCompany(value, source) {
  const company = normalizeDisplayLabel(value);
  if (!company) return company;
  if (source === 'FractionalJobs' && /^fractionaljobs$/i.test(company)) return 'FractionalJobs';
  return company;
}

function displayPipelineLocation(item) {
  const direct = normalizeDisplayLabel(item?.location || '');
  if (direct) return direct;

  const hint = locationHintFromUrl(item?.url || '');
  if (!hint) return '';

  const source = inferSource(item);
  const title = normalizeDisplayLabel(displayPipelineTitle(item, source));
  const company = normalizeDisplayLabel(displayPipelineCompany(item?.company || '', source));
  const normalizedHint = normalizeDisplayLabel(hint);

  if (normalizedHint && (normalizedHint === title || normalizedHint === company)) return '';

  return humanizeLocationHint(hint);
}

function displayPipelinePosted(item) {
  const direct = normalizeDisplayLabel(item?.posted || '');
  if (direct) return direct.replace(/^posted:\s*/i, '');
  const added = formatAddedAt(item?.addedAt || '');
  return added || '';
}

function locationHintFromUrl(url) {
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    const jobIdx = segments.lastIndexOf('job');
    if (jobIdx === -1 || jobIdx === segments.length - 1) return '';
    let segment = segments[jobIdx + 1];
    try {
      segment = decodeURIComponent(segment);
    } catch {
      // fall through with raw segment
    }
    return segment.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  } catch {
    return '';
  }
}

function humanizeLocationHint(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^remote$/i.test(raw)) return 'Remote';
  return raw
    .split(/\s+/)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'us') return 'US';
      if (lower === 'uk') return 'UK';
      if (lower === 'usa') return 'USA';
      if (lower === 'eu') return 'EU';
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function makeOpenPostingLink(url, label) {
  const link = document.createElement('a');
  link.className = 'action-link action-open';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = label;
  return link;
}

function buildSubtitle(item, source) {
  const extras = [];
  for (const part of item?.extra || []) {
    const text = String(part || '').trim();
    if (!text) continue;

    if (/^note:/i.test(text)) {
      const noteBody = text.replace(/^note:\s*/i, '').trim();
      const noteSource = sourceFromNote(noteBody);
      if (noteSource && normalizeCompanyName(noteSource) === normalizeCompanyName(source)) {
        const remainder = noteBody.replace(/(^|[;|,\-\u2014\u2013]\s*)source:\s*[^;|]+/i, '').trim();
        if (remainder) extras.push(`note: ${remainder}`);
        continue;
      }
    }

    extras.push(text);
  }

  return extras.join(' | ');
}

function renderFlagsCell(item) {
  const flags = [];
  const priorApplied = priorAppliedStatusFor(item.company);
  if (priorApplied) {
    flags.push(`<span class="chip prior-applied-chip">Applied: ${escapeHtml(priorApplied)}</span>`);
  }
  if (!flags.length) return '<span class="muted-cell">-</span>';
  return `<div class="flags-cell">${flags.join(' ')}</div>`;
}

function formatAddedAt(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const datePart = parsed.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timePart = parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} ${timePart}`;
}

function sortPipelineItems(items) {
  const key = pipelineState.sortKey || 'company';
  const dir = pipelineState.sortDir === 'desc' ? -1 : 1;
  return [...(items || [])].sort((a, b) => {
    const av = sortValueForItem(a, key);
    const bv = sortValueForItem(b, key);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function sortValueForItem(item, key) {
  switch (key) {
    case 'source':
      return inferSource(item).toLowerCase();
    case 'added':
      return String(item.addedAt || '').toLowerCase();
    case 'company':
      return String(item.company || '').toLowerCase();
    case 'role':
      return String(item.role || '').toLowerCase();
    case 'employmentType':
      return String(item.employmentType || inferEmploymentType(item)).toLowerCase();
    case 'location':
      return displayPipelineLocation(item).toLowerCase();
    case 'posted':
      return displayPipelinePosted(item).toLowerCase();
    case 'flags':
      return priorAppliedStatusFor(item.company) ? '0' : '1';
    default:
      return String(item.company || '').toLowerCase();
  }
}

function togglePipelineSort(sortKey) {
  if (pipelineState.sortKey === sortKey) {
    pipelineState.sortDir = pipelineState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    pipelineState.sortKey = sortKey;
    pipelineState.sortDir = 'asc';
  }
  renderPipeline();
}

function updateSortIndicators() {
  if (!pendingTable) return;
  pendingTable.querySelectorAll('button[data-sort-key]').forEach((btn) => {
    const key = btn.dataset.sortKey || '';
    if (!btn.dataset.baseLabel) btn.dataset.baseLabel = btn.textContent.trim();
    const active = key === pipelineState.sortKey;
    const arrow = active ? (pipelineState.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    btn.textContent = `${btn.dataset.baseLabel}${arrow}`;
    btn.setAttribute('aria-sort', active ? (pipelineState.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

function normalizeCompanyName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh|plc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function priorAppliedStatusFor(company) {
  const key = normalizeCompanyName(company || '');
  if (!key) return '';
  const rec = pipelineState.priorAppliedByCompany[key];
  return typeof rec === 'string' ? rec : String(rec?.status || '');
}

function sourceFromNote(noteText) {
  const note = String(noteText || '');
  const match = note.match(/source:\s*([^;|]+)/i);
  if (match && match[1] && match[1].trim()) return match[1].trim();
  return '';
}

function sourceClassSlug(source) {
  const key = String(source || '').toLowerCase();
  if (key === 'linkedin') return 'source-linkedin';
  if (key === 'fractionaljobs') return 'source-fractionaljobs';
  if (key === 'ashby') return 'source-ashby';
  if (key === 'builtin') return 'source-builtin';
  if (key === 'greenhouse') return 'source-greenhouse';
  if (key === 'workday') return 'source-workday';
  return 'source-generic';
}

function sourceBadgeGlyph(source) {
  const map = {
    LinkedIn: '◍',
    FractionalJobs: '✦',
    Ashby: '◈',
    BuiltIn: '⌂',
    Greenhouse: '❋',
    Workday: '◔',
    Glassdoor: '◍',
    Lever: '⟲',
  };
  return map[source] || '•';
}

function sourceBadgeLabel(source) {
  const map = {
    LinkedIn: 'LinkedIn source',
    FractionalJobs: 'FractionalJobs source',
    Ashby: 'Ashby source',
    BuiltIn: 'BuiltIn source',
    Greenhouse: 'Greenhouse source',
    Workday: 'Workday source',
    Glassdoor: 'Glassdoor source',
    Lever: 'Lever source',
  };
  return map[source] || `${source || 'Generic'} source`;
}

function initWhimsy() {
  initTitleEasterEgg();
  startHintRotation();
  startTaglineRotation();
  initThemePicker();
  renderDailyFortune();
}

function startTaglineRotation() {
  if (!brandTagline) return;
  if (whimsyState.taglineTimer) clearInterval(whimsyState.taglineTimer);
  whimsyState.taglineTimer = window.setInterval(() => {
    whimsyState.taglineIndex = (whimsyState.taglineIndex + 1) % taglinePool.length;
    brandTagline.classList.remove('is-revealed');
    window.setTimeout(() => {
      if (!brandTagline) return;
      brandTagline.textContent = taglinePool[whimsyState.taglineIndex];
      brandTagline.classList.add('is-revealed');
    }, 140);
  }, 8200);
}

function initThemePicker() {
  const saved = localStorage.getItem('careerops.theme') || 'calm';
  applyTheme(saved);
  themeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = String(btn.dataset.theme || 'calm');
      applyTheme(theme);
      localStorage.setItem('careerops.theme', theme);
    });
  });
}

function applyTheme(theme) {
  const allowed = new Set(['calm', 'gremlin', 'turbo']);
  const next = allowed.has(theme) ? theme : 'calm';
  whimsyState.activeTheme = next;
  document.body.classList.remove('theme-calm', 'theme-gremlin', 'theme-turbo');
  document.body.classList.add(`theme-${next}`);
  themeButtons.forEach((btn) => {
    const active = btn.dataset.theme === next;
    btn.classList.toggle('active', active);
  });
  startHintRotation();
}

function initTitleEasterEgg() {
  if (!dashboardTitle) return;
  dashboardTitle.addEventListener('click', () => {
    const now = Date.now();
    whimsyState.titleClicks = [...whimsyState.titleClicks, now].filter((t) => now - t <= 5200);
    if (whimsyState.titleClicks.length >= 5) {
      whimsyState.titleClicks = [];
      triggerChaosMode();
    }
  });
}

function triggerChaosMode() {
  document.body.classList.add('chaos-polish');
  spawnConfettiDots(16);
  window.setTimeout(() => {
    document.body.classList.remove('chaos-polish');
    document.querySelectorAll('.confetti-dot').forEach((el) => el.remove());
  }, 3200);
}

function spawnConfettiDots(count) {
  for (let i = 0; i < count; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'confetti-dot';
    dot.style.setProperty('--x', `${Math.random() * 100}%`);
    dot.style.setProperty('--drift', `${(Math.random() * 28 - 14).toFixed(1)}px`);
    dot.style.setProperty('--delay', `${(Math.random() * 260).toFixed(0)}ms`);
    dot.style.setProperty('--dur', `${(1800 + Math.random() * 1400).toFixed(0)}ms`);
    dot.style.setProperty('--hue', `${Math.floor(Math.random() * 360)}`);
    document.body.appendChild(dot);
  }
}

function startHintRotation() {
  if (whimsyState.hintTimer) clearInterval(whimsyState.hintTimer);
  const intervalMs = whimsyState.activeTheme === 'turbo' ? 4800 : whimsyState.activeTheme === 'gremlin' ? 7200 : 9000;
  whimsyState.hintTimer = window.setInterval(() => {
    pipelineState.hintIndex = (pipelineState.hintIndex + 1) % 7;
    renderGoblinHint(applyPipelineFilters(pipelineState.pending), summarizeExclusions(pipelineState.pending));
  }, intervalMs);
}

function renderGoblinHint(filteredPending, exclusionSummary) {
  if (!goblinHint) return;
  const hints = buildGoblinHints(filteredPending, exclusionSummary);
  if (!hints.length) {
    goblinHint.textContent = '';
    goblinHint.classList.remove('is-visible');
    return;
  }
  const hint = hints[pipelineState.hintIndex % hints.length];
  goblinHint.textContent = `Goblin hint: ${hint}`;
  goblinHint.classList.add('is-visible');
}

function buildGoblinHints(filteredPending, exclusionSummary) {
  const totalPending = filteredPending.length;
  const excluded = Number(exclusionSummary?.totalHidden || 0);
  const fractionalCount = filteredPending.filter((item) => inferEmploymentType(item) === 'fractional').length;
  const fullTimeCount = filteredPending.filter((item) => inferEmploymentType(item) === 'full-time').length;
  const topSource = Object.entries(summarizeSources(filteredPending)).sort((a, b) => b[1] - a[1])[0];
  const hints = [];

  hints.push(`You have ${totalPending} spells left in the queue. Start with your top 3.`);
  if (topSource) hints.push(`Most leads are coming from ${topSource[0]} (${topSource[1]}). Maybe tune that source filter.`);
  if (excluded > 0) hints.push(`${excluded} roles are auto-hidden by fit rules. Peek at the rules before scanning again.`);
  if (fractionalCount > fullTimeCount) hints.push('Fractional opportunities are dominating. Confirm that your target mix still matches your goals.');
  if (fullTimeCount > 0) hints.push('Full-time lane is active. Sort by Added to process the freshest roles first.');
  if (pipelineFilters.source !== 'all' || pipelineFilters.type !== 'all') hints.push('Filters are active. Clear them if the queue looks suspiciously tiny.');
  hints.push('Tap the dashboard title five times if you need morale and confetti.');

  return hints;
}

function updateWhimsyMeter(filteredPending, exclusionSummary) {
  if (!whimsyMeter || !whimsyMeterFill || !whimsyMeterText) return;
  const processed = pipelineState.processed.length;
  const hidden = Number(exclusionSummary?.totalHidden || 0);
  const score = estimateChaosLevel(filteredPending.length, processed, hidden);
  const moods = [
    { max: 20, text: 'Calm spreadsheet energy' },
    { max: 45, text: 'Focused triage momentum' },
    { max: 70, text: 'Gremlin mode engaged' },
    { max: 100, text: 'Maximum whimsy turbulence' },
  ];
  const mood = moods.find((m) => score <= m.max) || moods[moods.length - 1];

  whimsyMeter.style.setProperty('--meter-score', String(score));
  whimsyMeterFill.style.width = `${score}%`;
  whimsyMeterText.textContent = `${score}% - ${mood.text}`;
  updateMascotMood(score);
}

function updateMascotMood(score) {
  if (!mascot) return;
  const mood = score <= 24 ? 'calm' : score <= 52 ? 'focused' : score <= 78 ? 'gremlin' : 'turbo';
  if (whimsyState.lastMood === mood) return;
  whimsyState.lastMood = mood;
  mascot.classList.remove('mood-calm', 'mood-focused', 'mood-gremlin', 'mood-turbo');
  mascot.classList.add(`mood-${mood}`);
}

function renderDailyFortune() {
  if (!goblinFortune) return;
  const fortunes = [
    'Fortune: The recruiter who ghosts you was not the one.',
    'Fortune: Following up is not desperate. Silence is.',
    'Fortune: A 4.5 fit score is not a hunch — it is a green light.',
    'Fortune: Reject before you are rejected. Your pipeline will thank you.',
    'Fortune: The ATS does not hate you. It hates your formatting.',
    'Fortune: One tailored application opens more doors than ten copy-pasted ones.',
    'Fortune: The role asking for 10 years of 2-year-old tech is a test. Fail it.',
    'Fortune: Your future interviewer wants stories, not job descriptions.',
    'Fortune: The company with no salary range has a number. It will disappoint you.',
    'Fortune: Process three leads today. Future-you will be smug about it.',
    'Fortune: Specificity is the enemy of ghosting.',
    'Fortune: The pipeline that moves is the pipeline that wins.',
  ];
  const key = new Date().toISOString().slice(0, 10);
  const idx = hashString(key) % fortunes.length;
  goblinFortune.textContent = fortunes[idx];
}

function hashString(value) {
  let h = 2166136261;
  for (const ch of String(value || '')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function estimateChaosLevel(pendingCount, processedCount, hiddenCount) {
  const pendingComponent = Math.min(70, pendingCount * 0.65);
  const processedRelief = Math.min(24, processedCount * 0.18);
  const hiddenTurbulence = Math.min(18, hiddenCount * 0.33);
  const raw = 22 + pendingComponent + hiddenTurbulence - processedRelief;
  return Math.max(6, Math.min(100, Math.round(raw)));
}

function inferSource(item) {
  const direct = String(item?.source || '').trim();
  if (direct && direct.toLowerCase() !== 'unknown') return normalizePipelineSourceLabel(direct, item);

  const fromNote = sourceFromNote(item?.note || '');
  if (fromNote) return normalizePipelineSourceLabel(fromNote, item);

  const host = hostFromUrl(item?.url || '');
  if (!host) return 'Unknown source';
  return normalizePipelineSourceLabel(host, item);
}

function normalizePipelineSourceLabel(source, item = {}) {
  const raw = String(source || '').trim();
  if (!raw) return 'Unknown source';

  const company = normalizeCompanyName(item?.company || '');
  const host = hostFromUrl(raw) || raw.toLowerCase().replace(/^www\./, '');

  if (host === 'form.jotform.com' || host.endsWith('.jotform.com') || host === 'jotform.com') {
    if (company === 'builtin') return 'BuiltIn';
  }

  if (host.endsWith('linkedin.com')) return 'LinkedIn';
  if (host.endsWith('glassdoor.com')) return 'Glassdoor';
  if (host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io') return 'FractionalJobs';
  if (host === 'builtin.com' || host === 'www.builtin.com') return 'BuiltIn';
  if (host === 'adzuna.com' || host === 'www.adzuna.com') return 'Adzuna';
  if (host.endsWith('ashbyhq.com')) return 'Ashby';
  if (host.includes('greenhouse.io')) return 'Greenhouse';
  if (host.includes('lever.co')) return 'Lever';
  if (host.includes('workdayjobs.com') || host.includes('myworkdayjobs.com')) return 'Workday';
  if (host.endsWith('lensa.com')) return 'Lensa';
  if (host.endsWith('substack.com')) return 'Substack';
  if (host.endsWith('beehiiv.com')) return 'Beehiiv';

  return raw;
}

function segmentPending(items) {
  const grouped = { fractional: [], fullTime: [] };
  for (const item of items) {
    const t = inferEmploymentType(item);
    if (t === 'fractional') grouped.fractional.push(item);
    else grouped.fullTime.push(item);
  }
  return grouped;
}

function inferEmploymentType(item) {
  const haystack = `${item.url || ''} ${item.company || ''} ${item.role || ''} ${item.location || ''} ${(item.extra || []).join(' ')}`.toLowerCase();
  const host = hostFromUrl(item.url || '');
  const path = pathFromUrl(item.url || '');
  const fractionalSignals = ['fractional', 'contract', 'contractor', 'consultant', 'consulting', 'interim', 'part-time', 'part time', 'hourly', 'freelance'];
  if (host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io' || fractionalSignals.some((s) => haystack.includes(s))) return 'fractional';
  const fullTimeSignals = ['full-time', 'full time', 'permanent', 'fte'];
  if (fullTimeSignals.some((s) => haystack.includes(s))) return 'full-time';

  if (looksLikeFullTimeByHost(host, path)) return 'full-time';

  return 'full-time';
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function pathFromUrl(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

function looksLikeFullTimeByHost(host, path) {
  if (!host) return false;

  if (host.endsWith('linkedin.com') && path.startsWith('/comm/jobs/view/')) return true;
  if (host.endsWith('glassdoor.com') && (path.startsWith('/partner/joblisting.htm') || path.startsWith('/job/'))) return true;

  const fullTimeHosts = new Set([
    'builtin.com',
    'www.builtin.com',
    'adzuna.com',
    'www.adzuna.com',
    'jobs.ashbyhq.com',
    'solid.jobs',
  ]);
  if (fullTimeHosts.has(host)) return true;

  if (
    host.includes('greenhouse.io') ||
    host.includes('lever.co') ||
    host.includes('workdayjobs.com') ||
    host.includes('myworkdayjobs.com') ||
    host.includes('smartrecruiters.com') ||
    host.includes('jobvite.com') ||
    host.includes('icims.com')
  ) return true;

  return false;
}

function renderChip(container, text, options = {}) {
  const { clickable = false, active = false, onClick } = options;
  const chip = document.createElement('span');
  chip.className = `chip${clickable ? ' clickable' : ''}${active ? ' active' : ''}`;
  chip.textContent = text;
  if (clickable && typeof onClick === 'function') {
    chip.setAttribute('role', 'button');
    chip.tabIndex = 0;
    chip.addEventListener('click', onClick);
    chip.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        onClick();
      }
    });
  }
  container.appendChild(chip);
}

function renderMetric(container, text) {
  const metric = document.createElement('span');
  metric.className = 'summary-metric';
  metric.textContent = text;
  container.appendChild(metric);
}

function makePipelineActionButton(label, rawItem, action, extraClass = '') {
  const btn = document.createElement('button');
  btn.className = `secondary ${extraClass}`.trim();
  btn.textContent = label;
  btn.addEventListener('click', async () => {
    try {
      let resumeNote = '';
      if (action === 'applied') {
        const picked = await pickResume();
        if (picked === null) return; // cancelled
        resumeNote = picked;
      }
      const row = btn.closest('tr');
      row?.classList.add('is-celebrating');
      await api('/api/pipeline/process', {
        method: 'POST',
        body: JSON.stringify({ item: rawItem, action, resumeNote }),
      });
      celebratePipelineAction(label, action);
      await loadPipeline();
      if (action === 'applied') await loadTracker();
    } catch (err) {
      window.alert(formatActionError('Action failed', err));
    }
  });
  return btn;
}

function celebratePipelineAction(label, action) {
  if (!toastRack) return;
  const msg = action === 'applied' ? `Spell cast: marked ${label}.` : action === 'remove' ? `Banished from queue.` : `${label} complete.`;
  const toast = document.createElement('div');
  toast.className = `toast toast-${action}`;
  toast.textContent = msg;
  toastRack.appendChild(toast);
  window.setTimeout(() => toast.classList.add('is-visible'), 10);
  window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  window.setTimeout(() => toast.remove(), 3200);
}

function makeEvaluateButton(item) {
  const btn = document.createElement('button');
  btn.className = 'secondary action-evaluate';
  btn.textContent = 'Evaluate';
  btn.title = 'Run AI evaluation on this posting';
  btn.addEventListener('click', () => {
    setActiveTab('evaluate');
    const urlInput = document.getElementById('evaluateUrl');
    if (urlInput) urlInput.value = item.url || '';
    runEvaluation(item.url);
  });
  return btn;
}

function makeRejectActionButton(item) {
  const btn = document.createElement('button');
  btn.className = 'secondary action-reject';
  btn.textContent = 'Reject';
  btn.addEventListener('click', async () => {
    const rule = await promptRejectRule(item);
    if (!rule) return;

    try {
      await api('/api/pipeline/process', {
        method: 'POST',
        body: JSON.stringify({ item: item.raw, action: 'reject', rejectRule: rule }),
      });
      const refresh = await Promise.allSettled([loadPipeline(), loadFitFilters()]);
      const failedRefresh = refresh.find((r) => r.status === 'rejected');
      if (failedRefresh && failedRefresh.status === 'rejected') {
        window.alert(formatActionError('Rejected, but refresh failed', failedRefresh.reason));
      }
    } catch (err) {
      window.alert(formatActionError('Reject failed', err));
    }
  });
  return btn;
}

function ensureRejectReasonSelect() {
  if (!rejectReasonSelect || rejectReasonSelect.options.length > 0) return;
  rejectReasons.forEach((r) => {
    const option = document.createElement('option');
    option.value = r.id;
    option.textContent = r.label;
    rejectReasonSelect.appendChild(option);
  });
}

function getDefaultRejectScope(reasonId) {
  if (reasonId === 'company-stage') return { company: true, source: false, type: false };
  if (reasonId === 'source-quality') return { company: false, source: true, type: false };
  if (reasonId === 'employment-type-mismatch') return { company: false, source: false, type: true };
  if (reasonId === 'location-mismatch') return { company: false, source: false, type: false };
  if (reasonId === 'timing-mismatch') return { company: true, source: false, type: false };
  if (reasonId === 'previously-applied') return { company: true, source: false, type: false };
  return { company: false, source: false, type: false };
}

function applyRejectDefaults(item) {
  const reasonId = rejectReasonSelect?.value || rejectReasons[0].id;
  const reason = rejectReasons.find((r) => r.id === reasonId) || rejectReasons[0];
  const defaults = getDefaultRejectScope(reasonId);

  if (rejectReasonHelp) rejectReasonHelp.textContent = reason.help;
  if (rejectCompanyChk) rejectCompanyChk.checked = defaults.company;
  if (rejectSourceChk) rejectSourceChk.checked = defaults.source;
  if (rejectTypeChk) rejectTypeChk.checked = defaults.type;
  if (rejectRoleKeywords) rejectRoleKeywords.value = suggestRoleKeywords(reasonId, item).join(', ');
  if (rejectLocationKeywords) rejectLocationKeywords.value = suggestLocationKeywords(reasonId, item).join(', ');
}

function suggestRoleKeywords(reasonId, item) {
  const role = String(item?.role || '').trim();
  if (!role) return [];
  if (reasonId === 'skills-mismatch' || reasonId === 'domain-mismatch' || reasonId === 'seniority-mismatch') {
    return role
      .split(/[^a-zA-Z0-9+.#-]+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 4)
      .slice(0, 3);
  }
  return [];
}

function suggestLocationKeywords(reasonId, item) {
  if (reasonId !== 'location-mismatch') return [];
  const location = String(item?.location || '').trim().toLowerCase();
  if (!location) return [];
  return location
    .split(/[^a-zA-Z0-9-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 3);
}

function parseCsvKeywords(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function uniqueKeywords(values) {
  return [...new Set((values || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))].slice(0, 8);
}

function buildReasonFallbackRule(item, reasonId) {
  const company = String(item?.company || '').trim();
  const source = inferSource(item);
  const employmentType = item.employmentType || inferEmploymentType(item);
  const roleKeywords = suggestRoleKeywords(reasonId, item);
  const locationKeywords = suggestLocationKeywords(reasonId, item);

  if (reasonId === 'company-stage' || reasonId === 'timing-mismatch' || reasonId === 'previously-applied') {
    return { company };
  }
  if (reasonId === 'source-quality') {
    return { source };
  }
  if (reasonId === 'employment-type-mismatch') {
    return { employmentType };
  }
  if (reasonId === 'location-mismatch') {
    if (locationKeywords.length) return { locationKeywords };
    return { company };
  }

  if (roleKeywords.length) return { roleKeywords };
  return { company };
}

function hasAnyRuleScope(rule) {
  return Boolean(
    rule.company || rule.source || rule.employmentType || (rule.roleKeywords || []).length || (rule.locationKeywords || []).length,
  );
}

function withReasonFallbackRule(item, reasonId, rule) {
  const base = {
    company: String(rule.company || '').trim(),
    source: String(rule.source || '').trim(),
    employmentType: String(rule.employmentType || '').trim(),
    roleKeywords: uniqueKeywords(rule.roleKeywords || []),
    locationKeywords: uniqueKeywords(rule.locationKeywords || []),
  };

  if (hasAnyRuleScope(base)) {
    const hasKeywordsOnly =
      !base.company &&
      !base.source &&
      !base.employmentType &&
      ((base.roleKeywords && base.roleKeywords.length > 0) || (base.locationKeywords && base.locationKeywords.length > 0));

    if (hasKeywordsOnly) {
      base.source = inferSource(item);
      base.employmentType = item.employmentType || inferEmploymentType(item);
    }

    return base;
  }

  const fallback = buildReasonFallbackRule(item, reasonId);
  return {
    company: String(fallback.company || '').trim(),
    source: String(fallback.source || '').trim(),
    employmentType: String(fallback.employmentType || '').trim(),
    roleKeywords: uniqueKeywords(fallback.roleKeywords || []),
    locationKeywords: uniqueKeywords(fallback.locationKeywords || []),
  };
}

function promptRejectRule(item) {
  if (!rejectModal || !rejectForm || !rejectReasonSelect) {
    return Promise.resolve(null);
  }

  ensureRejectReasonSelect();
  rejectReasonSelect.value = rejectReasons[0].id;
  applyRejectDefaults(item);

  const onReasonChange = () => applyRejectDefaults(item);
  rejectReasonSelect.addEventListener('change', onReasonChange);

  return new Promise((resolve) => {
    const cleanup = () => {
      rejectReasonSelect.removeEventListener('change', onReasonChange);
      rejectForm.removeEventListener('submit', onSubmit);
      rejectCancelBtn?.removeEventListener('click', onCancel);
      rejectModal.removeEventListener('cancel', onCancel);
      if (rejectModal.open) rejectModal.close();
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onSubmit = (ev) => {
      ev.preventDefault();
      const reasonId = rejectReasonSelect.value;
      const reason = rejectReasons.find((r) => r.id === reasonId) || rejectReasons[0];

      const rule = withReasonFallbackRule(item, reasonId, {
        reasonId: reason.id,
        reasonLabel: reason.label,
        company: rejectCompanyChk?.checked ? (item.company || '') : '',
        source: rejectSourceChk?.checked ? inferSource(item) : '',
        employmentType: rejectTypeChk?.checked ? (item.employmentType || inferEmploymentType(item)) : '',
        roleKeywords: parseCsvKeywords(rejectRoleKeywords?.value || ''),
        locationKeywords: parseCsvKeywords(rejectLocationKeywords?.value || ''),
      });

      rule.reasonId = reason.id;
      rule.reasonLabel = reason.label;

      cleanup();
      resolve(rule);
    };

    rejectForm.addEventListener('submit', onSubmit);
    rejectCancelBtn?.addEventListener('click', onCancel);
    rejectModal.addEventListener('cancel', onCancel);
    rejectModal.showModal();
  });
}

function formatRuleChipText(rule) {
  // Always use the current label from rejectReasons so renamed reasons reflect immediately
  const currentReason = rejectReasons.find((r) => r.id === rule.reasonId);
  const currentLabel = currentReason?.label || rule.reasonLabel;

  if (rule.reasonId === 'previously-applied') {
    const bits = [currentLabel];
    if (rule.company) bits.push(`company=${rule.company}`);
    if (rule.source) bits.push(`source=${rule.source}`);
    if (rule.employmentType) bits.push(`type=${rule.employmentType}`);
    return bits.join(' | ');
  }

  const bits = [currentLabel || 'Rule'];
  if (rule.company) bits.push(`company=${rule.company}`);
  if (rule.source) bits.push(`source=${rule.source}`);
  if (rule.employmentType) bits.push(`type=${rule.employmentType}`);
  if (Array.isArray(rule.roleKeywords) && rule.roleKeywords.length) bits.push(`role~${rule.roleKeywords.join('/')}`);
  if (Array.isArray(rule.locationKeywords) && rule.locationKeywords.length) bits.push(`location~${rule.locationKeywords.join('/')}`);
  return bits.join(' | ');
}

async function runScan() {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Running...';
  try {
    const data = await api('/api/scan', { method: 'POST' });
    statusOutput.textContent = data.stdout || data.stderr || 'Scan finished.';
    await loadPipeline();
  } catch (err) {
    statusOutput.textContent = String(err.message || err);
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Run Scan';
  }
}

async function submitStatus(ev) {
  ev.preventDefault();
  const selector = document.getElementById('selectorInput').value.trim();
  const state = stateSelect.value;
  const note = document.getElementById('noteInput').value.trim();
  if (!selector || !state) return;

  const data = await api('/api/status', {
    method: 'POST',
    body: JSON.stringify({ selector, state, note }),
  });
  statusOutput.textContent = data.stdout || data.stderr || 'Updated.';
  await loadTracker();
}

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      headers: { 'content-type': 'application/json' },
      ...options,
    });
  } catch (err) {
    throw new Error(formatActionError('Request failed', err));
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error((json && (json.error || json.stderr)) || `Request failed (${res.status})`);
  }
  return json || {};
}

function formatActionError(prefix, err) {
  const msg = String(err?.message || err || '').trim();
  if (/failed to fetch/i.test(msg)) {
    return `${prefix}: network error while contacting the dashboard server.`;
  }
  return `${prefix}: ${msg || 'Unknown error'}`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(s) {
  return String(s ?? '').replaceAll('"', '%22');
}

// ─── Analytics ────────────────────────────────────────────────────────────────

const FUNNEL_ORDER = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP'];
const FUNNEL_COLORS = {
  Evaluated: '#0b7285', Applied: '#2b8a3e', Responded: '#1971c2',
  Interview: '#6741d9', Offer: '#f08c00', Hired: '#2f9e44',
  Rejected: '#c92a2a', Discarded: '#868e96', SKIP: '#495057',
};

function renderAnalytics() {
  const rows = (window._trackerRows || []);
  renderFunnelChart(rows);
  renderScoreChart(rows);
  renderTopCompanies(rows);
}

function renderFunnelChart(rows) {
  const el = document.getElementById('funnelChart');
  if (!el) return;
  const counts = {};
  for (const r of rows) {
    const s = String(r.status || '').trim();
    if (s) counts[s] = (counts[s] || 0) + 1;
  }
  const stages = FUNNEL_ORDER.filter((s) => counts[s] > 0);
  if (!stages.length) { el.innerHTML = '<p class="chart-empty">No tracker data yet.</p>'; return; }
  const max = Math.max(...stages.map((s) => counts[s]));
  el.innerHTML = buildBarChart(stages.map((s) => ({ label: s, value: counts[s], color: FUNNEL_COLORS[s] || '#0b7285' })), max, 'Applications by Stage');
}

function renderScoreChart(rows) {
  const el = document.getElementById('scoreChart');
  if (!el) return;
  const buckets = { '4.5 – 5.0': 0, '4.0 – 4.4': 0, '3.0 – 3.9': 0, '< 3.0': 0 };
  for (const r of rows) {
    const n = parseFloat(String(r.score || '').replace('/5', ''));
    if (!isFinite(n)) continue;
    if (n >= 4.5) buckets['4.5 – 5.0']++;
    else if (n >= 4.0) buckets['4.0 – 4.4']++;
    else if (n >= 3.0) buckets['3.0 – 3.9']++;
    else buckets['< 3.0']++;
  }
  const scoreColors = { '4.5 – 5.0': '#2b8a3e', '4.0 – 4.4': '#1971c2', '3.0 – 3.9': '#f08c00', '< 3.0': '#c92a2a' };
  const items = Object.entries(buckets).filter(([, v]) => v > 0).map(([k, v]) => ({ label: k, value: v, color: scoreColors[k] }));
  if (!items.length) { el.innerHTML = '<p class="chart-empty">No scored evaluations yet.</p>'; return; }
  el.innerHTML = buildBarChart(items, Math.max(...items.map((i) => i.value)), 'Roles by Score Bucket');
}

function renderTopCompanies(rows) {
  const el = document.getElementById('topCompaniesChart');
  if (!el) return;
  const byCompany = {};
  for (const r of rows) {
    const company = String(r.company || '').trim();
    const n = parseFloat(String(r.score || '').replace('/5', ''));
    if (!company || !isFinite(n)) continue;
    if (!byCompany[company] || n > byCompany[company]) byCompany[company] = n;
  }
  const sorted = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!sorted.length) { el.innerHTML = '<p class="chart-empty">No scored companies yet.</p>'; return; }
  el.innerHTML = buildBarChart(
    sorted.map(([company, score]) => ({ label: company, value: score, color: score >= 4.5 ? '#2b8a3e' : score >= 4.0 ? '#1971c2' : score >= 3.0 ? '#f08c00' : '#c92a2a' })),
    5,
    'Top Companies (best score)',
    true,
  );
}

function buildBarChart(items, max, title, showValue = false) {
  const W = 560, BAR_H = 28, GAP = 8, LABEL_W = 160, PAD = 16;
  const H = items.length * (BAR_H + GAP) + PAD * 2;
  const barMax = W - LABEL_W - PAD * 2 - 50;
  let rows = '';
  items.forEach((item, i) => {
    const y = PAD + i * (BAR_H + GAP);
    const bw = max > 0 ? Math.max(4, Math.round((item.value / max) * barMax)) : 4;
    const label = escapeHtml(String(item.label).length > 22 ? String(item.label).slice(0, 21) + '…' : item.label);
    const valueText = showValue ? item.value.toFixed(1) : String(item.value);
    rows += `
      <text x="${LABEL_W}" y="${y + BAR_H * 0.68}" class="chart-label" text-anchor="end">${label}</text>
      <rect x="${LABEL_W + 8}" y="${y + 2}" width="${bw}" height="${BAR_H - 4}" rx="4" fill="${item.color}" opacity="0.85" />
      <text x="${LABEL_W + 8 + bw + 6}" y="${y + BAR_H * 0.68}" class="chart-value">${valueText}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="bar-chart" aria-label="${escapeAttr(title)}">
    <style>.chart-label{font:13px system-ui,sans-serif;fill:var(--ink)}.chart-value{font:12px system-ui,sans-serif;fill:var(--muted)}</style>
    ${rows}
  </svg>`;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

let reportsLoaded = false;

async function loadReports() {
  if (reportsLoaded) return;
  const el = document.getElementById('reportsList');
  if (!el) return;
  el.innerHTML = '<p class="chart-empty">Loading…</p>';
  try {
    const data = await api('/api/reports');
    const reports = Array.isArray(data.reports) ? data.reports : [];
    reportsLoaded = true;
    if (!reports.length) { el.innerHTML = '<p class="chart-empty">No reports found.</p>'; return; }
    el.innerHTML = reports.map((r) => `
      <button class="report-list-item" type="button" data-slug="${escapeAttr(r.filename)}">
        <span class="report-num">#${escapeHtml(r.num)}</span>
        <span class="report-meta">
          <span class="report-company">${escapeHtml(r.company || r.slug)}</span>
          <span class="report-role">${escapeHtml(r.role)}</span>
        </span>
        <span class="report-score ${scoreClass(r.score)}">${escapeHtml(r.score || '—')}</span>
        <span class="report-date">${escapeHtml(r.date)}</span>
      </button>`).join('');
    el.querySelectorAll('.report-list-item').forEach((btn) => {
      btn.addEventListener('click', () => openReport(btn.dataset.slug, btn));
    });
  } catch (err) {
    el.innerHTML = `<p class="chart-empty">Error: ${escapeHtml(String(err.message))}</p>`;
  }
}

async function openReport(slug, activeBtn) {
  document.querySelectorAll('.report-list-item').forEach((b) => b.classList.remove('is-active'));
  activeBtn?.classList.add('is-active');
  const viewer = document.getElementById('reportsViewer');
  if (!viewer) return;
  viewer.innerHTML = '<p class="chart-empty">Loading…</p>';
  try {
    const data = await api(`/api/reports/${encodeURIComponent(slug)}`);
    const md = data.content || '';
    viewer.innerHTML = `<div class="md-body">${typeof marked !== 'undefined' ? marked.parse(md) : `<pre>${escapeHtml(md)}</pre>`}</div>`;
  } catch (err) {
    viewer.innerHTML = `<p class="chart-empty">Error: ${escapeHtml(String(err.message))}</p>`;
  }
}

function scoreClass(score) {
  const n = parseFloat(String(score || '').replace('/5', ''));
  if (!isFinite(n)) return '';
  if (n >= 4.5) return 'score-high';
  if (n >= 4.0) return 'score-mid';
  if (n >= 3.0) return 'score-low';
  return 'score-skip';
}

// ─── Evaluate ─────────────────────────────────────────────────────────────────

const evaluateForm = document.getElementById('evaluateForm');
const evaluateBtn = document.getElementById('evaluateBtn');
const evaluateOutput = document.getElementById('evaluateOutput');
const evaluateVerdict = document.getElementById('evaluateVerdict');

evaluateForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const url = document.getElementById('evaluateUrl')?.value?.trim();
  if (!url) return;
  await runEvaluation(url);
});

async function runEvaluation(url) {
  if (evaluateOutput) evaluateOutput.textContent = '';
  if (evaluateVerdict) { evaluateVerdict.textContent = ''; evaluateVerdict.classList.add('is-hidden'); }
  if (evaluateBtn) { evaluateBtn.disabled = true; evaluateBtn.textContent = 'Running…'; }

  let fullText = '';
  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const events = sseBuffer.split('\n\n');
      sseBuffer = events.pop() || '';
      for (const block of events) {
        const lines = block.split('\n');
        let evtType = 'text', evtData = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) evtType = line.slice(7).trim();
          if (line.startsWith('data: ')) evtData = line.slice(6);
        }
        if (!evtData) continue;
        try {
          const payload = JSON.parse(evtData);
          if (evtType === 'text' && payload.text) {
            fullText += payload.text;
            if (evaluateOutput) {
              evaluateOutput.textContent = fullText;
              evaluateOutput.scrollTop = evaluateOutput.scrollHeight;
            }
          } else if (evtType === 'stderr' && payload.text) {
            // show stderr faintly appended
            if (evaluateOutput) evaluateOutput.textContent += `\n[stderr] ${payload.text}`;
          } else if (evtType === 'done') {
            const verdict = extractVerdict(fullText);
            if (verdict && evaluateVerdict) {
              evaluateVerdict.textContent = verdict;
              evaluateVerdict.classList.remove('is-hidden');
            }
            if (payload.code === 0) {
              showToast('Evaluation complete — report + tracker updated', 'success');
              reportsLoaded = false; // force reload on next visit
              loadTracker();
            } else {
              showToast(`Evaluation exited with code ${payload.code}`, 'error');
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }
  } catch (err) {
    if (evaluateOutput) evaluateOutput.textContent += `\n\nError: ${String(err.message || err)}`;
    showToast(`Evaluation failed: ${err.message}`, 'error');
  } finally {
    if (evaluateBtn) { evaluateBtn.disabled = false; evaluateBtn.textContent = 'Run Evaluation'; }
  }
}

function extractVerdict(text) {
  const m = String(text || '').match(/VERDICT:\s*(.+)/);
  return m ? `VERDICT: ${m[1].trim()}` : '';
}
