let dances = [];
let formations = [];
let rolesRaw = [];
let setlists = [];
let workingSetlists = [];
let danceById = {};

let filteredDances = [];
let currentDanceId = null;
let currentSetlistId = '';

let roleSets = {};
let currentRoleSetId = null;

let callingMode = false;
let setlistEditorOpen = false;

const STORAGE_KEY_DANCES = 'ceilidh-dances-v1';
const STORAGE_KEY_SETLISTS = 'ceilidh-setlists-v1';
const DATA_URL = 'dances.json';
const FORMATIONS_URL = 'formations.json';
const ROLES_URL = 'roles.json';
const SETLISTS_URL = 'setlists.json';

document.addEventListener('DOMContentLoaded', () => {
  setupFilterHandlers();
  setupCallingModeToggle();
  setupNextPrevButtons();
  setupSetlistStaticHandlers();
  setupSetlistEditorToggle();
  loadData();
  registerServiceWorker();
});

/** Data loading **/

async function loadData() {
  try {
    const local = localStorage.getItem(STORAGE_KEY_DANCES);
    if (local) {
      try {
        dances = JSON.parse(local);
      } catch {
        dances = [];
      }
    }

    const [danceData, formationData, rolesData, setlistsData] = await Promise.all([
      fetchJson(DATA_URL),
      fetchJson(FORMATIONS_URL),
      fetchJson(ROLES_URL),
      fetchJson(SETLISTS_URL)
    ]);

    if (Array.isArray(danceData) && danceData.length) {
      dances = danceData;
      localStorage.setItem(STORAGE_KEY_DANCES, JSON.stringify(dances));
    }

    formations = Array.isArray(formationData) ? formationData : [];
    rolesRaw = Array.isArray(rolesData) ? rolesData : [];
    setlists = Array.isArray(setlistsData) ? setlistsData : [];

    rebuildDanceIndex();
    initialiseRoleSets();
    initialiseSetlists();

    populateFilterOptions();
    applyFilters();

  } catch (err) {
    console.error('Error loading data', err);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

function rebuildDanceIndex() {
  danceById = {};
  dances.forEach(d => {
    if (d && d.id) {
      danceById[d.id] = d;
    }
  });
}

/** Formation resolution helpers **/

function normaliseFormationString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')   // en/em dash → hyphen
    .replace(/[^a-z0-9]+/g, ' ')      // strip punctuation
    .replace(/\s+/g, ' ')             // collapse spaces
    .trim();
}

function getFormationForDance(d) {
  if (!d || !d.formationName) return null;
  const target = normaliseFormationString(d.formationName);
  if (!target) return null;

  // 1) exact normalised name match
  let match = formations.find(f => normaliseFormationString(f.name) === target);
  if (match) return match;

  // 2) loose substring match (helps while dances.json is dirty)
  match = formations.find(f => {
    const fName = normaliseFormationString(f.name);
    return fName.includes(target) || target.includes(fName);
  });

  return match || null;
}

/** Roles / terminology **/

function initialiseRoleSets() {
  roleSets = {};
  rolesRaw.forEach(r => {
    if (!r || !r.id) return;
    roleSets[r.id] = r;
  });

  const select = document.getElementById('role-set-select');
  if (!select) return;

  select.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Person 1 / Person 2';
  select.appendChild(defaultOption);

  Object.values(roleSets).forEach(rs => {
    const opt = document.createElement('option');
    opt.value = rs.id;
    opt.textContent = rs.label || rs.id;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    currentRoleSetId = select.value || null;
    renderCurrentDance();
  });
}

/** Setlists **/

function initialiseSetlists() {
  const stored = localStorage.getItem(STORAGE_KEY_SETLISTS);
  if (stored) {
    try {
      workingSetlists = JSON.parse(stored);
    } catch {
      workingSetlists = JSON.parse(JSON.stringify(setlists));
    }
  } else {
    workingSetlists = JSON.parse(JSON.stringify(setlists));
  }

  populateSetlistSelect();
  renderSetlistEditor();
}

function populateSetlistSelect() {
  const select = document.getElementById('setlist-select');
  if (!select) return;

  const current = currentSetlistId;

  // keep first "All dances" option
  const first = select.querySelector('option:first-child');
  select.innerHTML = '';
  if (first) {
    select.appendChild(first);
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'All dances';
    select.appendChild(opt);
  }

  workingSetlists.forEach(sl => {
    const opt = document.createElement('option');
    opt.value = sl.id;
    opt.textContent = sl.name || sl.id;
    select.appendChild(opt);
  });

  if (current && workingSetlists.some(s => s.id === current)) {
    select.value = current;
  } else {
    select.value = '';
    currentSetlistId = '';
  }
}

function setupSetlistStaticHandlers() {
  const select = document.getElementById('setlist-select');
  if (select) {
    select.addEventListener('change', () => {
      currentSetlistId = select.value || '';
      renderSetlistEditor();
      applyFilters();
    });
  }

  const addBtn = document.getElementById('add-current-to-setlist');
  if (addBtn) {
    addBtn.addEventListener('click', addCurrentDanceToSetlist);
  }

  const resetBtn = document.getElementById('reset-setlist');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetActiveSetlistToOriginal);
  }

  const editor = document.getElementById('setlist-editor');
  if (editor) {
    editor.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const index = parseInt(li.getAttribute('data-index'), 10);
      if (Number.isNaN(index)) return;

      if (e.target.classList.contains('remove-item')) {
        removeSetlistItem(index);
      } else if (e.target.classList.contains('move-up')) {
        moveSetlistItem(index, -1);
      } else if (e.target.classList.contains('move-down')) {
        moveSetlistItem(index, +1);
      }
    });
  }
}

