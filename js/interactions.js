// ── Mouse / Touch / Keyboard interactions ──

const ctxMenu = document.getElementById('ctx-menu');
const pinMenu = document.getElementById('pin-menu');
const freeImgMenu = document.getElementById('free-img-menu');

// ── Comment modal ──

const commentOverlay = document.getElementById('comment-overlay');
const commentTitleInput = document.getElementById('comment-title-input');
const commentTextInput = document.getElementById('comment-text-input');
let commentCallback = null;

function openCommentModal(titleVal, textVal, callback) {
  commentTitleInput.value = titleVal || '';
  commentTextInput.value = textVal || '';
  commentCallback = callback;
  commentOverlay.classList.add('visible');
  setTimeout(() => commentTitleInput.focus(), 50);
}

function closeCommentModal() {
  commentOverlay.classList.remove('visible');
  commentCallback = null;
}

document.getElementById('comment-save').addEventListener('click', () => {
  const title = commentTitleInput.value.trim();
  const text = commentTextInput.value.trim();
  if (text && commentCallback) {
    commentCallback(title, text);
  }
  closeCommentModal();
});

document.getElementById('comment-cancel').addEventListener('click', closeCommentModal);

commentTitleInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeCommentModal();
});

commentTextInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeCommentModal();
});

// ── Approve modal ──

const approveOverlay = document.getElementById('approve-overlay');
const approveNameInput = document.getElementById('approve-name-input');
const approveSavedList = document.getElementById('approve-saved-list');
const APPROVERS_KEY = 'basewear_approvers';
let approveCallback = null;
let selectedApprover = null;

function getSavedApprovers() {
  try {
    return JSON.parse(localStorage.getItem(APPROVERS_KEY) || '[]');
  } catch(_) { return []; }
}

function saveApprover(name) {
  if (!name) return;
  const list = getSavedApprovers();
  // Move to front if exists, or add
  const idx = list.indexOf(name);
  if (idx >= 0) list.splice(idx, 1);
  list.unshift(name);
  // Keep max 10
  if (list.length > 10) list.length = 10;
  localStorage.setItem(APPROVERS_KEY, JSON.stringify(list));
}

function openApproveModal(callback) {
  approveCallback = callback;
  approveNameInput.value = '';
  selectedApprover = null;
  renderApproverList();
  approveOverlay.classList.add('visible');
  setTimeout(() => {
    const saved = getSavedApprovers();
    if (saved.length > 0) {
      // Pre-select first saved name
      selectedApprover = saved[0];
      renderApproverList();
    } else {
      approveNameInput.focus();
    }
  }, 50);
}

function closeApproveModal() {
  approveOverlay.classList.remove('visible');
  approveCallback = null;
  selectedApprover = null;
}

function renderApproverList() {
  approveSavedList.innerHTML = '';
  const saved = getSavedApprovers();
  saved.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'saved-name-btn' + (selectedApprover === name ? ' selected' : '');
    btn.textContent = name;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (selectedApprover === name) {
        selectedApprover = null;
      } else {
        selectedApprover = name;
        approveNameInput.value = '';
      }
      renderApproverList();
    });
    approveSavedList.appendChild(btn);
  });
}

function confirmApproval() {
  const newName = approveNameInput.value.trim();
  const finalName = newName || selectedApprover || '';
  if (finalName) saveApprover(finalName);
  if (approveCallback) approveCallback(finalName);
  closeApproveModal();
}

document.getElementById('approve-confirm').addEventListener('click', confirmApproval);
document.getElementById('approve-cancel').addEventListener('click', closeApproveModal);

approveNameInput.addEventListener('input', () => {
  if (approveNameInput.value.trim()) {
    selectedApprover = null;
    renderApproverList();
  }
});

approveNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmApproval();
  if (e.key === 'Escape') closeApproveModal();
});

// ── Board image upload ──

const boardImgInput = document.createElement('input');
boardImgInput.type = 'file';
boardImgInput.accept = 'image/*';
boardImgInput.style.display = 'none';
document.body.appendChild(boardImgInput);

let pendingImgBoard = null;
let pendingImgSlot = null;

function uploadBoardImage(board, slotIndex) {
  pendingImgBoard = board;
  pendingImgSlot = slotIndex;
  boardImgInput.value = '';
  boardImgInput.click();
}

boardImgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file || !pendingImgBoard) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const dataURL = ev.target.result;
    if (!pendingImgBoard.images) pendingImgBoard.images = [null, null];
    pendingImgBoard.images[pendingImgSlot] = dataURL;
    // Create image object for rendering
    if (!pendingImgBoard._imgObjects) pendingImgBoard._imgObjects = [null, null];
    const img = new Image();
    img.onload = () => { draw(); };
    img.src = dataURL;
    pendingImgBoard._imgObjects[pendingImgSlot] = img;
    saveState();
    pendingImgBoard = null;
    pendingImgSlot = null;
  };
  reader.readAsDataURL(file);
});

// ── Hit testing ──

function hitRect(sx, sy, r) {
  return r && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
}

function hitCircle(sx, sy, r) {
  if (!r) return false;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const radius = r.w / 2;
  return Math.hypot(sx - cx, sy - cy) <= radius;
}

function hitCircleRect(sx, sy, r) {
  if (!r) return false;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return Math.hypot(sx - cx, sy - cy) <= r.w / 2;
}

// ── Menus ──

function closeMenu() {
  ctxMenu.classList.remove('visible');
  menuBoardIndex = null;
}

function closePinMenu() {
  pinMenu.classList.remove('visible');
  menuPin = null;
}

function showMenu(x, y, boardIndex) {
  closePinMenu();
  menuBoardIndex = boardIndex;
  ctxMenu.style.left = x + 'px';
  ctxMenu.style.top = y + 'px';
  ctxMenu.classList.add('visible');

  requestAnimationFrame(() => {
    const r = ctxMenu.getBoundingClientRect();
    if (r.right > window.innerWidth) ctxMenu.style.left = (x - r.width) + 'px';
    if (r.bottom > window.innerHeight) ctxMenu.style.top = (y - r.height) + 'px';
  });
}

function showPinMenu(x, y, boardIndex, pinIndex) {
  closeMenu();
  menuPin = { boardIndex, pinIndex };
  pinMenu.style.left = x + 'px';
  pinMenu.style.top = y + 'px';
  pinMenu.classList.add('visible');

  requestAnimationFrame(() => {
    const r = pinMenu.getBoundingClientRect();
    if (r.right > window.innerWidth) pinMenu.style.left = (x - r.width) + 'px';
    if (r.bottom > window.innerHeight) pinMenu.style.top = (y - r.height) + 'px';
  });
}

// ── Free image menu ──

function closeFreeImgMenu() {
  freeImgMenu.classList.remove('visible');
  menuFreeImageIndex = null;
}

function showFreeImgMenu(x, y, index) {
  closeMenu();
  closePinMenu();
  menuFreeImageIndex = index;
  const fi = freeImages[index];
  document.getElementById('fimg-lock').textContent = fi.locked ? 'Odemknout' : 'Uzamknout';
  freeImgMenu.style.left = x + 'px';
  freeImgMenu.style.top = y + 'px';
  freeImgMenu.classList.add('visible');

  requestAnimationFrame(() => {
    const r = freeImgMenu.getBoundingClientRect();
    if (r.right > window.innerWidth) freeImgMenu.style.left = (x - r.width) + 'px';
    if (r.bottom > window.innerHeight) freeImgMenu.style.top = (y - r.height) + 'px';
  });
}

// ── Free image hit testing ──

function hitTestFreeImage(sx, sy) {
  for (let i = freeImages.length - 1; i >= 0; i--) {
    const fi = freeImages[i];
    if (!fi._screenRect) continue;
    const r = fi._screenRect;
    if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) {
      return i;
    }
  }
  return -1;
}

function hitTestResizeHandle(sx, sy) {
  const hs = Math.max(8, 10 * scale);
  for (let i = freeImages.length - 1; i >= 0; i--) {
    const fi = freeImages[i];
    if (fi.locked || !fi._screenRect) continue;
    if (hoveredFreeImage !== i) continue;
    const r = fi._screenRect;
    const corners = [
      { x: r.x, y: r.y, corner: 'tl' },
      { x: r.x + r.w, y: r.y, corner: 'tr' },
      { x: r.x, y: r.y + r.h, corner: 'bl' },
      { x: r.x + r.w, y: r.y + r.h, corner: 'br' }
    ];
    for (const c of corners) {
      if (Math.abs(sx - c.x) <= hs && Math.abs(sy - c.y) <= hs) {
        return { index: i, corner: c.corner };
      }
    }
  }
  return null;
}

