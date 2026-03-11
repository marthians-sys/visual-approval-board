// ── Canvas & State management ──

const cvs = document.getElementById('canvas');
const ctx = cvs.getContext('2d');
// Brand name (saved in localStorage)
let brandName;

const PROJECTS_KEY = 'basewear_projects';
let currentProjectId = localStorage.getItem('basewear_current_project') || null;

// Projects list
let projectsList = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');

// Auto-create first project if none exist
if (projectsList.length === 0) {
  const id = 'proj_' + Date.now();
  projectsList.push({ id, name: 'BASEWEAR', created: Date.now() });
  currentProjectId = id;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projectsList));
  localStorage.setItem('basewear_current_project', currentProjectId);
  // Migrate existing data to this project
  const existingData = localStorage.getItem('basewear_canvas');
  if (existingData) {
    localStorage.setItem('basewear_data_' + id, existingData);
  }
}

if (!currentProjectId) {
  currentProjectId = projectsList[0].id;
  localStorage.setItem('basewear_current_project', currentProjectId);
}

const STORE_KEY = 'basewear_data_' + currentProjectId;
const IDB_NAME = 'basewear_images_' + currentProjectId;
const IDB_STORE = 'images';
const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');

const MIN_SCALE = 0.05;
const MAX_SCALE = 10;
const DOT_GAP = 24;

// Board default size (landscape)
const A4_W = 1122;
const A4_H = 794;
const BOARD_GAP = 60;

// Brand name — default to project name, not hardcoded
const _currentProj = projectsList.find(p => p.id === currentProjectId);
brandName = saved?.brandName ?? (_currentProj ? _currentProj.name : '');

// Pages system
let pages = saved?.pages ?? null;
let currentPageIndex = saved?.currentPageIndex ?? 0;
let currentSubPageIndex = saved?.currentSubPageIndex ?? -1;

if (!pages) {
  pages = [{
    name: 'Stránka 1',
    boards: [],
    panX: 0,
    panY: 0,
    scale: 1
  }];
  // Migrate old single-page data to first page
  if (saved?.boards && saved.boards.length > 0) {
    pages[0].boards = saved.boards;
    pages[0].panX = saved?.panX ?? 0;
    pages[0].panY = saved?.panY ?? 0;
    pages[0].scale = saved?.scale ?? 1;
  }
}

function currentPage() {
  const p = pages[currentPageIndex];
  if (currentSubPageIndex >= 0 && p.subPages && p.subPages[currentSubPageIndex]) {
    return p.subPages[currentSubPageIndex];
  }
  return p;
}

let panX, panY, scale, boards, freeImages;

function syncFromPage() {
  const p = currentPage();
  panX = p.panX;
  panY = p.panY;
  scale = p.scale;
  boards = p.boards;
  if (!p.freeImages) p.freeImages = [];
  freeImages = p.freeImages;
}

function syncToPage() {
  const p = currentPage();
  p.panX = panX;
  p.panY = panY;
  p.scale = scale;
}

syncFromPage();

// Logo (global for all pages)
let logoDataURL = saved?.logoDataURL ?? null;
let logoImg = null;

if (logoDataURL) {
  logoImg = new Image();
  logoImg.src = logoDataURL;
}

// ── IndexedDB for image storage ──

let idb = null;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      idb = req.result;
      resolve(idb);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbPut(key, value) {
  if (!idb) return;
  const tx = idb.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).put(value, key);
}