function resetActiveSetlistToOriginal() {
  if (!currentSetlistId) return;
  const original = setlists.find(s => s.id === currentSetlistId);
  if (!original) return;

  const index = workingSetlists.findIndex(s => s.id === currentSetlistId);
  if (index === -1) return;

  workingSetlists[index] = JSON.parse(JSON.stringify(original));
  saveWorkingSetlists();
  renderSetlistEditor();
}

function getActiveSetlist() {
  if (!currentSetlistId) return null;
  return workingSetlists.find(s => s.id === currentSetlistId) || null;
}

function renderSetlistEditor() {
  const wrapper = document.getElementById('setlist-editor-wrapper');
  const ul = document.getElementById('setlist-editor');
  if (!wrapper || !ul) return;

  const active = getActiveSetlist();
  if (!active || !setlistEditorOpen) {
    wrapper.classList.add('hidden');
    ul.innerHTML = '';
    return;
  }

  wrapper.classList.remove('hidden');
  ul.innerHTML = '';

  active.items.forEach((item, index) => {
    const li = document.createElement('li');
    li.setAttribute('data-index', String(index));
    li.setAttribute('data-dance-id', item.danceId);

    const labelSpan = document.createElement('span');
    const ro = item.roughOrder != null ? item.roughOrder : (index + 1);
    labelSpan.className = 'setlist-label';
    labelSpan.textContent = `${ro}. ${item.name}`;

    const controlsSpan = document.createElement('span');
    controlsSpan.className = 'setlist-item-buttons';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'move-up';
    upBtn.textContent = '↑';
    upBtn.addEventListener('click', () => moveSetlistItem(index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'move-down';
    downBtn.textContent = '↓';
    downBtn.addEventListener('click', () => moveSetlistItem(index, +1));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-item';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeSetlistItem(index));

    controlsSpan.appendChild(upBtn);
    controlsSpan.appendChild(downBtn);
    controlsSpan.appendChild(removeBtn);

    li.appendChild(labelSpan);
    li.appendChild(controlsSpan);

    ul.appendChild(li);
  });
}

function setupSetlistEditorToggle() {
  const btn = document.getElementById('toggle-setlist-editor');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const active = getActiveSetlist();
    if (!active) {
      alert('Select a setlist first.');
      return;
    }
    setlistEditorOpen = !setlistEditorOpen;
    renderSetlistEditor();
  });
}

