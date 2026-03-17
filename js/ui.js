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

// ── Sub-page block helper ──

function hasSubPagesBlock() {
  const p = pages[currentPageIndex];
  if (currentSubPageIndex < 0 && p.subPages && p.subPages.length > 0) {
    showToast('Přidejte plátna do podstránek');
    return true;
  }
  return false;
}

function showToast(msg) {
  let toast = document.getElementById('toast-msg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-msg';
    toast.style.cssText = `
      position:fixed; bottom:56px; left:50%; transform:translateX(-50%);
      padding:10px 22px; border-radius:10px;
      background:rgba(30,30,30,0.88); color:#fff;
      font:500 13px 'Outfit',sans-serif; letter-spacing:0.02em;
      z-index:9999; pointer-events:none; opacity:0;
      transition:opacity 0.25s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

// ── Add board (via modal) ──

const modalOverlay = document.getElementById('modal-overlay');
const boardTitleInput = document.getElementById('board-title-input');

document.getElementById('btn-add').addEventListener('click', () => {
  // Block board creation on pages that have sub-pages
  if (hasSubPagesBlock()) return;
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

// ── HUD init ──

const hudBrandName = document.getElementById('hud-brand-name');
const hudBrandLogo = document.getElementById('hud-brand-logo');
const hudLogoSep = document.getElementById('hud-logo-sep');
const hudNameInput = document.getElementById('hud-brand-name-input');
const hudLogoWrap = document.getElementById('hud-logo-wrap');
const hudLogoFile = document.getElementById('hud-logo-file');
const hudLogoPlaceholder = document.getElementById('hud-logo-placeholder');

// Init HUD from saved state
hudBrandName.textContent = brandName || 'Název';
if (logoDataURL) {
  hudBrandLogo.src = logoDataURL;
  hudBrandLogo.style.display = '';
  hudLogoPlaceholder.style.display = 'none';
}

// Click on name → edit inline
hudBrandName.addEventListener('click', () => {
  hudBrandName.style.display = 'none';
  hudNameInput.style.display = '';
  hudNameInput.value = brandName || '';
  hudNameInput.focus();
  hudNameInput.select();
});

function finishNameEdit() {
  const val = hudNameInput.value.trim();
  hudNameInput.style.display = 'none';
  hudBrandName.style.display = '';
  if (val && val !== brandName) {
    brandName = val;
    hudBrandName.textContent = brandName;
    // Also update project name in list
    const proj = projectsList.find(p => p.id === currentProjectId);
    if (proj) {
      proj.name = val;
      saveProjectsList();
    }
    saveState();
  }
}

hudNameInput.addEventListener('blur', finishNameEdit);
hudNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') hudNameInput.blur();
  if (e.key === 'Escape') {
    hudNameInput.value = brandName || '';
    hudNameInput.blur();
  }
});

// Click on logo area → upload new logo
hudLogoWrap.addEventListener('click', () => {
  hudLogoFile.value = '';
  hudLogoFile.click();
});

hudLogoFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    logoDataURL = ev.target.result;
    logoImg = new Image();
    logoImg.onload = () => {
      draw();
      hudBrandLogo.src = logoDataURL;
      hudBrandLogo.style.display = '';
      hudLogoPlaceholder.style.display = 'none';
    };
    logoImg.src = logoDataURL;
    saveState();
  };
  reader.readAsDataURL(file);
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

    const clientBtn = document.createElement('button');
    clientBtn.className = 'page-action-btn client-btn';
    clientBtn.textContent = '👤';
    clientBtn.title = 'Uživatelé pro klienta';
    clientBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openClientUsersModal(proj.id);
    });

    actions.appendChild(clientBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    bottom.appendChild(name);
    bottom.appendChild(info);
    bottom.appendChild(actions);
    item.appendChild(bottom);

    item.addEventListener('click', () => {
      if (proj.id === currentProjectId) {
        projectsScreen.classList.remove('visible');
        localStorage.setItem('basewear_in_project', 'true');
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
    openNewProjectModal();
  });

  projectsListEl.appendChild(newItem);
}

// ── New project modal ──

const newProjectOverlay = document.getElementById('new-project-overlay');
const newProjectNameInput = document.getElementById('new-project-name');
const newProjectLogoBtn = document.getElementById('new-project-logo-btn');
const newProjectLogoFile = document.getElementById('new-project-logo-file');
const newProjectLogoStatus = document.getElementById('new-project-logo-status');
let pendingNewProjectLogo = null;

function openNewProjectModal() {
  newProjectNameInput.value = '';
  pendingNewProjectLogo = null;
  newProjectLogoStatus.textContent = 'žádné logo';
  newProjectOverlay.classList.add('visible');
  setTimeout(() => newProjectNameInput.focus(), 50);
}

newProjectLogoBtn.addEventListener('click', () => {
  newProjectLogoFile.click();
});

newProjectLogoFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    pendingNewProjectLogo = ev.target.result;
    newProjectLogoStatus.textContent = file.name;
  };
  reader.readAsDataURL(file);
  newProjectLogoFile.value = '';
});

document.getElementById('new-project-create').addEventListener('click', () => {
  const name = newProjectNameInput.value.trim() || 'Nový projekt';
  newProjectOverlay.classList.remove('visible');

  // Create project with name
  const id = 'proj_' + Date.now();
  projectsList.push({ id, name, created: Date.now() });
  saveProjectsList();

  // If logo was selected, save it for the new project
  if (pendingNewProjectLogo) {
    // Save brand data to the new project's localStorage
    const projectData = {
      pages: createDefaultPages(),
      currentPageIndex: 0,
      currentSubPageIndex: -1,
      brandName: name
    };
    localStorage.setItem('basewear_data_' + id, JSON.stringify(projectData));

    // Save logo to the new project's IDB
    const dbReq = indexedDB.open('basewear_images_' + id, 1);
    dbReq.onupgradeneeded = () => { dbReq.result.createObjectStore('images'); };
    dbReq.onsuccess = () => {
      const db = dbReq.result;
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(pendingNewProjectLogo, 'logo');
      tx.oncomplete = () => {
        db.close();
        switchToProject(id);
      };
    };
    dbReq.onerror = () => {
      switchToProject(id);
    };
  } else {
    // Save brand name
    const projectData = {
      pages: createDefaultPages(),
      currentPageIndex: 0,
      currentSubPageIndex: -1,
      brandName: name
    };
    localStorage.setItem('basewear_data_' + id, JSON.stringify(projectData));
    switchToProject(id);
  }
});

document.getElementById('new-project-cancel').addEventListener('click', () => {
  newProjectOverlay.classList.remove('visible');
});

newProjectNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('new-project-create').click();
  if (e.key === 'Escape') newProjectOverlay.classList.remove('visible');
});

document.getElementById('btn-close').addEventListener('click', () => {
  saveState();
  renderProjectsList();
  localStorage.removeItem('basewear_in_project');
  projectsScreen.classList.add('visible');
});

// ── Client screen ──

const clientScreen = document.getElementById('client-screen');
const clientPageListEl = document.getElementById('client-page-list');
const clientSidebar = document.getElementById('client-sidebar');
const clientSidebarToggle = document.getElementById('client-sidebar-toggle');
let clientActivePageIndex = 0;
let clientActiveSubPageIndex = -1;
let clientPages = [];
let clientProjectId = null;

function getProjectPages(projectId) {
  if (projectId === currentProjectId) return pages;
  try {
    const data = JSON.parse(localStorage.getItem('basewear_data_' + projectId) || 'null');
    return data?.pages || [];
  } catch(_) {
    return [];
  }
}

function refreshClientPages() {
  if (!clientProjectId) return;
  clientPages = getProjectPages(clientProjectId);
}

function renderClientPageList() {
  refreshClientPages();
  clientPageListEl.innerHTML = '';

  // "All boards" item — always first
  const allItem = document.createElement('div');
  const allIsActive = clientActivePageIndex === -1;
  // Count all boards across all pages
  let allTotal = 0;
  clientPages.forEach(p => {
    allTotal += (p.boards || []).length;
    if (p.subPages) p.subPages.forEach(sp => { allTotal += (sp.boards || []).length; });
  });
  allItem.className = 'page-item' + (allIsActive ? ' active' : '') + (allTotal === 0 ? ' empty' : '');
  const allName = document.createElement('span');
  allName.className = 'page-name';
  allName.style.fontWeight = '600';
  allName.textContent = 'Vše';
  const allCount = document.createElement('span');
  allCount.className = 'page-count';
  allCount.textContent = allTotal;
  allItem.appendChild(allName);
  allItem.appendChild(allCount);
  allItem.addEventListener('click', () => {
    clientActivePageIndex = -1;
    clientActiveSubPageIndex = -1;
    renderClientPageList();
    renderClientBoards();
  });
  clientPageListEl.appendChild(allItem);

  clientPages.forEach((p, i) => {
    const isActive = i === clientActivePageIndex && clientActiveSubPageIndex === -1;
    const isEmpty = (p.boards || []).length === 0;
    const item = document.createElement('div');
    item.className = 'page-item' + (isActive ? ' active' : '') + (isEmpty ? ' empty' : '');

    const name = document.createElement('span');
    name.className = 'page-name';
    name.textContent = p.name;

    const count = document.createElement('span');
    count.className = 'page-count';
    let pageTotal = (p.boards || []).length;
    if (p.subPages && p.subPages.length > 0) {
      pageTotal = 0;
      p.subPages.forEach(sp => {
        if (sp.boards) {
          pageTotal += sp.boards.filter(b => b.status !== 'rejected').length;
        }
      });
    }
    count.textContent = pageTotal;

    item.appendChild(name);
    item.appendChild(count);

    item.addEventListener('click', () => {
      clientActivePageIndex = i;
      clientActiveSubPageIndex = -1;
      renderClientPageList();
      renderClientBoards();
    });
    clientPageListEl.appendChild(item);

    // Sub-pages (read-only)
    if (p.subPages && p.subPages.length > 0) {
      p.subPages.forEach((sp, si) => {
        const subItem = document.createElement('div');
        const subIsActive = i === clientActivePageIndex && si === clientActiveSubPageIndex;
        const subIsEmpty = (sp.boards || []).length === 0;
        subItem.className = 'page-item sub-page' + (subIsActive ? ' active' : '') + (subIsEmpty ? ' empty' : '');

        const subName = document.createElement('span');
        subName.className = 'page-name';
        subName.textContent = sp.name;

        const subCount = document.createElement('span');
        subCount.className = 'page-count';
        subCount.textContent = (sp.boards || []).length;

        subItem.appendChild(subName);
        subItem.appendChild(subCount);

        subItem.addEventListener('click', () => {
          clientActivePageIndex = i;
          clientActiveSubPageIndex = si;
          renderClientPageList();
          renderClientBoards();
        });
        clientPageListEl.appendChild(subItem);
      });
    }
  });
}

// ── Client comments storage (separate from project comments) ──

const CLIENT_COMMENTS_KEY = 'basewear_client_comments';
const CLIENT_STATUS_KEY = 'basewear_client_status';

function getAllClientStatuses() {
  try {
    return JSON.parse(localStorage.getItem(CLIENT_STATUS_KEY) || '{}');
  } catch(_) { return {}; }
}

function getClientStatus(boardKey) {
  return getAllClientStatuses()[boardKey] || null;
}

function setClientStatus(boardKey, status) {
  const all = getAllClientStatuses();
  all[boardKey] = status;
  localStorage.setItem(CLIENT_STATUS_KEY, JSON.stringify(all));
}

function getAllClientComments() {
  try {
    return JSON.parse(localStorage.getItem(CLIENT_COMMENTS_KEY) || '{}');
  } catch(_) { return {}; }
}

function getClientComments(boardKey) {
  return getAllClientComments()[boardKey] || [];
}

function addClientComment(boardKey, comment) {
  const all = getAllClientComments();
  if (!all[boardKey]) all[boardKey] = [];
  all[boardKey].push(comment);
  localStorage.setItem(CLIENT_COMMENTS_KEY, JSON.stringify(all));
}

function deleteClientComment(boardKey, index) {
  const all = getAllClientComments();
  if (all[boardKey]) {
    all[boardKey].splice(index, 1);
    localStorage.setItem(CLIENT_COMMENTS_KEY, JSON.stringify(all));
  }
}

function updateClientComment(boardKey, index, newText) {
  const all = getAllClientComments();
  if (all[boardKey] && all[boardKey][index]) {
    all[boardKey][index].text = newText;
    localStorage.setItem(CLIENT_COMMENTS_KEY, JSON.stringify(all));
  }
}

function addClientReply(boardKey, commentIndex, reply) {
  const all = getAllClientComments();
  if (all[boardKey] && all[boardKey][commentIndex]) {
    if (!all[boardKey][commentIndex].replies) all[boardKey][commentIndex].replies = [];
    all[boardKey][commentIndex].replies.push(reply);
    localStorage.setItem(CLIENT_COMMENTS_KEY, JSON.stringify(all));
  }
}

const _authorColors = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
  '#469990', '#e6beff'
];

const _authorShapeSVGs = [
  '<rect x="2" y="2" width="12" height="12" rx="1"/>',
  '<polygon points="8,1 15,15 1,15"/>',
  '<circle cx="8" cy="8" r="7"/>',
  '<polygon points="8,1 15,8 8,15 1,8"/>',
  '<polygon points="8,0.5 10.2,5.5 15.5,6 11.5,9.8 12.6,15 8,12.3 3.4,15 4.5,9.8 0.5,6 5.8,5.5"/>',
  '<rect x="2" y="2" width="12" height="12" rx="1"/>',
  '<polygon points="8,1 15,15 1,15"/>',
  '<circle cx="8" cy="8" r="7"/>',
  '<polygon points="8,1 15,8 8,15 1,8"/>',
  '<polygon points="8,0.5 10.2,5.5 15.5,6 11.5,9.8 12.6,15 8,12.3 3.4,15 4.5,9.8 0.5,6 5.8,5.5"/>'
];

function _authorHash(name) {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function getAuthorColor(name) {
  return _authorColors[_authorHash(name) % _authorColors.length];
}

function getAuthorShapeSVG(name) {
  const idx = _authorHash(name) % _authorShapeSVGs.length;
  const color = getAuthorColor(name);
  return `<svg viewBox="0 0 16 16" width="16" height="16"><g fill="${color}">${_authorShapeSVGs[idx]}</g></svg>`;
}

// For canvas rendering — simple shape names
const _authorShapeNames = ['square', 'triangle', 'circle', 'diamond', 'star', 'square', 'triangle', 'circle', 'diamond', 'star'];
function getAuthorShapeName(name) {
  return _authorShapeNames[_authorHash(name) % _authorShapeNames.length];
}

function createCommentEl(c, opts) {
  // opts: { boardKey, index, cmtList, onRefresh }
  const cmt = document.createElement('div');
  cmt.className = 'client-comment';

  // Author row
  if (c.author) {
    const author = document.createElement('span');
    author.className = 'client-comment-author';
    author.style.color = getAuthorColor(c.author);
    const shape = document.createElement('span');
    shape.className = 'client-comment-shape';
    shape.innerHTML = getAuthorShapeSVG(c.author);
    author.appendChild(shape);
    author.appendChild(document.createTextNode(c.author));
    cmt.appendChild(author);
  }

  // Text
  const text = document.createElement('span');
  text.className = 'client-comment-text';
  text.textContent = c.text;
  cmt.appendChild(text);

  // Date
  if (c.date) {
    const date = document.createElement('span');
    date.className = 'client-comment-date';
    date.textContent = c.date;
    cmt.appendChild(date);
  }

  // Replies
  if (c.replies && c.replies.length > 0) {
    const repliesWrap = document.createElement('div');
    repliesWrap.className = 'client-comment-replies';
    c.replies.forEach(r => {
      const replyEl = document.createElement('div');
      replyEl.className = 'client-comment-reply';
      if (r.author) {
        const ra = document.createElement('span');
        ra.className = 'client-comment-author';
        ra.style.color = getAuthorColor(r.author);
        const rs = document.createElement('span');
        rs.className = 'client-comment-shape';
        rs.innerHTML = getAuthorShapeSVG(r.author);
        ra.appendChild(rs);
        ra.appendChild(document.createTextNode(r.author));
        replyEl.appendChild(ra);
      }
      const rt = document.createElement('span');
      rt.className = 'client-comment-text';
      rt.textContent = r.text;
      replyEl.appendChild(rt);
      if (r.date) {
        const rd = document.createElement('span');
        rd.className = 'client-comment-date';
        rd.textContent = r.date;
        replyEl.appendChild(rd);
      }
      repliesWrap.appendChild(replyEl);
    });
    cmt.appendChild(repliesWrap);
  }

  // Action buttons
  if (opts && opts.boardKey !== undefined) {
    const currentAuthor = clientCurrentUser ? clientCurrentUser.name : 'Admin';
    const isOwner = c.author === currentAuthor;
    const actions = document.createElement('div');
    actions.className = 'client-comment-actions';

    // Reply — anyone
    const replyBtn = document.createElement('button');
    replyBtn.className = 'client-comment-action-btn';
    replyBtn.textContent = 'Odpovědět';
    replyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle reply input
      let existing = cmt.querySelector('.client-reply-input');
      if (existing) { existing.remove(); return; }
      const ri = document.createElement('div');
      ri.className = 'client-reply-input';
      const rta = document.createElement('textarea');
      rta.placeholder = 'Odpověď...';
      rta.rows = 1;
      ri.appendChild(rta);
      const rsend = document.createElement('button');
      rsend.className = 'client-comment-send';
      rsend.textContent = 'Odeslat';
      rsend.addEventListener('click', () => {
        const t = rta.value.trim();
        if (!t) return;
        const reply = { text: t, date: new Date().toLocaleString('cs'), author: currentAuthor };
        addClientReply(opts.boardKey, opts.index, reply);
        if (opts.onRefresh) opts.onRefresh();
      });
      rta.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); rsend.click(); }
      });
      ri.appendChild(rsend);
      cmt.appendChild(ri);
      rta.focus();
    });
    actions.appendChild(replyBtn);

    if (isOwner) {
      // Edit — owner only
      const editBtn = document.createElement('button');
      editBtn.className = 'client-comment-action-btn';
      editBtn.textContent = 'Upravit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let existing = cmt.querySelector('.client-edit-input');
        if (existing) { existing.remove(); text.style.display = ''; return; }
        text.style.display = 'none';
        const ei = document.createElement('div');
        ei.className = 'client-edit-input';
        const eta = document.createElement('textarea');
        eta.value = c.text;
        eta.rows = 2;
        ei.appendChild(eta);
        const esave = document.createElement('button');
        esave.className = 'client-comment-send';
        esave.textContent = 'Uložit';
        esave.addEventListener('click', () => {
          const t = eta.value.trim();
          if (!t) return;
          updateClientComment(opts.boardKey, opts.index, t);
          if (opts.onRefresh) opts.onRefresh();
        });
        eta.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); esave.click(); }
          if (ev.key === 'Escape') { ei.remove(); text.style.display = ''; }
        });
        ei.appendChild(esave);
        cmt.appendChild(ei);
        eta.focus();
      });
      actions.appendChild(editBtn);

      // Delete — owner only
      const delBtn = document.createElement('button');
      delBtn.className = 'client-comment-action-btn danger';
      delBtn.textContent = 'Smazat';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteClientComment(opts.boardKey, opts.index);
        if (opts.onRefresh) opts.onRefresh();
      });
      actions.appendChild(delBtn);
    }

    cmt.appendChild(actions);
  }

  return cmt;
}


function getClientActivePage() {
  const p = clientPages[clientActivePageIndex];
  if (!p) return null;
  if (clientActiveSubPageIndex >= 0 && p.subPages && p.subPages[clientActiveSubPageIndex]) {
    return p.subPages[clientActiveSubPageIndex];
  }
  return p;
}

function renderClientBoardCard(container, b, bi, prefix, sectionName, pageData, pageName) {
    const boardKey = `${clientProjectId}_${prefix}_${bi}`;

    // Apply client-specific status
    let clientStatus = getClientStatus(boardKey);

    // Filter: show only approved if filter is active
    if (clientFilterApproved && clientStatus !== 'approved') return;

    const card = document.createElement('div');
    card.className = 'client-board-card';
    if (clientStatus === 'approved') card.classList.add('client-approved');
    if (clientStatus === 'rejected') card.classList.add('client-rejected');

    // Title row — show category / subcategory name, centered
    const titleRow = document.createElement('div');
    titleRow.className = 'client-board-title';
    const categoryLabel = document.createElement('span');
    categoryLabel.className = 'client-board-category';
    categoryLabel.textContent = sectionName || pageName || '';
    titleRow.appendChild(categoryLabel);

    // Status dot (visible in grid mode)
    if (clientStatus) {
      const dot = document.createElement('span');
      dot.className = 'client-status-dot ' + clientStatus;
      titleRow.appendChild(dot);
    }

    // Comment indicator (visible in grid mode)
    const cmtCountArr = getClientComments(boardKey);
    if (cmtCountArr.length > 0) {
      const cmtBadge = document.createElement('span');
      cmtBadge.className = 'client-comment-badge';
      cmtBadge.textContent = '✎ ' + cmtCountArr.length;
      titleRow.appendChild(cmtBadge);
    }

    card.appendChild(titleRow);

    // Board snapshot (rendered as canvas image)
    const imgsRow = document.createElement('div');
    imgsRow.className = 'client-board-snapshot';

    const snapshotImg = document.createElement('img');
    snapshotImg.className = 'client-snapshot-img';
    snapshotImg.style.display = 'none';
    imgsRow.appendChild(snapshotImg);

    renderBoardSnapshot(b, bi, pageData || {}, prefix, (dataURL) => {
      if (dataURL) {
        snapshotImg.src = dataURL;
        snapshotImg.style.display = '';
      }
      if (_scrollToBoardKey && _scrollToBoardKey === boardKey) {
        _scrollToBoardKey = null;
        requestAnimationFrame(() => {
          card.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
      }
    });

    // Body: images left + comments right
    const body = document.createElement('div');
    body.className = 'client-board-body';

    body.appendChild(imgsRow);

    // Right panel: buttons + comments
    const cmtKey = boardKey;
    const cmtBlock = document.createElement('div');
    cmtBlock.className = 'client-comments';

    // Status buttons block
    const btnsBlock = document.createElement('div');
    btnsBlock.className = 'client-status-block';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'client-btn-approve' + (clientStatus === 'approved' ? ' active' : '');
    approveBtn.innerHTML = '<span class="client-btn-icon">✓</span> Líbí se';

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'client-btn-reject' + (clientStatus === 'rejected' ? ' active' : '');
    rejectBtn.innerHTML = '<span class="client-btn-icon">✕</span> Nelíbí se';

    function updateCardStatus(newStatus) {
      setClientStatus(boardKey, newStatus);
      card.classList.toggle('client-approved', newStatus === 'approved');
      card.classList.toggle('client-rejected', newStatus === 'rejected');
      approveBtn.classList.toggle('active', newStatus === 'approved');
      rejectBtn.classList.toggle('active', newStatus === 'rejected');
    }

    approveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasApproved = clientStatus === 'approved';
      updateCardStatus(wasApproved ? null : 'approved');
      clientStatus = getClientStatus(boardKey);
    });

    rejectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateCardStatus(clientStatus === 'rejected' ? null : 'rejected');
      clientStatus = getClientStatus(boardKey);
    });

    btnsBlock.appendChild(approveBtn);
    btnsBlock.appendChild(rejectBtn);
    cmtBlock.appendChild(btnsBlock);

    const cmtHeader = document.createElement('div');
    cmtHeader.className = 'client-comments-title';
    cmtHeader.textContent = 'Komentáře';
    cmtBlock.appendChild(cmtHeader);

    const cmtList = document.createElement('div');
    cmtList.className = 'client-comments-list';
    cmtBlock.appendChild(cmtList);

    // Load saved client comments
    function refreshComments() {
      cmtList.innerHTML = '';
      const comments = getClientComments(cmtKey);
      comments.forEach((c, ci) => {
        cmtList.appendChild(createCommentEl(c, {
          boardKey: cmtKey,
          index: ci,
          cmtList: cmtList,
          onRefresh: refreshComments
        }));
      });
      cmtList.scrollTop = cmtList.scrollHeight;
    }
    refreshComments();

    // Input area
    const cmtInput = document.createElement('div');
    cmtInput.className = 'client-comment-input';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Napište komentář...';
    textarea.rows = 2;
    cmtInput.appendChild(textarea);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'client-comment-send';
    sendBtn.textContent = 'Odeslat';
    sendBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;
      const authorName = clientCurrentUser ? clientCurrentUser.name : 'Admin';
      const comment = { text, date: new Date().toLocaleString('cs'), author: authorName };
      addClientComment(cmtKey, comment);
      textarea.value = '';
      refreshComments();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    cmtInput.appendChild(sendBtn);
    cmtBlock.appendChild(cmtInput);

    body.appendChild(cmtBlock);
    card.appendChild(body);

    // Store source page info on card for "All" view navigation
    card._srcPageIndex = prefix.includes('_sub') ? parseInt(prefix) : parseInt(prefix);
    card._srcSubIndex = prefix.includes('_sub') ? parseInt(prefix.split('_sub')[1]) : -1;

    // In grid mode, click to open detail view
    card.dataset.boardKey = boardKey;

    card.addEventListener('click', (e) => {
      if (!clientGridMode) return;
      if (e.target.closest('button, textarea, span.client-btn-icon')) return;

      // From "All" page — navigate to the source page
      if (clientActivePageIndex === -1) {
        clientActivePageIndex = card._srcPageIndex;
        clientActiveSubPageIndex = card._srcSubIndex;
        renderClientPageList();
      }

      clientGridMode = false;
      clientGridToggle.classList.remove('active');
      container.classList.remove('grid-view');
      _scrollToBoardKey = boardKey;
      renderClientBoards();
    });

    container.appendChild(card);
}

// Render a board snapshot (board + images + free PNGs overlay) to an offscreen canvas
function renderBoardSnapshot(b, bi, pageData, prefix, callback) {
  const W = A4_W;
  const H = A4_H;
  const S = 2; // scale factor for high-res
  const offscreen = document.createElement('canvas');
  offscreen.width = W * S;
  offscreen.height = H * S;
  const c = offscreen.getContext('2d');
  c.scale(S, S);

  // White background
  c.fillStyle = '#fff';
  c.fillRect(0, 0, W, H);

  // Image slots
  const pad = 20;
  const imgGap = 12;
  const fullImgTop = 70;
  const fullImgBottom = H - 30;
  const fullImgH = fullImgBottom - fullImgTop;
  const imgAreaH = fullImgH * 0.85;
  const imgAreaTop = fullImgTop + (fullImgH - imgAreaH) / 2;
  const imgSlotW = (W - pad * 2 - imgGap) / 2;

  // Collect all image keys to load
  const keysToLoad = [];
  for (let si = 0; si < 2; si++) {
    keysToLoad.push({ key: `board_${prefix}_${bi}_${si}`, type: 'slot', si });
  }
  // Free images that overlap this board
  if (pageData.freeImages) {
    pageData.freeImages.forEach((fi, fi_i) => {
      keysToLoad.push({ key: `free_${prefix}_${fi_i}`, type: 'free', fi });
    });
  }

  // Load all from IDB
  const dbName = 'basewear_images_' + clientProjectId;
  const req = indexedDB.open(dbName, 1);
  req.onupgradeneeded = () => { req.result.createObjectStore('images'); };
  req.onsuccess = () => {
    const db = req.result;
    let loaded = 0;
    const results = {};

    keysToLoad.forEach(item => {
      try {
        const tx = db.transaction('images', 'readonly');
        const getReq = tx.objectStore('images').get(item.key);
        getReq.onsuccess = () => {
          results[item.key] = getReq.result || null;
          loaded++;
          if (loaded === keysToLoad.length) {
            db.close();
            drawAll(results);
          }
        };
        getReq.onerror = () => {
          loaded++;
          if (loaded === keysToLoad.length) { db.close(); drawAll(results); }
        };
      } catch(_) {
        loaded++;
        if (loaded === keysToLoad.length) { db.close(); drawAll(results); }
      }
    });

    if (keysToLoad.length === 0) { db.close(); drawAll(results); }
  };
  req.onerror = () => callback(null);

  function drawAll(results) {
    let pending = 0;
    let total = 0;

    // Draw slot images
    for (let si = 0; si < 2; si++) {
      const dataURL = results[`board_${prefix}_${bi}_${si}`];
      const slotX = pad + si * (imgSlotW + imgGap);
      const slotY = imgAreaTop;

      if (dataURL) {
        total++;
        const img = new Image();
        img.onload = () => {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const slotAspect = imgSlotW / imgAreaH;
          let dw, dh, dx, dy;
          if (imgAspect > slotAspect) {
            dh = imgAreaH; dw = dh * imgAspect;
            dx = slotX + (imgSlotW - dw) / 2; dy = slotY;
          } else {
            dw = imgSlotW; dh = dw / imgAspect;
            dx = slotX; dy = slotY + (imgAreaH - dh) / 2;
          }
          c.save();
          c.beginPath();
          roundRect(c, slotX, slotY, imgSlotW, imgAreaH, 8);
          c.clip();
          c.drawImage(img, dx, dy, dw, dh);
          c.restore();
          pending++;
          if (pending === total) finishDraw();
        };
        img.onerror = () => { pending++; if (pending === total) finishDraw(); };
        img.src = dataURL;
      } else {
        // Empty slot placeholder
        c.fillStyle = 'rgba(42, 42, 42, 0.04)';
        roundRect(c, slotX, slotY, imgSlotW, imgAreaH, 8);
        c.fill();
        c.strokeStyle = 'rgba(42, 42, 42, 0.1)';
        c.lineWidth = 1;
        c.setLineDash([4, 4]);
        roundRect(c, slotX, slotY, imgSlotW, imgAreaH, 8);
        c.stroke();
        c.setLineDash([]);
      }
    }

    // Draw free images overlapping this board
    if (pageData.freeImages) {
      pageData.freeImages.forEach((fi, fi_i) => {
        const dataURL = results[`free_${prefix}_${fi_i}`];
        if (!dataURL) return;
        // Position relative to this board
        const fx = fi.x - b.x;
        const fy = fi.y - b.y;
        total++;
        const img = new Image();
        img.onload = () => {
          c.drawImage(img, fx, fy, fi.w, fi.h);
          pending++;
          if (pending === total) finishDraw();
        };
        img.onerror = () => { pending++; if (pending === total) finishDraw(); };
        img.src = dataURL;
      });
    }

    // Logo
    if (logoImg && logoImg.complete && logoImg.naturalWidth) {
      const maxLogoH = 40;
      const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
      c.drawImage(logoImg, pad, pad, maxLogoH * logoAspect, maxLogoH);
    }

    // Title
    if (b.title) {
      c.font = '400 14px Outfit, sans-serif';
      c.fillStyle = 'rgba(42, 42, 42, 0.7)';
      c.textAlign = 'right';
      c.textBaseline = 'top';
      c.fillText(b.title, W - pad, pad);
    }

    // Label
    c.font = '300 9px Outfit, sans-serif';
    c.fillStyle = 'rgba(42, 42, 42, 0.2)';
    c.textAlign = 'left';
    c.textBaseline = 'bottom';
    c.fillText(b.label || '', 10, H - 6);

    if (total === 0) finishDraw();
  }

  function finishDraw() {
    callback(offscreen.toDataURL('image/png'));
  }
}

function renderClientBoards() {
  refreshClientPages();
  const container = document.getElementById('client-container');
  const wasGrid = container.classList.contains('grid-view');
  container.innerHTML = '';
  if (wasGrid) container.classList.add('grid-view');

  const pageIndex = clientActivePageIndex;

  // "All" page — show every board from every page, always grid
  if (pageIndex === -1) {
    container.classList.add('grid-view');
    clientGridMode = true;
    clientGridToggle.classList.add('active');

    let hasContent = false;
    clientPages.forEach((p, pi) => {
      const hasPageContent = (p.boards && p.boards.length > 0) ||
        (p.freeImages && p.freeImages.length > 0) ||
        (p.subPages && p.subPages.some(sp => (sp.boards && sp.boards.length > 0) || (sp.freeImages && sp.freeImages.length > 0)));
      if (!hasPageContent) return;

      const header = document.createElement('div');
      header.className = 'client-section-header';
      header.textContent = p.name;
      container.appendChild(header);

      if (p.boards && p.boards.length > 0) {
        const prefix = `${pi}`;
        p.boards.forEach((b, bi) => {
          renderClientBoardCard(container, b, bi, prefix, null, p, p.name);
          hasContent = true;
        });
      }

      if (p.subPages) {
        p.subPages.forEach((sp, spi) => {
          if (!sp.boards || sp.boards.length === 0) return;
          const subHeader = document.createElement('div');
          subHeader.className = 'client-section-header client-section-sub';
          subHeader.textContent = sp.name;
          container.appendChild(subHeader);

          const prefix = `${pi}_sub${spi}`;
          sp.boards.forEach((b, bi) => {
            renderClientBoardCard(container, b, bi, prefix, sp.name, sp, p.name);
            hasContent = true;
          });
        });
      }
    });

    if (!hasContent) {
      container.innerHTML = '<div class="client-empty">Žádná plátna</div>';
    }
    return;
  }

  const page = clientPages[pageIndex];
  if (!page) {
    container.innerHTML = '<div class="client-empty">Žádná plátna</div>';
    return;
  }

  // Viewing a sub-page directly
  if (clientActiveSubPageIndex >= 0) {
    const sp = page.subPages && page.subPages[clientActiveSubPageIndex];
    const prefix = `${pageIndex}_sub${clientActiveSubPageIndex}`;
    const hasBoards = sp && sp.boards && sp.boards.length > 0;
    const hasFree = sp && sp.freeImages && sp.freeImages.length > 0;
    if (!hasBoards && !hasFree) {
      container.innerHTML = '<div class="client-empty">Žádná plátna</div>';
      return;
    }
    if (hasBoards) sp.boards.forEach((b, bi) => renderClientBoardCard(container, b, bi, prefix, sp.name, sp, page.name));
    return;
  }

  // Viewing parent page — show its boards + all sub-page boards + free images
  let hasContent = false;

  if (page.boards && page.boards.length > 0) {
    const prefix = `${pageIndex}`;
    page.boards.forEach((b, bi) => {
      renderClientBoardCard(container, b, bi, prefix, null, page, page.name);
      hasContent = true;
    });
  }

  if (page.subPages && page.subPages.length > 0) {
    page.subPages.forEach((sp, spi) => {
      if (!sp.boards || sp.boards.length === 0) return;
      const header = document.createElement('div');
      header.className = 'client-section-header';
      header.textContent = sp.name;
      container.appendChild(header);

      const prefix = `${pageIndex}_sub${spi}`;
      sp.boards.forEach((b, bi) => {
        renderClientBoardCard(container, b, bi, prefix, sp.name, sp, page.name);
        hasContent = true;
      });
    });
  }

  if (!hasContent) {
    container.innerHTML = '<div class="client-empty">Žádná plátna</div>';
  }
}

function openClientScreen(projectId) {
  clientProjectId = projectId;
  clientPages = getProjectPages(projectId);
  clientActivePageIndex = 0;
  clientActiveSubPageIndex = -1;

  // Set brand name
  const brand = getProjectBrandData(projectId);
  const proj = projectsList.find(p => p.id === projectId);
  const name = brand.brandName || (proj ? proj.name : '');
  document.getElementById('client-brand-name').textContent = name;

  // Set brand logo
  const logoEl = document.getElementById('client-brand-logo');
  const sepEl = document.getElementById('client-brand-sep');
  logoEl.style.display = 'none';
  sepEl.style.display = 'none';

  if (projectId === currentProjectId && logoDataURL) {
    logoEl.src = logoDataURL;
    logoEl.style.display = '';
    sepEl.style.display = '';
  } else {
    loadProjectLogo(projectId, logoEl);
    // Show sep when logo loads
    logoEl.addEventListener('load', () => {
      if (logoEl.style.display !== 'none') sepEl.style.display = '';
    }, { once: true });
  }

  clientActivePageIndex = -1;
  clientActiveSubPageIndex = -1;
  clientGridMode = true;
  clientGridToggle.classList.add('active');

  // Show user identity
  let identityEl = document.getElementById('client-user-identity');
  if (!identityEl) {
    identityEl = document.createElement('span');
    identityEl.id = 'client-user-identity';
    identityEl.className = 'client-user-identity';
    document.getElementById('client-topbar').appendChild(identityEl);
  }
  if (clientCurrentUser) {
    identityEl.innerHTML = '';

    // Other users — shape only
    const allUsers = getClientUsers(clientProjectId);
    allUsers.forEach(u => {
      if (u.id === clientCurrentUser.id) return;
      const otherShape = document.createElement('span');
      otherShape.className = 'client-comment-shape client-other-user-shape';
      otherShape.innerHTML = getAuthorShapeSVG(u.name);
      otherShape.title = u.name;
      identityEl.appendChild(otherShape);
    });

    // Separator if there are other users
    if (allUsers.filter(u => u.id !== clientCurrentUser.id).length > 0) {
      const sep = document.createElement('span');
      sep.className = 'client-identity-sep';
      identityEl.appendChild(sep);
    }

    // Current user — shape + name
    const shape = document.createElement('span');
    shape.className = 'client-comment-shape';
    shape.innerHTML = getAuthorShapeSVG(clientCurrentUser.name);
    identityEl.appendChild(shape);
    identityEl.appendChild(document.createTextNode(clientCurrentUser.name));
    identityEl.style.color = getAuthorColor(clientCurrentUser.name);
    identityEl.style.display = '';
  } else {
    identityEl.style.display = 'none';
  }

  renderClientPageList();
  renderClientBoards();

  clientScreen.classList.add('visible');
}

let clientGridMode = false;
let clientFilterApproved = false;
const clientGridToggle = document.getElementById('client-grid-toggle');
const clientFilterBtn = document.getElementById('client-filter-approved');

document.getElementById('client-back').addEventListener('click', () => {
  clientScreen.classList.remove('visible');
  clientGridMode = false;
  clientFilterApproved = false;
  clientCurrentUser = null;
  clientGridToggle.classList.remove('active');
  clientFilterBtn.classList.remove('active');
});

clientGridToggle.addEventListener('click', () => {
  clientGridMode = !clientGridMode;
  clientGridToggle.classList.toggle('active', clientGridMode);
  const container = document.getElementById('client-container');
  container.classList.toggle('grid-view', clientGridMode);
});

clientFilterBtn.addEventListener('click', () => {
  clientFilterApproved = !clientFilterApproved;
  clientFilterBtn.classList.toggle('active', clientFilterApproved);
  renderClientBoards();
});

clientSidebarToggle.addEventListener('click', () => {
  clientSidebar.classList.toggle('collapsed');
  clientSidebarToggle.classList.toggle('open');
  clientSidebarToggle.textContent = clientSidebar.classList.contains('collapsed') ? '›' : '‹';
});

// ── Admin Client Comments Panel ──

function toggleAdminCCPanel() {
  const panel = document.getElementById('admin-cc-panel');
  const isVisible = panel.classList.contains('visible');
  if (isVisible) {
    panel.classList.remove('visible');
  } else {
    renderAdminCCPanel();
    panel.classList.add('visible');
  }
}

function renderAdminCCPanel() {
  const list = document.getElementById('admin-cc-list');
  list.innerHTML = '';

  const allComments = getAllClientComments();
  const prefix = currentSubPageIndex >= 0
    ? `${currentPageIndex}_sub${currentSubPageIndex}`
    : `${currentPageIndex}`;

  const p = currentSubPageIndex >= 0
    ? pages[currentPageIndex].subPages[currentSubPageIndex]
    : pages[currentPageIndex];

  if (!p || !p.boards) {
    list.innerHTML = '<div class="admin-cc-empty">Žádné komentáře</div>';
    return;
  }

  let hasAny = false;

  p.boards.forEach((b, bi) => {
    const key = `${currentProjectId}_${prefix}_${bi}`;
    const comments = allComments[key];
    if (!comments || comments.length === 0) return;
    hasAny = true;

    const group = document.createElement('div');
    group.className = 'admin-cc-board-group';

    const label = document.createElement('div');
    label.className = 'admin-cc-board-label';
    label.textContent = (b.title || '') + (b.label ? ' — ' + b.label : '');
    group.appendChild(label);

    comments.forEach(c => {
      const cmtEl = document.createElement('div');
      cmtEl.className = 'admin-cc-comment';

      if (c.author) {
        const authorEl = document.createElement('span');
        authorEl.className = 'admin-cc-comment-author';
        authorEl.style.color = getAuthorColor(c.author);
        const shape = document.createElement('span');
        shape.className = 'client-comment-shape';
        shape.innerHTML = getAuthorShapeSVG(c.author);
        authorEl.appendChild(shape);
        authorEl.appendChild(document.createTextNode(c.author));
        cmtEl.appendChild(authorEl);
      }

      const textEl = document.createElement('span');
      textEl.className = 'admin-cc-comment-text';
      textEl.textContent = c.text;
      cmtEl.appendChild(textEl);

      if (c.date) {
        const dateEl = document.createElement('span');
        dateEl.className = 'admin-cc-comment-date';
        dateEl.textContent = c.date;
        cmtEl.appendChild(dateEl);
      }

      // Replies
      if (c.replies && c.replies.length > 0) {
        const repliesWrap = document.createElement('div');
        repliesWrap.className = 'admin-cc-replies';
        c.replies.forEach(r => {
          const rEl = document.createElement('div');
          rEl.className = 'admin-cc-comment';
          if (r.author) {
            const ra = document.createElement('span');
            ra.className = 'admin-cc-comment-author';
            ra.style.color = getAuthorColor(r.author);
            const rs = document.createElement('span');
            rs.className = 'client-comment-shape';
            rs.innerHTML = getAuthorShapeSVG(r.author);
            ra.appendChild(rs);
            ra.appendChild(document.createTextNode(r.author));
            rEl.appendChild(ra);
          }
          const rt = document.createElement('span');
          rt.className = 'admin-cc-comment-text';
          rt.textContent = r.text;
          rEl.appendChild(rt);
          if (r.date) {
            const rd = document.createElement('span');
            rd.className = 'admin-cc-comment-date';
            rd.textContent = r.date;
            rEl.appendChild(rd);
          }
          repliesWrap.appendChild(rEl);
        });
        cmtEl.appendChild(repliesWrap);
      }

      group.appendChild(cmtEl);
    });

    list.appendChild(group);
  });

  if (!hasAny) {
    list.innerHTML = '<div class="admin-cc-empty">Žádné komentáře</div>';
  }
}

document.getElementById('admin-cc-close').addEventListener('click', () => {
  document.getElementById('admin-cc-panel').classList.remove('visible');
});

// ── Client Users Modal ──

let clientUsersProjectId = null;

function openClientUsersModal(projectId) {
  clientUsersProjectId = projectId;
  document.getElementById('client-users-overlay').classList.add('visible');
  document.getElementById('client-user-name-input').value = '';
  renderClientUsersList();
}

function renderClientUsersList() {
  const list = document.getElementById('client-users-list');
  list.innerHTML = '';
  const users = getClientUsers(clientUsersProjectId);

  // Admin button — always first
  const adminItem = document.createElement('div');
  adminItem.className = 'client-user-item client-user-admin';

  const adminName = document.createElement('span');
  adminName.className = 'client-user-name';
  adminName.textContent = 'Admin';
  adminItem.appendChild(adminName);

  const adminBtn = document.createElement('button');
  adminBtn.className = 'client-user-copy client-user-admin-btn';
  adminBtn.textContent = 'Otevřít';
  adminBtn.addEventListener('click', () => {
    document.getElementById('client-users-overlay').classList.remove('visible');
    clientCurrentUser = { id: '_admin', name: 'Admin' };
    openClientScreen(clientUsersProjectId);
  });
  adminItem.appendChild(adminBtn);
  list.appendChild(adminItem);

  users.forEach(u => {
    const item = document.createElement('div');
    item.className = 'client-user-item';

    const name = document.createElement('span');
    name.className = 'client-user-name';
    name.textContent = u.name;
    item.appendChild(name);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'client-user-copy';
    copyBtn.textContent = 'Kopírovat odkaz';
    copyBtn.addEventListener('click', () => {
      const link = getClientLink(clientUsersProjectId, u.id);
      navigator.clipboard.writeText(link).then(() => {
        copyBtn.textContent = 'Zkopírováno ✓';
        setTimeout(() => { copyBtn.textContent = 'Kopírovat odkaz'; }, 2000);
      });
    });
    item.appendChild(copyBtn);

    const previewBtn = document.createElement('button');
    previewBtn.className = 'client-user-copy';
    previewBtn.textContent = 'Náhled';
    previewBtn.addEventListener('click', () => {
      document.getElementById('client-users-overlay').classList.remove('visible');
      clientCurrentUser = u;
      openClientScreen(clientUsersProjectId);
    });
    item.appendChild(previewBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'client-user-delete';
    delBtn.textContent = '✕';
    delBtn.title = 'Smazat uživatele';
    delBtn.addEventListener('click', () => {
      removeClientUser(clientUsersProjectId, u.id);
      renderClientUsersList();
    });
    item.appendChild(delBtn);

    list.appendChild(item);
  });
}

document.getElementById('client-user-add-btn').addEventListener('click', () => {
  const input = document.getElementById('client-user-name-input');
  const name = input.value.trim();
  if (!name) return;
  addClientUser(clientUsersProjectId, name);
  input.value = '';
  renderClientUsersList();
});

document.getElementById('client-user-name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('client-user-add-btn').click();
});

document.getElementById('client-users-close').addEventListener('click', () => {
  document.getElementById('client-users-overlay').classList.remove('visible');
});

// ── Client user identity ──

let clientCurrentUser = null; // { id, name } or null (admin)
let _scrollToBoardKey = null; // board key to scroll to after render

// ── URL-based routing for client links ──

function checkClientURL() {
  const params = new URLSearchParams(location.search);
  const projectId = params.get('client');
  const userToken = params.get('user');
  if (!projectId || !userToken) return false;

  // Wait for Firebase sync to be ready, then open
  const tryOpen = () => {
    const user = getClientUserByToken(projectId, userToken);
    if (user) {
      clientCurrentUser = user;
      openClientScreen(projectId);
      // Hide back button in direct-link mode
      document.getElementById('client-back').style.display = 'none';
      return true;
    }
    return false;
  };

  // Try immediately, then retry after a delay for Firebase sync
  if (!tryOpen()) {
    setTimeout(() => {
      if (!tryOpen()) {
        // User not found — show message
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Outfit,sans-serif;color:#888;font-size:16px;">Odkaz je neplatný nebo byl uživatel smazán.</div>';
      }
    }, 3000);
  }
  return true;
}

// ── Init ──
resize();

// Check if opened via client link
const isClientLink = checkClientURL();

// Show projects screen on startup if user wasn't inside a project or no projects exist
if (!isClientLink) {
  renderProjectsList();
  if (!localStorage.getItem('basewear_in_project') || projectsList.length === 0) {
    projectsScreen.classList.add('visible');
  }
}
