// ── Rendering (draw, drawBoards, drawDots, roundRect) ──

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function drawDots(w, h, gap, alpha) {
  const r = Math.max(0.6, scale * 1);
  const offsetX = ((panX * scale) % gap + gap) % gap;
  const offsetY = ((panY * scale) % gap + gap) % gap;

  ctx.fillStyle = `rgba(42, 42, 42, ${alpha})`;

  for (let x = offsetX; x < w; x += gap) {
    for (let y = offsetY; y < h; y += gap) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBoards(w, h) {
  const vw = w, vh = h;
  boards.forEach((b, i) => {
    const sx = (b.x + panX) * scale;
    const sy = (b.y + panY) * scale;
    const sw = b.w * scale;
    const sh = b.h * scale;

    if (sx + sw < 0 || sy + sh < 0 || sx > vw || sy > vh) return;

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 16 * scale;
    ctx.shadowOffsetY = 4 * scale;

    // White board
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();

    // Border
    if (b.status === 'approved') {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.lineWidth = 2;
    } else if (b.status === 'rejected') {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(42, 42, 42, 0.12)';
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(sx, sy, sw, sh);

    // Label (bottom-left, subtle)
    const labelSize = Math.max(7, 9 * scale);
    ctx.font = `300 ${labelSize}px 'DM Mono', monospace`;
    ctx.fillStyle = 'rgba(42, 42, 42, 0.2)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(b.label, sx + 10 * scale, sy + sh - 6 * scale);

    // Approval stamp (bottom-left, after label)
    if (b.status === 'approved' && b.approvedAt) {
      const stampSize = Math.max(10, 13 * scale);
      const stampPad = 10 * scale;
      const labelW = ctx.measureText(b.label).width;
      const stampX = sx + stampPad + labelW + 8 * scale;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';

      if (b.approvedBy) {
        ctx.font = `700 ${stampSize}px 'DM Mono', monospace`;
        const nameW = ctx.measureText(b.approvedBy).width;
        ctx.fillText(b.approvedBy, stampX, sy + sh - 6 * scale);

        ctx.font = `400 ${stampSize}px 'DM Mono', monospace`;
        ctx.fillText(' · ' + b.approvedAt, stampX + nameW, sy + sh - 6 * scale);
      } else {
        ctx.font = `400 ${stampSize}px 'DM Mono', monospace`;
        ctx.fillText(b.approvedAt, stampX, sy + sh - 6 * scale);
      }
    }

    // Image slots (two side-by-side)
    const pad = 20 * scale;
    const imgGap = 12 * scale;
    const fullImgTop = sy + 70 * scale;
    const fullImgBottom = sy + sh - 30 * scale;
    const fullImgH = fullImgBottom - fullImgTop;
    const imgAreaH = fullImgH * 0.85;
    const imgAreaTop = fullImgTop + (fullImgH - imgAreaH) / 2;
    const imgSlotW = (sw - pad * 2 - imgGap) / 2;
    if (!b.images) b.images = [null, null];
    if (!b._imgSlots) b._imgSlots = [];
    b._imgSlots = [];

    for (let si = 0; si < 2; si++) {
      const slotX = sx + pad + si * (imgSlotW + imgGap);
      const slotY = imgAreaTop;
      b._imgSlots.push({ x: slotX, y: slotY, w: imgSlotW, h: imgAreaH, si });

      if (b.images[si] && b._imgObjects && b._imgObjects[si]) {
        // Draw uploaded image (cover fit)
        const img = b._imgObjects[si];
        if (img.complete && img.naturalWidth) {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const slotAspect = imgSlotW / imgAreaH;
          let drawW, drawH, drawX, drawY;
          if (imgAspect > slotAspect) {
            drawH = imgAreaH;
            drawW = drawH * imgAspect;
            drawX = slotX + (imgSlotW - drawW) / 2;
            drawY = slotY;
          } else {
            drawW = imgSlotW;
            drawH = drawW / imgAspect;
            drawX = slotX;
            drawY = slotY + (imgAreaH - drawH) / 2;
          }
          ctx.save();
          ctx.beginPath();
          roundRect(ctx, slotX, slotY, imgSlotW, imgAreaH, 8 * scale);
          ctx.clip();
          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          // Hover overlay with plus icon
          if (freeImageEditMode && hoveredImgSlot && hoveredImgSlot.boardIndex === i && hoveredImgSlot.slotIndex === si) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(slotX, slotY, imgSlotW, imgAreaH);

            // Plus icon in circle
            const icx = slotX + imgSlotW / 2;
            const icy = slotY + imgAreaH / 2;
            const ir = 22 * scale;

            // Circle background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.arc(icx, icy, ir, 0, Math.PI * 2);
            ctx.fill();

            // Plus sign
            const ps = ir * 0.45;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(2, 3 * scale);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(icx - ps, icy);
            ctx.lineTo(icx + ps, icy);
            ctx.moveTo(icx, icy - ps);
            ctx.lineTo(icx, icy + ps);
            ctx.stroke();
          }

          ctx.restore();
        }
      } else {
        // Empty slot — gray placeholder with "+"
        ctx.fillStyle = 'rgba(42, 42, 42, 0.04)';
        roundRect(ctx, slotX, slotY, imgSlotW, imgAreaH, 8 * scale);
        ctx.fill();
        ctx.strokeStyle = 'rgba(42, 42, 42, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4 * scale, 4 * scale]);
        roundRect(ctx, slotX, slotY, imgSlotW, imgAreaH, 8 * scale);
        ctx.stroke();
        ctx.setLineDash([]);

        // Plus icon
        const plusSize = 16 * scale;
        const pcx = slotX + imgSlotW / 2;
        const pcy = slotY + imgAreaH / 2;
        ctx.strokeStyle = 'rgba(42, 42, 42, 0.2)';
        ctx.lineWidth = Math.max(1.5, 2 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pcx - plusSize, pcy);
        ctx.lineTo(pcx + plusSize, pcy);
        ctx.moveTo(pcx, pcy - plusSize);
        ctx.lineTo(pcx, pcy + plusSize);
        ctx.stroke();
      }
    }

    // Logo — top-left corner
    if (logoImg && logoImg.complete && logoImg.naturalWidth) {
      const maxLogoH = 40 * scale;
      const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
      const lh = maxLogoH;
      const lw = lh * logoAspect;
      ctx.drawImage(logoImg, sx + pad, sy + pad, lw, lh);
    }

    // Board title — top-right corner
    if (b.title) {
      const titleSize = Math.max(10, 14 * scale);
      ctx.font = `400 ${titleSize}px 'Bebas Neue', sans-serif`;
      ctx.fillStyle = 'rgba(42, 42, 42, 0.7)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(b.title, sx + sw - pad, sy + pad);
    }

    // Draw pin markers
    if (b.pins && b.pins.length > 0) {
      b._pinRects = [];
      b.pins.forEach((pin, pi) => {
        const px = sx + pin.rx * sw;
        const py = sy + pin.ry * sh;
        const pinR = Math.max(8.5, 11.9 * scale);
        const needleH = Math.max(13.6, 20.4 * scale);

        // Needle line
        ctx.strokeStyle = 'rgba(220, 50, 50, 0.7)';
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + needleH);
        ctx.stroke();

        // Pin head (circle)
        ctx.fillStyle = 'rgba(220, 50, 50, 0.85)';
        ctx.beginPath();
        ctx.arc(px, py, pinR, 0, Math.PI * 2);
        ctx.fill();

        // White dot in center
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(px, py, pinR * 0.35, 0, Math.PI * 2);
        ctx.fill();

        b._pinRects.push({ x: px - pinR, y: py - pinR, w: pinR * 2, h: pinR * 2 + needleH, pi });

        // Show comment tooltip on hover
        if (hoveredPin && hoveredPin.boardIndex === boards.indexOf(b) && hoveredPin.pinIndex === pi) {
          const tooltipFont = Math.max(9, 11 * scale);
          ctx.font = `400 ${tooltipFont}px 'DM Sans', sans-serif`;
          const tooltipPad = 8 * scale;
          const maxTooltipW = sw / 2;
          const maxTextW = maxTooltipW - tooltipPad * 2;
          const lineH = tooltipFont * 1.4;

          // Word-wrap text
          const words = pin.text.split(' ');
          const lines = [];
          let currentLine = '';
          for (const word of words) {
            const test = currentLine ? currentLine + ' ' + word : word;
            if (ctx.measureText(test).width > maxTextW && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = test;
            }
          }
          if (currentLine) lines.push(currentLine);

          const maxLines = Math.floor((sh / 2 - tooltipPad * 2) / lineH);
          if (lines.length > maxLines) lines.length = maxLines;

          let actualW = 0;
          for (const l of lines) actualW = Math.max(actualW, ctx.measureText(l).width);
          const tooltipW = actualW + tooltipPad * 2;
          const tooltipH = lines.length * lineH + tooltipPad * 2;

          let tooltipX = px - tooltipW / 2;
          let tooltipY = py - pinR - tooltipH - 4 * scale;

          if (tooltipX < 2) tooltipX = 2;
          if (tooltipX + tooltipW > vw - 2) tooltipX = vw - 2 - tooltipW;
          if (tooltipY < 2) tooltipY = py + needleH + 4 * scale;

          ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
          ctx.beginPath();
          roundRect(ctx, tooltipX, tooltipY, tooltipW, tooltipH, 6 * scale);
          ctx.fill();

          ctx.fillStyle = '#fff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          for (let li = 0; li < lines.length; li++) {
            ctx.fillText(lines[li], tooltipX + tooltipPad, tooltipY + tooltipPad + li * lineH);
          }
        }
      });
    } else {
      b._pinRects = [];
    }

    // Reset alpha after board content (in case of rejected overlay)
    ctx.globalAlpha = 1;

    // — Action buttons below board —
    const btnH = 42 * scale;
    const btnGap = 8 * scale;
    const btnY = sy + sh + 12 * scale;
    const btnR = 21 * scale;
    const comFontSize = Math.max(9, 13 * scale);

    const btnW = 42 * scale;
    const btnComW = 300 * scale;
    const comX = sx + sw - btnComW;

    // Approve & reject — left side
    b._btnApprove = { x: sx, y: btnY, w: btnW, h: btnH };
    b._btnReject = { x: sx + btnW + btnGap, y: btnY, w: btnW, h: btnH };

    // Approve button (green circle)
    const approveActive = b.status === 'approved';
    ctx.fillStyle = approveActive ? '#22c55e' : 'rgba(34, 197, 94, 0.12)';
    ctx.beginPath();
    ctx.arc(sx + btnW / 2, btnY + btnH / 2, btnW / 2, 0, Math.PI * 2);
    ctx.fill();
    const ck = btnH * 0.2;
    const appCx = sx + btnW / 2;
    const appCy = btnY + btnH / 2;
    ctx.strokeStyle = approveActive ? '#fff' : '#22c55e';
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(appCx - ck * 0.7, appCy + ck * 0.05);
    ctx.lineTo(appCx - ck * 0.1, appCy + ck * 0.6);
    ctx.lineTo(appCx + ck * 0.8, appCy - ck * 0.5);
    ctx.stroke();

    // Reject button (red circle)
    const rejectActive = b.status === 'rejected';
    const rejX = sx + btnW + btnGap;
    ctx.fillStyle = rejectActive ? '#ef4444' : 'rgba(239, 68, 68, 0.12)';
    ctx.beginPath();
    ctx.arc(rejX + btnW / 2, btnY + btnH / 2, btnW / 2, 0, Math.PI * 2);
    ctx.fill();
    const xk = btnH * 0.16;
    const rejCx = rejX + btnW / 2;
    const rejCy = btnY + btnH / 2;
    ctx.strokeStyle = rejectActive ? '#fff' : '#ef4444';
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rejCx - xk, rejCy - xk);
    ctx.lineTo(rejCx + xk, rejCy + xk);
    ctx.moveTo(rejCx + xk, rejCy - xk);
    ctx.lineTo(rejCx - xk, rejCy + xk);
    ctx.stroke();

    // Comment button / comments
    const hasComments = b.comments && b.comments.length > 0;

    if (!b._commentRects) b._commentRects = [];
    b._commentRects = [];

    if (!hasComments) {
      const comBtnX = sx + sw - btnW;
      b._btnComment = { x: comBtnX, y: btnY, w: btnW, h: btnH };
      b._btnAddComment = null;

      ctx.fillStyle = 'rgba(42, 42, 42, 0.06)';
      ctx.beginPath();
      ctx.arc(comBtnX + btnW / 2, btnY + btnH / 2, btnW / 2, 0, Math.PI * 2);
      ctx.fill();

      // Speech bubble icon
      const bCx = comBtnX + btnW / 2;
      const bCy = btnY + btnH / 2;
      const bs = btnH * 0.18;
      ctx.strokeStyle = 'rgba(42, 42, 42, 0.35)';
      ctx.lineWidth = Math.max(1.2, 1.8 * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bCx - bs * 1.1, bCy - bs * 0.7);
      ctx.lineTo(bCx + bs * 1.1, bCy - bs * 0.7);
      ctx.quadraticCurveTo(bCx + bs * 1.4, bCy - bs * 0.7, bCx + bs * 1.4, bCy - bs * 0.2);
      ctx.lineTo(bCx + bs * 1.4, bCy + bs * 0.3);
      ctx.quadraticCurveTo(bCx + bs * 1.4, bCy + bs * 0.7, bCx + bs * 1.1, bCy + bs * 0.7);
      ctx.lineTo(bCx - bs * 0.3, bCy + bs * 0.7);
      ctx.lineTo(bCx - bs * 0.8, bCy + bs * 1.2);
      ctx.lineTo(bCx - bs * 0.6, bCy + bs * 0.7);
      ctx.lineTo(bCx - bs * 1.1, bCy + bs * 0.7);
      ctx.quadraticCurveTo(bCx - bs * 1.4, bCy + bs * 0.7, bCx - bs * 1.4, bCy + bs * 0.3);
      ctx.lineTo(bCx - bs * 1.4, bCy - bs * 0.2);
      ctx.quadraticCurveTo(bCx - bs * 1.4, bCy - bs * 0.7, bCx - bs * 1.1, bCy - bs * 0.7);
      ctx.stroke();
    } else {
      b._btnComment = null;

      const cmtFontSize = Math.max(8, 10 * scale);
      const cmtPadX = 12 * scale;
      const cmtPadY = 8 * scale;
      const cmtBlockX = sx + sw - btnComW;
      const cmtBlockW = btnComW;
      const cmtLineH = cmtFontSize * 1.45;
      const cmtMinH = 36 * scale;
      const cmtGap = 4 * scale;
      const cmtRadius = 10 * scale;
      const iconSize = 22 * scale;
      const iconPad = 8 * scale;
      let cmtCurY = btnY;

      b.comments.forEach((c, ci) => {
        // Backward compat: old comments are strings, new ones are {title, text}
        const cmtTitle = typeof c === 'object' ? c.title : '';
        const cmtText = typeof c === 'object' ? c.text : c;

        const isHovered = hoveredComment && hoveredComment.boardIndex === i && hoveredComment.commentIndex === ci;
        const isConfirming = confirmDeleteComment && confirmDeleteComment.boardIndex === i && confirmDeleteComment.commentIndex === ci;

        // Word-wrap text to compute height
        const cmtTitleFont = `500 ${cmtFontSize}px 'DM Mono', monospace`;
        const cmtBodyFont = `300 ${cmtFontSize}px 'DM Mono', monospace`;
        const maxTextW = cmtBlockW - cmtPadX * 2 - (isHovered || isConfirming ? iconSize * 2 + iconPad + 8 * scale : 0);

        // Wrap title lines
        const titleLines = [];
        if (cmtTitle) {
          ctx.font = cmtTitleFont;
          const tWords = cmtTitle.split(' ');
          let tLine = '';
          for (const word of tWords) {
            const test = tLine ? tLine + ' ' + word : word;
            if (ctx.measureText(test).width > maxTextW && tLine) {
              titleLines.push(tLine);
              tLine = word;
            } else {
              tLine = test;
            }
          }
          if (tLine) titleLines.push(tLine);
        }

        // Wrap body lines
        ctx.font = cmtBodyFont;
        const bodyLines = [];
        const words = cmtText.split(' ');
        let curLine = '';
        for (const word of words) {
          const test = curLine ? curLine + ' ' + word : word;
          if (ctx.measureText(test).width > maxTextW && curLine) {
            bodyLines.push(curLine);
            curLine = word;
          } else {
            curLine = test;
          }
        }
        if (curLine) bodyLines.push(curLine);

        const totalLines = titleLines.length + bodyLines.length;
        const titleGap = titleLines.length > 0 ? 4 * scale : 0;
        const cmtItemH = Math.max(cmtMinH, totalLines * cmtLineH + titleGap + cmtPadY * 2);

        // Block background
        ctx.fillStyle = isHovered ? 'rgba(42, 42, 42, 0.07)' : 'rgba(42, 42, 42, 0.035)';
        roundRect(ctx, cmtBlockX, cmtCurY, cmtBlockW, cmtItemH, cmtRadius);
        ctx.fill();
        ctx.strokeStyle = isHovered ? 'rgba(42, 42, 42, 0.14)' : 'rgba(42, 42, 42, 0.07)';
        ctx.lineWidth = 1;
        roundRect(ctx, cmtBlockX, cmtCurY, cmtBlockW, cmtItemH, cmtRadius);
        ctx.stroke();

        // Hit-test rects
        const cmtRect = { x: cmtBlockX, y: cmtCurY, w: cmtBlockW, h: cmtItemH };
        const iconCenterY = cmtCurY + cmtItemH / 2;
        const delRect = { x: cmtBlockX + cmtBlockW - iconSize - iconPad, y: iconCenterY - iconSize / 2, w: iconSize, h: iconSize };
        const editRect = { x: cmtBlockX + cmtBlockW - iconSize * 2 - iconPad - 4 * scale, y: iconCenterY - iconSize / 2, w: iconSize, h: iconSize };
        b._commentRects.push({ rect: cmtRect, delRect, editRect, ci });

        if (isConfirming) {
          // Red delete icon
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(delRect.x + delRect.w / 2, iconCenterY, iconSize / 2, 0, Math.PI * 2);
          ctx.fill();
          const xSz = iconSize * 0.2;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = Math.max(1.5, 2 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(delRect.x + delRect.w / 2 - xSz, iconCenterY - xSz);
          ctx.lineTo(delRect.x + delRect.w / 2 + xSz, iconCenterY + xSz);
          ctx.moveTo(delRect.x + delRect.w / 2 + xSz, iconCenterY - xSz);
          ctx.lineTo(delRect.x + delRect.w / 2 - xSz, iconCenterY + xSz);
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `400 ${cmtFontSize}px 'DM Mono', monospace`;
          ctx.fillStyle = '#ef4444';
          ctx.fillText('Smazat?', cmtBlockX + cmtPadX, iconCenterY);
        } else {
          // Draw title (bold) + body text
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          let textY = cmtCurY + cmtPadY;

          // Title lines
          if (titleLines.length > 0) {
            ctx.font = cmtTitleFont;
            ctx.fillStyle = 'rgba(42, 42, 42, 0.75)';
            for (let li = 0; li < titleLines.length; li++) {
              ctx.fillText(titleLines[li], cmtBlockX + cmtPadX, textY);
              textY += cmtLineH;
            }
            textY += titleGap;
          }

          // Body lines
          ctx.font = cmtBodyFont;
          ctx.fillStyle = 'rgba(42, 42, 42, 0.5)';
          for (let li = 0; li < bodyLines.length; li++) {
            ctx.fillText(bodyLines[li], cmtBlockX + cmtPadX, textY);
            textY += cmtLineH;
          }
        }

        // Hover icons
        if (isHovered && !isConfirming) {
          // Delete (X)
          ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
          ctx.beginPath();
          ctx.arc(delRect.x + delRect.w / 2, iconCenterY, iconSize / 2, 0, Math.PI * 2);
          ctx.fill();
          const xSz2 = iconSize * 0.18;
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.lineWidth = Math.max(1.2, 1.8 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(delRect.x + delRect.w / 2 - xSz2, iconCenterY - xSz2);
          ctx.lineTo(delRect.x + delRect.w / 2 + xSz2, iconCenterY + xSz2);
          ctx.moveTo(delRect.x + delRect.w / 2 + xSz2, iconCenterY - xSz2);
          ctx.lineTo(delRect.x + delRect.w / 2 - xSz2, iconCenterY + xSz2);
          ctx.stroke();

          // Edit (pencil)
          ctx.fillStyle = 'rgba(42, 42, 42, 0.08)';
          ctx.beginPath();
          ctx.arc(editRect.x + editRect.w / 2, iconCenterY, iconSize / 2, 0, Math.PI * 2);
          ctx.fill();
          const eCx = editRect.x + editRect.w / 2;
          const ps = iconSize * 0.22;
          ctx.strokeStyle = 'rgba(42, 42, 42, 0.45)';
          ctx.lineWidth = Math.max(1.2, 1.8 * scale);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(eCx - ps, iconCenterY + ps);
          ctx.lineTo(eCx + ps * 0.6, iconCenterY - ps * 0.6);
          ctx.lineTo(eCx + ps, iconCenterY - ps);
          ctx.stroke();
        }

        cmtCurY += cmtItemH + cmtGap;
      });

      // Circle "+" button below comments, right-aligned
      const addBtnSize = 28 * scale;
      const addBtnX = cmtBlockX + cmtBlockW - addBtnSize;
      const addBtnCY = cmtCurY + addBtnSize / 2;
      b._btnAddComment = { x: addBtnX, y: cmtCurY, w: addBtnSize, h: addBtnSize };

      ctx.fillStyle = 'rgba(42, 42, 42, 0.05)';
      ctx.beginPath();
      ctx.arc(addBtnX + addBtnSize / 2, addBtnCY, addBtnSize / 2, 0, Math.PI * 2);
      ctx.fill();

      const pSize = addBtnSize * 0.22;
      const pCx = addBtnX + addBtnSize / 2;
      ctx.strokeStyle = 'rgba(42, 42, 42, 0.35)';
      ctx.lineWidth = Math.max(1.2, 1.8 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pCx - pSize, addBtnCY);
      ctx.lineTo(pCx + pSize, addBtnCY);
      ctx.moveTo(pCx, addBtnCY - pSize);
      ctx.lineTo(pCx, addBtnCY + pSize);
      ctx.stroke();
    }

    // ── Side "+" buttons (add board on all 4 sides) ──
    const sideBtnSize = 32 * scale;
    const sideBtnGap = 16 * scale;
    const sps = sideBtnSize * 0.22;
    b._btnAddLeft = null;
    b._btnAddRight = null;
    b._btnAddTop = null;
    b._btnAddBottom = null;

    // Check adjacency — hide "+" if a board is already next to this side
    const threshold = BOARD_GAP * 1.5;
    let hasLeft = false, hasRight = false, hasTop = false, hasBottom = false;
    boards.forEach(other => {
      if (other === b) return;
      const overlapH = other.y < b.y + b.h && other.y + other.h > b.y;
      const overlapV = other.x < b.x + b.w && other.x + other.w > b.x;
      if (overlapH && Math.abs((other.x + other.w) - b.x) < threshold) hasLeft = true;
      if (overlapH && Math.abs(other.x - (b.x + b.w)) < threshold) hasRight = true;
      if (overlapV && Math.abs((other.y + other.h) - b.y) < threshold) hasTop = true;
      if (overlapV && Math.abs(other.y - (b.y + b.h)) < threshold) hasBottom = true;
    });

    function drawSidePlusBtn(cx, cy) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = 'rgba(42, 42, 42, 0.05)';
      ctx.beginPath();
      ctx.arc(cx, cy, sideBtnSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(42, 42, 42, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, sideBtnSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(42, 42, 42, 0.3)';
      ctx.lineWidth = Math.max(1.5, 2 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - sps, cy);
      ctx.lineTo(cx + sps, cy);
      ctx.moveTo(cx, cy - sps);
      ctx.lineTo(cx, cy + sps);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (!hasLeft) {
      const cx = sx - sideBtnGap - sideBtnSize / 2;
      const cy = sy + sh / 2;
      b._btnAddLeft = { x: cx - sideBtnSize / 2, y: cy - sideBtnSize / 2, w: sideBtnSize, h: sideBtnSize };
      drawSidePlusBtn(cx, cy);
    }
    if (!hasRight) {
      const cx = sx + sw + sideBtnGap + sideBtnSize / 2;
      const cy = sy + sh / 2;
      b._btnAddRight = { x: cx - sideBtnSize / 2, y: cy - sideBtnSize / 2, w: sideBtnSize, h: sideBtnSize };
      drawSidePlusBtn(cx, cy);
    }
    if (!hasTop) {
      const cx = sx + sw / 2;
      const cy = sy - sideBtnGap - sideBtnSize / 2;
      b._btnAddTop = { x: cx - sideBtnSize / 2, y: cy - sideBtnSize / 2, w: sideBtnSize, h: sideBtnSize };
      drawSidePlusBtn(cx, cy);
    }
    if (!hasBottom) {
      const cx = sx + sw / 2;
      const cy = sy + sh + sideBtnGap + sideBtnSize / 2;
      b._btnAddBottom = { x: cx - sideBtnSize / 2, y: cy - sideBtnSize / 2, w: sideBtnSize, h: sideBtnSize };
      drawSidePlusBtn(cx, cy);
    }
  });
}

function drawFreeImages(w, h) {
  if (!freeImages || freeImages.length === 0) return;
  freeImages.forEach((fi, i) => {
    if (!fi._img || !fi._img.complete || !fi._img.naturalWidth) return;
    const sx = (fi.x + panX) * scale;
    const sy = (fi.y + panY) * scale;
    const sw = fi.w * scale;
    const sh = fi.h * scale;

    if (sx + sw < 0 || sy + sh < 0 || sx > w || sy > h) return;

    // Unlocked = 50% opacity, locked = 100% opacity
    ctx.globalAlpha = fi.locked ? 1 : 0.5;
    ctx.drawImage(fi._img, sx, sy, sw, sh);
    ctx.globalAlpha = 1;

    // Store screen rect for hit-testing
    fi._screenRect = { x: sx, y: sy, w: sw, h: sh };

    // Selection border + resize handles when hovered, not locked
    if (hoveredFreeImage === i && !fi.locked) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);

      const hs = Math.max(6, 8 * scale);
      const corners = [
        { x: sx, y: sy },
        { x: sx + sw, y: sy },
        { x: sx, y: sy + sh },
        { x: sx + sw, y: sy + sh }
      ];
      ctx.fillStyle = '#3b82f6';
      corners.forEach(c => {
        ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
      });
    }

    // Border when being resized
    if (resizeFreeImage && resizeFreeImage.index === i) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);
    }
  });
}