// ── Drag-and-drop image files onto canvas ──

cvs.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

cvs.addEventListener('drop', e => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length === 0) return;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      const dataURL = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const maxSize = 600;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const wp = screenToWorld(e.clientX, e.clientY);
        freeImages.push({
          x: wp.x - w / 2,
          y: wp.y - h / 2,
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
});

// ── Board click handling ──

function handleBoardButtonClick(screenX, screenY) {
  // Check pin clicks — show pin context menu
  for (let i = boards.length - 1; i >= 0; i--) {
    const b = boards[i];
    if (b._pinRects) {
      for (const pr of b._pinRects) {
        if (hitRect(screenX, screenY, pr)) {
          showPinMenu(screenX, screenY, i, pr.pi);
          return true;
        }
      }
    }
  }

  // Check image slot clicks (empty slots always, filled slots when hovered or in edit mode)
  for (let i = boards.length - 1; i >= 0; i--) {
    const b = boards[i];
    if (b._imgSlots) {
      for (const slot of b._imgSlots) {
        if (hitRect(screenX, screenY, slot)) {
          const hasImage = b.images && b.images[slot.si];
          if (!hasImage || freeImageEditMode) {
            uploadBoardImage(b, slot.si);
            return true;
          }
        }
      }
    }
  }

  for (let i = boards.length - 1; i >= 0; i--) {
    const b = boards[i];

    // Check comment action icons first (delete / edit)
    if (b._commentRects) {
      for (const cr of b._commentRects) {
        if (hitCircleRect(screenX, screenY, cr.delRect)) {
          if (confirmDeleteComment && confirmDeleteComment.boardIndex === i && confirmDeleteComment.commentIndex === cr.ci) {
            b.comments.splice(cr.ci, 1);
            confirmDeleteComment = null;
            hoveredComment = null;
            draw();
          } else {
            confirmDeleteComment = { boardIndex: i, commentIndex: cr.ci };
            draw();
          }
          return true;
        }
        if (hitCircleRect(screenX, screenY, cr.editRect)) {
          const current = b.comments[cr.ci];
          const curTitle = typeof current === 'object' ? current.title : '';
          const curText = typeof current === 'object' ? current.text : current;
          openCommentModal(curTitle, curText, (title, text) => {
            b.comments[cr.ci] = { title, text };
            saveState();
            draw();
          });
          return true;
        }
      }
    }

    if (hitCircle(screenX, screenY, b._btnApprove)) {
      if (b.status === 'approved') {
        b.status = null;
        b.approvedBy = null;
        b.approvedAt = null;
        saveState();
        draw();
      } else {
        openApproveModal((name) => {
          b.status = 'approved';
          b.approvedBy = name;
          b.approvedAt = new Date().toLocaleString('cs-CZ', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          saveState();
          draw();
        });
      }
      return true;
    }
    if (hitCircle(screenX, screenY, b._btnReject)) {
      b.status = b.status === 'rejected' ? null : 'rejected';
      draw();
      return true;
    }
    if (hitCircle(screenX, screenY, b._btnComment) || hitCircle(screenX, screenY, b._btnAddComment)) {
      openCommentModal('', '', (title, text) => {
        if (!b.comments) b.comments = [];
        b.comments.push({ title, text });
        saveState();
        draw();
      });
      return true;
    }
  }
  if (confirmDeleteComment) {
    confirmDeleteComment = null;
    draw();
  }

  return false;
}

// ── Coordinate helpers ──

let dragging = false;
let lastX, lastY;

function screenToWorld(sx, sy) {
  return { x: sx / scale - panX, y: sy / scale - panY };
}

function hitTestBoard(sx, sy) {
  const wp = screenToWorld(sx, sy);
  for (let i = boards.length - 1; i >= 0; i--) {
    const b = boards[i];
    if (wp.x >= b.x && wp.x <= b.x + b.w && wp.y >= b.y && wp.y <= b.y + b.h) {
      return { index: i, offsetX: wp.x - b.x, offsetY: wp.y - b.y };
    }
  }
  return null;
}

// ── Hover tracking ──

cvs.addEventListener('mousemove', e => {
  // Pin dragging — follow cursor in real-time
  if (pinMoveMode) {
    const b = boards[pinMoveMode.boardIndex];
    const bsx = (b.x + panX) * scale;
    const bsy = (b.y + panY) * scale;
    const bsw = b.w * scale;
    const bsh = b.h * scale;
    // Clamp pin inside board
    const rx = Math.max(0, Math.min(1, (e.clientX - bsx) / bsw));
    const ry = Math.max(0, Math.min(1, (e.clientY - bsy) / bsh));
    b.pins[pinMoveMode.pinIndex].rx = rx;
    b.pins[pinMoveMode.pinIndex].ry = ry;
    draw();
    return;
  }

  if (dragging || dragBoard) return;
  const sx = e.clientX;
  const sy = e.clientY;
  let needRedraw = false;
  let found = null;
  for (let i = boards.length - 1; i >= 0; i--) {
    const b = boards[i];
    if (!b._commentRects) continue;
    for (const cr of b._commentRects) {
      if (hitRect(sx, sy, cr.rect) || hitCircleRect(sx, sy, cr.delRect) || hitCircleRect(sx, sy, cr.editRect)) {
        found = { boardIndex: i, commentIndex: cr.ci };
        break;
      }
    }
    if (found) break;
  }
  const prev = hoveredComment;
  hoveredComment = found;
  if (!found && confirmDeleteComment) {
    confirmDeleteComment = null;
  }
  if ((prev?.boardIndex !== found?.boardIndex) || (prev?.commentIndex !== found?.commentIndex)) {
    needRedraw = true;
  }

  // Pin hover detection
  let foundPin = null;
  for (let i = boards.length - 1; i >= 0; i--) {
    const b = boards[i];
    if (b._pinRects) {
      for (const pr of b._pinRects) {
        if (hitRect(sx, sy, pr)) {
          foundPin = { boardIndex: i, pinIndex: pr.pi };
          break;
        }
      }
    }
    if (foundPin) break;
  }
  const prevPin = hoveredPin;
  hoveredPin = foundPin;
  if ((prevPin?.boardIndex !== foundPin?.boardIndex) || (prevPin?.pinIndex !== foundPin?.pinIndex)) {
    needRedraw = true;
  }

  // Image slot hover detection (filled slots only, only in edit mode)
  let foundImgSlot = null;
  if (freeImageEditMode) {
    for (let i = boards.length - 1; i >= 0; i--) {
      const b = boards[i];
      if (b._imgSlots) {
        for (const slot of b._imgSlots) {
          if (hitRect(sx, sy, slot)) {
            const hasImage = b.images && b.images[slot.si];
            if (hasImage) {
              foundImgSlot = { boardIndex: i, slotIndex: slot.si };
            }
            break;
          }
        }
      }
      if (foundImgSlot) break;
    }
  }
  const prevImgSlot = hoveredImgSlot;
  hoveredImgSlot = foundImgSlot;
  if ((prevImgSlot?.boardIndex !== foundImgSlot?.boardIndex) || (prevImgSlot?.slotIndex !== foundImgSlot?.slotIndex)) {
    needRedraw = true;
  }
  if (foundImgSlot) {
    cvs.style.cursor = 'pointer';
  }

  // Free image hover detection (always active)
  let foundFreeImg = null;
  const resH = hitTestResizeHandle(sx, sy);
  if (resH) {
    cvs.style.cursor = (resH.corner === 'tl' || resH.corner === 'br') ? 'nwse-resize' : 'nesw-resize';
    foundFreeImg = resH.index;
  } else {
    const fHit = hitTestFreeImage(sx, sy);
    if (fHit >= 0) {
      foundFreeImg = fHit;
      if (!freeImages[fHit].locked) {
        cvs.style.cursor = 'move';
      }
    } else if (!pinMoveMode && pinMode === null && moveMode === null && !foundImgSlot) {
      cvs.style.cursor = 'grab';
    }
  }
  const prevFreeImg = hoveredFreeImage;
  hoveredFreeImage = foundFreeImg;
  if (prevFreeImg !== foundFreeImg) needRedraw = true;

  if (needRedraw) draw();
});

// ── Snapping ──

const SNAP_DIST = 12;

function snapBoard(index) {
  const b = boards[index];
  const bRight = b.x + b.w;
  for (let j = 0; j < boards.length; j++) {
    if (j === index) continue;
    const o = boards[j];
    const bCenterY = b.y + b.h / 2;
    const oCenterY = o.y + o.h / 2;
    if (Math.abs(bCenterY - oCenterY) < SNAP_DIST) b.y = oCenterY - b.h / 2;

    const oRight = o.x + o.w;
    if (Math.abs(b.x - (oRight + BOARD_GAP)) < SNAP_DIST) b.x = oRight + BOARD_GAP;
    if (Math.abs(bRight - (o.x - BOARD_GAP)) < SNAP_DIST) b.x = o.x - BOARD_GAP - b.w;
    if (Math.abs(b.x - o.x) < SNAP_DIST) b.x = o.x;
  }
}

// ── Pointer events ──

cvs.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  closeMenu();
  closePinMenu();
  closeFreeImgMenu();

  // Pin move — drop pin on click
  if (pinMoveMode) {
    saveState();
    pinMoveMode = null;
    cvs.style.cursor = 'grab';
    draw();
    return;
  }

  lastX = e.clientX;
  lastY = e.clientY;
  pointerMoved = false;
  cvs.setPointerCapture(e.pointerId);

  if (moveMode !== null) {
    const wp = screenToWorld(e.clientX, e.clientY);
    dragBoard = {
      index: moveMode,
      offsetX: wp.x - boards[moveMode].x,
      offsetY: wp.y - boards[moveMode].y
    };
    cvs.classList.add('grabbing');
    moveMode = null;
    return;
  }

  // Free image resize handle
  const resizeHit = hitTestResizeHandle(e.clientX, e.clientY);
  if (resizeHit) {
    const fi = freeImages[resizeHit.index];
    resizeFreeImage = {
      index: resizeHit.index,
      corner: resizeHit.corner,
      startX: e.clientX,
      startY: e.clientY,
      origX: fi.x,
      origY: fi.y,
      origW: fi.w,
      origH: fi.h,
      aspect: fi.w / fi.h
    };
    cvs.setPointerCapture(e.pointerId);
    return;
  }

  // Free image drag (if not locked)
  const freeHit = hitTestFreeImage(e.clientX, e.clientY);
  if (freeHit >= 0 && !freeImages[freeHit].locked) {
    const wp = screenToWorld(e.clientX, e.clientY);
    const fi = freeImages[freeHit];
    dragFreeImage = {
      index: freeHit,
      offsetX: wp.x - fi.x,
      offsetY: wp.y - fi.y
    };
    cvs.classList.add('grabbing');
    cvs.setPointerCapture(e.pointerId);
    return;
  }

  dragging = true;
  cvs.classList.add('grabbing');
});

