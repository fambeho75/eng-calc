/* Tiny SVG line/scatter chart with linear or log axes. */
(function (root) {
  "use strict";
  const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)"];
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function niceStep(span, n) {
    const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function tickLabel(v, log) {
    if (log) {
      const e = Math.round(Math.log10(v));
      if (e >= -2 && e <= 4) return String(+v.toPrecision(3));
      return "1e" + e;
    }
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(0).replace("e+", "e");
    return String(+v.toPrecision(6));
  }
  function axis(min, max, log) {
    if (log) {
      const lo = Math.floor(Math.log10(min) + 1e-9), hi = Math.ceil(Math.log10(max) - 1e-9);
      const ticks = []; for (let e = lo; e <= hi; e++) ticks.push(Math.pow(10, e));
      const minor = []; for (let e = lo; e < hi; e++) for (let k = 2; k <= 9; k++) minor.push(k * Math.pow(10, e));
      return { min: Math.pow(10, lo), max: Math.pow(10, hi), ticks, minor };
    }
    if (max === min) { max = min + 1; }
    const st = niceStep(max - min, 5);
    const a = Math.floor(min / st) * st, b = Math.ceil(max / st) * st;
    const ticks = []; for (let v = a; v <= b + st * 1e-6; v += st) ticks.push(+v.toPrecision(12));
    return { min: a, max: b, ticks, minor: [] };
  }
  // opts: {series:[{name, pts:[[x,y]], color?, dash?, marker?, step?}], points:[{x,y,label,color}], xlog, ylog, xlabel, ylabel, xmin,xmax,ymin,ymax}
  function lineChart(opts) {
    const W = 640, H = 360, L = 64, R = 16, T = 14, B = 46;
    const all = [];
    opts.series.forEach((s) => s.pts.forEach((p) => { if (isFinite(p[0]) && isFinite(p[1])) all.push(p); }));
    (opts.points || []).forEach((p) => { if (isFinite(p.x) && isFinite(p.y)) all.push([p.x, p.y]); });
    const okx = all.filter((p) => !opts.xlog || p[0] > 0), oky = all.filter((p) => !opts.ylog || p[1] > 0);
    if (!okx.length || !oky.length) return '<div class="faint">No data to plot.</div>';
    let xmin = opts.xmin != null ? opts.xmin : Math.min(...okx.map((p) => p[0]));
    let xmax = opts.xmax != null ? opts.xmax : Math.max(...okx.map((p) => p[0]));
    let ymin = opts.ymin != null ? opts.ymin : Math.min(...oky.map((p) => p[1]));
    let ymax = opts.ymax != null ? opts.ymax : Math.max(...oky.map((p) => p[1]));
    if (!opts.ylog && opts.ymin == null && ymin > 0 && ymin < 0.6 * ymax) ymin = 0;
    if (!opts.xlog && opts.xmin == null && xmin > 0 && xmin < 0.6 * xmax) xmin = 0;
    const ax = axis(xmin, xmax, opts.xlog), ay = axis(ymin, ymax, opts.ylog);
    const tx = (x) => { const t = opts.xlog ? (Math.log10(x) - Math.log10(ax.min)) / (Math.log10(ax.max) - Math.log10(ax.min)) : (x - ax.min) / (ax.max - ax.min); return L + t * (W - L - R); };
    const ty = (y) => { const t = opts.ylog ? (Math.log10(y) - Math.log10(ay.min)) / (Math.log10(ay.max) - Math.log10(ay.min)) : (y - ay.min) / (ay.max - ay.min); return H - B - t * (H - T - B); };
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title || "Chart")}">`;
    ax.minor.forEach((v) => { const x = tx(v); s += `<line class="gl" x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" opacity="0.45"/>`; });
    ay.minor.forEach((v) => { const y = ty(v); s += `<line class="gl" y1="${y}" y2="${y}" x1="${L}" x2="${W - R}" opacity="0.45"/>`; });
    ax.ticks.forEach((v) => { const x = tx(v); s += `<line class="gl" x1="${x}" x2="${x}" y1="${T}" y2="${H - B}"/><text class="ax" x="${x}" y="${H - B + 17}" text-anchor="middle">${tickLabel(v, opts.xlog)}</text>`; });
    ay.ticks.forEach((v) => { const y = ty(v); s += `<line class="gl" y1="${y}" y2="${y}" x1="${L}" x2="${W - R}"/><text class="ax" x="${L - 7}" y="${y + 4}" text-anchor="end">${tickLabel(v, opts.ylog)}</text>`; });
    s += `<line class="axl" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/><line class="axl" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>`;
    s += `<text class="axt" x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(opts.xlabel || "")}</text>`;
    s += `<text class="axt" transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(opts.ylabel || "")}</text>`;
    s += `<defs><clipPath id="clip-${opts.id || "c"}"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></clipPath></defs><g clip-path="url(#clip-${opts.id || "c"})">`;
    opts.series.forEach((se, i) => {
      const col = se.color || COLORS[i % COLORS.length];
      const pts = se.pts.filter((p) => isFinite(p[0]) && isFinite(p[1]) && (!opts.xlog || p[0] > 0) && (!opts.ylog || p[1] > 0));
      if (!pts.length) return;
      if (se.marker) {
        pts.forEach((p) => { s += `<circle cx="${tx(p[0]).toFixed(1)}" cy="${ty(p[1]).toFixed(1)}" r="4" fill="${col}"/>`; });
        if (!se.line) return;
      }
      let d = "";
      pts.forEach((p, j) => {
        const X = tx(p[0]).toFixed(1), Y = ty(p[1]).toFixed(1);
        if (j === 0) d += `M${X} ${Y}`;
        else if (se.step) d += `H${X}V${Y}`;
        else d += `L${X} ${Y}`;
      });
      s += `<path class="ln${se.dash ? " dash" : ""}" d="${d}" stroke="${col}"/>`;
    });
    (opts.points || []).forEach((p) => {
      if (!(isFinite(p.x) && isFinite(p.y))) return;
      const X = tx(p.x), Y = ty(p.y);
      s += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="5.5" fill="${p.color || "var(--text)"}" stroke="var(--surface)" stroke-width="2"/>`;
      if (p.label) s += `<text class="axt" x="${(X + 8).toFixed(1)}" y="${(Y - 8).toFixed(1)}">${esc(p.label)}</text>`;
    });
    s += `</g></svg>`;
    const leg = opts.series.filter((se) => se.name).map((se, i) => `<span><i style="background:${se.color || COLORS[opts.series.indexOf(se) % COLORS.length]}"></i>${esc(se.name)}</span>`).join("");
    return s + (leg ? `<div class="legend">${leg}</div>` : "");
  }
  function logspace(a, b, n) { const out = []; const la = Math.log10(a), lb = Math.log10(b); for (let i = 0; i < n; i++) out.push(Math.pow(10, la + (lb - la) * i / (n - 1))); return out; }
  function linspace(a, b, n) { const out = []; for (let i = 0; i < n; i++) out.push(a + (b - a) * i / (n - 1)); return out; }
  root.ECChart = { lineChart, logspace, linspace, COLORS };
})(typeof self !== "undefined" ? self : this);