function idbGet(key) {
  return new Promise((resolve) => {
    if (!idb) { resolve(null); return; }
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

function idbDelete(key) {
  if (!idb) return;
  const tx = idb.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).delete(key);
}

// Save all images to IndexedDB
function saveIDBImages() {
  if (!idb) return;
  const allImages = {};

  // Collect images from a page-like object
  function collectPageImages(p, prefix) {
    if (!p.boards) return;
    p.boards.forEach((b, bi) => {
      if (b.images) {
        b.images.forEach((dataURL, si) => {
          if (dataURL) {
            allImages[`board_${prefix}_${bi}_${si}`] = dataURL;
          }
        });
      }
    });
    if (p.freeImages) {
      p.freeImages.forEach((fi, fi_i) => {
        if (fi.dataURL) {
          allImages[`free_${prefix}_${fi_i}`] = fi.dataURL;
        }
      });
    }
  }

  pages.forEach((p, pi) => {
    collectPageImages(p, `${pi}`);
    // Sub-pages
    if (p.subPages) {
      p.subPages.forEach((sp, spi) => {
        collectPageImages(sp, `${pi}_sub${spi}`);
      });
    }
  });

  // Logo
  if (logoDataURL) {
    allImages['logo'] = logoDataURL;
  }

  // Write all to IDB
  const tx = idb.transaction(IDB_STORE, 'readwrite');
  const store = tx.objectStore(IDB_STORE);
  store.clear();
  for (const [key, val] of Object.entries(allImages)) {
    store.put(val, key);
  }
}

// Load all images from IndexedDB and restore Image objects
async function loadIDBImages() {
  if (!idb) return;
  const tx = idb.transaction(IDB_STORE, 'readonly');
  const store = tx.objectStore(IDB_STORE);

  // Logo
  const logoData = await idbGet('logo');
  if (logoData && !logoDataURL) {
    logoDataURL = logoData;
    logoImg = new Image();
    logoImg.onload = () => draw();
    logoImg.src = logoDataURL;
  }

  // Load images for a page-like object
  async function loadPageImages(p, prefix) {
    if (!p.boards) return;
    for (let bi = 0; bi < p.boards.length; bi++) {
      const b = p.boards[bi];
      if (!b.images) b.images = [null, null];
      if (!b._imgObjects) b._imgObjects = [null, null];
      for (let si = 0; si < 2; si++) {
        const key = `board_${prefix}_${bi}_${si}`;
        const dataURL = await idbGet(key);
        if (dataURL) {
          b.images[si] = dataURL;
          const img = new Image();
          img.onload = () => draw();
          img.src = dataURL;
          b._imgObjects[si] = img;
        }
      }
    }
    if (p.freeImages) {
      for (let fi_i = 0; fi_i < p.freeImages.length; fi_i++) {
        const fi = p.freeImages[fi_i];
        const key = `free_${prefix}_${fi_i}`;
        const dataURL = await idbGet(key);
        if (dataURL) {
          fi.dataURL = dataURL;
          const img = new Image();
          img.onload = () => draw();
          img.src = dataURL;
          fi._img = img;
        }
      }
    }
  }

  for (let pi = 0; pi < pages.length; pi++) {
    await loadPageImages(pages[pi], `${pi}`);
    // Sub-pages
    if (pages[pi].subPages) {
      for (let spi = 0; spi < pages[pi].subPages.length; spi++) {
        await loadPageImages(pages[pi].subPages[spi], `${pi}_sub${spi}`);
      }
    }
  }
}

// Restore board image objects from saved dataURLs (localStorage fallback)
function restoreBoardImages() {
  boards.forEach(b => {
    if (b.images) {
      b._imgObjects = [null, null];
      b.images.forEach((dataURL, si) => {
        if (dataURL) {
          const img = new Image();
          img.src = dataURL;
          b._imgObjects[si] = img;
        }
      });
    }
  });
}
restoreBoardImages();

// Restore free image objects from saved dataURLs
function restoreFreeImages() {
  if (!freeImages) return;
  freeImages.forEach(fi => {
    if (fi.dataURL && !fi._img) {
      const img = new Image();
      img.src = fi.dataURL;
      fi._img = img;
    }
  });
}
restoreFreeImages();

// Interaction state
let dragBoard = null;
let moveMode = null;
let pointerMoved = false;
let menuBoardIndex = null;
let menuPin = null;
let pinMoveMode = null;
let hoveredComment = null;
let confirmDeleteComment = null;
let pinMode = null;
let hoveredPin = null;

// Free images (drag-and-drop PNGs)
let freeImageEditMode = false;
let dragFreeImage = null;
let resizeFreeImage = null;
let hoveredFreeImage = null;
let menuFreeImageIndex = null;
let hoveredImgSlot = null; // { boardIndex, slotIndex }

let _saveTimeout = null;

function saveState() {
  syncToPage();

  // Save structure (without image data) to localStorage
  const data = JSON.stringify({
    pages, currentPageIndex, currentSubPageIndex, brandName
  }, (key, value) => {
    // Skip runtime-only properties and image data
    if (key === '_img' || key === '_imgObjects' || key === '_screenRect' ||
        key === '_pinRects' || key === '_commentRects' || key === '_imgSlots' ||
        key === '_btnApprove' || key === '_btnReject' || key === '_btnComment' ||
        key === '_btnAddComment' || key === '_btnAddLeft' || key === '_btnAddRight' ||
        key === '_btnAddTop' || key === '_btnAddBottom' || key === 'dataURL' || key === 'images' ||
        key === 'logoDataURL') return undefined;
    return value;
  });
  try {
    localStorage.setItem(STORE_KEY, data);
  } catch (_) {}

  // Debounced save of images to IndexedDB
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(() => {
    saveIDBImages();
    // Also save images to Firebase Storage
    if (typeof firebaseSaveImages === 'function') firebaseSaveImages();
  }, 500);

  // Sync structure to Firebase
  if (typeof firebaseSaveStructure === 'function') firebaseSaveStructure();
}

// Init IndexedDB and load images
openIDB().then(() => {
  loadIDBImages();
}).catch(err => {
  console.warn('IndexedDB not available:', err);
});

// ── Project management ──

function saveProjectsList() {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projectsList));
  if (typeof firebaseSaveProjectsList === 'function') firebaseSaveProjectsList();
}

function switchToProject(projectId) {
  // Save current project first (only if it still exists)
  if (projectsList.find(p => p.id === currentProjectId)) {
    saveState();
    if (idb) saveIDBImages();
  }
  // Switch
  localStorage.setItem('basewear_current_project', projectId);
  localStorage.setItem('basewear_in_project', 'true');
  location.reload();
}

function createNewProject(name) {
  const id = 'proj_' + Date.now();
  projectsList.push({ id, name: name || 'Nový projekt', created: Date.now() });
  saveProjectsList();
  switchToProject(id);
}

function deleteProject(projectId) {
  projectsList = projectsList.filter(p => p.id !== projectId);
  // Remove data
  localStorage.removeItem('basewear_data_' + projectId);
  // Delete IDB
  try { indexedDB.deleteDatabase('basewear_images_' + projectId); } catch(_) {}
  // Delete from Firebase
  if (typeof firebaseDeleteProject === 'function') firebaseDeleteProject(projectId);
  saveProjectsList();
  // If current project was deleted
  if (currentProjectId === projectId) {
    if (projectsList.length > 0) {
      currentProjectId = projectsList[0].id;
    } else {
      currentProjectId = null;
    }
    localStorage.setItem('basewear_current_project', currentProjectId || '');
    localStorage.removeItem('basewear_in_project');
  }
}

function renameProject(projectId, newName) {
  const p = projectsList.find(p => p.id === projectId);
  if (p) {
    p.name = newName;
    saveProjectsList();
    // Also update brandName if this is the current project
    if (projectId === currentProjectId) {
      brandName = newName;
      const hudName = document.getElementById('hud-brand-name');
      if (hudName) hudName.textContent = brandName;
      saveState();
    }
  }
}