function saveWorkingSetlists() {
  try {
    localStorage.setItem(STORAGE_KEY_SETLISTS, JSON.stringify(workingSetlists));
  } catch (err) {
    console.warn('Could not persist setlists to localStorage', err);
  }
}

function moveSetlistItem(index, delta) {
  const active = getActiveSetlist();
  if (!active) return;
  const items = active.items;
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= items.length) return;

  const [moved] = items.splice(index, 1);
  items.splice(newIndex, 0, moved);

  saveWorkingSetlists();
  renderSetlistEditor();
  applyFilters();
}

function removeSetlistItem(index) {
  const active = getActiveSetlist();
  if (!active) return;
  active.items.splice(index, 1);
  saveWorkingSetlists();
  renderSetlistEditor();
  applyFilters();
}

function addCurrentDanceToSetlist() {
  const active = getActiveSetlist();
  if (!active || !currentDanceId) return;

  if (active.items.some(i => i.danceId === currentDanceId)) return;

  const d = danceById[currentDanceId];
  if (!d) return;

  const nextOrder = active.items.length
    ? (active.items[active.items.length - 1].roughOrder || active.items.length) + 1
    : 1;

  active.items.push({
    roughOrder: nextOrder,
    doing: null,
    danceId: currentDanceId,
    name: d.title || currentDanceId,
    speed: d.speed || null,
    form: d.formationName || null,
    bars: d.structure && typeof d.structure.barsPerPart === 'number'
      ? d.structure.barsPerPart
      : null,
    musicType: d.musicType || null
  });

  saveWorkingSetlists();
  renderSetlistEditor();
  applyFilters();
}

/** Filters and controls **/