window.addEventListener('pointermove', e => {
  if (resizeFreeImage) {
    pointerMoved = true;
    const r = resizeFreeImage;
    const fi = freeImages[r.index];
    const dx = (e.clientX - r.startX) / scale;
    const dy = (e.clientY - r.startY) / scale;

    let newW, newH;
    if (r.corner === 'br') {
      newW = Math.max(20, r.origW + dx);
      newH = newW / r.aspect;
      fi.x = r.origX;
      fi.y = r.origY;
    } else if (r.corner === 'bl') {
      newW = Math.max(20, r.origW - dx);
      newH = newW / r.aspect;
      fi.x = r.origX + r.origW - newW;
      fi.y = r.origY;
    } else if (r.corner === 'tr') {
      newW = Math.max(20, r.origW + dx);
      newH = newW / r.aspect;
      fi.x = r.origX;
      fi.y = r.origY + r.origH - newH;
    } else {
      newW = Math.max(20, r.origW - dx);
      newH = newW / r.aspect;
      fi.x = r.origX + r.origW - newW;
      fi.y = r.origY + r.origH - newH;
    }
    fi.w = newW;
    fi.h = newH;
    draw();
  } else if (dragFreeImage) {
    pointerMoved = true;
    const wp = screenToWorld(e.clientX, e.clientY);
    const fi = freeImages[dragFreeImage.index];
    fi.x = wp.x - dragFreeImage.offsetX;
    fi.y = wp.y - dragFreeImage.offsetY;
    draw();
  } else if (dragBoard) {
    pointerMoved = true;
    const wp = screenToWorld(e.clientX, e.clientY);
    boards[dragBoard.index].x = wp.x - dragBoard.offsetX;
    boards[dragBoard.index].y = wp.y - dragBoard.offsetY;
    snapBoard(dragBoard.index);
    draw();
  } else if (dragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) pointerMoved = true;
    lastX = e.clientX;
    lastY = e.clientY;
    panX += dx / scale;
    panY += dy / scale;
    draw();
  }
});

