const THEME_STORAGE_KEY = 'careerops-theme';
const trackerBody = document.querySelector('#trackerTable tbody');
const trackerTable = document.getElementById('trackerTable');
const trackerSummary = document.getElementById('trackerSummary');
const trackerViewAllBtn = document.getElementById('trackerViewAllBtn');
const trackerViewActiveBtn = document.getElementById('trackerViewActiveBtn');
const trackerSearchInput = document.getElementById('trackerSearchInput');
const trackerFlagsFilterSelect = document.getElementById('trackerFlagsFilterSelect');
const trackerClearFiltersBtn = document.getElementById('trackerClearFiltersBtn');
const pipelineSearchInput = document.getElementById('pipelineSearchInput');
const pendingSummary = document.getElementById('pendingSummary');
const hiddenJobsCount = document.getElementById('hiddenJobsCount');
const pendingTable = document.getElementById('pendingTable');
const pendingTableBody = document.querySelector('#pendingTable tbody');
const opsChecklist = document.getElementById('opsChecklist');
const opsOutput = document.getElementById('opsOutput');
const baselineRefreshBtn = document.getElementById('baselineRefreshBtn');
const runVerifyPipelineBtn = document.getElementById('runVerifyPipelineBtn');
const runVerifyPortalsBtn = document.getElementById('runVerifyPortalsBtn');
const runStatsBtn = document.getElementById('runStatsBtn');
const startTabBtn = document.getElementById('startTabBtn');
const pipelineTabBtn = document.getElementById('pipelineTabBtn');
const manageTabBtn = document.getElementById('manageTabBtn');
const analyticsTabBtn = document.getElementById('analyticsTabBtn');
const reportsTabBtn = document.getElementById('reportsTabBtn');
const evaluateTabBtn = document.getElementById('evaluateTabBtn');
const reportsGeneratePdfBtn = document.getElementById('reportsGeneratePdfBtn');
const reportsDownloadResumeLink = document.getElementById('reportsDownloadResumeLink');
const reportsToolbarMeta = document.getElementById('reportsToolbarMeta');
const startPanel = document.getElementById('startPanel');
const pipelinePanel = document.getElementById('pipelinePanel');
const managePanel = document.getElementById('managePanel');
const analyticsPanel = document.getElementById('analyticsPanel');
const reportsPanel = document.getElementById('reportsPanel');
const evaluatePanel = document.getElementById('evaluatePanel');
const refreshBtn = document.getElementById('refreshBtn');
const scanBtn = document.getElementById('scanBtn');
const enrichPendingBtn = document.getElementById('enrichPendingBtn');
const profileTabBtn = document.getElementById('profileTabBtn');
const profilePanel = document.getElementById('profilePanel');
const dashboardTitle = document.getElementById('dashboardTitle');
const brandTagline = document.getElementById('brandTagline');
const toastRack = document.getElementById('toastRack');
const goblinHint = document.getElementById('goblinHint');
const stateSelect = document.getElementById('stateSelect');
const statusForm = document.getElementById('statusForm');
const statusOutput = document.getElementById('statusOutput');
const sourceFilterSelect = document.getElementById('sourceFilterSelect');
const typeFilterSelect = document.getElementById('typeFilterSelect');
const showHiddenToggle = document.getElementById('showHiddenToggle');
const showPriorAppliedToggle = document.getElementById('showPriorAppliedToggle');
const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
const rejectModal = document.getElementById('rejectModal');
const rejectForm = document.getElementById('rejectForm');
const rejectReasonSelect = document.getElementById('rejectReasonSelect');
const rejectReasonHelp = document.getElementById('rejectReasonHelp');
const rejectPreview = document.getElementById('rejectPreview');
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
  sortKey: 'added',
  sortDir: 'desc',
  query: '',
  hintIndex: 0,
  showHidden: false,
  showPriorApplied: false,
};

const trackerState = {
  sortKey: 'date',
  sortDir: 'desc',
  statusFilter: 'all', // 'all' | 'active' | an exact status string from the tracker (e.g. 'Rejected')
  availableStates: [], // populated by loadStates(); canonical labels from templates/states.yml
  query: '',
  flagsFilter: 'all', // 'all' | 'none' | an exact legitimacy tier (e.g. 'Suspicious')
};

// Manually re-running an evaluation to Evaluated is a real process (oferta/
// auto-pipeline), not a one-click row edit — the inline status dropdown
// offers every other canonical state but disables this one unless it's
// already the row's current value (so the current status still displays
// correctly for rows that haven't been touched yet).
const INLINE_STATUS_LOCKED = new Set(['Evaluated']);

// Applied/Responded/Interview/Offer — in-flight rows worth watching for a
// reply. Evaluated (not yet applied) and terminal states (Hired/Rejected/
// Discarded/SKIP) are excluded.
const ACTIVE_STATUSES = new Set(['applied', 'responded', 'interview', 'offer']);

const evaluateState = {
  jobs: [],
  selectedId: '',
  nextId: 1,
};

const reportsState = {
  items: [],
  selectedSlug: '',
  pdfRunning: false,
};

const whimsyState = {
  titleClicks: [],
  hintTimer: null,
  taglineTimer: null,
  taglineIndex: 0,
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
  { id: 'score-too-low', label: 'Score Too Low', help: 'Evaluated below your applying threshold — not a strong enough fit to pursue.' },
  { id: 'not-right-fit', label: 'Not the right fit', help: 'General fit issue that does not match a more specific reason below.' },
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
  { id: 'no-longer-accepting', label: 'No Longer Accepting Applications', help: 'The posting is closed. Not a fit signal, so no filter is taught by default.' },
  { id: 'other', label: 'Already Applied', help: 'Use custom company/source/type/keywords filters for this pattern.' },
];

const pipelineFilters = {
  source: "all",
  type: "all",
};

refreshBtn.addEventListener('click', loadAll);
scanBtn.addEventListener('click', runScan);
enrichPendingBtn?.addEventListener('click', runEnrichPending);
statusForm.addEventListener('submit', submitStatus);
startTabBtn?.addEventListener('click', () => setActiveTab('start'));
pipelineTabBtn?.addEventListener('click', () => setActiveTab('pipeline'));
manageTabBtn?.addEventListener('click', () => setActiveTab('manage'));
analyticsTabBtn?.addEventListener('click', () => setActiveTab('analytics'));
reportsTabBtn?.addEventListener('click', () => { setActiveTab('reports'); loadReports(); });
evaluateTabBtn?.addEventListener('click', () => setActiveTab('evaluate'));
profileTabBtn?.addEventListener('click', () => { setActiveTab('profile'); loadProfile(); });
baselineRefreshBtn?.addEventListener('click', loadOpsBaseline);
runVerifyPipelineBtn?.addEventListener('click', () => runOpsAction('verify-pipeline'));
runVerifyPortalsBtn?.addEventListener('click', () => runOpsAction('verify-portals'));
runStatsBtn?.addEventListener('click', () => runOpsAction('stats-summary'));
reportsGeneratePdfBtn?.addEventListener('click', generateSelectedReportPdf);
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
showHiddenToggle?.addEventListener('change', (ev) => {
  pipelineState.showHidden = Boolean(ev.target.checked);
  renderPipeline();
});
showPriorAppliedToggle?.addEventListener('change', (ev) => {
  pipelineState.showPriorApplied = Boolean(ev.target.checked);
  renderPipeline();
});
trackerSearchInput?.addEventListener('input', (ev) => {
  trackerState.query = String(ev.target.value || '').trim().toLowerCase();
  renderTrackerTable();
});
trackerFlagsFilterSelect?.addEventListener('change', (ev) => {
  trackerState.flagsFilter = String(ev.target.value || 'all');
  renderTrackerTable();
});
trackerClearFiltersBtn?.addEventListener('click', () => {
  trackerState.query = '';
  trackerState.flagsFilter = 'all';
  if (trackerSearchInput) trackerSearchInput.value = '';
  if (trackerFlagsFilterSelect) trackerFlagsFilterSelect.value = 'all';
  renderTrackerTable();
});
clearAllFiltersBtn?.addEventListener('click', () => {  pipelineFilters.source = 'all';
  pipelineFilters.type = 'all';
  pipelineState.query = '';
  pipelineState.showPriorApplied = false;
  if (pipelineSearchInput) pipelineSearchInput.value = '';
  if (showPriorAppliedToggle) showPriorAppliedToggle.checked = false;
  renderPipeline();
});
pendingTableBody?.addEventListener('click', (ev) => {
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;
  const reportFilename = target.dataset.reportFilename || target.closest('[data-report-filename]')?.dataset.reportFilename;
  if (reportFilename) {
    openReportFromPipeline(reportFilename);
    return;
  }
  const jumpId = target.dataset.evalOpen || target.closest('[data-eval-open]')?.dataset.evalOpen;
  if (!jumpId) return;
  const job = evaluateState.jobs.find((entry) => entry.id === jumpId);
  if (!job) return;
  evaluateState.selectedId = job.id;
  setActiveTab('evaluate');
  renderEvaluationJobs();
  renderEvaluationViewer();
});
pendingTableBody?.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;
  const reportFilename = target.dataset.reportFilename || target.closest('[data-report-filename]')?.dataset.reportFilename;
  if (!reportFilename) return;
  ev.preventDefault();
  openReportFromPipeline(reportFilename);
});
trackerBody?.addEventListener('click', (ev) => {
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;
  const reportFilename = target.dataset.reportFilename || target.closest('[data-report-filename]')?.dataset.reportFilename;
  if (!reportFilename) return;
  openReportFromPipeline(reportFilename);
});
trackerBody?.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;
  const reportFilename = target.dataset.reportFilename || target.closest('[data-report-filename]')?.dataset.reportFilename;
  if (!reportFilename) return;
  ev.preventDefault();
  openReportFromPipeline(reportFilename);
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
initSpendTierToggle();

