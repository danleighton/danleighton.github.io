// Core data
let dances = [];
let formations = [];
let roles = [];
let setlists = [];

let filteredDances = [];
let currentDanceIndex = 0;
let callingMode = false;

let currentSetlist = null;
let formationById = {};

// DOM elements
const danceSelect = document.getElementById("dance-select");
const roleSetSelect = document.getElementById("role-set-select");
const setlistSelect = document.getElementById("setlist-select");

const filterFormation = document.getElementById("filter-formation");
const filterBars = document.getElementById("filter-bars");
const filterMusicType = document.getElementById("filter-music-type");
const filterDifficulty = document.getElementById("filter-difficulty");
const clearFiltersBtn = document.getElementById("clear-filters");

const danceTitleEl = document.getElementById("dance-title");
const danceFormationEl = document.getElementById("dance-formation");
const danceStructureEl = document.getElementById("dance-structure");
const danceSpeedEl = document.getElementById("dance-speed");
const danceMusicTypeEl = document.getElementById("dance-music-type");
const danceDifficultyEl = document.getElementById("dance-difficulty");

const danceFormationDescriptionEl = document.getElementById("dance-formation-description");
const danceNotesEl = document.getElementById("dance-notes");
const formationDiagramContainer = document.getElementById("formation-diagram-container");

const infoContainer = document.getElementById("info-container");
const figureContainer = document.getElementById("figure-container");
const callsContainer = document.getElementById("calls-container");

const toggleCallingModeBtn = document.getElementById("toggle-calling-mode");
const prevDanceBtn = document.getElementById("prev-dance");
const nextDanceBtn = document.getElementById("next-dance");

const addCurrentToSetlistBtn = document.getElementById("add-current-to-setlist");
const resetSetlistBtn = document.getElementById("reset-setlist");
const setlistEditorWrapper = document.getElementById("setlist-editor-wrapper");
const setlistEditor = document.getElementById("setlist-editor");
const toggleSetlistEditorBtn = document.getElementById("toggle-setlist-editor");

const toggleFormationDiagramBtn = document.getElementById("toggle-formation-diagram");
const toggleDanceFigureBtn = document.getElementById("toggle-dance-figure");

// Helpers

function normaliseString(value) {
  return (value || "").toString().trim();
}

function buildFormationIndex() {
  formationById = {};
  formations.forEach((f) => {
    if (f && f.id) {
      formationById[f.id] = f;
    }
  });
}

// Data loading

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    console.error("Failed to load:", path, res.status);
    return null;
  }
  try {
    return await res.json();
  } catch (err) {
    console.error("Invalid JSON in", path, err);
    return null;
  }
}

async function loadData() {
  const [dancesData, formationsData, rolesData, setlistsData] = await Promise.all([
    loadJson("dances.json"),
    loadJson("formations.json"),
    loadJson("roles.json"),
    loadJson("setlists.json")
  ]);

  dances = Array.isArray(dancesData) ? dancesData : [];
  formations = Array.isArray(formationsData) ? formationsData : [];
  roles = Array.isArray(rolesData) ? rolesData : [];
  setlists = Array.isArray(setlistsData) ? setlistsData : [];

  buildFormationIndex();
  populateSelects();
  applyFilters();
  restoreLastDance();
  renderCurrentDance();
}

// UI population

function populateSelects() {
  populateDanceSelect();
  populateRolesSelect();
  populateSetlistSelect();
  populateFilterOptions();
}

function populateDanceSelect() {
  if (!danceSelect) return;
  danceSelect.innerHTML = "";
  dances.forEach((d, index) => {
    const option = document.createElement("option");
    option.value = d.id;
    option.textContent = d.title || d.id || `Dance ${index + 1}`;
    danceSelect.appendChild(option);
  });
}

function populateRolesSelect() {
  if (!roleSetSelect) return;
  roleSetSelect.innerHTML = "";
  roles.forEach((r) => {
    const option = document.createElement("option");
    option.value = r.id;
    option.textContent = r.name || r.id;
    roleSetSelect.appendChild(option);
  });
}

function populateSetlistSelect() {
  if (!setlistSelect) return;
  setlistSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "All dances";
  setlistSelect.appendChild(defaultOption);

  setlists.forEach((s) => {
    const option = document.createElement("option");
    option.value = s.id;
    option.textContent = s.name || s.id;
    setlistSelect.appendChild(option);
  });
}

