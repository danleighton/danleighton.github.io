const DATA_URL = 'dances.json';
const FORMATIONS_URL = 'formations.json';
const STORAGE_KEY = 'ceilidh-dances-v1';

let dances = [];
let formations = [];
let filteredDances = [];
let currentDanceId = null;

let infoVisible = true;
let formationVisible = false;
let danceFigureVisible = false;

const roleSets = {
  'person1-person2': {
    label: 'Person 1 / Person 2',
    P1: 'Person 1',
    P1S: 'People 1',
    P2: 'Person 2',
    P2S: 'People 2'
  },
  'larks-robins': {
    label: 'Larks / Robins',
    P1: 'Lark',
    P1S: 'Larks',
    P2: 'Robin',
    P2S: 'Robins'
  },
  'gents-ladies': {
    label: 'Gents / Ladies',
    P1: 'Gent',
    P1S: 'Gents',
    P2: 'Lady',
    P2S: 'Ladies'
  },
  'men-women': {
    label: 'Men / Women',
    P1: 'Man',
    P1S: 'Men',
    P2: 'Woman',
    P2S: 'Women'
  }
};

let currentRoleSetKey = 'person1-person2';

document.addEventListener('DOMContentLoaded', () => {
  setupFilters();
  setupRoleSetSelect();
  setupViewToggles();
  loadData();
});

/* Setup */

function setupFilters() {
  ['formation', 'difficulty', 'tunetype', 'bars'].forEach(id => {
    const el = document.getElementById(`filter-${id}`);
    el.addEventListener('change', applyFilters);
  });

  const danceSelect = document.getElementById('dance-select');
  danceSelect.addEventListener('change', () => {
    const id = danceSelect.value;
    if (id) showDance(id);
  });
}

function setupRoleSetSelect() {
  const select = document.getElementById('role-set');
  Object.keys(roleSets).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = roleSets[key].label;
    select.appendChild(opt);
  });
  select.value = currentRoleSetKey;

  select.addEventListener('change', e => {
    currentRoleSetKey = e.target.value;
    if (currentDanceId) {
      showDance(currentDanceId);
    }
  });
}

function setupViewToggles() {
  document.getElementById('toggle-info').addEventListener('click', () => {
    infoVisible = !infoVisible;
    updateVisibility();
  });

  document
    .getElementById('toggle-formation')
    .addEventListener('click', () => {
      formationVisible = !formationVisible;
      updateVisibility();
    });

  document
    .getElementById('toggle-dance-figure')
    .addEventListener('click', () => {
      danceFigureVisible = !danceFigureVisible;
      updateVisibility();
    });
}

/* Visibility */

function updateVisibility() {
  const meta = document.getElementById('dance-meta');
  const toggleInfo = document.getElementById('toggle-info');

  const formationWrapper = document.getElementById('formation-diagram-wrapper');
  const toggleFormation = document.getElementById('toggle-formation');

  const danceDiagramWrapper = document.getElementById('dance-diagram-wrapper');
  const toggleDanceFigure = document.getElementById('toggle-dance-figure');

  if (infoVisible) {
    meta.classList.remove('hidden');
    toggleInfo.textContent = 'Hide info';
  } else {
    meta.classList.add('hidden');
    toggleInfo.textContent = 'Show info';
  }

  if (formationVisible) {
    formationWrapper.classList.remove('hidden');
    toggleFormation.textContent = 'Hide formation';
  } else {
    formationWrapper.classList.add('hidden');
    toggleFormation.textContent = 'Show formation';
  }

  if (danceFigureVisible) {
    danceDiagramWrapper.classList.remove('hidden');
    toggleDanceFigure.textContent = 'Hide dance figure';
  } else {
    danceDiagramWrapper.classList.add('hidden');
    toggleDanceFigure.textContent = 'Show dance figure';
  }
}

/* Roles */

function applyRoleSet(html) {
  if (!html) return '';
  const map = roleSets[currentRoleSetKey] || roleSets['person1-person2'];
  return html.replace(/\[(P1S?|P2S?)\]/g, (match, key) => map[key] || match);
}

/* Data loading */