window.addEventListener('pointerup', e => {
  // Free image resize end
  if (resizeFreeImage) {
    if (pointerMoved) saveState();
    resizeFreeImage = null;
    draw();
    return;
  }

  // Free image drag end
  if (dragFreeImage) {
    if (!pointerMoved) {
      // Click without move — show context menu
      showFreeImgMenu(e.clientX, e.clientY, dragFreeImage.index);
    } else {
      saveState();
    }
    dragFreeImage = null;
    cvs.classList.remove('grabbing');
    cvs.style.cursor = 'grab';
    return;
  }

  if (!pointerMoved && dragging) {
    // Pin placement mode
    if (pinMode !== null) {
      const b = boards[pinMode];
      const sx = (b.x + panX) * scale;
      const sy = (b.y + panY) * scale;
      const sw = b.w * scale;
      const sh = b.h * scale;
      if (e.clientX >= sx && e.clientX <= sx + sw && e.clientY >= sy && e.clientY <= sy + sh) {
        const pinRx = (e.clientX - sx) / sw;
        const pinRy = (e.clientY - sy) / sh;
        openCommentModal('', '', (title, text) => {
          if (!b.pins) b.pins = [];
          b.pins.push({ rx: pinRx, ry: pinRy, text: title ? title + ': ' + text : text });
          saveState();
          draw();
        });
      }
      pinMode = null;
      cvs.style.cursor = 'grab';
      dragging = false;
      cvs.classList.remove('grabbing');
      return;
    }

    // Check free image click (show context menu)
    const freeHitUp = hitTestFreeImage(e.clientX, e.clientY);
    if (freeHitUp >= 0) {
      showFreeImgMenu(e.clientX, e.clientY, freeHitUp);
      dragging = false;
      cvs.classList.remove('grabbing');
      return;
    }

    if (handleBoardButtonClick(e.clientX, e.clientY)) {
      dragging = false;
      cvs.classList.remove('grabbing');
      return;
    }
    const hit = hitTestBoard(e.clientX, e.clientY);
    if (hit) {
      showMenu(e.clientX, e.clientY, hit.index);
    }
  }
  dragging = false;
  dragBoard = null;
  cvs.classList.remove('grabbing');
  cvs.style.cursor = (pinMode !== null || pinMoveMode) ? 'crosshair' : (moveMode !== null ? 'move' : 'grab');
});

