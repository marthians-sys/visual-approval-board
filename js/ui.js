// ── UI controls: modal, logo, buttons, resize, init ──

// ── Resize ──

function resize() {
  cvs.width = window.innerWidth * devicePixelRatio;
  cvs.height = window.innerHeight * devicePixelRatio;
  cvs.style.width = window.innerWidth + 'px';
  cvs.style.height = window.innerHeight + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  draw();
}
window.addEventListener('resize', resize);

// ── Add board (via modal) ──

const modalOverlay = document.getElementById('modal-overlay');
const boardTitleInput = document.getElementById('board-title-input');

document.getElementById('btn-add').addEventListener('click', () => {
  // Block board creation on pages that have sub-pages
  const p = pages[currentPageIndex];
  if (currentSubPageIndex < 0 && p.subPages && p.subPages.length > 0) {
    alert('Tato stránka má podkategorie. Plátna lze vytvářet pouze v podkategoriích.');
    return;
  }
  boardTitleInput.value = '';
  modalOverlay.classList.add('visible');
  setTimeout(() => boardTitleInput.focus(), 50);
});

function createBoard() {
  const title = boardTitleInput.value.trim();
  modalOverlay.classList.remove('visible');

  let x, y;
  if (boards.length === 0) {
    x = -A4_W / 2;
    y = -A4_H / 2;
  } else {
    const last = boards[boards.length - 1];
    x = last.x + A4_W + BOARD_GAP;
    y = boards[0].y;
  }
  boards.push({
    x, y,
    w: A4_W, h: A4_H,
    label: `#${boards.length + 1}`,
    title: title || ''
  });

  draw();
  renderPageList();
}

document.getElementById('modal-create').addEventListener('click', createBoard);
document.getElementById('modal-cancel').addEventListener('click', () => {
  modalOverlay.classList.remove('visible');
});

boardTitleInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') createBoard();
  if (e.key === 'Escape') modalOverlay.classList.remove('visible');
});

// ── Brand settings modal ──

const brandOverlay = document.getElementById('brand-overlay');
const brandNameInput = document.getElementById('brand-name-input');
const brandLogoFile = document.getElementById('brand-logo-file');
const brandLogoStatus = document.getElementById('brand-logo-status');
const hudBrandName = document.getElementById('hud-brand-name');
const hudBrandLogo = document.getElementById('hud-brand-logo');
const hudLogoSep = document.getElementById('hud-logo-sep');
let pendingBrandLogo = null;

// Init HUD from saved state
hudBrandName.textContent = brandName;
if (logoDataURL) {
  hudBrandLogo.src = logoDataURL;
  hudBrandLogo.style.display = '';
  hudLogoSep.style.display = '';
}

document.getElementById('hud-add').addEventListener('click', () => {
  brandNameInput.value = brandName;
  pendingBrandLogo = null;
  brandLogoStatus.textContent = logoDataURL ? 'logo nahráno' : 'žádné logo';
  brandOverlay.classList.add('visible');
  setTimeout(() => brandNameInput.focus(), 50);
});

document.getElementById('brand-logo-upload').addEventListener('click', () => {
  brandLogoFile.click();
});

brandLogoFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    pendingBrandLogo = ev.target.result;
    brandLogoStatus.textContent = file.name;
  };
  reader.readAsDataURL(file);
  brandLogoFile.value = '';
});

document.getElementById('brand-save').addEventListener('click', () => {
  const name = brandNameInput.value.trim();
  if (name) {
    brandName = name;
    hudBrandName.textContent = brandName;
  }
  if (pendingBrandLogo) {
    logoDataURL = pendingBrandLogo;
    logoImg = new Image();
    logoImg.onload = () => {
      draw();
      hudBrandLogo.src = logoDataURL;
      hudBrandLogo.style.display = '';
      hudLogoSep.style.display = '';
    };
    logoImg.src = logoDataURL;
  }
  brandOverlay.classList.remove('visible');
  saveState();
});

document.getElementById('brand-cancel').addEventListener('click', () => {
  brandOverlay.classList.remove('visible');
});

brandNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('brand-save').click();
  if (e.key === 'Escape') brandOverlay.classList.remove('visible');
});