function loadData() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      dances = JSON.parse(local);
      filteredDances = dances.slice();
      renderAll();
    } catch (e) {
      console.warn('Could not parse local data', e);
    }
  }

  Promise.all([
    fetch(DATA_URL).then(res => {
      if (!res.ok) throw new Error('Network error for dances');
      return res.json();
    }),
    fetch(FORMATIONS_URL).then(res => {
      if (!res.ok) throw new Error('Network error for formations');
      return res.json();
    }).catch(err => {
      console.warn('Could not fetch formations.json', err);
      return [];
    })
  ])
    .then(([danceData, formationData]) => {
      dances = danceData;
      formations = formationData;
      filteredDances = dances.slice();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dances));
      renderAll();
    })
    .catch(err => {
      console.warn('Could not fetch data files', err);
      if (!local) {
        document.getElementById('dance-title').textContent =
          'No data available.';
      }
    });
}

/* Rendering */

function renderAll() {
  populateFilterOptions();
  applyFilters();
}

function populateFilterOptions() {
  const formationsSet = new Set();
  const difficulties = new Set();
  const tuneTypes = new Set();
  const bars = new Set();

  dances.forEach(d => {
    if (d.formationId) {
      const f = formations.find(fm => fm.id === d.formationId);
      if (f && f.name) formationsSet.add(f.name);
    }
    if (d.difficulty !== undefined) difficulties.add(String(d.difficulty));
    if (d.musicType) tuneTypes.add(d.musicType);
    if (d.structure && d.structure.barsPerPart) {
      bars.add(String(d.structure.barsPerPart));
    }
  });

  fillSelect('filter-formation', formationsSet);
  fillSelect('filter-difficulty', difficulties);
  fillSelect('filter-tunetype', tuneTypes);
  fillSelect('filter-bars', bars);
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  const current = select.value;
  while (select.options.length > 1) {
    select.remove(1);
  }
  Array.from(values).sort().forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
  if ([...select.options].some(o => o.value === current)) {
    select.value = current;
  }
}

function applyFilters() {
  const formationName = document.getElementById('filter-formation').value;
  const difficulty = document.getElementById('filter-difficulty').value;
  const tuneType = document.getElementById('filter-tunetype').value;
  const bars = document.getElementById('filter-bars').value;

  filteredDances = dances.filter(d => {
    if (formationName) {
      const f = formations.find(fm => fm.id === d.formationId);
      if (!f || f.name !== formationName) return false;
    }
    if (difficulty && String(d.difficulty) !== difficulty) return false;
    if (tuneType && d.musicType !== tuneType) return false;
    if (
      bars &&
      (!d.structure || String(d.structure.barsPerPart) !== bars)
    ) {
      return false;
    }
    return true;
  });

  renderDanceSelect();
}

function renderDanceSelect() {
  const select = document.getElementById('dance-select');
  const previous = currentDanceId;

  // Clear all except the first placeholder option
  while (select.options.length > 1) {
    select.remove(1);
  }

  if (!filteredDances.length) {
    select.disabled = true;
    document.getElementById('dance-title').textContent =
      'No dances match these filters.';
    document.getElementById('dance-meta').innerHTML = '';
    document.getElementById('calls-container').innerHTML = '';
    document.getElementById('formation-diagram').innerHTML = '';
    document.getElementById('dance-diagram').innerHTML = '';
    document.getElementById('tune-controls').innerHTML = '';
    document.getElementById('tune-notation').innerHTML = '';
    return;
  }

  select.disabled = false;

  filteredDances.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    const label = d.number ? `${d.number}. ${d.title}` : (d.title || d.id);
    opt.textContent = label;
    select.appendChild(opt);
  });

  let toShowId = previous;
  if (!toShowId || !filteredDances.some(d => d.id === toShowId)) {
    toShowId = filteredDances[0].id;
  }

  select.value = toShowId;
  showDance(toShowId);
}