function setActiveTab(tab) {
  const tabs = ['start', 'pipeline', 'manage', 'analytics', 'reports', 'evaluate', 'profile'];
  const btns = { start: startTabBtn, pipeline: pipelineTabBtn, manage: manageTabBtn, analytics: analyticsTabBtn, reports: reportsTabBtn, evaluate: evaluateTabBtn, profile: profileTabBtn };
  const panels = { start: startPanel, pipeline: pipelinePanel, manage: managePanel, analytics: analyticsPanel, reports: reportsPanel, evaluate: evaluatePanel, profile: profilePanel };
  for (const t of tabs) {
    const active = t === tab;
    btns[t]?.classList.toggle('active', active);
    btns[t]?.setAttribute('aria-selected', String(active));
    panels[t]?.classList.toggle('is-hidden', !active);
  }
  document.body.classList.toggle('tab-start', tab === 'start');
  document.body.classList.toggle('tab-pipeline', tab === 'pipeline');
  document.body.classList.toggle('tab-manage', tab === 'manage');
  document.body.classList.toggle('tab-analytics', tab === 'analytics');
  document.body.classList.toggle('tab-reports', tab === 'reports');
  document.body.classList.toggle('tab-evaluate', tab === 'evaluate');
  document.body.classList.toggle('tab-profile', tab === 'profile');
  if (tab === 'pipeline') renderPipeline();
  if (tab === 'analytics') renderAnalytics();
}

function showToast(message, type = 'success') {
  const text = String(message || '').trim();
  if (!text) return;
  if (!toastRack) {
    if (type === 'error') console.error(text);
    else console.log(text);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = text;
  toastRack.appendChild(toast);
  window.setTimeout(() => toast.classList.add('is-visible'), 10);
  window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  window.setTimeout(() => toast.remove(), 3400);
}

async function loadAll() {
  // fit-filter rules must be in place before pipeline renders, or exclusions
  // won't apply on first paint (they'd only apply on a *second* load, since
  // stale rules from a prior load happen to still be in memory by then).
  await loadFitFilters();
  // States load first: the tracker's inline per-row status dropdown needs
  // trackerState.availableStates populated before rows render, or the first
  // paint would offer only whatever status each row already has.
  await loadStates();
  await Promise.all([loadTracker(), loadPipeline(), loadOpsBaseline()]);
}

async function loadFitFilters() {
  const data = await api('/api/fit-filters');
  pipelineState.fitFilters = Array.isArray(data.rules) ? data.rules : [];
}

async function loadOpsBaseline() {
  const data = await api('/api/ops/baseline');
  if (!opsChecklist) return;

  opsChecklist.innerHTML = '';

  const c = data.checks || {};
  renderChip(opsChecklist, `Onboarding: ${c.onboardingReady ? 'ready' : 'needs setup'}`, {
    className: `ops-chip ${c.onboardingReady ? 'ops-chip-good' : 'ops-chip-bad'}`,
  });
  renderChip(opsChecklist, `Version: ${c.upToDate ? 'up-to-date' : 'update available'}`, {
    className: `ops-chip ${c.upToDate ? 'ops-chip-good' : 'ops-chip-warn'}`,
  });
  renderChip(opsChecklist, `Tracker file: ${c.trackerPresent ? 'present' : 'missing'}`, {
    className: `ops-chip ${c.trackerPresent ? 'ops-chip-good' : 'ops-chip-bad'}`,
  });
  renderChip(opsChecklist, `Follow-ups file: ${c.followupsPresent ? 'present' : 'missing'}`, {
    className: `ops-chip ${c.followupsPresent ? 'ops-chip-good' : 'ops-chip-bad'}`,
  });
  renderChip(opsChecklist, `Warnings: ${c.hasWarnings ? 'yes' : 'none'}`, {
    className: `ops-chip ${c.hasWarnings ? 'ops-chip-warn' : 'ops-chip-good'}`,
  });

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
  trackerState.availableStates = data.states || [];
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
  window._trackerRows = data.rows || [];
  window._trackerFound = Boolean(data.found);
  window._trackerSummary = data.summary || {};
  renderTrackerTable();
}

// Re-renders from the cached fetch (window._trackerRows) — no network call —
// so search/flags-filter typing and status-chip clicks stay instant instead
// of re-fetching the whole tracker on every keystroke.
function renderTrackerTable() {
  const rows = window._trackerRows || [];
  trackerBody.innerHTML = '';
  trackerSummary.innerHTML = '';

  if (!window._trackerFound) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="10">No tracker file found yet.</td>';
    trackerBody.appendChild(tr);
    return;
  }

  const viewRows = filterTrackerRows(matchesTrackerSearchAndFlags(rows), trackerState.statusFilter);
  const sortedRows = sortTrackerRows(viewRows);

  if (trackerState.query.trim() || trackerState.flagsFilter !== 'all') {
    renderMetric(trackerSummary, `Showing: ${sortedRows.length} of ${rows.length}`);
  }
  Object.entries(window._trackerSummary || {}).forEach(([k, v]) => {
    renderChip(trackerSummary, `${k}: ${v}`, {
      clickable: true,
      active: trackerState.statusFilter === k,
      onClick: () => setTrackerFilter(trackerState.statusFilter === k ? 'all' : k),
    });
  });

  if (sortedRows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="10">No matching applications.</td>';
    trackerBody.appendChild(tr);
    updateTrackerSortIndicators();
    return;
  }
  for (const row of sortedRows) {
    const tr = document.createElement('tr');
    const score = String(row.score || '').trim();
    const scoreCell = row.reportFilename
      ? `<span class="chip score-chip clickable ${scoreClass(score)}" role="button" tabindex="0" data-report-filename="${escapeAttr(row.reportFilename)}">${escapeHtml(score || '-')}</span>`
      : (score ? escapeHtml(score) : '<span class="muted-cell">-</span>');
    tr.innerHTML = `
      <td>${escapeHtml(row.num)}</td>
      <td>${escapeHtml(row.date)}</td>
      <td><div class="cell-title">${escapeHtml(row.company)}</div></td>
      <td>${escapeHtml(row.role)}</td>
      <td class="score-cell">${scoreCell}</td>
      <td>${renderTrackerFlagsCell(row)}</td>
      <td class="tracker-status-cell"></td>
      <td>${escapeHtml(row.lastUpdated || row.date)}</td>
      <td class="tracker-notes-cell"></td>
      <td class="actions-cell"></td>
    `;
    tr.querySelector('.tracker-status-cell').appendChild(buildTrackerStatusControl(row));
    tr.querySelector('.tracker-notes-cell').appendChild(buildTrackerNotesControl(row));
    tr.querySelector('.actions-cell').appendChild(buildTrackerActionsCell(row));
    trackerBody.appendChild(tr);
  }

  updateTrackerSortIndicators();
}

function legitimacyClass(tier) {
  const t = String(tier || '').trim().toLowerCase();
  if (t === 'suspicious') return 'legitimacy-suspicious';
  if (t === 'proceed with caution') return 'legitimacy-caution';
  if (t === 'high confidence') return 'legitimacy-confident';
  return '';
}