function populateFilterOptions() {
  if (filterFormation) {
    filterFormation.innerHTML = "";
    const any = document.createElement("option");
    any.value = "";
    any.textContent = "Any formation";
    filterFormation.appendChild(any);

    const seen = new Set();
    formations.forEach((f) => {
      if (!f || !f.id || seen.has(f.id)) return;
      seen.add(f.id);
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name || f.id;
      filterFormation.appendChild(opt);
    });
  }

  const barSet = new Set();
  const musicTypeSet = new Set();
  const difficultySet = new Set();

  dances.forEach((d) => {
    if (d?.structure?.barsPerPart) {
      barSet.add(String(d.structure.barsPerPart));
    }
    if (d?.musicType) {
      musicTypeSet.add(normaliseString(d.musicType));
    }
    if (d?.difficulty) {
      difficultySet.add(normaliseString(d.difficulty));
    }
  });

  if (filterBars) {
    filterBars.innerHTML = "";
    const any = document.createElement("option");
    any.value = "";
    any.textContent = "Any";
    filterBars.appendChild(any);
    Array.from(barSet)
      .sort()
      .forEach((bars) => {
        const option = document.createElement("option");
        option.value = bars;
        option.textContent = bars;
        filterBars.appendChild(option);
      });
  }

  if (filterMusicType) {
    filterMusicType.innerHTML = "";
    const any = document.createElement("option");
    any.value = "";
    any.textContent = "Any";
    filterMusicType.appendChild(any);
    Array.from(musicTypeSet)
      .sort()
      .forEach((mt) => {
        const option = document.createElement("option");
        option.value = mt;
        option.textContent = mt;
        filterMusicType.appendChild(option);
      });
  }

  if (filterDifficulty) {
    filterDifficulty.innerHTML = "";
    const any = document.createElement("option");
    any.value = "";
    any.textContent = "Any";
    filterDifficulty.appendChild(any);
    Array.from(difficultySet)
      .sort()
      .forEach((diff) => {
        const option = document.createElement("option");
        option.value = diff;
        option.textContent = diff;
        filterDifficulty.appendChild(option);
      });
  }
}

// Filtering and selection

function getActiveSetlist() {
  const selectedId = setlistSelect?.value || "";
  if (!selectedId) return null;
  return setlists.find((s) => s.id === selectedId) || null;
}

function applyFilters() {
  const formationFilterValue = filterFormation?.value || "";
  const barsFilterValue = filterBars?.value || "";
  const musicTypeFilterValue = filterMusicType?.value || "";
  const difficultyFilterValue = filterDifficulty?.value || "";

  const activeSetlist = getActiveSetlist();
  const allowedIds = activeSetlist ? new Set(activeSetlist.danceIds || []) : null;

  filteredDances = dances.filter((d) => {
    if (allowedIds && !allowedIds.has(d.id)) return false;

    if (formationFilterValue) {
      const fid = d.formationId || "";
      if (!fid || fid !== formationFilterValue) return false;
    }

    if (barsFilterValue) {
      if (!d.structure || String(d.structure.barsPerPart || "") !== barsFilterValue) {
        return false;
      }
    }

    if (musicTypeFilterValue) {
      if (normaliseString(d.musicType) !== musicTypeFilterValue) return false;
    }

    if (difficultyFilterValue) {
      if (normaliseString(d.difficulty) !== difficultyFilterValue) return false;
    }

    return true;
  });

  if (filteredDances.length === 0) {
    currentDanceIndex = 0;
  } else {
    const currentDance = getCurrentDance();
    if (!currentDance) {
      currentDanceIndex = 0;
    } else {
      const newIndex = filteredDances.findIndex((d) => d.id === currentDance.id);
      currentDanceIndex = newIndex >= 0 ? newIndex : 0;
    }
  }

  populateDanceSelectFromFiltered();
  renderCurrentDance();
}

function populateDanceSelectFromFiltered() {
  if (!danceSelect) return;
  const currentId = getCurrentDance()?.id;
  danceSelect.innerHTML = "";
  filteredDances.forEach((d, index) => {
    const option = document.createElement("option");
    option.value = d.id;
    option.textContent = d.title || d.id || `Dance ${index + 1}`;
    if (d.id === currentId) option.selected = true;
    danceSelect.appendChild(option);
  });
}

function getCurrentDance() {
  if (!filteredDances.length) return null;
  if (currentDanceIndex < 0) currentDanceIndex = 0;
  if (currentDanceIndex >= filteredDances.length) {
    currentDanceIndex = filteredDances.length - 1;
  }
  return filteredDances[currentDanceIndex] || null;
}

function setCurrentDanceById(id) {
  const idx = filteredDances.findIndex((d) => d.id === id);
  if (idx >= 0) {
    currentDanceIndex = idx;
    renderCurrentDance();
    saveLastDance();
  }
}

function goToPreviousDance() {
  if (!filteredDances.length) return;
  currentDanceIndex = (currentDanceIndex - 1 + filteredDances.length) % filteredDances.length;
  renderCurrentDance();
  saveLastDance();
}

function goToNextDance() {
  if (!filteredDances.length) return;
  currentDanceIndex = (currentDanceIndex + 1) % filteredDances.length;
  renderCurrentDance();
  saveLastDance();
}