// Close menus on click outside or on non-button area
window.addEventListener('pointerdown', e => {
  if (!ctxMenu.contains(e.target)) closeMenu();
  if (!pinMenu.contains(e.target)) closePinMenu();
  if (!freeImgMenu.contains(e.target)) closeFreeImgMenu();
});

// Close menus when clicking on separators/padding (non-button areas)
ctxMenu.addEventListener('pointerdown', e => {
  if (!e.target.closest('.ctx-item')) { closeMenu(); e.stopPropagation(); }
});
pinMenu.addEventListener('pointerdown', e => {
  if (!e.target.closest('.ctx-item')) { closePinMenu(); e.stopPropagation(); }
});
freeImgMenu.addEventListener('pointerdown', e => {
  if (!e.target.closest('.ctx-item')) { closeFreeImgMenu(); e.stopPropagation(); }
});

// ── Context menu actions ──

document.getElementById('ctx-rename').addEventListener('click', () => {
  if (menuBoardIndex === null) return;
  const b = boards[menuBoardIndex];
  const newTitle = prompt('Název plátna:', b.title || '');
  if (newTitle !== null) {
    b.title = newTitle.trim();
    draw();
    saveState();
  }
  closeMenu();
});

// Pin menu actions
document.getElementById('pin-edit').addEventListener('click', () => {
  if (!menuPin) return;
  const b = boards[menuPin.boardIndex];
  const pin = b.pins[menuPin.pinIndex];
  closePinMenu();
  openCommentModal('', pin.text, (title, text) => {
    pin.text = title ? title + ': ' + text : text;
    saveState();
    draw();
  });
});

document.getElementById('pin-move').addEventListener('click', () => {
  if (!menuPin) return;
  pinMoveMode = { boardIndex: menuPin.boardIndex, pinIndex: menuPin.pinIndex };
  cvs.style.cursor = 'crosshair';
  closePinMenu();
});