function renderTrackerFlagsCell(row) {
  const tier = String(row.legitimacy || '').trim();
  if (!tier) return '<span class="muted-cell">-</span>';
  return `<div class="flags-cell"><span class="chip legitimacy-chip ${legitimacyClass(tier)}">${escapeHtml(tier)}</span></div>`;
}

function buildTrackerActionsCell(row) {
  const wrap = document.createElement('div');
  wrap.className = 'row item-actions';
  if (row.postingUrl) {
    wrap.appendChild(makeOpenPostingLink({ url: row.postingUrl }, 'Open'));
  }
  if (row.reportFilename) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'action-link action-open tracker-view-report';
    link.textContent = 'View Report';
    link.dataset.reportFilename = row.reportFilename;
    wrap.appendChild(link);
  }
  if (!row.postingUrl && !row.reportFilename) {
    const span = document.createElement('span');
    span.className = 'muted-cell';
    span.textContent = 'No report';
    wrap.appendChild(span);
  }
  return wrap;
}

// Tracker # is blank ("—") on backfilled/legacy rows with no linked report,
// so set-status.mjs can't select them by number — fall back to company name,
// the same selector merge-tracker dedup already keys off.
function trackerRowSelector(row) {
  const num = String(row?.num ?? '').trim();
  return /^\d+$/.test(num) ? num : String(row?.company ?? '').trim();
}

function trackerFieldIndicator() {
  const span = document.createElement('span');
  span.className = 'tracker-field-indicator';
  return span;
}

function setTrackerFieldIndicator(el, text, kind) {
  el.textContent = text || '';
  el.classList.toggle('is-error', kind === 'error');
  el.classList.toggle('is-ok', kind === 'ok');
  if (kind === 'ok' && text) {
    window.setTimeout(() => {
      if (el.textContent === text) {
        el.textContent = '';
        el.classList.remove('is-ok');
      }
    }, 2000);
  }
}

// Inline status dropdown for one tracker row. Every canonical state is
// selectable except Evaluated — re-running a real evaluation is a process
// (oferta/auto-pipeline), not a one-click edit — but Evaluated still renders
// correctly as the CURRENT value on rows that haven't moved past it yet.
function buildTrackerStatusControl(row) {
  const wrap = document.createElement('div');
  wrap.className = 'tracker-inline-field';

  const select = document.createElement('select');
  select.className = 'tracker-status-select';
  select.setAttribute('aria-label', `Status for ${row.company || 'row'}`);

  const currentStatus = String(row.status || '').trim();
  const canonical = trackerState.availableStates.length ? trackerState.availableStates : [];
  const seen = new Set();
  for (const label of canonical) {
    if (seen.has(label)) continue;
    seen.add(label);
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    if (INLINE_STATUS_LOCKED.has(label) && label !== currentStatus) option.disabled = true;
    select.appendChild(option);
  }
  // Non-canonical/legacy status text (typo, older data) still needs a slot to
  // display correctly — silently swapping it to something else would be a
  // surprise edit the user never asked for.
  if (currentStatus && !seen.has(currentStatus)) {
    const option = document.createElement('option');
    option.value = currentStatus;
    option.textContent = currentStatus;
    select.appendChild(option);
  }
  select.value = currentStatus;

  const indicator = trackerFieldIndicator();

  select.addEventListener('change', async () => {
    const newState = select.value;
    if (newState === currentStatus) return;
    select.disabled = true;
    setTrackerFieldIndicator(indicator, 'Saving…');
    try {
      await api('/api/status', {
        method: 'POST',
        body: JSON.stringify({ selector: trackerRowSelector(row), state: newState, selectorKind: 'row' }),
      });
      setTrackerFieldIndicator(indicator, 'Saved', 'ok');
      await loadTracker();
    } catch (err) {
      setTrackerFieldIndicator(indicator, formatActionError('Update failed', err), 'error');
      select.value = currentStatus;
      select.disabled = false;
    }
  });

  wrap.appendChild(select);
  wrap.appendChild(indicator);
  return wrap;
}

// Freeform Notes editor for one tracker row — full replace via --set-note,
// not the append-only --note semantics the global Status Action form uses.
// Saves on blur so it doesn't fire on every keystroke.
function buildTrackerNotesControl(row) {
  const wrap = document.createElement('div');
  wrap.className = 'tracker-inline-field';

  const textarea = document.createElement('textarea');
  textarea.className = 'tracker-notes-input';
  textarea.rows = 2;
  textarea.value = row.notes || '';
  textarea.setAttribute('aria-label', `Notes for ${row.company || 'row'}`);

  const indicator = trackerFieldIndicator();
  let savedValue = textarea.value;

  textarea.addEventListener('blur', async () => {
    const newValue = textarea.value;
    if (newValue === savedValue) return;
    textarea.disabled = true;
    setTrackerFieldIndicator(indicator, 'Saving…');
    try {
      await api('/api/status', {
        method: 'POST',
        body: JSON.stringify({ selector: trackerRowSelector(row), state: row.status, setNote: newValue, selectorKind: 'row' }),
      });
      savedValue = newValue;
      row.notes = newValue;
      setTrackerFieldIndicator(indicator, 'Saved', 'ok');
    } catch (err) {
      setTrackerFieldIndicator(indicator, formatActionError('Save failed', err), 'error');
    } finally {
      textarea.disabled = false;
    }
  });

  wrap.appendChild(textarea);
  wrap.appendChild(indicator);
  return wrap;
}