function setupFilterHandlers() {
  const formationSelect = document.getElementById('filter-formation');
  const barsSelect = document.getElementById('filter-bars');
  const musicTypeSelect = document.getElementById('filter-music-type');
  const difficultySelect = document.getElementById('filter-difficulty');
  const clearBtn = document.getElementById('clear-filters');
  const danceSelect = document.getElementById('dance-select');

  [formationSelect, barsSelect, musicTypeSelect, difficultySelect].forEach(sel => {
    if (!sel) return;
    sel.addEventListener('change', () => {
      applyFilters();
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (formationSelect) formationSelect.value = '';
      if (barsSelect) barsSelect.value = '';
      if (musicTypeSelect) musicTypeSelect.value = '';
      if (difficultySelect) difficultySelect.value = '';
      applyFilters();
    });
  }

  if (danceSelect) {
    danceSelect.addEventListener('change', () => {
      currentDanceId = danceSelect.value || null;
      renderCurrentDance();
    });
  }
}

function populateFilterOptions() {
  const formationSelect = document.getElementById('filter-formation');
  const barsSelect = document.getElementById('filter-bars');
  const musicTypeSelect = document.getElementById('filter-music-type');

  // Formation filter: driven from formations.json
  if (formationSelect) {
    const currentValue = formationSelect.value;
    // assume first option is the blank "Any formation"
    const first = formationSelect.querySelector('option:first-child');
    formationSelect.innerHTML = '';
    if (first) {
      formationSelect.appendChild(first);
    } else {
      const anyOpt = document.createElement('option');
      anyOpt.value = '';
      anyOpt.textContent = 'Any formation';
      formationSelect.appendChild(anyOpt);
    }

    formations.forEach(f => {
      if (!f || !f.id) return;
      const opt = document.createElement('option');
      opt.value = f.id;          // key is the formation id
      opt.textContent = f.name;  // label is the canonical name
      formationSelect.appendChild(opt);
    });

    // try to preserve selection if still valid
    if (currentValue && formations.some(f => f.id === currentValue)) {
      formationSelect.value = currentValue;
    } else {
      formationSelect.value = '';
    }
  }

  // Bars filter still inferred from dances for now
  if (barsSelect) {
    const seen = new Set();
    // preserve first option
    const first = barsSelect.querySelector('option:first-child');
    barsSelect.innerHTML = '';
    if (first) {
      barsSelect.appendChild(first);
    } else {
      const anyOpt = document.createElement('option');
      anyOpt.value = '';
      anyOpt.textContent = 'Any bars';
      barsSelect.appendChild(anyOpt);
    }
    dances.forEach(d => {
      const bars = d.structure && typeof d.structure.barsPerPart === 'number'
        ? d.structure.barsPerPart
        : null;
      if (!bars) return;
      if (seen.has(bars)) return;
      seen.add(bars);
      const opt = document.createElement('option');
      opt.value = String(bars);
      opt.textContent = String(bars);
      barsSelect.appendChild(opt);
    });
  }

  // Music type filter still inferred from dances
  if (musicTypeSelect) {
    const seen = new Set();
    const first = musicTypeSelect.querySelector('option:first-child');
    musicTypeSelect.innerHTML = '';
    if (first) {
      musicTypeSelect.appendChild(first);
    } else {
      const anyOpt = document.createElement('option');
      anyOpt.value = '';
      anyOpt.textContent = 'Any music type';
      musicTypeSelect.appendChild(anyOpt);
    }
    dances.forEach(d => {
      const m = d.musicType || '';
      if (!m) return;
      if (seen.has(m)) return;
      seen.add(m);
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      musicTypeSelect.appendChild(opt);
    });
  }
}

function applyFilters() {
  const formationSelect = document.getElementById('filter-formation');
  const barsSelect = document.getElementById('filter-bars');
  const musicTypeSelect = document.getElementById('filter-music-type');
  const difficultySelect = document.getElementById('filter-difficulty');

  const formationFilter = formationSelect ? formationSelect.value : '';
  const barsFilter = barsSelect ? barsSelect.value : '';
  const musicTypeFilter = musicTypeSelect ? musicTypeSelect.value : '';
  const difficultyFilter = difficultySelect ? difficultySelect.value : '';

  // Always filter from the full dance list; setlists control ordering and calling, not visibility
  const baseDances = dances.slice();

  filteredDances = baseDances.filter(d => {
    // Formation filter using formations.json (by formation id)
    if (formationFilter) {
      const f = getFormationForDance(d);
      if (!f || f.id !== formationFilter) return false;
    }

    if (barsFilter) {
      const bars = d.structure && typeof d.structure.barsPerPart === 'number'
        ? d.structure.barsPerPart
        : null;
      if (!bars || String(bars) !== barsFilter) return false;
    }
    if (musicTypeFilter && d.musicType !== musicTypeFilter) return false;
    if (difficultyFilter) {
      const diff = d.difficulty || null;
      if (!diff || String(diff) !== difficultyFilter) return false;
    }
    return true;
  });

  // When not using a setlist, keep alphabetical order
  const activeSetlist = getActiveSetlist();
  if (!activeSetlist) {
    filteredDances.sort((a, b) => {
      const ta = (a.title || '').toLowerCase();
      const tb = (b.title || '').toLowerCase();
      if (ta < tb) return -1;
      if (ta > tb) return 1;
      return 0;
    });
  }

  renderDanceSelect();
}

/** Dance selection **/

function renderDanceSelect() {
  const select = document.getElementById('dance-select');
  if (!select) return;

  const previous = currentDanceId;

  select.innerHTML = '';

  filteredDances.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.title || d.id;
    select.appendChild(opt);
  });

  if (!filteredDances.length) {
    currentDanceId = null;
    renderCurrentDance();
    return;
  }

  const found = previous && filteredDances.find(d => d.id === previous);
  if (found) {
    currentDanceId = previous;
  } else {
    currentDanceId = filteredDances[0].id;
  }

  select.value = currentDanceId;
  renderCurrentDance();
}

