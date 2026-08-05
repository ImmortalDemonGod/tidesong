// D1: extract a display list from a canvas renderer WITHOUT refactoring it.
//
// The lessons doc argues the renderer should emit a display list and blit it
// second, so layout becomes assertable. This proves the invariants are worth
// having by recovering an equivalent list at runtime: proxy the 2D context,
// track the current path's bounding box, and record every fill, stroke, and
// text draw with its transformed box and frame number.
//
// Injected before all page code.
(() => {
  const REC = { frame: 0, draws: [], cap: 400000, every: 3 };
  window.__REC = REC;

  const P = CanvasRenderingContext2D.prototype;
  const orig = {};
  for (const k of [
    "fillText", "strokeText", "fillRect", "strokeRect", "beginPath", "rect",
    "roundRect", "moveTo", "lineTo", "arc", "ellipse", "quadraticCurveTo",
    "bezierCurveTo", "fill", "stroke", "closePath", "clearRect", "drawImage",
  ]) orig[k] = P[k];

  const paths = new WeakMap();
  function pb(ctx) {
    let b = paths.get(ctx);
    if (!b) { b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; paths.set(ctx, b); }
    return b;
  }
  function ext(ctx, x, y) {
    const b = pb(ctx);
    if (x < b.x0) b.x0 = x; if (y < b.y0) b.y0 = y;
    if (x > b.x1) b.x1 = x; if (y > b.y1) b.y1 = y;
  }
  function xf(ctx, x, y) {
    const m = ctx.getTransform();
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }
  function boxOf(ctx, x0, y0, x1, y1) {
    const p = [xf(ctx, x0, y0), xf(ctx, x1, y0), xf(ctx, x0, y1), xf(ctx, x1, y1)];
    return {
      x0: Math.min(...p.map((q) => q.x)), y0: Math.min(...p.map((q) => q.y)),
      x1: Math.max(...p.map((q) => q.x)), y1: Math.max(...p.map((q) => q.y)),
    };
  }
  function push(d) { if (REC.frame % REC.every) return; if (REC.draws.length < REC.cap) { d.i = REC.draws.length; REC.draws.push(d); } }

  P.beginPath = function () { paths.set(this, { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }); return orig.beginPath.apply(this, arguments); };
  P.moveTo = function (x, y) { ext(this, x, y); return orig.moveTo.apply(this, arguments); };
  P.lineTo = function (x, y) { ext(this, x, y); return orig.lineTo.apply(this, arguments); };
  P.rect = function (x, y, w, h) { ext(this, x, y); ext(this, x + w, y + h); return orig.rect.apply(this, arguments); };
  P.roundRect = function (x, y, w, h) { ext(this, x, y); ext(this, x + w, y + h); return orig.roundRect.apply(this, arguments); };
  P.arc = function (x, y, r) { ext(this, x - r, y - r); ext(this, x + r, y + r); return orig.arc.apply(this, arguments); };
  P.ellipse = function (x, y, rx, ry) { ext(this, x - rx, y - ry); ext(this, x + rx, y + ry); return orig.ellipse.apply(this, arguments); };
  P.quadraticCurveTo = function (cx, cy, x, y) { ext(this, cx, cy); ext(this, x, y); return orig.quadraticCurveTo.apply(this, arguments); };
  P.bezierCurveTo = function (a, b, c, d, x, y) { ext(this, a, b); ext(this, c, d); ext(this, x, y); return orig.bezierCurveTo.apply(this, arguments); };

  function emitPath(ctx, kind) {
    const b = pb(ctx);
    if (b.x0 !== Infinity) {
      const box = boxOf(ctx, b.x0, b.y0, b.x1, b.y1);
      push({ kind, frame: REC.frame, box, fill: String(ctx.fillStyle), alpha: ctx.globalAlpha });
    }
  }
  P.fill = function () { emitPath(this, "shape"); return orig.fill.apply(this, arguments); };
  P.stroke = function () { emitPath(this, "outline"); return orig.stroke.apply(this, arguments); };

  P.fillRect = function (x, y, w, h) {
    push({ kind: "shape", frame: REC.frame, box: boxOf(this, x, y, x + w, y + h), fill: String(this.fillStyle), alpha: this.globalAlpha });
    return orig.fillRect.apply(this, arguments);
  };
  P.strokeRect = function (x, y, w, h) {
    push({ kind: "outline", frame: REC.frame, box: boxOf(this, x, y, x + w, y + h), fill: String(this.strokeStyle), alpha: this.globalAlpha });
    return orig.strokeRect.apply(this, arguments);
  };
  P.drawImage = function (img, ...a) {
    const [dx, dy, dw, dh] = a.length >= 6 ? a.slice(4) : a.length >= 4 ? a : [a[0], a[1], img.width, img.height];
    push({ kind: "image", frame: REC.frame, box: boxOf(this, dx, dy, dx + dw, dy + dh) });
    return orig.drawImage.apply(this, arguments);
  };

  function textDraw(ctx, text, x, y, kind) {
    let m;
    try { m = ctx.measureText(text); } catch { return; }
    // actualBoundingBox* are relative to the origin and already account for
    // textAlign and textBaseline, which is exactly the box a layout check needs
    const left = m.actualBoundingBoxLeft ?? 0, right = m.actualBoundingBoxRight ?? m.width;
    const asc = m.actualBoundingBoxAscent ?? 8, desc = m.actualBoundingBoxDescent ?? 3;
    if (!isFinite(left + right + asc + desc)) return;
    const box = boxOf(ctx, x - left, y - asc, x + right, y + desc);
    const size = parseFloat((/(\d+(\.\d+)?)px/.exec(ctx.font) || [0, "12"])[1]);
    push({ kind, frame: REC.frame, box, text: String(text), font: ctx.font, size, alpha: ctx.globalAlpha, fill: String(ctx.fillStyle) });
  }
  P.fillText = function (t, x, y) { textDraw(this, t, x, y, "text"); return orig.fillText.apply(this, arguments); };
  P.strokeText = function (t, x, y) { textDraw(this, t, x, y, "textOutline"); return orig.strokeText.apply(this, arguments); };

  // frame boundary: registered before any app code, so it runs first each frame
  const raf = window.requestAnimationFrame.bind(window);
  (function tick() { REC.frame++; raf(tick); })();
})();