function showDance(id) {
  const dance = dances.find(d => d.id === id);
  if (!dance) return;
  currentDanceId = id;

  const danceSelect = document.getElementById('dance-select');
  if (danceSelect.value !== id) {
    danceSelect.value = id;
  }

  const titleEl = document.getElementById('dance-title');
  const metaEl = document.getElementById('dance-meta');
  const callsEl = document.getElementById('calls-container');

  titleEl.innerHTML = '';
  metaEl.innerHTML = '';
  callsEl.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = dance.number
    ? `${dance.number}. ${dance.title}`
    : (dance.title || dance.id);
  titleEl.appendChild(h2);

  const formation = formations.find(f => f.id === dance.formationId);
  const formationName = formation ? formation.name : (dance.formationName || '');
  const formationDescSource =
    dance.formationDescriptionOverride || (formation ? formation.description : '');
  const formationDesc = applyRoleSet(formationDescSource || '');

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `
    <p><strong>Form:</strong> ${formationName || ''}</p>
    ${formationDesc ? `<p class="formation-description">${formationDesc}</p>` : ''}
    <p><strong>Speed:</strong> ${dance.speed || ''}</p>
    <p><strong>Music:</strong> ${dance.musicType || ''}</p>
    ${
      dance.musicExamples && dance.musicExamples.length
        ? `<p><strong>Suggested tunes:</strong> ${dance.musicExamples.join(', ')}</p>`
        : ''
    }
    <p><strong>Difficulty:</strong> ${dance.difficulty ?? ''}</p>
    <p><strong>Step:</strong> ${dance.step || ''}</p>
    <p><strong>Author:</strong> ${dance.author || ''}</p>
  `;
  metaEl.appendChild(meta);

  if (dance.calls && dance.calls.length) {
    const table = document.createElement('table');
    table.className = 'calls-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Part</th><th>Bars</th><th>Call</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    dance.calls.forEach(row => {
      const tr = document.createElement('tr');

      const tdPart = document.createElement('td');
      tdPart.textContent = row.part || '';
      tr.appendChild(tdPart);

      const tdBars = document.createElement('td');
      tdBars.textContent = row.bars || '';
      tr.appendChild(tdBars);

      const tdCall = document.createElement('td');
      const rawHtml = row.callHtml || (row.call || '');
      tdCall.innerHTML = applyRoleSet(rawHtml);
      tr.appendChild(tdCall);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    callsEl.appendChild(table);
  } else if (dance.instructionsHtml) {
    const block = document.createElement('div');
    block.className = 'instructions-block';
    block.innerHTML = applyRoleSet(dance.instructionsHtml);
    callsEl.appendChild(block);
  }

  renderFormationDiagram(dance, formation);
  renderDanceDiagram(dance);
  renderTunes(dance);
  updateVisibility();
}

function renderFormationDiagram(dance, formation) {
  const container = document.getElementById('formation-diagram');
  container.innerHTML = '';
  const fm = formation;
  if (!fm || !fm.diagramImage) return;

  const title = document.createElement('h3');
  title.textContent = 'Formation';
  container.appendChild(title);

  const img = document.createElement('img');
  img.alt = fm.name || 'Formation diagram';
  img.src = fm.diagramImage;
  container.appendChild(img);
}

function renderDanceDiagram(dance) {
  const container = document.getElementById('dance-diagram');
  container.innerHTML = '';
  if (!dance.danceDiagramImage) return;

  const title = document.createElement('h3');
  title.textContent = 'Dance figure';
  container.appendChild(title);

  const img = document.createElement('img');
  img.alt = dance.title + ' diagram';
  img.src = dance.danceDiagramImage;
  container.appendChild(img);
}

function renderTunes(dance) {
  const controls = document.getElementById('tune-controls');
  const notation = document.getElementById('tune-notation');
  controls.innerHTML = '';
  notation.innerHTML = '';

  if (!dance.tunes || !dance.tunes.length) {
    return;
  }

  const label = document.createElement('label');
  label.textContent = 'Suggested tune: ';

  const select = document.createElement('select');
  dance.tunes.forEach((tune, index) => {
    const opt = document.createElement('option');
    opt.value = String(index);
    opt.textContent = tune.title || `Tune ${index + 1}`;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    showTune(dance, Number(select.value));
  });

  label.appendChild(select);
  controls.appendChild(label);

  const linkWrap = document.createElement('div');
  const firstTune = dance.tunes[0];
  if (firstTune && firstTune.sessionUrl) {
    const a = document.createElement('a');
    a.href = firstTune.sessionUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'View on The Session';
    linkWrap.appendChild(a);
  }
  controls.appendChild(linkWrap);

  showTune(dance, 0);
}

function showTune(dance, index) {
  const tune = dance.tunes[index];
  const notation = document.getElementById('tune-notation');
  notation.innerHTML = '';

  if (!tune || !tune.abc) {
    notation.textContent = 'No ABC for this tune.';
    return;
  }

  if (window.ABCJS && ABCJS.renderAbc) {
    ABCJS.renderAbc('tune-notation', tune.abc);
  } else {
    const pre = document.createElement('pre');
    pre.textContent = tune.abc;
    notation.appendChild(pre);
  }
}