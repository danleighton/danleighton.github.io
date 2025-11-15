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
      danceBy