document.getElementById('pin-delete').addEventListener('click', () => {
  if (!menuPin) return;
  const b = boards[menuPin.boardIndex];
  b.pins.splice(menuPin.pinIndex, 1);
  saveState();
  draw();
  closePinMenu();
});

document.getElementById('ctx-pin').addEventListener('click', () => {
  if (menuBoardIndex === null) return;
  const bi = menuBoardIndex;
  const b = boards[bi];
  // Get menu position and convert to pin coordinates
  const menuX = parseInt(ctxMenu.style.left);
  const menuY = parseInt(ctxMenu.style.top);
  const bsx = (b.x + panX) * scale;
  const bsy = (b.y + panY) * scale;
  const bsw = b.w * scale;
  const bsh = b.h * scale;
  const pinRx = Math.max(0, Math.min(1, (menuX - bsx) / bsw));
  const pinRy = Math.max(0, Math.min(1, (menuY - bsy) / bsh));
  closeMenu();
  openCommentModal('', '', (title, text) => {
    if (!b.pins) b.pins = [];
    b.pins.push({ rx: pinRx, ry: pinRy, text: title ? title + ': ' + text : text });
    saveState();
    draw();
  });
});

document.getElementById('ctx-edit-photo').addEventListener('click', () => {
  freeImageEditMode = true;
  closeMenu();
  draw();
});

document.getElementById('ctx-add-png').addEventListener('click', () => {
  closeMenu();
  triggerPngUpload();
});

document.getElementById('ctx-move').addEventListener('click', () => {
  if (menuBoardIndex === null) return;
  moveMode = menuBoardIndex;
  cvs.style.cursor = 'move';
  closeMenu();
});

document.getElementById('ctx-delete').addEventListener('click', () => {
  if (menuBoardIndex === null) return;
  boards.splice(menuBoardIndex, 1);
  boards.forEach((b, i) => b.label = `#${i + 1}`);
  closeMenu();
  draw();
  renderPageList();
});

// ── Free image context menu actions ──

document.getElementById('fimg-lock').addEventListener('click', () => {
  if (menuFreeImageIndex === null) return;
  freeImages[menuFreeImageIndex].locked = !freeImages[menuFreeImageIndex].locked;
  saveState();
  draw();
  closeFreeImgMenu();
});

document.getElementById('fimg-delete').addEventListener('click', () => {
  if (menuFreeImageIndex === null) return;
  freeImages.splice(menuFreeImageIndex, 1);
  hoveredFreeImage = null;
  saveState();
  draw();
  closeFreeImgMenu();
});

// ── Zoom ──

function zoomAt(cx, cy, factor) {
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
  const worldX = cx / scale - panX;
  const worldY = cy / scale - panY;
  panX = cx / newScale - worldX;
  panY = cy / newScale - worldY;
  scale = newScale;
  draw();
}

cvs.addEventListener('wheel', e => {
  e.preventDefault();
  let delta = e.deltaY;
  if (e.deltaMode === 1) delta *= 36;
  if (e.deltaMode === 2) delta *= 100;
  delta = Math.max(-300, Math.min(300, delta));
  const zoomFactor = Math.pow(0.9961, delta);
  zoomAt(e.clientX, e.clientY, zoomFactor);
}, { passive: false });

// ── Touch (pinch zoom) ──

let lastTouchDist = null;
let lastTouchCenter = null;

cvs.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    lastTouchDist = getTouchDist(e.touches);
    lastTouchCenter = getTouchCenter(e.touches);
  }
}, { passive: false });

cvs.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && lastTouchDist !== null) {
    e.preventDefault();
    const dist = getTouchDist(e.touches);
    const center = getTouchCenter(e.touches);
    const factor = dist / lastTouchDist;
    zoomAt(center.x, center.y, factor);
    lastTouchDist = dist;
    lastTouchCenter = center;
  }
}, { passive: false });

cvs.addEventListener('touchend', () => {
  lastTouchDist = null;
  lastTouchCenter = null;
});

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function getTouchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

// ── Keyboard shortcuts ──

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && freeImageEditMode) {
    freeImageEditMode = false;
    hoveredFreeImage = null;
    cvs.style.cursor = 'grab';
    draw();
    return;
  }
  if (e.key === '=' || e.key === '+') zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25);
  if (e.key === '-') zoomAt(window.innerWidth / 2, window.innerHeight / 2, 0.8);
  if (e.key === '0') { panX = 0; panY = 0; scale = 1; draw(); }
});