function renderCurrentDance() {
  const d = currentDanceId ? danceById[currentDanceId] : null;

  const titleEl = document.getElementById('dance-title');
  const formationEl = document.getElementById('dance-formation');
  const structureEl = document.getElementById('dance-structure');
  const speedEl = document.getElementById('dance-speed');
  const musicTypeEl = document.getElementById('dance-music-type');
  const difficultyEl = document.getElementById('dance-difficulty');

  const callsContainer = document.getElementById('calls-container');
  const infoContainer = document.getElementById('info-container');
  const figureContainer = document.getElementById('figure-container');

  if (!d) {
    if (titleEl) titleEl.textContent = '';
    if (formationEl) formationEl.textContent = '';
    if (structureEl) structureEl.textContent = '';
    if (speedEl) speedEl.textContent = '';
    if (musicTypeEl) musicTypeEl.textContent = '';
    if (difficultyEl) difficultyEl.textContent = '';
    if (callsContainer) callsContainer.innerHTML = '';
    if (infoContainer) infoContainer.innerHTML = '';
    if (figureContainer) figureContainer.innerHTML = '';
    return;
  }

  const formation = getFormationForDance(d);

  if (titleEl) titleEl.textContent = d.title || d.id;
  if (formationEl) {
    const label = formation
      ? `Formation: ${formation.name}`
      : (d.formationName ? `Formation: ${d.formationName}` : '');
    formationEl.textContent = label;
  }

  if (structureEl) {
    const bars = d.structure && typeof d.structure.barsPerPart === 'number'
      ? d.structure.barsPerPart
      : null;
    structureEl.textContent = bars ? `Bars: ${bars}` : '';
  }

  if (speedEl) speedEl.textContent = d.speed ? `Speed: ${d.speed}` : '';
  if (musicTypeEl) musicTypeEl.textContent = d.musicType ? `Music: ${d.musicType}` : '';

  if (difficultyEl) {
    const diffLabel = d.difficulty === 1
      ? 'Difficulty: Easy'
      : d.difficulty === 2
      ? 'Difficulty: Medium'
      : d.difficulty === 3
      ? 'Difficulty: Hard'
      : '';
    difficultyEl.textContent = diffLabel;
  }

  // Calls
  if (callsContainer) {
    callsContainer.innerHTML = '';

    if (Array.isArray(d.calls) && d.calls.length && d.structure && Array.isArray(d.structure.parts)) {
      const table = document.createElement('table');
      table.className = 'calls-table';

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      const thBars = document.createElement('th');
      thBars.textContent = 'BARS';
      const thCalls = document.createElement('th');
      thCalls.textContent = 'CALLS';
      headRow.appendChild(thBars);
      headRow.appendChild(thCalls);
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      d.structure.parts.forEach(partId => {
        const rowCalls = d.calls.filter(c => c.part === partId);
        if (!rowCalls.length) return;

        const tr = document.createElement('tr');

        const tdBars = document.createElement('td');
        tdBars.innerHTML = `<strong>${partId}</strong>`;
        tr.appendChild(tdBars);

        const tdCalls = document.createElement('td');
        const combinedHtml = rowCalls.map(c => c.call || '').join('<br>');
        tdCalls.innerHTML = applyRoleSetToHtml(combinedHtml);
        tr.appendChild(tdCalls);

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      callsContainer.appendChild(table);
    } else if (d.instructionsHtml) {
      const div = document.createElement('div');
      div.innerHTML = applyRoleSetToHtml(d.instructionsHtml);
      callsContainer.appendChild(div);
    }
  }

  // Formation panel (was "Info")
  if (infoContainer) {
    infoContainer.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = 'Formation';
    infoContainer.appendChild(heading);

    if (formation) {
      if (formation.description) {
        const descP = document.createElement('p');
        descP.textContent = applyRoleSetToText(formation.description);
        infoContainer.appendChild(descP);
      }

      if (formation.diagramImage) {
        const img = document.createElement('img');
        img.src = formation.diagramImage;
        img.alt = formation.name || 'Formation diagram';
        infoContainer.appendChild(img);
      } else {
        const p = document.createElement('p');
        p.textContent = 'No formation image added yet';
        infoContainer.appendChild(p);
      }
    } else {
      const p = document.createElement('p');
      p.textContent = 'No formation details added yet';
      infoContainer.appendChild(p);
    }
  }

  if (figureContainer) {
    figureContainer.innerHTML = '';

    let hasFigure = false;

    if (d.figureHtml) {
      const div = document.createElement('div');
      div.innerHTML = d.figureHtml;
      figureContainer.appendChild(div);
      hasFigure = true;
    } else if (d.figureImage) {
      const img = document.createElement('img');
      img.src = d.figureImage;
      img.alt = `${d.title} figure`;
      figureContainer.appendChild(img);
      hasFigure = true;
    }

    if (!hasFigure) {
      const p = document.createElement('p');
      p.textContent = 'No dance illustration added yet';
      figureContainer.appendChild(p);
    }
  }
}

/** Role text substitution, Person1 / Person2 baseline **/

function callText(call) {
  if (typeof call === 'string') return call;
  if (!call) return '';
  // Support both legacy {text: ''} and new {call: ''}
  return call.call || call.text || '';
}

function applyRoleSetToText(text) {
  if (!text) return '';
  // Baseline: map neutral tokens and legacy role words to Person 1 / Person 2
  let result = text
    .replace(/\[P1s\]/g, 'Person 1s')
    .replace(/\[P1\]/g, 'Person 1')
    .replace(/\[P2s\]/g, 'Person 2s')
    .replace(/\[P2\]/g, 'Person 2')
    .replace(/\bLarks\b/g, 'Person 1s')
    .replace(/\bLark\b/g, 'Person 1')
    .replace(/\bRobins\b/g, 'Person 2s')
    .replace(/\bRobin\b/g, 'Person 2');

  const rs = currentRoleSetId ? roleSets[currentRoleSetId] : null;
  if (!rs) return result;

  const map = rs.mapping || rs;
  if (!map) return result;

  const p1 = map.P1 || 'Person 1';
  const p2 = map.P2 || 'Person 2';
  const p1s = map.P1S || p1;
  const p2s = map.P2S || p2;

  result = result
    .replace(/\bPerson 1s\b/g, p1s)
    .replace(/\bPerson 2s\b/g, p2s)
    .replace(/\bPerson 1\b/g, p1)
    .replace(/\bPerson 2\b/g, p2);

  return result;
}

function applyRoleSetToHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  walkTextNodes(tmp, node => {
    node.textContent = applyRoleSetToText(node.textContent);
  });
  return tmp.innerHTML;
}

function walkTextNodes(root, fn) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    fn(node);
  }
}

