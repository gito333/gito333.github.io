/* Minimal SVG chart renderers: line chart + column chart, with hover tooltips
   and a generated data table for accessibility. No dependencies. */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const css = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  let tooltip;
  function getTooltip() {
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "viz-tooltip";
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }
  function showTooltip(html, x, y) {
    const t = getTooltip();
    t.innerHTML = html;
    t.style.display = "block";
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 10;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 14;
    t.style.left = left + "px";
    t.style.top = top + "px";
  }
  function hideTooltip() {
    if (tooltip) tooltip.style.display = "none";
  }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(v, dec) {
    return v.toLocaleString("es-ES", {
      minimumFractionDigits: dec == null ? 0 : dec,
      maximumFractionDigits: dec == null ? 1 : dec,
    });
  }
  function niceTicks(min, max, count) {
    const span = max - min;
    const step0 = span / Math.max(1, count - 1);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    let step = mag;
    for (const m of [1, 2, 2.5, 5, 10]) {
      if (mag * m >= step0) { step = mag * m; break; }
    }
    const ticks = [];
    for (let v = Math.floor(min / step) * step; ; v += step) {
      ticks.push(Math.round(v * 100) / 100);
      if (v >= max - 1e-9) break;
    }
    return ticks;
  }

  function dataTable(fig, head, rows) {
    const det = document.createElement("details");
    det.className = "data-table";
    const sum = document.createElement("summary");
    sum.textContent = "Ver datos en tabla";
    det.appendChild(sum);
    const scroll = document.createElement("div");
    scroll.className = "table-scroll";
    const tbl = document.createElement("table");
    const tr = document.createElement("tr");
    head.forEach((h, i) => {
      const th = document.createElement("th");
      th.textContent = h;
      if (i > 0) th.className = "num";
      tr.appendChild(th);
    });
    tbl.appendChild(tr);
    rows.forEach((r) => {
      const tr2 = document.createElement("tr");
      r.forEach((c, i) => {
        const td = document.createElement("td");
        td.textContent = c == null ? "—" : typeof c === "number" ? fmt(c) : c;
        if (i > 0) td.className = "num";
        tr2.appendChild(td);
      });
      tbl.appendChild(tr2);
    });
    scroll.appendChild(tbl);
    det.appendChild(scroll);
    fig.appendChild(det);
  }

  /* ---------------- line chart ---------------- */
  window.lineChart = function (id, cfg) {
    const fig = document.getElementById(id);
    const W = 720, H = 400;
    const M = { t: 16, r: cfg.marginRight || 90, b: 34, l: 44 };
    const iw = W - M.l - M.r, ih = H - M.t - M.b;

    const allPts = cfg.series.flatMap((s) => s.points);
    const xMin = Math.min(...allPts.map((p) => p[0]));
    const xMax = Math.max(...allPts.map((p) => p[0]));
    const yMax0 = Math.max(...allPts.map((p) => p[1]), cfg.refLine ? cfg.refLine.value : 0);
    const yTicks = niceTicks(0, yMax0 * 1.06, 6);
    const yMax = yTicks[yTicks.length - 1];
    const X = (x) => M.l + ((x - xMin) / (xMax - xMin)) * iw;
    const Y = (y) => M.t + ih - (y / yMax) * ih;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": cfg.ariaLabel || "" });

    // gridlines + y labels
    yTicks.forEach((t) => {
      el("line", { x1: M.l, x2: M.l + iw, y1: Y(t), y2: Y(t),
        stroke: css("--grid"), "stroke-width": 1 }, svg);
      const lab = el("text", { x: M.l - 8, y: Y(t) + 4, "text-anchor": "end",
        "font-size": 11, fill: css("--muted"),
        style: "font-variant-numeric: tabular-nums" }, svg);
      lab.textContent = fmt(t, 0);
    });
    // x ticks
    (cfg.xTicks || []).forEach((t) => {
      const lab = el("text", { x: X(t), y: M.t + ih + 20, "text-anchor": "middle",
        "font-size": 11, fill: css("--muted"),
        style: "font-variant-numeric: tabular-nums" }, svg);
      lab.textContent = t;
    });
    // baseline
    el("line", { x1: M.l, x2: M.l + iw, y1: Y(0), y2: Y(0),
      stroke: css("--baseline"), "stroke-width": 1 }, svg);

    // reference line
    if (cfg.refLine) {
      el("line", { x1: M.l, x2: M.l + iw, y1: Y(cfg.refLine.value),
        y2: Y(cfg.refLine.value), stroke: css("--baseline"), "stroke-width": 1.5 }, svg);
      const lab = el("text", { x: M.l + 4, y: Y(cfg.refLine.value) - 5,
        "font-size": 11, fill: css("--text-secondary"), "font-weight": 600 }, svg);
      lab.textContent = cfg.refLine.label;
    }

    // series lines
    cfg.series.forEach((s) => {
      const d = s.points
        .map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1))
        .join(" ");
      el("path", { d, fill: "none", stroke: css(s.color), "stroke-width": 2,
        "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      const last = s.points[s.points.length - 1];
      el("circle", { cx: X(last[0]), cy: Y(last[1]), r: 4.5,
        fill: css(s.color), stroke: css("--surface-1"), "stroke-width": 2 }, svg);
      // direct end label (text token + value); labelDy resolves collisions
      const lab = el("text", { x: X(last[0]) + 9, y: Y(last[1]) + 4 + (s.labelDy || 0),
        "font-size": 12, fill: css("--text-primary"), "font-weight": 600 }, svg);
      lab.textContent = s.endLabel || s.name + " " + fmt(last[1]);
    });

    // annotations
    (cfg.annotations || []).forEach((a) => {
      el("circle", { cx: X(a.x), cy: Y(a.y), r: 4, fill: css(cfg.series[0].color),
        stroke: css("--surface-1"), "stroke-width": 2 }, svg);
      const lab = el("text", { x: X(a.x) + (a.dx || 0), y: Y(a.y) + (a.dy || -10),
        "font-size": 11, fill: css("--text-secondary"),
        "text-anchor": a.anchor || "middle" }, svg);
      lab.textContent = a.label;
    });

    // hover layer: crosshair + tooltip at nearest x
    const cross = el("line", { y1: M.t, y2: M.t + ih, stroke: css("--baseline"),
      "stroke-width": 1, visibility: "hidden" }, svg);
    const dots = cfg.series.map((s) =>
      el("circle", { r: 4, fill: css(s.color), stroke: css("--surface-1"),
        "stroke-width": 2, visibility: "hidden" }, svg));
    const capture = el("rect", { x: M.l, y: M.t, width: iw, height: ih,
      fill: "transparent" }, svg);

    function nearest(points, x) {
      let best = points[0];
      for (const p of points)
        if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
      return best;
    }
    capture.addEventListener("mousemove", (ev) => {
      const rect = svg.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * W;
      const xVal = xMin + ((sx - M.l) / iw) * (xMax - xMin);
      const ref = nearest(cfg.series[0].points, xVal);
      cross.setAttribute("x1", X(ref[0]));
      cross.setAttribute("x2", X(ref[0]));
      cross.setAttribute("visibility", "visible");
      let html = `<div class="tt-title">${cfg.xLabel || ""} ${Math.floor(ref[0])}</div>`;
      cfg.series.forEach((s, i) => {
        const p = nearest(s.points, ref[0]);
        dots[i].setAttribute("cx", X(p[0]));
        dots[i].setAttribute("cy", Y(p[1]));
        dots[i].setAttribute("visibility", "visible");
        html += `<div class="tt-row"><span class="swatch" style="background:${css(s.color)}"></span>${s.name}<span class="v">${fmt(p[1])}</span></div>`;
      });
      showTooltip(html, ev.clientX, ev.clientY);
    });
    capture.addEventListener("mouseleave", () => {
      cross.setAttribute("visibility", "hidden");
      dots.forEach((d) => d.setAttribute("visibility", "hidden"));
      hideTooltip();
    });

    fig.querySelector(".chart-slot").appendChild(svg);

    // legend (only for >= 2 series)
    if (cfg.series.length >= 2) {
      const leg = document.createElement("div");
      leg.className = "legend";
      cfg.series.forEach((s) => {
        const k = document.createElement("span");
        k.className = "key";
        k.innerHTML = `<span class="swatch" style="background:${css(s.color)}"></span>${s.name}`;
        leg.appendChild(k);
      });
      fig.querySelector(".chart-slot").after(leg);
    }

    // data table
    const xs = [...new Set(cfg.series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b);
    const rows = xs.map((x) => [
      x % 1 ? Math.floor(x) + " (jul)" : String(x),
      ...cfg.series.map((s) => {
        const p = s.points.find((q) => q[0] === x);
        return p ? p[1] : null;
      }),
    ]);
    dataTable(fig, [cfg.xLabel || "x", ...cfg.series.map((s) => s.name)], rows);
  };

  /* ---------------- column chart ---------------- */
  window.columnChart = function (id, cfg) {
    const fig = document.getElementById(id);
    const W = 720, H = 340;
    const M = { t: 30, r: 16, b: 56, l: 44 };
    const iw = W - M.l - M.r, ih = H - M.t - M.b;
    const yTicks = niceTicks(0, Math.max(...cfg.items.map((i) => i.value)) * 1.15, 5);
    const yMax = yTicks[yTicks.length - 1];
    const Y = (y) => M.t + ih - (y / yMax) * ih;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": cfg.ariaLabel || "" });

    yTicks.forEach((t) => {
      el("line", { x1: M.l, x2: M.l + iw, y1: Y(t), y2: Y(t),
        stroke: css("--grid"), "stroke-width": 1 }, svg);
      const lab = el("text", { x: M.l - 8, y: Y(t) + 4, "text-anchor": "end",
        "font-size": 11, fill: css("--muted"),
        style: "font-variant-numeric: tabular-nums" }, svg);
      lab.textContent = fmt(t, 0);
    });

    const n = cfg.items.length;
    const band = iw / n;
    const bw = Math.min(24, band * 0.5);

    cfg.items.forEach((item, i) => {
      const cx = M.l + band * (i + 0.5);
      const x = cx - bw / 2;
      const y = Y(item.value);
      const h = M.t + ih - y;
      const r = Math.min(4, bw / 2, h);
      // rounded top, square baseline
      const bar = el("path", {
        d: `M${x} ${y + r} a${r} ${r} 0 0 1 ${r} ${-r} h${bw - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${h - r} h${-bw} Z`,
        fill: css(cfg.color || "--series-1"),
      }, svg);
      // value on the cap
      const val = el("text", { x: cx, y: y - 8, "text-anchor": "middle",
        "font-size": 13, "font-weight": 600, fill: css("--text-primary"),
        style: "font-variant-numeric: tabular-nums" }, svg);
      val.textContent = fmt(item.value) + (cfg.unit || "");
      // category label(s)
      const lines = Array.isArray(item.label) ? item.label : [item.label];
      lines.forEach((ln, li) => {
        const lab = el("text", { x: cx, y: M.t + ih + 18 + li * 14,
          "text-anchor": "middle", "font-size": 12, fill: css("--text-secondary") }, svg);
        lab.textContent = ln;
      });
      // hover
      const hit = el("rect", { x: M.l + band * i, y: M.t, width: band, height: ih,
        fill: "transparent" }, svg);
      hit.addEventListener("mousemove", (ev) => {
        bar.setAttribute("opacity", "0.85");
        showTooltip(
          `<div class="tt-title">${lines.join(" ")}</div><div class="tt-row">${cfg.measure || "Valor"}<span class="v">${fmt(item.value)}${cfg.unit || ""}</span></div>${item.note ? `<div style="color:var(--muted);margin-top:2px">${item.note}</div>` : ""}`,
          ev.clientX, ev.clientY);
      });
      hit.addEventListener("mouseleave", () => {
        bar.removeAttribute("opacity");
        hideTooltip();
      });
    });

    el("line", { x1: M.l, x2: M.l + iw, y1: Y(0), y2: Y(0),
      stroke: css("--baseline"), "stroke-width": 1 }, svg);

    fig.querySelector(".chart-slot").appendChild(svg);
    dataTable(fig, [cfg.dimension || "Categoría", cfg.measure || "Valor"],
      cfg.items.map((i) => [Array.isArray(i.label) ? i.label.join(" ") : i.label, i.value]));
  };
})();