// ── PNG upload (free image) ──

const pngInput = document.createElement('input');
pngInput.type = 'file';
pngInput.accept = 'image/*';
pngInput.style.display = 'none';
document.body.appendChild(pngInput);

function triggerPngUpload() {
  pngInput.value = '';
  pngInput.click();
}

pngInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const dataURL = ev.target.result;
    const img = new Image();
    img.onload = () => {
      // Scale down if too large (max 600px on longest side)
      const maxSize = 600;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxSize || h > maxSize) {
        const ratio = Math.min(maxSize / w, maxSize / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      // Place at center of current view
      const cx = -panX + window.innerWidth / 2 / scale;
      const cy = -panY + window.innerHeight / 2 / scale;
      freeImages.push({
        x: cx - w / 2,
        y: cy - h / 2,
        w, h,
        dataURL,
        locked: false,
        _img: img
      });
      saveState();
      draw();
    };
    img.src = dataURL;
  };
  reader.readAsDataURL(file);
});

// ── Buttons ──

document.getElementById('btn-reset').addEventListener('click', () => {
  scale = 1;
  if (boards.length > 0) {
    const b = boards[0];
    panX = -(b.x + b.w / 2) + window.innerWidth / 2;
    panY = -(b.y + b.h / 2) + window.innerHeight / 2;
  } else {
    panX = 0;
    panY = 0;
  }
  draw();
});

// ── Projects screen ──

const projectsScreen = document.getElementById('projects-screen');
const projectsListEl = document.getElementById('projects-list');

// Get brand data (name + logo) from a project's saved data
function getProjectBrandData(projectId) {
  if (projectId === currentProjectId) {
    return { brandName: brandName, logoDataURL: logoDataURL };
  }
  try {
    const data = JSON.parse(localStorage.getItem('basewear_data_' + projectId) || 'null');
    const projBrandName = data?.brandName || null;
    // Logo is stored in IDB, but we can try to get it from the project's IDB
    // For simplicity, check if there's a cached logo key in localStorage
    return { brandName: projBrandName, logoDataURL: null };
  } catch(_) {
    return { brandName: null, logoDataURL: null };
  }
}

// Cache project logos loaded from their IDBs
const projectLogoCache = {};

function loadProjectLogo(projectId, imgEl) {
  if (projectId === currentProjectId) {
    if (logoDataURL) {
      imgEl.src = logoDataURL;
      imgEl.style.display = '';
    }
    return;
  }
  if (projectLogoCache[projectId] !== undefined) {
    if (projectLogoCache[projectId]) {
      imgEl.src = projectLogoCache[projectId];
      imgEl.style.display = '';
    }
    return;
  }
  // Load from project's IDB
  const dbName = 'basewear_images_' + projectId;
  const req = indexedDB.open(dbName, 1);
  req.onupgradeneeded = () => { req.result.createObjectStore('images'); };
  req.onsuccess = () => {
    const db = req.result;
    try {
      const tx = db.transaction('images', 'readonly');
      const getReq = tx.objectStore('images').get('logo');
      getReq.onsuccess = () => {
        const data = getReq.result || null;
        projectLogoCache[projectId] = data;
        if (data) {
          imgEl.src = data;
          imgEl.style.display = '';
          // Hide placeholder if exists
          const placeholder = imgEl.parentElement.querySelector('.project-logo-placeholder');
          if (placeholder) placeholder.style.display = 'none';
        }
        db.close();
      };
      getReq.onerror = () => { projectLogoCache[projectId] = null; db.close(); };
    } catch(_) { db.close(); }
  };
  req.onerror = () => { projectLogoCache[projectId] = null; };
}

