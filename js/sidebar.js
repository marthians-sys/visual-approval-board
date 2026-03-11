// ── Sidebar / Pages logic ──

const pageListEl = document.getElementById('page-list');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');

function switchPage(index, subIndex = -1) {
  syncToPage();
  currentPageIndex = index;
  currentSubPageIndex = subIndex;
  syncFromPage();
  restoreBoardImages();
  restoreFreeImages();
  hoveredComment = null;
  confirmDeleteComment = null;
  dragBoard = null;
  moveMode = null;
  renderPageList();
  draw();
}

function renderPageList() {
  pageListEl.innerHTML = '';
  pages.forEach((p, i) => {
    const isActive = i === currentPageIndex && currentSubPageIndex === -1;
    const item = document.createElement('div');
    const isEmpty = p.boards.length === 0;
    item.className = 'page-item' + (isActive ? ' active' : '') + (isEmpty ? ' empty' : '');

    const name = document.createElement('span');
    name.className = 'page-name';
    name.textContent = p.name;

    const count = document.createElement('span');
    count.className = 'page-count';
    // If page has sub-pages, sum non-rejected boards from all sub-pages
    let pageTotal = p.boards.length;
    if (p.subPages && p.subPages.length > 0) {
      pageTotal = 0;
      p.subPages.forEach(sp => {
        if (sp.boards) {
          pageTotal += sp.boards.filter(b => b.status !== 'rejected').length;
        }
      });
    }
    count.textContent = pageTotal;

    const actions = document.createElement('div');
    actions.className = 'page-actions';

    // Add sub-page button
    const addSubBtn = document.createElement('button');
    addSubBtn.className = 'page-action-btn';
    addSubBtn.textContent = '+';
    addSubBtn.title = 'Přidat podstránku';
    addSubBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!p.subPages) p.subPages = [];
      const sp = {
        name: 'Podstránka ' + (p.subPages.length + 1),
        boards: [],
        panX: 0,
        panY: 0,
        scale: 1
      };
      p.subPages.push(sp);
      switchPage(i, p.subPages.length - 1);
      saveState();
      setTimeout(() => startSubRename(i, p.subPages.length - 1), 50);
    });

    const renameBtn = document.createElement('button');
    renameBtn.className = 'page-action-btn';
    renameBtn.textContent = '✎';
    renameBtn.title = 'Přejmenovat';
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startRename(i);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'page-action-btn danger';
    delBtn.textContent = '✕';
    delBtn.title = 'Smazat';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pages.length <= 1) return;
      pages.splice(i, 1);
      if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;
      currentSubPageIndex = -1;
      syncFromPage();
      renderPageList();
      draw();
      saveState();
    });

    actions.appendChild(addSubBtn);
    actions.appendChild(renameBtn);
    if (pages.length > 1) actions.appendChild(delBtn);

    item.appendChild(name);
    item.appendChild(count);
    item.appendChild(actions);

    item.addEventListener('click', () => switchPage(i));
    pageListEl.appendChild(item);

    // Render sub-pages
    if (p.subPages && p.subPages.length > 0) {
      p.subPages.forEach((sp, si) => {
        const subItem = document.createElement('div');
        const subIsActive = i === currentPageIndex && si === currentSubPageIndex;
        const subIsEmpty = sp.boards.length === 0;
        subItem.className = 'page-item sub-page' + (subIsActive ? ' active' : '') + (subIsEmpty ? ' empty' : '');

        const subName = document.createElement('span');
        subName.className = 'page-name';
        subName.textContent = sp.name;

        const subCount = document.createElement('span');
        subCount.className = 'page-count';
        subCount.textContent = sp.boards.length;

        const subActions = document.createElement('div');
        subActions.className = 'page-actions';

        const subRenameBtn = document.createElement('button');
        subRenameBtn.className = 'page-action-btn';
        subRenameBtn.textContent = '✎';
        subRenameBtn.title = 'Přejmenovat';
        subRenameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          startSubRename(i, si);
        });

        const subDelBtn = document.createElement('button');
        subDelBtn.className = 'page-action-btn danger';
        subDelBtn.textContent = '✕';
        subDelBtn.title = 'Smazat';
        subDelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasActive = currentPageIndex === i && currentSubPageIndex === si;
          p.subPages.splice(si, 1);
          if (wasActive) {
            currentSubPageIndex = -1;
          } else if (currentPageIndex === i && currentSubPageIndex > si) {
            currentSubPageIndex--;
          }
          syncFromPage();
          renderPageList();
          draw();
          saveState();
        });

        subActions.appendChild(subRenameBtn);
        subActions.appendChild(subDelBtn);

        subItem.appendChild(subName);
        subItem.appendChild(subCount);
        subItem.appendChild(subActions);

        subItem.addEventListener('click', () => switchPage(i, si));
        pageListEl.appendChild(subItem);
      });
    }
  });
}

function startRename(index) {
  const items = pageListEl.querySelectorAll('.page-item:not(.sub-page)');
  const item = items[index];
  if (!item) return;
  const nameSpan = item.querySelector('.page-name');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'page-name-input';
  input.value = pages[index].name;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const finish = () => {
    const val = input.value.trim();
    if (val) pages[index].name = val;
    renderPageList();
    saveState();
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = pages[index].name; input.blur(); }
  });
}

function startSubRename(pageIndex, subIndex) {
  const items = pageListEl.querySelectorAll('.page-item');
  // Find the correct sub-page item
  let targetItem = null;
  let count = 0;
  for (const item of items) {
    if (item.classList.contains('sub-page')) {
      // Check if this sub-page belongs to our parent
      // We need to count sub-pages per parent
    }
  }
  // Simpler approach: find all sub-page items and count
  let subCount = -1;
  let parentCount = -1;
  for (const item of items) {
    if (!item.classList.contains('sub-page')) {
      parentCount++;
      subCount = -1;
    } else {
      subCount++;
      if (parentCount === pageIndex && subCount === subIndex) {
        targetItem = item;
        break;
      }
    }
  }
  if (!targetItem) return;

  const nameSpan = targetItem.querySelector('.page-name');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'page-name-input';
  input.value = pages[pageIndex].subPages[subIndex].name;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const finish = () => {
    const val = input.value.trim();
    if (val) pages[pageIndex].subPages[subIndex].name = val;
    renderPageList();
    saveState();
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = pages[pageIndex].subPages[subIndex].name; input.blur(); }
  });
}

document.getElementById('sb-add-page').addEventListener('click', () => {
  const newPage = {
    name: 'Stránka ' + (pages.length + 1),
    boards: [],
    panX: 0,
    panY: 0,
    scale: 1
  };
  pages.push(newPage);
  switchPage(pages.length - 1, -1);
  saveState();
  setTimeout(() => startRename(pages.length - 1), 50);
});

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  sidebarToggle.classList.toggle('open');
  sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
});

renderPageList();