/** Calling mode **/

function setupCallingModeToggle() {
  const btn = document.getElementById('toggle-calling-mode');
  if (!btn) return;
  btn.addEventListener('click', () => {
    callingMode = !callingMode;
    updateCallingModeUI();
  });
}

function updateCallingModeUI() {
  const body = document.body;
  if (callingMode) {
    body.classList.add('calling-mode');
  } else {
    body.classList.remove('calling-mode');
  }

  const btn = document.getElementById('toggle-calling-mode');
  if (btn) {
    btn.textContent = callingMode ? 'Exit calling mode' : 'Calling mode';
  }
}

/** Next / previous **/

function setupNextPrevButtons() {
  const prevBtn = document.getElementById('prev-dance');
  const nextBtn = document.getElementById('next-dance');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => stepDance(-1));
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => stepDance(1));
  }
}

function stepDance(delta) {
  if (!currentDanceId) return;

  const activeSetlist = getActiveSetlist();
  let sequence;

  if (activeSetlist && Array.isArray(activeSetlist.items) && activeSetlist.items.length) {
    sequence = activeSetlist.items
      .map(item => danceById[item.danceId])
      .filter(Boolean);
  } else {
    sequence = filteredDances.slice();
  }

  if (!sequence.length) return;

  const index = sequence.findIndex(d => d.id === currentDanceId);
  if (index === -1) return;

  let newIndex = index + delta;
  if (newIndex < 0) newIndex = sequence.length - 1;
  if (newIndex >= sequence.length) newIndex = 0;

  const newDance = sequence[newIndex];
  if (!newDance) return;

  currentDanceId = newDance.id;

  const select = document.getElementById('dance-select');
  if (select) select.value = currentDanceId;

  renderCurrentDance();
}

/** Service worker **/

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('service-worker.js').catch(err => {
    console.warn('Service worker registration failed', err);
  });
}