function renderProjectsList() {
  projectsListEl.innerHTML = '';

  projectsList.forEach(proj => {
    const item = document.createElement('div');
    item.className = 'project-item' + (proj.id === currentProjectId ? ' active' : '');

    // Folder tab
    const tab = document.createElement('div');
    tab.className = 'project-folder-tab';
    item.appendChild(tab);

    // Get brand data
    const brand = getProjectBrandData(proj.id);
    const displayName = brand.brandName || proj.name;

    // Logo area
    const logoArea = document.createElement('div');
    logoArea.className = 'project-logo-area';

    // Logo image (may load async from IDB)
    const logoImg = document.createElement('img');
    logoImg.alt = displayName;
    logoImg.style.display = 'none';
    logoArea.appendChild(logoImg);

    // Placeholder (first 2 letters of brand name)
    const placeholder = document.createElement('span');
    placeholder.className = 'project-logo-placeholder';
    placeholder.textContent = (displayName || '').substring(0, 2);
    logoArea.appendChild(placeholder);

    // Load logo from current data or IDB
    if (proj.id === currentProjectId && logoDataURL) {
      logoImg.src = logoDataURL;
      logoImg.style.display = '';
      placeholder.style.display = 'none';
    } else {
      loadProjectLogo(proj.id, logoImg);
    }

    item.appendChild(logoArea);

    // Bottom row: name + info/actions
    const bottom = document.createElement('div');
    bottom.className = 'project-card-bottom';

    const name = document.createElement('span');
    name.className = 'project-name';
    name.textContent = displayName;

    // Count total boards
    let totalBoards = 0;
    if (proj.id === currentProjectId) {
      pages.forEach(p => {
        totalBoards += (p.boards || []).length;
        if (p.subPages) p.subPages.forEach(sp => { totalBoards += (sp.boards || []).length; });
      });
    } else {
      try {
        const data = JSON.parse(localStorage.getItem('basewear_data_' + proj.id) || 'null');
        if (data && data.pages) {
          data.pages.forEach(p => {
            totalBoards += (p.boards || []).length;
            if (p.subPages) p.subPages.forEach(sp => { totalBoards += (sp.boards || []).length; });
          });
        }
      } catch(_) {}
    }

    const info = document.createElement('span');
    info.className = 'project-info';
    info.textContent = totalBoards + ' pláten';

    const actions = document.createElement('div');
    actions.className = 'project-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'page-action-btn';
    renameBtn.textContent = '✎';
    renameBtn.title = 'Přejmenovat';
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'project-name-input';
      input.value = proj.name;
      name.replaceWith(input);
      input.focus();
      input.select();
      const finish = () => {
        const val = input.value.trim();
        if (val) renameProject(proj.id, val);
        renderProjectsList();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { input.value = proj.name; input.blur(); }
      });
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'page-action-btn danger';
    delBtn.textContent = '✕';
    delBtn.title = 'Smazat';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Smazat projekt «' + proj.name + '»?')) {
        deleteProject(proj.id);
        renderProjectsList();
      }
    });

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    bottom.appendChild(name);
    bottom.appendChild(info);
    bottom.appendChild(actions);
    item.appendChild(bottom);

    item.addEventListener('click', () => {
      if (proj.id === currentProjectId) {
        projectsScreen.classList.add('hidden');
      } else {
        switchToProject(proj.id);
      }
    });

    projectsListEl.appendChild(item);
  });

  // "New project" card
  const newItem = document.createElement('div');
  newItem.className = 'project-item new-project';

  const newTab = document.createElement('div');
  newTab.className = 'project-folder-tab';
  newItem.appendChild(newTab);

  const newLogoArea = document.createElement('div');
  newLogoArea.className = 'project-logo-area';
  const newIcon = document.createElement('div');
  newIcon.className = 'project-new-icon';
  newIcon.textContent = '+';
  newLogoArea.appendChild(newIcon);
  newItem.appendChild(newLogoArea);

  const newBottom = document.createElement('div');
  newBottom.className = 'project-card-bottom';
  const newName = document.createElement('span');
  newName.className = 'project-name';
  newName.style.color = 'var(--accent-mid)';
  newName.textContent = 'Nový projekt';
  newBottom.appendChild(newName);
  newItem.appendChild(newBottom);

  newItem.addEventListener('click', () => {
    createNewProject('Nový projekt');
  });

  projectsListEl.appendChild(newItem);
}

document.getElementById('btn-close').addEventListener('click', () => {
  saveState();
  renderProjectsList();
  projectsScreen.classList.remove('hidden');
});

// ── Init ──
resize();

// Show projects screen on startup
renderProjectsList();
projectsScreen.classList.remove('hidden');
