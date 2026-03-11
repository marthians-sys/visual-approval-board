// ── Firebase Sync Layer ──

let _fbSaveTimeout = null;
let _fbImageSaveTimeout = null;
let _isRemoteUpdate = false;
let _structureListener = null;
let _projectsListener = null;
let _syncIndicator = null;

// Sync status indicator
function createSyncIndicator() {
  _syncIndicator = document.createElement('div');
  _syncIndicator.id = 'sync-indicator';
  _syncIndicator.style.cssText = `
    position: fixed; bottom: 12px; right: 12px; z-index: 9999;
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 20px;
    background: rgba(30,30,30,0.85); color: #aaa;
    font: 400 11px 'DM Mono', monospace;
    transition: opacity 0.3s;
  `;
  document.body.appendChild(_syncIndicator);
  setSyncStatus('offline');
}

function setSyncStatus(status) {
  if (!_syncIndicator) return;
  const colors = { synced: '#4ade80', syncing: '#facc15', offline: '#888', error: '#ef4444' };
  const labels = { synced: 'Synced', syncing: 'Syncing...', offline: 'Local', error: 'Sync error' };
  _syncIndicator.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${colors[status]}"></span>${labels[status]}`;
}

// ── Save structure to Firestore ──
function firebaseSaveStructure() {
  if (!firebaseReady || !db || _isRemoteUpdate) return;

  // Debounce
  if (_fbSaveTimeout) clearTimeout(_fbSaveTimeout);
  _fbSaveTimeout = setTimeout(() => {
    setSyncStatus('syncing');

    // Build clean structure data (same as localStorage save)
    const cleanData = JSON.parse(JSON.stringify({
      pages, currentPageIndex, currentSubPageIndex, brandName
    }, (key, value) => {
      if (key === '_img' || key === '_imgObjects' || key === '_screenRect' ||
          key === '_pinRects' || key === '_commentRects' || key === '_imgSlots' ||
          key === '_btnApprove' || key === '_btnReject' || key === '_btnComment' ||
          key === '_btnAddComment' || key === 'dataURL' || key === 'images' ||
          key === 'logoDataURL') return undefined;
      return value;
    }));

    cleanData._updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    cleanData._updatedBy = firebaseUser ? firebaseUser.uid : 'unknown';

    db.collection('projects').doc(currentProjectId).set({
      structure: cleanData
    }, { merge: true })
    .then(() => {
      setSyncStatus('synced');
    })
    .catch((err) => {
      console.warn('[Firebase] Save failed:', err);
      setSyncStatus('error');
    });
  }, 800);
}

// ── Save images to Firebase Storage ──
let _fbImageQueue = {};

function firebaseSaveImages() {
  if (!firebaseReady || !fbStorage || _isRemoteUpdate) return;

  if (_fbImageSaveTimeout) clearTimeout(_fbImageSaveTimeout);
  _fbImageSaveTimeout = setTimeout(() => {
    _doFirebaseImageSave();
  }, 2000);
}

function _doFirebaseImageSave() {
  const allImages = {};

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
    if (p.subPages) {
      p.subPages.forEach((sp, spi) => {
        collectPageImages(sp, `${pi}_sub${spi}`);
      });
    }
  });

  if (logoDataURL) {
    allImages['logo'] = logoDataURL;
  }

  // Save image list to Firestore (keys only, for sync)
  const imageKeys = Object.keys(allImages);
  db.collection('projects').doc(currentProjectId).set({
    imageKeys: imageKeys
  }, { merge: true });

  // Upload each image to Firebase Storage
  const storageRef = fbStorage.ref();
  for (const [key, dataURL] of Object.entries(allImages)) {
    const path = `projects/${currentProjectId}/${key}`;
    const ref = storageRef.child(path);

    // Convert dataURL to blob
    try {
      const byteString = atob(dataURL.split(',')[1]);
      const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });

      ref.put(blob).then(() => {
        console.log('[Firebase] Image uploaded:', key);
      }).catch(err => {
        console.warn('[Firebase] Image upload failed:', key, err);
      });
    } catch (e) {
      console.warn('[Firebase] Image conversion failed:', key, e);
    }
  }
}

// ── Load images from Firebase Storage ──
async function firebaseLoadImages() {
  if (!firebaseReady || !fbStorage) return;

  const storageRef = fbStorage.ref();

  async function loadPageImages(p, prefix) {
    if (!p.boards) return;
    for (let bi = 0; bi < p.boards.length; bi++) {
      const b = p.boards[bi];
      if (!b.images) b.images = [null, null];
      if (!b._imgObjects) b._imgObjects = [null, null];
      for (let si = 0; si < 2; si++) {
        const key = `board_${prefix}_${bi}_${si}`;
        const path = `projects/${currentProjectId}/${key}`;
        try {
          const url = await storageRef.child(path).getDownloadURL();
          const response = await fetch(url);
          const blob = await response.blob();
          const dataURL = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          b.images[si] = dataURL;
          const img = new Image();
          img.onload = () => { if (typeof draw === 'function') draw(); };
          img.src = dataURL;
          b._imgObjects[si] = img;
          // Also save to IDB for caching
          if (typeof idbPut === 'function') idbPut(key, dataURL);
        } catch (e) {
          // Image not found — that's OK
        }
      }
    }
    if (p.freeImages) {
      for (let fi_i = 0; fi_i < p.freeImages.length; fi_i++) {
        const fi = p.freeImages[fi_i];
        const key = `free_${prefix}_${fi_i}`;
        const path = `projects/${currentProjectId}/${key}`;
        try {
          const url = await storageRef.child(path).getDownloadURL();
          const response = await fetch(url);
          const blob = await response.blob();
          const dataURL = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          fi.dataURL = dataURL;
          const img = new Image();
          img.onload = () => { if (typeof draw === 'function') draw(); };
          img.src = dataURL;
          fi._img = img;
          if (typeof idbPut === 'function') idbPut(key, dataURL);
        } catch (e) {
          // Image not found
        }
      }
    }
  }

  // Logo
  try {
    const logoUrl = await storageRef.child(`projects/${currentProjectId}/logo`).getDownloadURL();
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    const dataURL = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    logoDataURL = dataURL;
    logoImg = new Image();
    logoImg.onload = () => { if (typeof draw === 'function') draw(); };
    logoImg.src = logoDataURL;
  } catch (e) {
    // No logo
  }

  for (let pi = 0; pi < pages.length; pi++) {
    await loadPageImages(pages[pi], `${pi}`);
    if (pages[pi].subPages) {
      for (let spi = 0; spi < pages[pi].subPages.length; spi++) {
        await loadPageImages(pages[pi].subPages[spi], `${pi}_sub${spi}`);
      }
    }
  }
}

