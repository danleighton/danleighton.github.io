const DATA_URL = 'dances.json';
const STORAGE_KEY = 'ceilidh-dances-v1';

let dances = [];
let filteredDances = [];
let currentDanceId = null;

document.addEventListener('DOMContentLoaded', () => {
  setupFilters();
  loadData();
});

function setupFilters() {
  ['formation', 'difficulty', 'tunetype', 'bars'].forEach(id => {
    const el = document.getElementById(`filter-${id}`);
    el.addEventListener('change', applyFilters);
  });
}

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

  fetch(DATA_URL)
    .then(res => {
      if (!res.ok) throw new Error('Network error');
      return res.json();
    })
    .then(data => {
      dances = data;
      filteredDances = dances.slice();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dances));
      renderAll();
    })
    .catch(err => {
      console.warn('Could not fetch dances.json', err);
      if (!local) {
        document.getElementById('dance-details').textContent =
          'No data available.';
      }
    });
}

function renderAll() {
  populateFilterOptions();
  applyFilters();
}

function populateFilterOptions() {
  const formations = new Set();
  const difficulties = new Set();
  const tuneTypes = new Set();
  const bars = new Set();

  dances.forEach(d => {
    if (d.form) formations.add(d.form);
    if (d.difficulty !== undefined) difficulties.add(String(d.difficulty));
    if (d.musicType) tuneTypes.add(d.musicType);
    if (d.structure && d.structure.barsPerPart) {
      bars.add(String(d.structure.barsPerPart));
    }
  });

  fillSelect('filter-formation', formations);
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
  const formation = document.getElementById('filter-formation').value;
  const difficulty = document.getElementById('filter-difficulty').value;
  const tuneType = document.getElementById('filter-tunetype').value;
  const bars = document.getElementById('filter-bars').value;

  filteredDances = dances.filter(d => {
    if (formation && d.form !== formation) return false;
    if (difficulty && String(d.difficulty) !== difficulty) return false;
    if (tuneType && d.musicType !== tuneType) return false;
    if (bars && (!d.structure || String(d.structure.barsPerPart) !== bars)) {
      return false;
    }
    return true;
  });

  renderDanceList();
}

function renderDanceList() {
  const listEl = document.getElementById('dance-list');
  listEl.innerHTML = '';

  if (!filteredDances.length) {
    listEl.textContent = 'No dances match these filters.';
    document.getElementById('dance-details').innerHTML = '';
    document.getElementById('tune-controls').innerHTML = '';
    document.getElementById('tune-notation').innerHTML = '';
    return;
  }

  filteredDances.forEach(d => {
    const item = document.createElement('button');
    item.className = 'dance-list-item';
    item.textContent = d.title || d.name || d.id;
    item.addEventListener('click', () => showDance(d.id));
    if (d.id === currentDanceId) {
      item.classList.add('active');
    }
    listEl.appendChild(item);
  });

  if (!currentDanceId) {
    showDance(filteredDances[0].id);
  } else if (!filteredDances.some(d => d.id === currentDanceId)) {
    showDance(filteredDances[0].id);
  }
}

function showDance(id) {
  const dance = dances.find(d => d.id === id);
  if (!dance) return;
  currentDanceId = id;

  document
    .querySelectorAll('.dance-list-item')
    .forEach(btn => btn.classList.toggle(
      'active',
      btn.textContent === (dance.title || dance.name || dance.id)
    ));

  const details = document.getElementById('dance-details');
  details.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = dance.title || dance.name || dance.id;
  details.appendChild(h2);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `
    <p><strong>Form:</strong> ${dance.form || ''}</p>
    <p><strong>Speed:</strong> ${dance.speed || ''}</p>
    <p><strong>Music:</strong> ${dance.musicType || ''}</p>
    <p><strong>Difficulty:</strong> ${dance.difficulty ?? ''}</p>
    <p><strong>Step:</strong> ${dance.step || ''}</p>
    <p><strong>Author:</strong> ${dance.author || ''}</p>
  `;
  details.appendChild(meta);

  if (dance.calls && dance.calls.length) {
    const table = document.createElement('table');
    table.className = 'calls-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Part</th><th>Bars</th><th>Call</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    dance.calls.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.part || ''}</td>
        <td>${row.bars || ''}</td>
        <td>${row.call || ''}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    details.appendChild(table);
  }

  renderTunes(dance);
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
  if (dance.tunes[0].sessionUrl) {
    const a = document.createElement('a');
    a.href = dance.tunes[0].sessionUrl;
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