// Rendering

function renderCurrentDance() {
  const dance = getCurrentDance();

  if (!dance) {
    danceTitleEl.textContent = "No dance matches these filters";
    danceFormationEl.textContent = "";
    danceStructureEl.textContent = "";
    danceSpeedEl.textContent = "";
    danceMusicTypeEl.textContent = "";
    danceDifficultyEl.textContent = "";
    danceFormationDescriptionEl.textContent = "";
    danceNotesEl.textContent = "";
    if (formationDiagramContainer) formationDiagramContainer.innerHTML = "";
    if (infoContainer) infoContainer.innerHTML = "";
    if (figureContainer) figureContainer.innerHTML = "";
    if (callsContainer) callsContainer.innerHTML = "";
    return;
  }

  danceTitleEl.textContent = dance.title || dance.id || "Untitled dance";

  // Formation name and description from formations.json
  let formationLabel = "";
  let formationDescription = "";
  let formationDiagramImage = "";

  if (dance.formationId && formationById[dance.formationId]) {
    const f = formationById[dance.formationId];
    formationLabel = f.name || dance.formationId;
    formationDescription = f.description || "";
    formationDiagramImage = f.diagramImage || "";
  } else if (dance.formationName) {
    // Fallback during migration
    formationLabel = dance.formationName;
  }

  if (danceFormationEl) {
    danceFormationEl.textContent = formationLabel ? `Formation: ${formationLabel}` : "";
  }
  if (danceFormationDescriptionEl) {
    danceFormationDescriptionEl.textContent = formationDescription || "";
  }

  // Notes from dances.json (old formationName moved here)
  if (danceNotesEl) {
    danceNotesEl.textContent = dance.notes || "";
  }

  // Structure
  if (danceStructureEl) {
    if (dance.structure?.barsPerPart && Array.isArray(dance.structure.parts)) {
      const parts = dance.structure.parts.join(", ");
      danceStructureEl.textContent = `${dance.structure.barsPerPart} bars: ${parts}`;
    } else if (Array.isArray(dance.structure?.parts)) {
      danceStructureEl.textContent = `Parts: ${dance.structure.parts.join(", ")}`;
    } else {
      danceStructureEl.textContent = "";
    }
  }

  if (danceSpeedEl) {
    danceSpeedEl.textContent = dance.speed || "";
  }

  if (danceMusicTypeEl) {
    danceMusicTypeEl.textContent = dance.musicType || "";
  }

  if (danceDifficultyEl) {
    danceDifficultyEl.textContent = dance.difficulty || "";
  }

  // Formation diagram
  if (formationDiagramContainer) {
    formationDiagramContainer.innerHTML = "";
    if (formationDiagramImage) {
      const img = document.createElement("img");
      img.src = formationDiagramImage;
      img.alt = formationLabel || "Formation diagram";
      formationDiagramContainer.appendChild(img);
    } else {
      const p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = "No formation image added yet.";
      formationDiagramContainer.appendChild(p);
    }
  }

  // Extra info (currently unused but kept for future)
  if (infoContainer) {
    infoContainer.innerHTML = "";
    if (dance.infoHtml) {
      infoContainer.innerHTML = dance.infoHtml;
    }
  }

  // Dance figure illustration
  if (figureContainer) {
    figureContainer.innerHTML = "";
    if (dance.figureHtml) {
      figureContainer.innerHTML = dance.figureHtml;
    } else if (dance.figureImage) {
      const img = document.createElement("img");
      img.src = dance.figureImage;
      img.alt = dance.title ? `${dance.title} illustration` : "Dance illustration";
      figureContainer.appendChild(img);
    } else {
      const p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = "No dance illustration added yet.";
      figureContainer.appendChild(p);
    }
  }

  renderCalls(dance);
}