function drawRejectionOverlays(w, h) {
  boards.forEach(b => {
    if (b.status !== 'rejected') return;
    const sx = (b.x + panX) * scale;
    const sy = (b.y + panY) * scale;
    const sw = b.w * scale;
    const sh = b.h * scale;
    if (sx + sw < 0 || sy + sh < 0 || sx > w || sy > h) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    // Base tint
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fillRect(sx, sy, sw, sh);
    // Diagonal stripes
    const stripeW = 36 * scale;
    const gap = 24 * scale;
    const step = stripeW + gap;
    const diag = Math.sqrt(sw * sw + sh * sh);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
    ctx.lineWidth = stripeW;
    for (let d = -diag; d < diag * 2; d += step) {
      ctx.beginPath();
      ctx.moveTo(sx + d, sy);
      ctx.lineTo(sx + d - sh, sy + sh);
      ctx.stroke();
    }
    ctx.restore();
  });
}

// ── Sub-page columns on main page ──

function drawSubPageColumns(w, h) {
  // Only when viewing main page (not a sub-page)
  if (currentSubPageIndex >= 0) return;
  const p = pages[currentPageIndex];
  if (!p.subPages || p.subPages.length === 0) return;

  // Find bottom edge of main page boards
  let maxBottom = 0;
  let startX = 0;
  if (boards.length > 0) {
    startX = boards[0].x;
    boards.forEach(b => {
      const bot = b.y + b.h;
      if (bot > maxBottom) maxBottom = bot;
    });
    maxBottom += BOARD_GAP * 2;
  } else {
    startX = -A4_W / 2;
  }

  const ROW_GAP = BOARD_GAP * 5;
  let rowY = maxBottom;

  p.subPages.forEach((sp, spi) => {
    if (!sp.boards || sp.boards.length === 0) return;

    // Separator line (horizontal dashed)
    const sepScreenY = (rowY - ROW_GAP / 2 + panY) * scale;
    const visibleCount = sp.boards.filter(b => b.status !== 'rejected').length;
    if (visibleCount === 0) { rowY += A4_H + ROW_GAP; return; }
    const totalW = visibleCount * (A4_W + BOARD_GAP);
    const sepLeftX = (startX - 40 + panX) * scale;
    const sepRightX = (startX + totalW + 40 + panX) * scale;

    if (sepScreenY > 0 && sepScreenY < h) {
      ctx.strokeStyle = 'rgba(42, 42, 42, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8 * scale, 6 * scale]);
      ctx.beginPath();
      ctx.moveTo(Math.max(0, sepLeftX), sepScreenY);
      ctx.lineTo(Math.min(w, sepRightX), sepScreenY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Sub-page label (left of the row)
    const labelX = (startX + panX) * scale;
    const labelY = (rowY - 12 + panY) * scale;
    if (labelY > -30 && labelY < h && labelX > -200 && labelX < w + 200) {
      const labelSize = Math.max(9, 12 * scale);
      ctx.font = `500 ${labelSize}px 'DM Mono', monospace`;
      ctx.fillStyle = 'rgba(42, 42, 42, 0.3)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(sp.name.toUpperCase(), labelX, labelY);
    }

    // Draw each board in this sub-page row (horizontally, skip rejected)
    const visibleBoards = sp.boards.filter(b => b.status !== 'rejected');
    if (visibleBoards.length === 0) { rowY += A4_H + ROW_GAP; return; }
    visibleBoards.forEach((b, vi) => {
      const bx = startX + vi * (A4_W + BOARD_GAP);
      const by = rowY;
      const sx = (bx + panX) * scale;
      const sy = (by + panY) * scale;
      const sw = A4_W * scale;
      const sh = A4_H * scale;

      if (sx + sw < 0 || sy + sh < 0 || sx > w || sy > h) return;

      // Shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.05)';
      ctx.shadowBlur = 12 * scale;
      ctx.shadowOffsetY = 3 * scale;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.restore();

      // Border
      if (b.status === 'approved') {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
        ctx.lineWidth = 2;
      } else if (b.status === 'rejected') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(42, 42, 42, 0.12)';
        ctx.lineWidth = 1;
      }
      ctx.strokeRect(sx, sy, sw, sh);

      // Label
      const labelSize2 = Math.max(7, 9 * scale);
      ctx.font = `300 ${labelSize2}px 'DM Mono', monospace`;
      ctx.fillStyle = 'rgba(42, 42, 42, 0.2)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(b.label || `#${bi + 1}`, sx + 10 * scale, sy + sh - 6 * scale);

      // Approval stamp
      if (b.status === 'approved' && b.approvedAt) {
        const stampSize = Math.max(10, 13 * scale);
        const stampPad = 10 * scale;
        const labelW2 = ctx.measureText(b.label || `#${bi + 1}`).width;
        const stampX = sx + stampPad + labelW2 + 8 * scale;
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
        if (b.approvedBy) {
          ctx.font = `700 ${stampSize}px 'DM Mono', monospace`;
          const nameW = ctx.measureText(b.approvedBy).width;
          ctx.fillText(b.approvedBy, stampX, sy + sh - 6 * scale);
          ctx.font = `400 ${stampSize}px 'DM Mono', monospace`;
          ctx.fillText(' · ' + b.approvedAt, stampX + nameW, sy + sh - 6 * scale);
        } else {
          ctx.font = `400 ${stampSize}px 'DM Mono', monospace`;
          ctx.fillText(b.approvedAt, stampX, sy + sh - 6 * scale);
        }
      }

      // Images
      const pad = 20 * scale;
      const imgGap = 12 * scale;
      const fullImgTop2 = sy + 70 * scale;
      const fullImgBottom2 = sy + sh - 30 * scale;
      const fullImgH2 = fullImgBottom2 - fullImgTop2;
      const imgAreaH = fullImgH2 * 0.85;
      const imgAreaTop = fullImgTop2 + (fullImgH2 - imgAreaH) / 2;
      const imgSlotW = (sw - pad * 2 - imgGap) / 2;

      if (b.images && b._imgObjects) {
        for (let si = 0; si < 2; si++) {
          if (b.images[si] && b._imgObjects[si]) {
            const img = b._imgObjects[si];
            if (img.complete && img.naturalWidth) {
              const slotX = sx + pad + si * (imgSlotW + imgGap);
              const slotY = imgAreaTop;
              const imgAspect = img.naturalWidth / img.naturalHeight;
              const slotAspect = imgSlotW / imgAreaH;
              let drawW, drawH, drawX, drawY;
              if (imgAspect > slotAspect) {
                drawH = imgAreaH; drawW = drawH * imgAspect;
                drawX = slotX + (imgSlotW - drawW) / 2; drawY = slotY;
              } else {
                drawW = imgSlotW; drawH = drawW / imgAspect;
                drawX = slotX; drawY = slotY + (imgAreaH - drawH) / 2;
              }
              ctx.save();
              ctx.beginPath();
              roundRect(ctx, slotX, slotY, imgSlotW, imgAreaH, 8 * scale);
              ctx.clip();
              ctx.drawImage(img, drawX, drawY, drawW, drawH);
              ctx.restore();
            }
          }
        }
      }

      // Logo
      if (logoImg && logoImg.complete && logoImg.naturalWidth) {
        const maxLogoH = 40 * scale;
        const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
        const lh = maxLogoH;
        const lw = lh * logoAspect;
        ctx.drawImage(logoImg, sx + pad, sy + pad, lw, lh);
      }

      // Title
      if (b.title) {
        const titleSize = Math.max(10, 14 * scale);
        ctx.font = `400 ${titleSize}px 'Bebas Neue', sans-serif`;
        ctx.fillStyle = 'rgba(42, 42, 42, 0.7)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(b.title, sx + sw - pad, sy + pad);
      }

      // Rejection overlay
      if (b.status === 'rejected') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx, sy, sw, sh);
        ctx.clip();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(sx, sy, sw, sh);
        const stripeW = 36 * scale;
        const stripeGap = 24 * scale;
        const step = stripeW + stripeGap;
        const diag = Math.sqrt(sw * sw + sh * sh);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
        ctx.lineWidth = stripeW;
        for (let d = -diag; d < diag * 2; d += step) {
          ctx.beginPath();
          ctx.moveTo(sx + d, sy);
          ctx.lineTo(sx + d - sh, sy + sh);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Clear interactive rects (read-only on main page)
      b._btnApprove = null;
      b._btnReject = null;
      b._btnComment = null;
      b._btnAddComment = null;
      b._commentRects = [];

      // Comment count badge (bottom-right of board)
      const cmtCount = b.comments ? b.comments.length : 0;
      if (cmtCount > 0) {
        const badgeSize = Math.max(18, 24 * scale);
        const badgeX = sx + sw - pad - badgeSize;
        const badgeY = sy + sh + 10 * scale;
        // Circle badge
        ctx.fillStyle = 'rgba(42, 42, 42, 0.08)';
        ctx.beginPath();
        ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
        ctx.fill();
        // Number
        const badgeFontSize = Math.max(8, 11 * scale);
        ctx.font = `500 ${badgeFontSize}px 'DM Mono', monospace`;
        ctx.fillStyle = 'rgba(42, 42, 42, 0.5)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cmtCount.toString(), badgeX + badgeSize / 2, badgeY + badgeSize / 2);
      }
    });

    // Advance row Y
    rowY += A4_H + ROW_GAP;
  });
}

function updateHUD() {
  // HUD now shows brand name/logo, no coordinates
}

function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);

  const gap = DOT_GAP * scale;
  if (gap < 4) {
    drawDots(w, h, gap < 2 ? gap * 4 : gap * 2, gap < 2 ? 0.06 : 0.1);
  } else {
    drawDots(w, h, gap, 0.15);
  }

  drawBoards(w, h);
  drawFreeImages(w, h);
  drawRejectionOverlays(w, h);
  drawSubPageColumns(w, h);
  updateHUD();
  saveState();
}