// Search box + Flags dropdown, applied before the status filter/chips —
// mirrors Pending Pipeline's search+source-filter pattern.
function matchesTrackerSearchAndFlags(rows) {
  const query = String(trackerState.query || '').trim().toLowerCase();
  const flags = trackerState.flagsFilter || 'all';
  return (rows || []).filter((row) => {
    const tier = String(row.legitimacy || '').trim();
    const flagsOk = flags === 'all' || (flags === 'none' ? !tier : tier === flags);
    if (!flagsOk) return false;
    if (!query) return true;
    const haystack = `${row.num || ''} ${row.company || ''} ${row.role || ''} ${row.notes || ''} ${row.status || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function filterTrackerRows(rows, filter) {
  if (filter === 'active') {
    return rows.filter((r) => ACTIVE_STATUSES.has(String(r.status || '').trim().toLowerCase()));
  }
  if (filter && filter !== 'all') {
    return rows.filter((r) => String(r.status || '').trim() === filter);
  }
  return rows;
}

function setTrackerFilter(filter) {
  if (trackerState.statusFilter === filter) return;
  trackerState.statusFilter = filter;
  // The two dedicated buttons re-sort for a fresh read; a status chip just
  // narrows the current view without disturbing whatever sort was active.
  if (filter === 'all' || filter === 'active') {
    trackerState.sortKey = filter === 'active' ? 'lastUpdated' : 'date';
    trackerState.sortDir = 'desc';
  }
  trackerViewAllBtn?.classList.toggle('active', filter === 'all');
  trackerViewAllBtn?.setAttribute('aria-selected', String(filter === 'all'));
  trackerViewActiveBtn?.classList.toggle('active', filter === 'active');
  trackerViewActiveBtn?.setAttribute('aria-selected', String(filter === 'active'));
  loadTracker();
}

trackerViewAllBtn?.addEventListener('click', () => setTrackerFilter('all'));
trackerViewActiveBtn?.addEventListener('click', () => setTrackerFilter('active'));

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
    case 'lastUpdated': {
      const raw = String(row?.lastUpdated || row?.date || '').trim();
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
    case 'legitimacy': {
      // Most-concerning tier first so a sort click surfaces rows worth a second look.
      const order = { suspicious: 0, 'proceed with caution': 1, 'high confidence': 2 };
      const tier = String(row?.legitimacy || '').trim().toLowerCase();
      return tier in order ? order[tier] : 3;
    }
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

  const filteredPending = applyPipelineFilters(pipelineState.pending, { ignoreExclusions: pipelineState.showHidden });
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
  if (hiddenJobsCount) {
    hiddenJobsCount.textContent = exclusionSummary.totalHidden > 0 ? ` (${exclusionSummary.totalHidden})` : '';
  }
  const priorAppliedCount = pipelineState.pending.filter((item) => priorAppliedStatusFor(item.company)).length;
  if (priorAppliedCount > 0) {
    renderChip(pendingSummary, `Previously applied: ${priorAppliedCount}${pipelineState.showPriorApplied ? '' : ' (hidden)'}`, {
      clickable: true,
      active: pipelineState.showPriorApplied,
      onClick: () => {
        pipelineState.showPriorApplied = !pipelineState.showPriorApplied;
        if (showPriorAppliedToggle) showPriorAppliedToggle.checked = pipelineState.showPriorApplied;
        renderPipeline();
      },
    });
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

  if (pipelineFilters.source !== "all" || pipelineFilters.type !== "all" || pipelineState.showPriorApplied) {
    renderChip(pendingSummary, "Clear filters", {
      clickable: true,
      onClick: () => {
        pipelineFilters.source = "all";
        pipelineFilters.type = "all";
        pipelineState.showPriorApplied = false;
        if (showPriorAppliedToggle) showPriorAppliedToggle.checked = false;
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

  renderStepOneGuidance(filteredPending);
  renderGoblinHint(filteredPending, exclusionSummary);
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
    tr.innerHTML = '<td colspan="10" class="empty-state">No pending roles match the current filters.</td>';
    pendingTableBody.appendChild(tr);
    return;
  }

  for (const [index, item] of items.entries()) {
    pendingTableBody.appendChild(renderPipelineItem(item, true, index, firstMatchingFitRule(item)));
  }
}

async function removeFitRule(rule, promptLabel) {
  const ok = window.confirm(`Remove rule?\n\n${promptLabel || formatRuleChipText(rule)}`);
  if (!ok) return false;
  await api('/api/fit-filters/remove', {
    method: 'POST',
    body: JSON.stringify({ id: rule.id }),
  });
  await loadFitFilters();
  renderPipeline();
  return true;
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
    if (!pipelineState.showPriorApplied && priorAppliedStatusFor(item.company)) return false;
    const sourceOk = ignoreSource || sourceValue === 'all' || inferSource(item) === sourceValue;
    const itemType = item.employmentType || inferEmploymentType(item);
    const typeOk = ignoreType || typeValue === 'all' || itemType === typeValue;
    const queryText = query
      ? `${inferSource(item)} ${item.company || ''} ${item.role || ''} ${displayPipelineLocation(item)} ${displayPipelinePosted(item)} ${(item.extra || []).join(' ')}`.toLowerCase()
      : '';
    const queryOk = !query || queryText.includes(query);
    const glassdoorBlocked = inferSource(item) === 'Glassdoor';
    // No hasCoreFields gate: a pending row always has a URL (that's what makes
    // it a row), but company/role are frequently unresolved for a raw lead
    // (e.g. a LinkedIn "Job lead #id" stub never opened yet). Requiring both
    // used to drop those rows from the table with zero indication — not
    // filtered, just gone — which is worse than showing "(no company)" /
    // "(no role)" via the same fallback renderStepOneGuidance/renderPipelineItem
    // already use for exactly this case.
    return sourceOk && typeOk && queryOk && !glassdoorBlocked;
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

function renderPipelineItem(item, allowProcess, rowIndex = 0, matchRule = null) {
  const el = document.createElement('tr');
  el.className = `pipeline-row${priorAppliedStatusFor(item.company) ? ' prior-applied-row' : ''}${matchRule ? ' hidden-by-rule-row' : ''}`;
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
  const flags = renderFlagsCell(item, matchRule);
  const openPostingLabel = 'Open';
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
    <td class="score-cell"></td>
    <td>${flags}</td>
    <td class="actions-cell">
      <div class="action-stack">
        <div class="row item-actions"></div>
      </div>
    </td>
  `;

  if (allowProcess) {
    el.querySelector('.score-cell').appendChild(makeEvaluateAction(item));
    const row = el.querySelector('.item-actions');
    row.appendChild(makeOpenPostingLink(item, openPostingLabel));
    if (matchRule) row.appendChild(makeUnhideActionButton(matchRule));
    row.appendChild(makePipelineActionButton('Mark Applied', item, 'applied', 'action-applied'));
    row.appendChild(makeRejectActionButton(item));
  } else {
    const score = String(item.score || '').trim();
    el.querySelector('.score-cell').innerHTML = score
      ? `<span class="chip score-chip clickable ${scoreClass(score)}" role="button" tabindex="0" data-report-filename="${escapeAttr(item.reportFilename || '')}">${escapeHtml(score)}</span>`
      : '<span class="muted-cell">-</span>';
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

function makeOpenPostingLink(item, label) {
  const targetUrl = String(item?.url || item?.originalUrl || '').trim();
  const link = document.createElement('a');
  link.className = 'action-link action-open';
  link.href = targetUrl || '#';
  link.target = '_blank';
  link.rel = 'noopener';
  link.dataset.openUrl = targetUrl;
  link.textContent = label;
  link.addEventListener('click', (ev) => {
    const href = String(link.dataset.openUrl || '').trim();
    if (!href) {
      ev.preventDefault();
      showToast('No posting URL found for this row', 'error');
      return;
    }
    // Ensure the clicked row URL always wins, even during rapid re-renders.
    link.href = href;
  });
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

// Posting-age tiers match Block G's own convention (modes/_shared.md):
// under 30d=good (no flag), 30-60d=mixed ("Aging"), 60d+=concerning ("Stale").
function daysSincePosted(item) {
  const raw = String(item?.posted || '').replace(/^posted:\s*/i, '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const posted = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(posted.getTime())) return null;
  return Math.floor((Date.now() - posted.getTime()) / 86400000);
}

function renderFlagsCell(item, matchRule = null) {
  const flags = [];
  // Evaluate found this dead (404/expired/redirected) — modes/oferta.md's
  // Liveness gate stopped before Block A, so there's no score/report for
  // this row; markPipelineItemDead wrote the `dead:` segment that surfaces
  // here. Highest-priority flag — nothing else about the row matters until
  // this is resolved.
  if (item.deadReason) {
    flags.push(`<span class="chip dead-link-chip" title="${escapeAttr(item.deadReason)}">Dead Link</span>`);
  }
  const priorApplied = priorAppliedStatusFor(item.company);
  if (priorApplied) {
    flags.push(`<span class="chip prior-applied-chip">Applied: ${escapeHtml(priorApplied)}</span>`);
  }
  if (matchRule) {
    flags.push(`<span class="chip hidden-rule-chip" title="${escapeAttr(formatRuleChipText(matchRule))}">Hidden: ${escapeHtml(formatRuleChipText(matchRule))}</span>`);
  }
  // Scanner's legitimacy signal (modes/pipeline.md `trust:` segment) — only
  // written when a posting scored below 100, so absent/null means "never
  // flagged," not "clean." Requires trust_filter enabled in portals.yml.
  const trustScore = item.trustScore;
  if (Number.isFinite(trustScore) && trustScore < 100) {
    const tier = trustScore < 60 ? 'trust-chip-low' : 'trust-chip-mid';
    const flagsTitle = (item.trustFlags || []).join(', ') || 'Legitimacy signal from the scanner';
    flags.push(`<span class="chip trust-chip ${tier}" title="${escapeAttr(flagsTitle)}">Trust: ${escapeHtml(String(trustScore))}</span>`);
  }
  const ageDays = daysSincePosted(item);
  if (ageDays !== null && ageDays >= 60) {
    flags.push(`<span class="chip stale-chip stale-chip-concerning" title="Posted ${ageDays} days ago">Stale: ${ageDays}d</span>`);
  } else if (ageDays !== null && ageDays >= 30) {
    flags.push(`<span class="chip stale-chip stale-chip-aging" title="Posted ${ageDays} days ago">Aging: ${ageDays}d</span>`);
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
  const key = pipelineState.sortKey || 'added';
  const dir = pipelineState.sortDir === 'desc' ? -1 : 1;
  return [...(items || [])].sort((a, b) => {
    const av = sortValueForItem(a, key);
    const bv = sortValueForItem(b, key);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    if (key === 'company') return 0;
    // Tie-break on company alphabetically so equal primary-sort rows don't
    // reshuffle arbitrarily between renders.
    const ac = sortValueForItem(a, 'company');
    const bc = sortValueForItem(b, 'company');
    if (ac < bc) return -1;
    if (ac > bc) return 1;
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
    case 'score': {
      const n = parseFloat(String(item.score || '').replace('/5', ''));
      return isFinite(n) ? n : -1;
    }
    case 'flags': {
      const ageDays = daysSincePosted(item);
      const hasFlag = Boolean(item.deadReason)
        || Boolean(priorAppliedStatusFor(item.company))
        || (Number.isFinite(item.trustScore) && item.trustScore < 100)
        || (ageDays !== null && ageDays >= 30);
      return hasFlag ? '0' : '1';
    }
    default:
      return String(item.company || '').toLowerCase();
  }
}

function togglePipelineSort(sortKey) {
  if (pipelineState.sortKey === sortKey) {
    pipelineState.sortDir = pipelineState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    pipelineState.sortKey = sortKey;
    pipelineState.sortDir = sortKey === 'added' ? 'desc' : 'asc';
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
  const stored = (() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  })();
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light'));

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('theme-dark') ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (e) {}
    });
  }

  startHintRotation();
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('theme-dark', isDark);
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
    toggleBtn.setAttribute('aria-pressed', String(isDark));
  }
}

// Spend tier lives in config/profile.yml (modes/_shared.md § Spend Tier) and
// is read by every evaluation path in career-ops — the CLI, batch runs, and
// this dashboard's own Evaluate button — so a change here is not a
// dashboard-local setting, it's a config write that changes what every one
// of those paths does on its next run.
const SPEND_TIERS = ['economy', 'standard', 'premium'];
const SPEND_TIER_LABELS = { economy: '⚡ Economy', standard: '⚖️ Standard', premium: '💎 Premium' };

async function initSpendTierToggle() {
  const btn = document.getElementById('spendTierBtn');
  if (!btn) return;

  let tier = 'standard';
  try {
    const data = await api('/api/spend-tier');
    if (SPEND_TIERS.includes(data?.tier)) tier = data.tier;
  } catch {
    // Server unreachable at load time — leave the button on its default
    // label; the click handler will surface any real error when used.
  }
  applySpendTierLabel(btn, tier);

  btn.addEventListener('click', async () => {
    const current = btn.dataset.tier || tier;
    const next = SPEND_TIERS[(SPEND_TIERS.indexOf(current) + 1) % SPEND_TIERS.length];
    btn.disabled = true;
    try {
      await api('/api/spend-tier', { method: 'POST', body: JSON.stringify({ tier: next }) });
      applySpendTierLabel(btn, next);
      showToast(`Spend tier set to ${next} — applies to all career-ops evaluations, not just this dashboard`, 'success');
    } catch (err) {
      showToast(formatActionError('Could not change spend tier', err), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function applySpendTierLabel(btn, tier) {
  btn.dataset.tier = tier;
  btn.textContent = SPEND_TIER_LABELS[tier] || SPEND_TIER_LABELS.standard;
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
  const intervalMs = 9000;
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
  const { clickable = false, active = false, onClick, className = '' } = options;
  const chip = document.createElement('span');
  chip.className = `chip${clickable ? ' clickable' : ''}${active ? ' active' : ''}${className ? ` ${className}` : ''}`;
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

function makePipelineActionButton(label, item, action, extraClass = '') {
  const rawItem = String(item?.raw || '').trim();
  const itemUrl = String(item?.url || item?.originalUrl || '').trim();
  const itemCompany = String(item?.company || '').trim();
  const itemRole = String(item?.role || '').trim();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `secondary ${extraClass}`.trim();
  btn.textContent = label;
  btn.dataset.pipelineRaw = rawItem;
  btn.dataset.pipelineUrl = itemUrl;
  btn.dataset.pipelineCompany = itemCompany;
  btn.dataset.pipelineRole = itemRole;
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
        body: JSON.stringify({
          item: {
            raw: btn.dataset.pipelineRaw || '',
            url: btn.dataset.pipelineUrl || '',
            company: btn.dataset.pipelineCompany || '',
            role: btn.dataset.pipelineRole || '',
          },
          action,
          resumeNote,
        }),
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

// Single action slot per pipeline row: Evaluate button -> spinning "Evaluating"
// chip while a run is in flight -> score + Report link once done. A row that
// already has a report (this session's job, or a prior report found on load)
// never shows the Evaluate button again.
function makeEvaluateAction(item) {
  const url = String(item?.url || item?.originalUrl || '').trim();
  const job = latestEvaluationForUrl(url);
  const status = job?.status || '';

  if (status === 'running') {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'eval-inline-chip status-running';
    chip.dataset.evalOpen = job.id;
    chip.title = 'Open this run in Evaluate tab';
    const spinner = document.createElement('span');
    spinner.className = 'eval-inline-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    chip.appendChild(spinner);
    chip.appendChild(document.createTextNode('Evaluating'));
    return chip;
  }

  const reportFilename = (status === 'success' ? job.reportSlug : '') || item.reportFilename || '';
  const score = (status === 'success' ? job.score : '') || item.score || '';

  if (reportFilename) {
    const chip = document.createElement('span');
    chip.className = `chip score-chip clickable ${scoreClass(score)}`;
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.dataset.reportFilename = reportFilename;
    chip.title = 'Open evaluation report';
    chip.textContent = score || 'Report';
    return chip;
  }

  // Persisted (pipeline.md `dead:` segment, survives reload) or from this
  // session's own job — either way, don't let it quietly go back to a plain
  // "Evaluate" button as if nothing happened (see markPipelineItemDead).
  const deadReason = (status === 'dead' ? job.deadReason : '') || item.deadReason || '';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary action-evaluate';
  if (deadReason) {
    btn.classList.add('action-dead-link');
    btn.textContent = 'Dead Link — Retry?';
    btn.title = `Marked dead: ${deadReason} — click to re-check`;
  } else {
    btn.textContent = status === 'error' ? 'Retry Evaluate' : 'Evaluate';
    btn.title = status === 'error'
      ? `Evaluation failed${job?.error ? `: ${job.error}` : ''} — click to retry`
      : 'Run AI evaluation on this posting';
  }
  btn.dataset.evaluateUrl = url;
  btn.dataset.evaluateSource = String(item?.source || inferSource(item) || 'pipeline').trim();
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const targetUrl = String(btn.dataset.evaluateUrl || '').trim();
    const sourceLabel = String(btn.dataset.evaluateSource || 'pipeline').trim();
    if (!targetUrl) {
      showToast('No posting URL found for this row', 'error');
      return;
    }
    const urlInput = document.getElementById('evaluateUrl');
    if (urlInput) urlInput.value = targetUrl;
    runEvaluation(targetUrl, { sourceLabel, focusJob: true });
  });
  return btn;
}

function latestEvaluationForUrl(url) {
  const normalized = String(url || '').trim();
  if (!normalized) return '';
  const job = evaluateState.jobs.find((entry) => String(entry.url || '').trim() === normalized);
  return job || null;
}

function makeRejectActionButton(item) {
  const rowPayload = {
    raw: String(item?.raw || '').trim(),
    url: String(item?.url || item?.originalUrl || '').trim(),
    company: String(item?.company || '').trim(),
    role: String(item?.role || '').trim(),
  };
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary action-reject';
  btn.textContent = 'Reject';
  btn.addEventListener('click', async () => {
    const rule = await promptRejectRule(item);
    if (!rule) return;

    try {
      await api('/api/pipeline/process', {
        method: 'POST',
        body: JSON.stringify({ item: rowPayload, action: 'reject', rejectRule: hasAnyRuleScope(rule) ? rule : null }),
      });
      try {
        await loadFitFilters();
        await loadPipeline();
      } catch (refreshErr) {
        window.alert(formatActionError('Rejected, but refresh failed', refreshErr));
      }
    } catch (err) {
      window.alert(formatActionError('Reject failed', err));
    }
  });
  return btn;
}

function makeUnhideActionButton(rule) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary action-unhide';
  btn.textContent = 'Unhide (remove rule)';
  btn.title = formatRuleChipText(rule);
  btn.addEventListener('click', () => removeFitRule(rule));
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

function applyRejectDefaults(item) {
  const reasonId = rejectReasonSelect?.value || rejectReasons[0].id;
  const reason = rejectReasons.find((r) => r.id === reasonId) || rejectReasons[0];
  const defaults = normalizeRuleScope(buildReasonFallbackRule(item, reasonId));

  if (rejectReasonHelp) rejectReasonHelp.textContent = reason.help;
  if (rejectCompanyChk) rejectCompanyChk.checked = Boolean(defaults.company);
  if (rejectSourceChk) rejectSourceChk.checked = Boolean(defaults.source);
  if (rejectTypeChk) rejectTypeChk.checked = Boolean(defaults.employmentType);
  if (rejectRoleKeywords) rejectRoleKeywords.value = defaults.roleKeywords.join(', ');
  if (rejectLocationKeywords) rejectLocationKeywords.value = defaults.locationKeywords.join(', ');
  updateRejectPreview(item);
}

function parseCsvKeywords(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function currentRejectRuleFromForm(item) {
  return normalizeRuleScope({
    company: rejectCompanyChk?.checked ? String(item?.company || '').trim() : '',
    source: rejectSourceChk?.checked ? inferSource(item) : '',
    employmentType: rejectTypeChk?.checked ? (item.employmentType || inferEmploymentType(item)) : '',
    roleKeywords: parseCsvKeywords(rejectRoleKeywords?.value || ''),
    locationKeywords: parseCsvKeywords(rejectLocationKeywords?.value || ''),
  });
}

function updateRejectPreview(item) {
  if (!rejectPreview) return;
  rejectPreview.textContent = formatRejectPreview(currentRejectRuleFromForm(item));
}

function formatRejectPreview(rule) {
  if (!hasAnyRuleScope(rule)) return 'No auto-exclude filter will be saved for this reason.';

  const bits = [];
  if (rule.company) bits.push(`company = ${rule.company}`);
  if (rule.source) bits.push(`source = ${rule.source}`);
  if (rule.employmentType) bits.push(`type = ${rule.employmentType}`);
  if (rule.roleKeywords.length) bits.push(`role ~ ${rule.roleKeywords.join(', ')}`);
  if (rule.locationKeywords.length) bits.push(`location ~ ${rule.locationKeywords.join(', ')}`);
  return `Will auto-exclude future matches by ${bits.join(' + ')}.`;
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

function uniqueKeywords(values) {
  return [...new Set((values || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))].slice(0, 8);
}

function buildReasonFallbackRule(item, reasonId) {
  const company = String(item?.company || '').trim();
  const source = inferSource(item);
  const employmentType = item.employmentType || inferEmploymentType(item);
  const roleKeywords = suggestRoleKeywords(reasonId, item);
  const locationKeywords = suggestLocationKeywords(reasonId, item);

  if (reasonId === 'no-longer-accepting' || reasonId === 'score-too-low') {
    return {};
  }
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
    if (locationKeywords.length) return { locationKeywords, source, employmentType };
    return { company };
  }

  if (roleKeywords.length) return { roleKeywords, source, employmentType };
  return { company };
}

function hasAnyRuleScope(rule) {
  return Boolean(
    rule.company || rule.source || rule.employmentType || (rule.roleKeywords || []).length || (rule.locationKeywords || []).length,
  );
}

function normalizeRuleScope(rule) {
  return {
    company: String(rule.company || '').trim(),
    source: String(rule.source || '').trim(),
    employmentType: String(rule.employmentType || '').trim(),
    roleKeywords: uniqueKeywords(rule.roleKeywords || []),
    locationKeywords: uniqueKeywords(rule.locationKeywords || []),
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
  const onFieldChange = () => updateRejectPreview(item);
  rejectReasonSelect.addEventListener('change', onReasonChange);
  rejectCompanyChk?.addEventListener('change', onFieldChange);
  rejectSourceChk?.addEventListener('change', onFieldChange);
  rejectTypeChk?.addEventListener('change', onFieldChange);
  rejectRoleKeywords?.addEventListener('input', onFieldChange);
  rejectLocationKeywords?.addEventListener('input', onFieldChange);

  return new Promise((resolve) => {
    const cleanup = () => {
      rejectReasonSelect.removeEventListener('change', onReasonChange);
      rejectCompanyChk?.removeEventListener('change', onFieldChange);
      rejectSourceChk?.removeEventListener('change', onFieldChange);
      rejectTypeChk?.removeEventListener('change', onFieldChange);
      rejectRoleKeywords?.removeEventListener('input', onFieldChange);
      rejectLocationKeywords?.removeEventListener('input', onFieldChange);
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

      const rule = currentRejectRuleFromForm(item);
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

// Backfills company/title/location for pending rows still showing a
// placeholder (blank company, "Job lead #id", etc.) from BuiltIn,
// FractionalJobs, Adzuna, and Glassdoor — see enrich-pipeline.mjs. LinkedIn
// isn't included here: it needs its own authenticated session
// (linkedin-login.mjs), so it has its own separate script/button-free path
// (`npm run linkedin:enrich`) rather than one this button can silently skip.
async function runEnrichPending() {
  enrichPendingBtn.disabled = true;
  enrichPendingBtn.textContent = 'Enriching...';
  try {
    const data = await api('/api/pipeline/enrich-sources', { method: 'POST' });
    const summary = data.stdout || data.stderr || 'Enrichment finished.';
    showToast(summary.split('\n').filter(Boolean).slice(-2).join(' — ') || 'Enrichment finished.', 'success');
    await loadPipeline();
  } catch (err) {
    showToast(formatActionError('Enrich Pending failed', err), 'error');
  } finally {
    enrichPendingBtn.disabled = false;
    enrichPendingBtn.textContent = 'Enrich Pending';
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

function openReportFromPipeline(filename) {
  if (!filename) return;
  setActiveTab('reports');
  loadReports().then(() => {
    const btn = document.querySelector(`.report-list-item[data-slug="${escapeAttr(filename)}"]`);
    if (btn) {
      btn.click();
      btn.scrollIntoView({ block: 'nearest' });
    }
  });
}

function updateReportsScrollShadow(el) {
  if (!el) return;
  const hasOverflow = el.scrollHeight > el.clientHeight + 1;
  el.classList.toggle('has-more-above', hasOverflow && el.scrollTop > 2);
  el.classList.toggle('has-more-below', hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
}

async function loadReports() {
  if (reportsLoaded) return;
  const el = document.getElementById('reportsList');
  const countEl = document.getElementById('reportsCount');
  if (!el) return;
  el.innerHTML = '<p class="chart-empty">Loading…</p>';
  try {
    const data = await api('/api/reports');
    const reports = Array.isArray(data.reports) ? data.reports : [];
    reports.sort((a, b) => reportScoreValue(b.score) - reportScoreValue(a.score));
    reportsState.items = reports;
    reportsLoaded = true;
    renderReportsToolbar();
    if (countEl) countEl.textContent = reports.length ? ` · ${reports.length}` : '';
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
    el.addEventListener('scroll', () => updateReportsScrollShadow(el));
    window.addEventListener('resize', () => updateReportsScrollShadow(el));
    updateReportsScrollShadow(el);
  } catch (err) {
    el.innerHTML = `<p class="chart-empty">Error: ${escapeHtml(String(err.message))}</p>`;
  }
}

let profileLoaded = false;

async function loadProfile() {
  if (profileLoaded) return; // static content for the life of the page; Refresh reloads everything anyway
  const summaryEl = document.getElementById('profileSummary');
  const viewerEl = document.getElementById('profileViewer');
  if (!summaryEl || !viewerEl) return;
  try {
    const data = await api('/api/profile');
    summaryEl.innerHTML = renderProfileSummary(data.summary);
    if (data.profileMdMissing) {
      viewerEl.innerHTML = '<p class="chart-empty">modes/_profile.md not found — nothing to show yet.</p>';
    } else {
      const md = data.profileMd || '';
      viewerEl.innerHTML = `<div class="md-body">${typeof marked !== 'undefined' ? marked.parse(md) : `<pre>${escapeHtml(md)}</pre>`}</div>`;
    }
    profileLoaded = true;
  } catch (err) {
    viewerEl.innerHTML = `<p class="chart-empty">Error: ${escapeHtml(String(err.message || err))}</p>`;
  }
}

function renderProfileSummary(summary) {
  if (!summary) return '';
  const roles = Array.isArray(summary.targetRoles) ? summary.targetRoles : [];
  const comp = summary.compensation || {};
  const loc = summary.location || {};
  const roleChips = roles.length
    ? roles.map((r) => `<span class="chip">${escapeHtml(r)}</span>`).join('')
    : '<span class="muted-cell">none configured</span>';
  const locBits = [loc.city, loc.country].filter(Boolean).join(', ');
  return `
    <div class="profile-summary-row">
      <div class="profile-summary-item">
        <div class="profile-summary-label">Target Roles</div>
        <div class="profile-summary-value">${roleChips}</div>
      </div>
      <div class="profile-summary-item">
        <div class="profile-summary-label">Comp Target</div>
        <div class="profile-summary-value">${escapeHtml(comp.target_range || comp.minimum || '—')}</div>
      </div>
      <div class="profile-summary-item">
        <div class="profile-summary-label">Location</div>
        <div class="profile-summary-value">${escapeHtml(locBits || '—')}</div>
        ${comp.location_flexibility ? `<div class="profile-summary-subvalue">${escapeHtml(comp.location_flexibility)}</div>` : ''}
      </div>
      <div class="profile-summary-item">
        <div class="profile-summary-label">Spend Tier</div>
        <div class="profile-summary-value">${escapeHtml(SPEND_TIER_LABELS[summary.spendTier] || summary.spendTier || '—')}</div>
      </div>
    </div>
  `;
}

async function openReport(slug, activeBtn) {
  reportsState.selectedSlug = String(slug || '').trim();
  renderReportsToolbar();
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

function selectedReportMeta() {
  const slug = String(reportsState.selectedSlug || '').trim();
  if (!slug) return null;
  return reportsState.items.find((item) => String(item.filename || '').trim() === slug) || null;
}

function renderReportsToolbar() {
  if (!reportsGeneratePdfBtn || !reportsToolbarMeta) return;
  const selected = selectedReportMeta();
  const company = String(selected?.company || '').trim();
  const pdfFilename = String(selected?.pdfFilename || '').trim();

  if (reportsDownloadResumeLink) {
    if (pdfFilename) {
      reportsDownloadResumeLink.href = `/download/resume/${encodeURIComponent(pdfFilename)}`;
      reportsDownloadResumeLink.classList.remove('is-hidden');
    } else {
      reportsDownloadResumeLink.removeAttribute('href');
      reportsDownloadResumeLink.classList.add('is-hidden');
    }
  }

  if (!selected) {
    reportsGeneratePdfBtn.disabled = true;
    reportsGeneratePdfBtn.textContent = 'Create PDF On Demand';
    reportsToolbarMeta.textContent = 'Select a report to enable PDF generation.';
    return;
  }

  reportsGeneratePdfBtn.disabled = reportsState.pdfRunning || !company;
  reportsGeneratePdfBtn.textContent = reportsState.pdfRunning ? 'Generating…' : 'Create PDF On Demand';
  reportsToolbarMeta.textContent = company
    ? `Runs /career-ops pdf ${company}`
    : 'Company name missing in this report header.';
}

async function generateSelectedReportPdf() {
  const selected = selectedReportMeta();
  const company = String(selected?.company || '').trim();
  if (!company) {
    showToast('Select a report with a company name first', 'error');
    return;
  }

  reportsState.pdfRunning = true;
  renderReportsToolbar();
  try {
    await api('/api/reports/pdf-on-demand', {
      method: 'POST',
      body: JSON.stringify({ company }),
    });
    showToast(`PDF flow finished for ${company}`, 'success');
    // Re-fetch so the new PDF's download link shows up without a full page refresh.
    const selectedSlug = reportsState.selectedSlug;
    reportsLoaded = false;
    await loadReports();
    if (selectedSlug) {
      const btn = document.querySelector(`.report-list-item[data-slug="${escapeAttr(selectedSlug)}"]`);
      reportsState.selectedSlug = selectedSlug;
      btn?.classList.add('is-active');
    }
  } catch (err) {
    showToast(`PDF generation failed: ${String(err.message || err)}`, 'error');
  } finally {
    reportsState.pdfRunning = false;
    renderReportsToolbar();
  }
}

async function reportInfoForUrl(url) {
  const targetUrl = String(url || '').trim();
  if (!targetUrl) return { filename: '', score: '' };
  try {
    const data = await api(`/api/reports/by-url?url=${encodeURIComponent(targetUrl)}`);
    return { filename: String(data.filename || '').trim(), score: String(data.score || '').trim() };
  } catch {
    return { filename: '', score: '' };
  }
}

async function openReportFromEvaluate(reportSlug) {
  const slug = String(reportSlug || '').trim();
  if (!slug) return;
  setActiveTab('reports');
  if (!reportsLoaded) await loadReports();
  const btn = document.querySelector(`.report-list-item[data-slug="${escapeAttr(slug)}"]`);
  await openReport(slug, btn instanceof HTMLElement ? btn : null);
}

function scoreClass(score) {
  const n = parseFloat(String(score || '').replace('/5', ''));
  if (!isFinite(n)) return '';
  if (n >= 4.5) return 'score-high';
  if (n >= 4.0) return 'score-mid';
  if (n >= 3.0) return 'score-low';
  return 'score-skip';
}

// Missing/unparseable scores sort to the bottom, below the 0-5 range.
function reportScoreValue(score) {
  const n = parseFloat(String(score || '').replace('/5', ''));
  return isFinite(n) ? n : -1;
}

// ─── Evaluate ─────────────────────────────────────────────────────────────────

const evaluateForm = document.getElementById('evaluateForm');
const evaluateBtn = document.getElementById('evaluateBtn');
const evaluateOutput = document.getElementById('evaluateOutput');
const evaluateVerdict = document.getElementById('evaluateVerdict');
const evaluateJobsMeta = document.getElementById('evaluateJobsMeta');
const evaluateJobsList = document.getElementById('evaluateJobsList');

evaluateForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const url = document.getElementById('evaluateUrl')?.value?.trim();
  if (!url) return;
  runEvaluation(url, { sourceLabel: 'manual', focusJob: true });
  if (evaluateBtn) {
    evaluateBtn.textContent = 'Queued';
    window.setTimeout(() => {
      if (evaluateBtn) evaluateBtn.textContent = 'Run Evaluation';
    }, 700);
  }
});

evaluateJobsList?.addEventListener('click', (ev) => {
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;

  const selectId = target.dataset.evalSelect;
  if (selectId) {
    evaluateState.selectedId = selectId;
    renderEvaluationJobs();
    renderEvaluationViewer();
    return;
  }

  const reportSlug = target.dataset.evalReport;
  if (reportSlug) {
    openReportFromEvaluate(reportSlug);
    return;
  }

  const cancelId = target.dataset.evalCancel;
  if (cancelId) {
    const job = evaluateState.jobs.find((j) => j.id === cancelId);
    if (job && job.status === 'running') job.controller.abort();
    return;
  }

  const retryId = target.dataset.evalRetry;
  if (!retryId) return;
  const failedJob = evaluateState.jobs.find((j) => j.id === retryId);
  if (!failedJob || (failedJob.status !== 'error' && failedJob.status !== 'dead')) return;
  runEvaluation(failedJob.url, { sourceLabel: failedJob.sourceLabel, focusJob: true });
});

function runEvaluation(url, options = {}) {
  const targetUrl = String(url || '').trim();
  if (!targetUrl) return null;

  const sourceLabel = String(options.sourceLabel || 'pipeline').trim() || 'pipeline';
  const job = {
    id: `eval-${Date.now()}-${evaluateState.nextId++}`,
    url: targetUrl,
    sourceLabel,
    status: 'running',
    startedAt: Date.now(),
    finishedAt: 0,
    output: '',
    verdict: '',
    reportSlug: '',
    score: '',
    exitCode: null,
    error: '',
    controller: new AbortController(),
  };

  evaluateState.jobs.unshift(job);
  if (options.focusJob !== false || !evaluateState.selectedId) evaluateState.selectedId = job.id;
  renderEvaluationJobs();
  renderEvaluationViewer();
  refreshPipelineEvaluationIndicators();
  startEvaluationJob(job);
  showToast(`Evaluation started (${sourceLabel})`, 'success');
  return job.id;
}

async function startEvaluationJob(job) {
  let fullText = '';

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: job.url }),
      signal: job.controller.signal,
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
          if (evtType === 'start' && payload.model) {
            // Surfaces which model this run resolved to (config/profile.yml's
            // spend_tier) so a slow/expensive run isn't a mystery — economy
            // (haiku) vs standard (sonnet) vs premium (opus) is a real cost
            // difference, and this is the only place that choice is visible.
            fullText += `[spend tier: ${payload.tier || '?'} — ${payload.model}]\n`;
            job.output = fullText;
            maybeRefreshEvaluationViewer(job.id);
          } else if (evtType === 'text' && payload.text) {
            fullText += payload.text;
            job.output = fullText;
            maybeRefreshEvaluationViewer(job.id);
          } else if (evtType === 'stderr' && payload.text) {
            fullText += `\n[stderr] ${payload.text}`;
            job.output = fullText;
            maybeRefreshEvaluationViewer(job.id);
          } else if (evtType === 'done') {
            const verdict = extractVerdict(fullText) || '';
            job.verdict = verdict;
            job.exitCode = payload.code;
            if (payload.code === 0) {
              const deadReason = extractDeadLinkReason(fullText);
              if (deadReason) {
                // The liveness gate (modes/oferta.md) stopped before Block A —
                // no report was written, so there's nothing to enrich/link.
                // Flag the pending row instead so this doesn't just vanish
                // into the Evaluate tab's scrollback.
                job.status = 'dead';
                job.deadReason = deadReason;
                job.verdict = job.verdict || `DEAD LINK: ${deadReason}`;
                try {
                  await api('/api/pipeline/mark-dead', {
                    method: 'POST',
                    body: JSON.stringify({ url: job.url, reason: deadReason }),
                  });
                } catch {
                  // Same as the enrich case below — the standalone Evaluate
                  // tab can target a URL that was never a pending row.
                }
                showToast(`Dead link: ${deadReason}`, 'error');
                loadPipeline(); // pick up the dead flag
                renderEvaluationJobs();
                maybeRefreshEvaluationViewer(job.id);
                refreshPipelineEvaluationIndicators();
                continue;
              }
              job.status = 'success';
              const reportFilename = extractReportFilename(fullText);
              if (reportFilename) {
                // Deterministic: the evaluator told us exactly what it wrote.
                // Use it directly, and backfill the pending row's Company/Role
                // (and URL, if the report's own is cleaner) from the same
                // report — see enrichPipelineItemFromReport in server.mjs.
                job.reportSlug = reportFilename;
                try {
                  const enriched = await api('/api/pipeline/enrich', {
                    method: 'POST',
                    body: JSON.stringify({ url: job.url, reportFilename }),
                  });
                  if (enriched?.score) job.score = enriched.score;
                } catch {
                  // Not every evaluated URL is a pending row — the standalone
                  // Evaluate tab can target one that was never added to the
                  // pipeline. That's expected, not a failure worth surfacing.
                }
                if (!job.score) {
                  const reportInfo = await reportInfoForUrl(job.url);
                  job.score = reportInfo.score;
                }
              } else {
                // Fallback for an older/different prompt shape with no REPORT line.
                const reportInfo = await reportInfoForUrl(job.url);
                job.reportSlug = reportInfo.filename;
                job.score = reportInfo.score;
              }
              showToast('Evaluation complete — report + tracker updated', 'success');
              reportsLoaded = false; // force reload on next visit
              loadTracker();
              loadPipeline(); // pick up the backfilled company/role/url + score/link
            } else {
              job.status = 'error';
              showToast(`Evaluation exited with code ${payload.code}`, 'error');
            }
            renderEvaluationJobs();
            maybeRefreshEvaluationViewer(job.id);
            refreshPipelineEvaluationIndicators();
          }
        } catch { /* ignore parse errors */ }
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      job.status = 'cancelled';
      job.error = 'Cancelled by user.';
      if (!job.output.trim()) job.output = '[cancelled] Evaluation cancelled by user.';
      showToast('Evaluation cancelled', 'error');
    } else {
      job.status = 'error';
      job.error = String(err?.message || err);
      job.output += `\n\nError: ${job.error}`;
      showToast(`Evaluation failed: ${job.error}`, 'error');
    }
    renderEvaluationJobs();
    maybeRefreshEvaluationViewer(job.id);
    refreshPipelineEvaluationIndicators();
  } finally {
    if (job.status === 'running') {
      job.status = job.exitCode === 0 ? 'success' : 'error';
    }
    job.finishedAt = Date.now();
    renderEvaluationJobs();
    maybeRefreshEvaluationViewer(job.id);
    refreshPipelineEvaluationIndicators();
  }
}

function refreshPipelineEvaluationIndicators() {
  if (!Array.isArray(pipelineState.pending) || pipelineState.pending.length === 0) return;
  renderPipeline();
}

function maybeRefreshEvaluationViewer(jobId) {
  if (evaluateState.selectedId === jobId) renderEvaluationViewer();
}

function renderEvaluationJobs() {
  if (evaluateJobsMeta) {
    const active = evaluateState.jobs.filter((j) => j.status === 'running').length;
    const success = evaluateState.jobs.filter((j) => j.status === 'success').length;
    const dead = evaluateState.jobs.filter((j) => j.status === 'dead').length;
    const failed = evaluateState.jobs.filter((j) => j.status === 'error').length;
    const cancelled = evaluateState.jobs.filter((j) => j.status === 'cancelled').length;
    evaluateJobsMeta.textContent = `Running: ${active} | Done: ${success} | Dead: ${dead} | Failed: ${failed} | Cancelled: ${cancelled}`;
  }

  if (!evaluateJobsList) return;
  if (!evaluateState.jobs.length) {
    evaluateJobsList.innerHTML = '<div class="muted-cell">No evaluations started yet.</div>';
    return;
  }

  evaluateJobsList.innerHTML = evaluateState.jobs.map((job) => {
    const activeClass = evaluateState.selectedId === job.id ? ' is-active' : '';
    const statusLabel = evalStatusLabel(job.status);
    const running = job.status === 'running';
    return `
      <article class="eval-job${activeClass}">
        <div class="eval-job-top">
          <span class="eval-job-status status-${escapeAttr(job.status)}">${escapeHtml(statusLabel)}</span>
          <span class="muted-cell">${escapeHtml(job.sourceLabel)}</span>
        </div>
        <div class="eval-job-url">${escapeHtml(compactUrl(job.url))}</div>
        <div class="eval-job-actions">
          <button type="button" class="secondary" data-eval-select="${escapeAttr(job.id)}">View</button>
          ${!running && job.reportSlug ? `<button type="button" class="secondary" data-eval-report="${escapeAttr(job.reportSlug)}">Report</button>` : ''}
          ${running ? `<button type="button" class="secondary" data-eval-cancel="${escapeAttr(job.id)}">Cancel</button>` : ''}
          ${job.status === 'error' || job.status === 'dead' ? `<button type="button" class="secondary action-retry" data-eval-retry="${escapeAttr(job.id)}">Retry</button>` : ''}
        </div>
      </article>`;
  }).join('');
}

function renderEvaluationViewer() {
  const selected = evaluateState.jobs.find((j) => j.id === evaluateState.selectedId) || null;
  if (!selected) {
    if (evaluateVerdict) {
      evaluateVerdict.textContent = '';
      evaluateVerdict.classList.add('is-hidden');
    }
    if (evaluateOutput) evaluateOutput.textContent = 'No evaluation selected.';
    return;
  }

  const verdict = selected.verdict || inferVerdictForJob(selected);
  if (evaluateVerdict) {
    if (verdict) {
      evaluateVerdict.textContent = verdict;
      evaluateVerdict.classList.remove('is-hidden');
    } else {
      evaluateVerdict.textContent = `Status: ${evalStatusLabel(selected.status)}`;
      evaluateVerdict.classList.remove('is-hidden');
    }
  }

  if (evaluateOutput) {
    evaluateOutput.textContent = selected.output || '[waiting for evaluator output]';
    evaluateOutput.scrollTop = evaluateOutput.scrollHeight;
  }
}

function inferVerdictForJob(job) {
  if (job.status === 'running') return '';
  if (job.status === 'cancelled') return 'Evaluation cancelled';
  if (job.status === 'error') {
    const suffix = Number.isInteger(job.exitCode) ? ` (exit ${job.exitCode})` : '';
    return `Evaluation failed${suffix}`;
  }
  return '';
}

function evalStatusLabel(status) {
  if (status === 'running') return 'Running';
  if (status === 'success') return 'Done';
  if (status === 'dead') return 'Dead Link';
  if (status === 'cancelled') return 'Cancelled';
  return 'Error';
}

function compactUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 94) return raw;
  return `${raw.slice(0, 45)}...${raw.slice(-42)}`;
}

function extractVerdict(text) {
  const m = String(text || '').match(/VERDICT:\s*(.+)/);
  return m ? `VERDICT: ${m[1].trim()}` : '';
}

// The evaluator prints its own report filename as a REPORT: line — reading it
// directly is deterministic, unlike guessing the report back from job.url via
// reportInfoForUrl(), which silently fails whenever the report's own **URL:**
// ends up differing from the pending row's stored URL (redirect/tracking
// links, blank-company stub rows that had never been resolved before this
// run — see enrichPipelineItemFromReport in server.mjs for the full story).
function extractReportFilename(text) {
  const m = String(text || '').match(/REPORT:\s*(\S+\.md)/);
  return m ? m[1].trim() : '';
}

// modes/oferta.md's Liveness gate stops the evaluator before Block A on a
// dead posting — the DEAD_LINK: line is how it tells the dashboard that
// happened instead of a REPORT:/VERDICT: pair (see buildEvalPrompt in
// server.mjs).
function extractDeadLinkReason(text) {
  const m = String(text || '').match(/DEAD_LINK:\s*(.+)/);
  return m ? m[1].trim() : '';
}