function renderCalls(dance) {
  if (!callsContainer) return;
  callsContainer.innerHTML = "";

  if (!Array.isArray(dance.calls) || dance.calls.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No calls defined for this dance.";
    callsContainer.appendChild(p);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  ["Part", "Bars", "Call"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  dance.calls.forEach((c) => {
    const tr = document.createElement("tr");

    const partTd = document.createElement("td");
    partTd.textContent = c.part || "";
    tr.appendChild(partTd);

    const barsTd = document.createElement("td");
    barsTd.textContent = c.bars != null ? String(c.bars) : "";
    tr.appendChild(barsTd);

    const callTd = document.createElement("td");
    callTd.innerHTML = c.call || "";
    tr.appendChild(callTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  callsContainer.appendChild(table);
}

// Calling mode

function setCallingMode(on) {
  callingMode = !!on;
  document.body.classList.toggle("calling-mode", callingMode);
  if (toggleCallingModeBtn) {
    toggleCallingModeBtn.textContent = callingMode ? "Exit calling mode" : "Calling mode";
  }
}

// Set lists

function loadSetlistIntoEditor(setlist) {
  if (!setlistEditor) return;
  if (!setlist) {
    setlistEditor.value = "";
    return;
  }
  const lines = (setlist.danceIds || []).map((id) => id);
  setlistEditor.value = lines.join("\n");
}

function saveEditorToSetlist() {
  const active = getActiveSetlist();
  if (!active || !setlistEditor) return;
  const lines = setlistEditor.value.split("\n").map((l) => l.trim()).filter(Boolean);
  active.danceIds = lines;
  applyFilters();
}

function addCurrentDanceToSetlist() {
  const active = getActiveSetlist();
  const currentDance = getCurrentDance();
  if (!active || !currentDance) return;

  active.danceIds = active.danceIds || [];
  if (!active.danceIds.includes(currentDance.id)) {
    active.danceIds.push(currentDance.id);
  }
  loadSetlistIntoEditor(active);
  applyFilters();
}

function resetActiveSetlist() {
  const active = getActiveSetlist();
  if (!active) return;
  active.danceIds = [];
  loadSetlistIntoEditor(active);
  applyFilters();
}

// Persistence

const LAST_DANCE_KEY = "ceilidh_last_dance_id";

function saveLastDance() {
  const current = getCurrentDance();
  if (!current) return;
  try {
    localStorage.setItem(LAST_DANCE_KEY, current.id);
  } catch (e) {
    console.warn("Failed to store last dance", e);
  }
}

function restoreLastDance() {
  let lastId = null;
  try {
    lastId = localStorage.getItem(LAST_DANCE_KEY);
  } catch (e) {
    lastId = null;
  }
  if (!lastId) {
    currentDanceIndex = 0;
    return;
  }
  const idx = filteredDances.findIndex((d) => d.id === lastId);
  currentDanceIndex = idx >= 0 ? idx : 0;
}

// Event wiring

function setupEvents() {
  if (danceSelect) {
    danceSelect.addEventListener("change", (e) => {
      const id = e.target.value;
      setCurrentDanceById(id);
    });
  }

  if (filterFormation) {
    filterFormation.addEventListener("change", applyFilters);
  }
  if (filterBars) {
    filterBars.addEventListener("change", applyFilters);
  }
  if (filterMusicType) {
    filterMusicType.addEventListener("change", applyFilters);
  }
  if (filterDifficulty) {
    filterDifficulty.addEventListener("change", applyFilters);
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (filterFormation) filterFormation.value = "";
      if (filterBars) filterBars.value = "";
      if (filterMusicType) filterMusicType.value = "";
      if (filterDifficulty) filterDifficulty.value = "";
      applyFilters();
    });
  }

  if (prevDanceBtn) {
    prevDanceBtn.addEventListener("click", goToPreviousDance);
  }
  if (nextDanceBtn) {
    nextDanceBtn.addEventListener("click", goToNextDance);
  }

  if (toggleCallingModeBtn) {
    toggleCallingModeBtn.addEventListener("click", () => {
      setCallingMode(!callingMode);
    });
  }

  if (setlistSelect) {
    setlistSelect.addEventListener("change", () => {
      currentSetlist = getActiveSetlist();
      loadSetlistIntoEditor(currentSetlist);
      applyFilters();
    });
  }

  if (toggleSetlistEditorBtn) {
    toggleSetlistEditorBtn.addEventListener("click", () => {
      if (!setlistEditorWrapper) return;
      const hidden = setlistEditorWrapper.classList.toggle("hidden");
      toggleSetlistEditorBtn.textContent = hidden ? "Edit raw set list" : "Hide raw set list";
    });
  }

  if (setlistEditor) {
    setlistEditor.addEventListener("change", saveEditorToSetlist);
    setlistEditor.addEventListener("blur", saveEditorToSetlist);
  }

  if (addCurrentToSetlistBtn) {
    addCurrentToSetlistBtn.addEventListener("click", addCurrentDanceToSetlist);
  }

  if (resetSetlistBtn) {
    resetSetlistBtn.addEventListener("click", resetActiveSetlist);
  }

  if (toggleFormationDiagramBtn && formationDiagramContainer) {
    toggleFormationDiagramBtn.addEventListener("click", () => {
      const isHidden = formationDiagramContainer.classList.toggle("hidden");
      toggleFormationDiagramBtn.textContent = isHidden ? "Show diagram" : "Hide diagram";
    });
  }

  if (toggleDanceFigureBtn && figureContainer) {
    toggleDanceFigureBtn.addEventListener("click", () => {
      const isHidden = figureContainer.classList.toggle("hidden");
      toggleDanceFigureBtn.textContent = isHidden ? "Show illustration" : "Hide illustration";
    });
  }
}

// Init

document.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  loadData().catch((err) => {
    console.error("Error loading data", err);
  });
});