// ── Real-time listener ──
function firebaseStartSync() {
  if (!firebaseReady || !db) return;

  createSyncIndicator();

  // Listen for structure changes
  _structureListener = db.collection('projects').doc(currentProjectId)
    .onSnapshot((doc) => {
      if (!doc.exists) {
        // No remote data — do initial upload
        console.log('[Firebase] No remote data, uploading local...');
        firebaseSaveStructure();
        firebaseSaveImages();
        return;
      }

      const data = doc.data();
      if (!data.structure) return;

      const remote = data.structure;

      // Skip if this update was from us
      if (remote._updatedBy === (firebaseUser ? firebaseUser.uid : '')) {
        setSyncStatus('synced');
        return;
      }

      console.log('[Firebase] Remote update received');
      _isRemoteUpdate = true;

      // Apply remote structure
      if (remote.pages) {
        // Preserve local image data and runtime fields
        const localImageMap = {};
        function saveLocalImages(p, prefix) {
          if (!p.boards) return;
          p.boards.forEach((b, bi) => {
            if (b.images) {
              b.images.forEach((dataURL, si) => {
                if (dataURL) localImageMap[`${prefix}_${bi}_${si}`] = { dataURL, imgObj: b._imgObjects ? b._imgObjects[si] : null };
              });
            }
          });
          if (p.freeImages) {
            p.freeImages.forEach((fi, fi_i) => {
              if (fi.dataURL) localImageMap[`free_${prefix}_${fi_i}`] = { dataURL: fi.dataURL, img: fi._img };
            });
          }
        }
        pages.forEach((p, pi) => {
          saveLocalImages(p, `${pi}`);
          if (p.subPages) {
            p.subPages.forEach((sp, spi) => {
              saveLocalImages(sp, `${pi}_sub${spi}`);
            });
          }
        });

        pages = remote.pages;

        // Restore local images to new pages structure
        function restoreLocalImages(p, prefix) {
          if (!p.boards) return;
          p.boards.forEach((b, bi) => {
            if (!b.images) b.images = [null, null];
            if (!b._imgObjects) b._imgObjects = [null, null];
            for (let si = 0; si < 2; si++) {
              const key = `${prefix}_${bi}_${si}`;
              if (localImageMap[key]) {
                b.images[si] = localImageMap[key].dataURL;
                b._imgObjects[si] = localImageMap[key].imgObj;
              }
            }
          });
          if (p.freeImages) {
            p.freeImages.forEach((fi, fi_i) => {
              const key = `free_${prefix}_${fi_i}`;
              if (localImageMap[key]) {
                fi.dataURL = localImageMap[key].dataURL;
                fi._img = localImageMap[key].img;
              }
            });
          }
        }
        pages.forEach((p, pi) => {
          restoreLocalImages(p, `${pi}`);
          if (p.subPages) {
            p.subPages.forEach((sp, spi) => {
              restoreLocalImages(sp, `${pi}_sub${spi}`);
            });
          }
        });

        if (remote.brandName !== undefined) brandName = remote.brandName;
      }

      syncFromPage();
      restoreBoardImages();
      restoreFreeImages();
      if (typeof renderPageList === 'function') renderPageList();
      if (typeof draw === 'function') draw();

      // Also load remote images if we don't have them locally
      firebaseLoadImages();

      setSyncStatus('synced');

      setTimeout(() => {
        _isRemoteUpdate = false;
      }, 100);
    }, (err) => {
      console.warn('[Firebase] Listener error:', err);
      setSyncStatus('error');
    });

  // Listen for projects list changes
  _projectsListener = db.collection('meta').doc('projects')
    .onSnapshot((doc) => {
      if (!doc.exists) {
        // Upload local projects list
        firebaseSaveProjectsList();
        return;
      }
      const data = doc.data();
      if (data.list && data._updatedBy !== (firebaseUser ? firebaseUser.uid : '')) {
        projectsList = data.list;
        saveProjectsList();
      }
    });

  setSyncStatus('synced');
}

// ── Save projects list to Firestore ──
function firebaseSaveProjectsList() {
  if (!firebaseReady || !db || _isRemoteUpdate) return;
  db.collection('meta').doc('projects').set({
    list: projectsList,
    _updatedBy: firebaseUser ? firebaseUser.uid : 'unknown',
    _updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ── Delete project from Firebase ──
function firebaseDeleteProject(projectId) {
  if (!firebaseReady || !db) return;
  db.collection('projects').doc(projectId).delete();
  // Delete storage images
  if (fbStorage) {
    const ref = fbStorage.ref().child(`projects/${projectId}`);
    ref.listAll().then((res) => {
      res.items.forEach((item) => item.delete());
    }).catch(() => {});
  }
}
