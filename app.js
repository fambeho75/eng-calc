/* Engineering Calculations — UI. Calculations live in calc.js, defaults (from the spreadsheet) in data.js. */
(function () {
  "use strict";
  const EC = window.EC, DATA = window.ECDATA, CH = window.ECChart;
  const app = document.getElementById("app");

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function fmt(x, sig) {
    sig = sig || 5;
    if (typeof x !== "number" || isNaN(x)) return "–";
    if (!isFinite(x)) return x > 0 ? "∞" : "−∞";
    const a = Math.abs(x);
    if (a !== 0 && (a >= 1e7 || a < 1e-4)) {
      const [m, e] = x.toExponential(sig - 1).split("e");
      return `${+m}·10<sup>${+e}</sup>`;
    }
    return (+x.toPrecision(sig)).toLocaleString("en-US", { maximumFractionDigits: 12 });
  }
  const fmtPlain = (x, sig) => fmt(x, sig).replace(/·10<sup>(-?\d+)<\/sup>/, "e$1");
  function field(id, label, unit, value, extra) {
    return `<div class="field"><label for="${id}">${label}</label><div class="inp"><input id="${id}" type="number" inputmode="decimal" step="any" value="${value}" ${extra || ""}>${unit ? `<span class="unit">${unit}</span>` : ""}</div></div>`;
  }
  function res(label, valueHtml, unit, main) {
    return `<div class="res${main ? " main" : ""}"><span>${label}</span><b>${valueHtml}${unit ? ` <small>${unit}</small>` : ""}</b></div>`;
  }
  const math = (inner, label) => `<div>${label ? `<div class="lbl">${label}</div>` : ""}<math display="block">${inner}</math></div>`;
  const note = (html, warn) => `<div class="note${warn ? " warn" : ""}">${html}</div>`;
  function num(root, id) { const el = root.querySelector("#" + id); const v = parseFloat(String(el.value).replace(",", ".")); return v; }
  function setVal(root, id, v) { const el = root.querySelector("#" + id); if (el) el.value = v; }
  function out(root, id, html) { const el = root.querySelector("#" + id); if (el) el.innerHTML = html; }
  const mi = (s) => ([...String(s)].length === 1 ? `<mi mathvariant="normal" class="it">${s}</mi>` : `<mi>${s}</mi>`), mn = (s) => `<mn>${s}</mn>`, mo = (s) => `<mo>${s}</mo>`;
  const sub = (a, b) => `<msub>${a}${b}</msub>`, sup = (a, b) => `<msup>${a}${b}</msup>`, frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
  const row = (...a) => `<mrow>${a.join("")}</mrow>`, par = (...a) => `<mrow><mo>(</mo>${a.join("")}<mo>)</mo></mrow>`;
  const sig = (s) => sub(mi("σ"), mi(s)), eps = (s) => sub(mi("ε"), mi(s));

  function parseTable(text, minCols) {
    const rows = [], errors = [];
    text.split(/\r?\n/).forEach((line, i) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      let f;
      if (/[;\t]/.test(t)) f = t.split(/\s*[;\t]\s*/).map((x) => x.replace(",", "."));
      else f = t.split(/\s*,\s*|\s+/);
      const nums = f.map((x) => (x === "" ? NaN : Number(x)));
      const numericTail = nums.slice(-minCols).every((v) => isFinite(v));
      if (!numericTail) { if (rows.length || i > 0) errors.push(`Line ${i + 1} skipped: "${t.slice(0, 40)}"`); return; }
      rows.push({ f, nums });
    });
    return { rows, errors };
  }
  function downloadCsv(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fileToTextarea(input, ta, cb) {
    const f = input.files && input.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { ta.value = r.result; cb(); }; r.readAsText(f);
  }

  // ---------- calculators ----------
  const CALCS = [];

  // 1 Engineering -> true
  CALCS.push({
    id: "true-stress", title: "Engineering → true stress/strain",
    desc: "True stress, true strain and logarithmic plastic strain for Abaqus *PLASTIC.",
    render(root) {
      const d = DATA.engTrue;
      const ex = [[0, 0], [250, 0.00125], [300, 0.01], [380, 0.05], [430, 0.10], [470, 0.18], [500, 0.4]];
      root.innerHTML = `
      <div class="card">
        <div class="fields">
          ${field("et-s", "Engineering stress σ<sub>eng</sub>", "MPa", d.sEng)}
          ${field("et-e", "Engineering strain ε<sub>eng</sub>", "–", d.eEng)}
          ${field("et-E", "Young's modulus E", "MPa", d.E)}
        </div>
        <div class="results" id="et-out"></div>
        <div class="formula">
          ${math(row(sig("true"), mo("="), sig("eng"), mo("·"), par(mn("1"), mo("+"), eps("eng"))))}
          ${math(row(eps("true"), mo("="), mi("ln"), par(mn("1"), mo("+"), eps("eng"))))}
          ${math(row(sup(sub(mi("ε"), mi("ln")), mi("pl")), mo("="), mi("ln"), par(mn("1"), mo("+"), eps("eng")), mo("−"), frac(sig("true"), mi("E"))))}
        </div>
        <div id="et-warn"></div>
        <p class="src">Source: Simuleon, “Converting engineering stress-strain to true stress-strain in Abaqus”.</p>
      </div>
      <div class="card">
        <h3>Whole curve</h3>
        <p class="faint">Paste engineering stress [MPa] and engineering strain [–], one point per line (comma, semicolon, tab or space separated). The table gives the Abaqus *PLASTIC input (true stress, log plastic strain) from the first yielding point on. Example data below is illustrative.</p>
        <textarea id="et-curve" spellcheck="false">${ex.map((p) => p.join(", ")).join("\n")}</textarea>
        <div class="actions"><button class="btn" id="et-csv">Download *PLASTIC CSV</button><label class="btn">Load CSV file<input id="et-file" type="file" accept=".csv,.txt" hidden></label></div>
        <div id="et-err"></div>
        <div id="et-chart"></div>
        <div class="tbl-wrap" id="et-tbl"></div>
        ${note("Engineering → true conversion is only valid up to uniform elongation (onset of necking, max engineering stress). Points with negative log plastic strain are still elastic and are left out of the *PLASTIC table; the first row is shifted to ε<sub>pl</sub> = 0.")}
      </div>`;
      let plastic = [];
      const update = () => {
        const s = num(root, "et-s"), e = num(root, "et-e"), E = num(root, "et-E");
        const r = EC.engToTrue(s, e, E);
        out(root, "et-out", res("True stress σ<sub>true</sub>", fmt(r.sTrue, 6), "MPa", true) + res("Total true strain ε<sub>true</sub>", fmt(r.eTrue, 6)) + res("Log plastic strain ε<sub>pl</sub> (Abaqus)", fmt(r.ePl, 6)));
        out(root, "et-warn", r.ePl < 0 ? note("Plastic strain is negative: this point is in the elastic range.") : "");
        const { rows, errors } = parseTable(root.querySelector("#et-curve").value, 2);
        out(root, "et-err", errors.length ? `<div class="err">${esc(errors.join(" · "))}</div>` : "");
        const pts = rows.map((r) => ({ s: r.nums[r.nums.length - 2], e: r.nums[r.nums.length - 1] })).map((p) => ({ ...p, ...EC.engToTrue(p.s, p.e, E) }));
        plastic = pts.filter((p) => p.ePl >= 0 && p.s > 0);
        const first = plastic.length ? plastic[0].ePl : 0;
        plastic = plastic.map((p, i) => ({ ...p, ePlA: i === 0 ? 0 : p.ePl }));
        out(root, "et-chart", CH.lineChart({ id: "et", xlabel: "Strain [–]", ylabel: "Stress [MPa]", series: [
          { name: "Engineering", pts: pts.map((p) => [p.e, p.s]) },
          { name: "True (σ_true vs ε_true)", pts: pts.map((p) => [p.eTrue, p.sTrue]) }] }));
        out(root, "et-tbl", `<table class="tbl"><thead><tr><th>σ<sub>eng</sub> [MPa]</th><th>ε<sub>eng</sub></th><th>σ<sub>true</sub> [MPa]</th><th>ε<sub>true</sub></th><th>ε<sub>pl,ln</sub></th><th>*PLASTIC ε<sub>pl</sub></th></tr></thead><tbody>${
          pts.map((p) => { const pl = plastic.find((q) => q === p || (q.s === p.s && q.e === p.e)); return `<tr><td>${fmt(p.s, 6)}</td><td>${fmt(p.e, 6)}</td><td class="out">${fmt(p.sTrue, 6)}</td><td>${fmt(p.eTrue, 6)}</td><td>${fmt(p.ePl, 6)}</td><td class="out">${pl ? fmt(pl.ePlA, 6) : "—"}</td></tr>`; }).join("")}</tbody></table>${first > 0.002 ? `<p class="faint">Note: first plastic point has ε<sub>pl</sub> = ${fmt(first, 4)}; it is set to 0 in *PLASTIC.</p>` : ""}`);
      };
      root.addEventListener("input", update);
      root.querySelector("#et-csv").onclick = () => downloadCsv("plastic.csv", "true_stress_MPa,plastic_strain\n" + plastic.map((p) => `${+p.sTrue.toPrecision(8)},${+p.ePlA.toPrecision(8)}`).join("\n") + "\n");
      root.querySelector("#et-file").onchange = (e) => fileToTextarea(e.target, root.querySelector("#et-curve"), update);
      update();
    }
  });

  // 2 Bolt torque
  CALCS.push({
    id: "bolt-torque", title: "Bolt torque",
    desc: "Max tightening torque by the K-method (Bosch) and preload from torque (Colly).",
    render(root) {
      const d = DATA.bolt;
      const tbl = (cls) => `<div><h3>Property class ${cls}</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Size</th><th>d [mm]</th><th>F<sub>sp,max</sub> [N]</th><th>M<sub>A,max</sub> [Nm]</th></tr></thead><tbody>${
        d.classes[cls].map((r, i) => `<tr><td>${r[0]}</td><td>${r[1] * 1000}</td><td><input type="number" step="any" id="bt-f-${cls.replace(".", "")}-${i}" value="${r[2]}"></td><td class="out" id="bt-m-${cls.replace(".", "")}-${i}"></td></tr>`).join("")}</tbody></table></div></div>`;
      const opts = EC.METRIC.map((m, i) => `<option value="${i}" ${m[0] === "M10" ? "selected" : ""}>${m[0]}</option>`).join("");
      root.innerHTML = `
      <div class="card">
        <h3>K-method: M<sub>A</sub> = K · F<sub>sp</sub> · d</h3>
        <div class="fields">${field("bt-K", "Torque coefficient K<sub>min</sub>", "–", d.K)}</div>
        <div class="formula">
          ${math(row(sub(mi("M"), mi("A")), mo("="), mi("K"), mo("·"), sub(mi("F"), mi("sp")), mo("·"), mi("d"), mspace(), mtext("(K × 0.95 for M16 and larger)")))}
          ${math(row(mi("K"), mo("="), frac(row(mn("0.16"), mi("P"), mo("+"), sub(mi("μ"), mi("G")), mn("0.58"), sub(mi("d"), mn("2")), mo("+"), sub(mi("μ"), mi("K")), frac(sub(mi("D"), mi("Km")), mn("2"))), mi("d"))), "K from friction (Bosch)")}
        </div>
        <div class="grid2" style="margin-top:14px">${tbl("8.8")}${tbl("10.9")}</div>
        ${note("F<sub>sp,max</sub> is the assembly preload at 90 % utilisation of R<sub>p0.2</sub> (Bosch Table 5). The spreadsheet values equal the <b>μ<sub>G</sub> = 0.18</b> column, while Bosch says to read F<sub>sp</sub> at μ<sub>G,min</sub>. K<sub>min</sub> = 0.158 equals Table 4 at μ<sub>G</sub> = 0.10 / μ<sub>K</sub> = 0.12; for the stated friction range 0.10–0.18 the minimum would be K = 0.146 (μ<sub>G</sub> = μ<sub>K</sub> = 0.10). Net effect: the tabulated torques stay conservative (preload at lowest friction ≈ 1.08 × F<sub>sp</sub>(0.18) &lt; F<sub>sp</sub>(0.10)). Kept as in the sheet.", true)}
      </div>
      <div class="card">
        <h3>K from Bosch Table 4</h3>
        <p class="faint">Bilinear interpolation in Table 4 (coarse thread M1.4–M42, hex head / socket head screws, DIN 934 nuts). Book misprint “2,284” at μ<sub>G</sub> 0.18 / μ<sub>K</sub> 0.24 read as 0.284.</p>
        <div class="fields">
          ${field("bt-mg", "Thread friction μ<sub>G</sub>", "", d.muG, 'min="0.08" max="0.28"')}
          ${field("bt-mk", "Head/nut friction μ<sub>K</sub>", "", d.muK, 'min="0.04" max="0.28"')}
        </div>
        <div class="results" id="bt-kout"></div>
        <div class="actions"><button class="btn primary" id="bt-usek">Use this K above</button></div>
      </div>
      <div class="card">
        <h3>Preload from torque (Colly Company, ch. 4.3)</h3>
        <div class="fields">
          <div class="field"><label for="bt-th">Thread (fills P, d<sub>m</sub>, D<sub>a</sub>)</label><select id="bt-th">${opts}</select></div>
          ${field("bt-Mv", "Tightening torque M<sub>v</sub>", "Nm", d.colly.Mv)}
          ${field("bt-P", "Pitch P", "mm", d.colly.P)}
          ${field("bt-dm", "Pitch diameter d<sub>m</sub>", "mm", d.colly.dm)}
          ${field("bt-mug", "Thread friction μ<sub>g</sub>", "", d.colly.muG)}
          ${field("bt-Da", "Mean bearing diameter D<sub>a</sub>", "mm", d.colly.Da)}
          ${field("bt-mua", "Bearing friction μ<sub>a</sub>", "", d.colly.muA)}
        </div>
        <div class="results" id="bt-cout"></div>
        <div class="formula">${math(row(sub(mi("F"), mi("f")), mo("="), frac(sub(mi("M"), mi("v")), row(mn("0.161"), mi("P"), mo("+"), mn("0.583"), sub(mi("d"), mi("m")), sub(mi("μ"), mi("g")), mo("+"), mn("0.5"), sub(mi("D"), mi("a")), sub(mi("μ"), mi("a"))))), "M [Nm], lengths [mm] → F [kN]")}</div>
        <p class="faint">Cross-check: Colly table M10 8.8, μ<sub>g</sub> = 0.15 gives F = 25.8 kN at M<sub>v</sub> = 48.4 Nm; the formula gives 25.8 kN.</p>
      </div>`;
      const update = () => {
        const K = num(root, "bt-K");
        ["8.8", "10.9"].forEach((cls) => d.classes[cls].forEach((r, i) => {
          const k = cls.replace(".", "");
          out(root, `bt-m-${k}-${i}`, fmt(EC.boltTorque(K, num(root, `bt-f-${k}-${i}`), r[1]), 5));
        }));
        const kt = EC.kFromTable(num(root, "bt-mg"), num(root, "bt-mk"));
        out(root, "bt-kout", res("K (Table 4)", fmt(kt, 4), "", true));
        const c = ["bt-Mv", "bt-P", "bt-dm", "bt-mug", "bt-Da", "bt-mua"].map((id) => num(root, id));
        const F = EC.collyPreload(...c);
        const m = EC.METRIC[+root.querySelector("#bt-th").value];
        out(root, "bt-cout", res("Preload F<sub>f</sub>", fmt(F, 5), "kN", true) + res(`Stress in A<sub>s</sub> (${m[0]}: ${m[8]} mm²)`, fmt(F * 1000 / m[8], 4), "MPa"));
      };
      root.addEventListener("input", (e) => {
        if (e.target.id === "bt-th") { const m = EC.METRIC[+e.target.value]; setVal(root, "bt-P", m[7]); setVal(root, "bt-dm", m[2]); setVal(root, "bt-Da", m[6]); }
        update();
      });
      root.querySelector("#bt-usek").onclick = () => { setVal(root, "bt-K", +EC.kFromTable(num(root, "bt-mg"), num(root, "bt-mk")).toFixed(4)); update(); };
      update();
    }
  });
  function mspace() { return `<mspace width="1em"></mspace>`; }
  function mtext(t) { return `<mtext>${esc(t)}</mtext>`; }

  // 3 Fatigue calculation
  CALCS.push({
    id: "fatigue", title: "Fatigue (Basquin, Manson-Coffin)",
    desc: "Goodman mean-stress correction, stress-life (HCF) and strain-life (LCF) for three materials.",
    render(root) {
      const d = DATA.fatigue, M = d.materials;
      const hdr = `<tr><th></th>${M.map((m) => `<th>${esc(m.name)}<br><span class="faint">S<sub>u</sub> = ${m.Su} MPa</span></th>`).join("")}</tr>`;
      const inRow = (key, label) => `<tr><td>${label}</td>${M.map((m, i) => `<td><input type="number" step="any" id="fa-${key}-${i}" value="${m[key]}"></td>`).join("")}</tr>`;
      const outRow = (key, label) => `<tr><td>${label}</td>${M.map((m, i) => `<td class="out" id="fa-${key}-${i}"></td>`).join("")}</tr>`;
      root.innerHTML = `
      <div class="card">
        <h3>Global factors and mean stress</h3>
        <div class="fields">
          ${field("fa-ksf", "k<sub>sf</sub> surface", "", d.ksf)}
          ${field("fa-kl", "k<sub>L</sub> loading", "", d.kl)}
          ${field("fa-ksize", "k<sub>size</sub> size", "", d.ksize)}
          ${field("fa-Su", "Ultimate S<sub>u</sub>", "MPa", d.Su)}
          ${field("fa-Sa", "Stress amplitude S<sub>a</sub>", "MPa", d.Sa)}
          ${field("fa-Sm", "Mean stress S<sub>m</sub>", "MPa", d.Sm)}
        </div>
        <div class="results" id="fa-gout"></div>
        <div class="formula">${math(row(sub(mi("S"), mi("eq")), mo("="), frac(sub(mi("S"), mi("a")), row(mn("1"), mo("−"), frac(sub(mi("S"), mi("m")), sub(mi("S"), mi("u")))))), "Goodman")}</div>
        <div class="actions">
          <select id="fa-klsel" aria-label="Loading factor"><option value="">kL helper…</option><option value="0.92">Tension, Su ≤ 1500 MPa: 0.92</option><option value="1">Tension, Su &gt; 1500 MPa: 1.0</option><option value="1">Bending: 1.0</option><option value="0.58">Torsion: 0.58</option></select>
          <span class="check"><span>k<sub>size</sub> from d</span><input id="fa-d" type="number" step="any" value="7.62" style="width:80px"> mm</span><button class="btn" id="fa-usesize">Use</button>
        </div>
        <p class="faint">k<sub>size</sub> = (d/7.62)<sup>−0.1133</sup> for 3 ≤ d ≤ 50 mm; for non-round sections d = √(A<sub>0.95</sub>/0.077). k<sub>sf</sub> from the surface-factor chart: polished 1.0, ground 0.9, machined / hot-rolled / forged decreasing with S<sub>u</sub>.</p>
      </div>
      <div class="card">
        <h3>High-cycle fatigue (&gt; 10<sup>4</sup> cycles), Basquin</h3>
        <div class="tbl-wrap"><table class="tbl"><thead>${hdr}</thead><tbody>
          ${inRow("b", "b")}${inRow("Sf", "S<sub>f</sub>′ [MPa]")}${inRow("NfHcf", "N<sub>f</sub> [cycles]")}
          ${outRow("sa", "Stress amplitude S<sub>a</sub> [MPa]")}${outRow("nseq", "Life at S<sub>eq</sub> [cycles]")}${outRow("chk", "σ<sub>f</sub>′ · 2<sup>b</sup> (check) [MPa]")}
        </tbody></table></div>
        <div class="formula">${math(row(frac(row(mi("Δ"), mi("S")), mn("2")), mo("="), sub(mi("S"), mi("f")), mo("′"), sup(par(sub(mi("N"), mi("f"))), mi("b")), mo("·"), sub(mi("k"), mi("sf")), sub(mi("k"), mi("L")), sub(mi("k"), mi("size"))), "Basquin in cycles (sheet rounds S_a to whole MPa)")}</div>
        <div id="fa-sn"></div>
        ${note("Basquin is written with N<sub>f</sub> (cycles), not 2N<sub>f</sub>. That is consistent: the HCF S<sub>f</sub>′ values equal σ<sub>f</sub>′ · 2<sup>b</sup> from the LCF table (see check row), so both tables describe the same curve.")}
      </div>
      <div class="card">
        <h3>Low-cycle fatigue (&lt; 10<sup>4</sup> cycles), Manson-Coffin</h3>
        <div class="tbl-wrap"><table class="tbl"><thead>${hdr}</thead><tbody>
          ${inRow("b", "b").replace(/fa-b-/g, "fa-lb-")}${inRow("c", "c")}${inRow("ef", "ε<sub>f</sub>′")}${inRow("sf", "σ<sub>f</sub>′ [MPa]")}${inRow("E", "E [MPa]")}${inRow("NfLcf", "N<sub>f</sub> [cycles]")}
          ${outRow("ea", "Strain amplitude ε<sub>a</sub>")}${outRow("nt", "Transition life N<sub>t</sub> [cycles]")}
        </tbody></table></div>
        <div class="fields" style="margin-top:10px">${field("fa-eat", "Target strain amplitude", "–", 0.004)}</div>
        <div class="tbl-wrap"><table class="tbl"><tbody>${outRow("ninv", "Life at target ε<sub>a</sub> [cycles]")}</tbody></table></div>
        <div class="formula">${math(row(frac(row(mi("Δ"), mi("ε")), mn("2")), mo("="), frac(row(sub(mi("k"), mi("sf")), sub(mi("k"), mi("L")), sub(mi("k"), mi("size")), sub(mi("σ"), mi("f")), mo("′")), mi("E")), sup(par(mn("2"), sub(mi("N"), mi("f"))), mi("b")), mo("+"), sub(mi("ε"), mi("f")), mo("′"), sup(par(mn("2"), sub(mi("N"), mi("f"))), mi("c"))))}</div>
        <div id="fa-en"></div>
        ${note("The sheet multiplies k<sub>sf</sub> onto the <b>plastic</b> term (ε<sub>f</sub>′(2N)<sup>c</sup>·k<sub>sf</sub>) and ignores k<sub>L</sub>, k<sub>size</sub>. Surface/size/load factors act on the fatigue-strength (elastic) term, as in the HCF table, so here the factors scale σ<sub>f</sub>′. Identical to the sheet for the default k = 1.", true)}
      </div>`;
      const v = (id) => num(root, id);
      const update = () => {
        const k = v("fa-ksf") * v("fa-kl") * v("fa-ksize");
        const Seq = EC.goodman(v("fa-Sa"), v("fa-Sm"), v("fa-Su"));
        out(root, "fa-gout", res("Equivalent amplitude S<sub>eq</sub>", v("fa-Sm") >= v("fa-Su") ? "invalid (S<sub>m</sub> ≥ S<sub>u</sub>)" : fmt(Seq, 6), "MPa", true) + res("k<sub>sf</sub>·k<sub>L</sub>·k<sub>size</sub>", fmt(k, 4)));
        const sn = [], en = [], snPts = [];
        M.forEach((m, i) => {
          const b = v(`fa-b-${i}`), Sf = v(`fa-Sf-${i}`), N = v(`fa-NfHcf-${i}`);
          const Sa = EC.basquinSa(Sf, b, N, k);
          out(root, `fa-sa-${i}`, `${fmt(Sa, 6)} <span class="faint">(sheet: ${Math.round(Sa)})</span>`);
          out(root, `fa-nseq-${i}`, Seq > 0 ? fmt(EC.basquinN(Sf, b, Seq, k), 4) : "–");
          const lb = v(`fa-lb-${i}`), c = v(`fa-c-${i}`), ef = v(`fa-ef-${i}`), sf = v(`fa-sf-${i}`), E = v(`fa-E-${i}`), NL = v(`fa-NfLcf-${i}`);
          out(root, `fa-chk-${i}`, fmt(sf * Math.pow(2, lb), 5));
          out(root, `fa-ea-${i}`, fmt(EC.strainLife(sf, E, lb, ef, c, NL, k), 6));
          const Nt = 0.5 * Math.pow(ef * E / (k * sf), 1 / (lb - c));
          out(root, `fa-nt-${i}`, fmt(Nt, 4));
          out(root, `fa-ninv-${i}`, fmt(EC.solveN((n) => EC.strainLife(sf, E, lb, ef, c, n, k), v("fa-eat")), 4));
          const Ns = CH.logspace(1e3, 1e8, 80);
          sn.push({ name: M[i].name, pts: Ns.map((n) => [n, EC.basquinSa(Sf, b, n, k)]) });
          snPts.push({ x: N, y: Sa, color: CH.COLORS[i] });
          en.push({ name: M[i].name, pts: CH.logspace(1, 1e7, 80).map((n) => [n, EC.strainLife(sf, E, lb, ef, c, n, k)]) });
        });
        out(root, "fa-sn", CH.lineChart({ id: "sn", xlog: true, ylog: true, xlabel: "Cycles to failure N", ylabel: "Stress amplitude [MPa]", series: sn, points: snPts }));
        if (Seq > 0) out(root, "fa-sn", CH.lineChart({ id: "sn", xlog: true, ylog: true, xlabel: "Cycles to failure N", ylabel: "Stress amplitude [MPa]", series: sn.concat([{ name: "S_eq (Goodman)", pts: [[1e3, Seq], [1e8, Seq]], dash: true, color: "var(--faint)" }]), points: snPts }));
        out(root, "fa-en", CH.lineChart({ id: "en", xlog: true, ylog: true, xlabel: "Cycles to failure N", ylabel: "Strain amplitude [–]", series: en }));
      };
      root.addEventListener("input", update);
      root.querySelector("#fa-klsel").onchange = (e) => { if (e.target.value) { setVal(root, "fa-kl", e.target.value); update(); } };
      root.querySelector("#fa-usesize").onclick = () => { setVal(root, "fa-ksize", +EC.kSize(num(root, "fa-d")).toFixed(4)); update(); };
      update();
    }
  });

  // 4 UML
  CALCS.push({
    id: "uml", title: "Uniform Material Law (UML)",
    desc: "Strain-life parameters from S_u and E (Bäumel & Seeger 1990) for structural and sheet steels.",
    render(root) {
      const d = DATA.uml;
      root.innerHTML = `
      <div class="card">
        <div class="fields">
          <div class="field"><label for="um-g">Material set</label><select id="um-g"><option value="structural">${d.groups.structural.label}</option><option value="sheet">${d.groups.sheet.label}</option></select></div>
          <div class="field"><label for="um-t">UML type</label><select id="um-t"><option value="steel">Unalloyed / low-alloy steel</option><option value="al">Aluminium and titanium alloys</option></select></div>
          ${field("um-N", "Life N<sub>f</sub>", "cycles", d.Nf)}
          ${field("um-ea", "Target strain amplitude", "–", 0.003)}
        </div>
        <div class="tbl-wrap" id="um-tbl"></div>
        <div class="formula">
          ${math(row(frac(row(mi("Δ"), mi("ε")), mn("2")), mo("="), frac(row(sub(mi("σ"), mi("f")), mo("′")), mi("E")), sup(par(mn("2"), sub(mi("N"), mi("f"))), mi("b")), mo("+"), sub(mi("ε"), mi("f")), mo("′"), sup(par(mn("2"), sub(mi("N"), mi("f"))), mi("c"))))}
          ${math(row(mtext("Steel: "), sub(mi("σ"), mi("f")), mo("′"), mo("="), mn("1.5"), sub(mi("S"), mi("u")), mo(","), mspace(), mi("b"), mo("="), mn("−0.087"), mo(","), mspace(), sub(mi("ε"), mi("f")), mo("′"), mo("="), mn("0.59"), mi("ψ"), mo(","), mspace(), mi("c"), mo("="), mn("−0.58")))}
          ${math(row(mi("ψ"), mo("="), mn("1"), mspace(), mtext("if S_u/E ≤ 0.003, else "), mi("ψ"), mo("="), mn("1.375"), mo("−"), mn("125"), frac(sub(mi("S"), mi("u")), mi("E"))))}
        </div>
        <p class="faint">Aluminium/titanium UML (not in the sheet, same source): σ<sub>f</sub>′ = 1.67 S<sub>u</sub>, b = −0.095, ε<sub>f</sub>′ = 0.35, c = −0.69, K′ = 1.61 S<sub>u</sub>, n′ = 0.11. Steel cyclic curve: K′ = 1.65 S<sub>u</sub>, n′ = 0.15.</p>
      </div>
      <div class="card"><h3>Strain-life curves</h3><div id="um-chart"></div><div class="tbl-wrap" id="um-n"></div>
      ${note("The sheet's “Tunnplåt” chart leaves out VSCR420LA (its series stop at column H); it is included here. S<sub>u</sub> values are the minimum R<sub>m</sub> of each grade.")}</div>`;
      let mats = [];
      const build = () => {
        const g = root.querySelector("#um-g").value;
        mats = d.groups[g].mats.map((m) => m.slice());
        out(root, "um-tbl", `<table class="tbl"><thead><tr><th>Material</th><th>E [MPa]</th><th>S<sub>u</sub> [MPa]</th><th>σ<sub>f</sub>′</th><th>ψ</th><th>ε<sub>f</sub>′</th><th>K′</th><th>ε<sub>a</sub>(N<sub>f</sub>)</th><th>N at target ε<sub>a</sub></th></tr></thead><tbody>${
          mats.map((m, i) => `<tr><td>${m[0]}</td><td><input type="number" step="any" id="um-E-${i}" value="${m[1]}"></td><td><input type="number" step="any" id="um-S-${i}" value="${m[2]}"></td><td id="um-sf-${i}"></td><td id="um-psi-${i}"></td><td id="um-ef-${i}"></td><td id="um-K-${i}"></td><td class="out" id="um-ea-${i}"></td><td class="out" id="um-ni-${i}"></td></tr>`).join("")}</tbody></table>`);
      };
      const update = () => {
        const type = root.querySelector("#um-t").value, N = num(root, "um-N"), target = num(root, "um-ea");
        const series = [], tabRows = d.Ntable.map((n) => [n]);
        mats.forEach((m, i) => {
          const E = num(root, `um-E-${i}`), Su = num(root, `um-S-${i}`), u = EC.uml(Su, E, type);
          out(root, `um-sf-${i}`, fmt(u.sf, 5)); out(root, `um-psi-${i}`, fmt(u.psi, 5)); out(root, `um-ef-${i}`, fmt(u.ef, 5)); out(root, `um-K-${i}`, fmt(u.Kp, 5));
          const f = (n) => EC.strainLife(u.sf, E, u.b, u.ef, u.c, n);
          out(root, `um-ea-${i}`, fmt(f(N), 6)); out(root, `um-ni-${i}`, fmt(EC.solveN(f, target), 4));
          series.push({ name: m[0], pts: CH.logspace(10, 1e7, 80).map((n) => [n, f(n)]) });
          d.Ntable.forEach((n, j) => tabRows[j].push(f(n)));
        });
        out(root, "um-chart", CH.lineChart({ id: "uml", xlog: true, ylog: true, xlabel: "Cycles to failure N", ylabel: "Strain amplitude [–]", series }));
        out(root, "um-n", `<table class="tbl"><thead><tr><th>N</th>${mats.map((m) => `<th>${m[0]}</th>`).join("")}</tr></thead><tbody>${tabRows.map((r) => `<tr><td>${fmt(r[0])}</td>${r.slice(1).map((x) => `<td>${fmt(x, 5)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      };
      root.addEventListener("input", (e) => { if (e.target.id === "um-g") build(); update(); });
      build(); update();
    }
  });

  // 5 Shore A
  CALCS.push({
    id: "shore", title: "Shore A → Young's modulus",
    desc: "E-modulus of elastomers from Shore A hardness (Boussinesq with fitting term, IWK).",
    render(root) {
      const d = DATA.shore;
      root.innerHTML = `
      <div class="card">
        <div class="fields">
          ${field("sh-A", "Shore A hardness", "ShA", d.ShA, 'min="0" max="99"')}
          ${field("sh-mu", "Poisson ratio μ", "", d.mu)}
          ${field("sh-R", "Indenter radius R", "mm", d.R)}
          ${field("sh-C1", "C<sub>1</sub>", "N", d.C1)}
          ${field("sh-C2", "C<sub>2</sub>", "N", d.C2)}
          ${field("sh-C3", "C<sub>3</sub>", "mm", d.C3)}
        </div>
        <div class="results" id="sh-out"></div>
        <div id="sh-warn"></div>
        <div class="formula">${math(row(mi("E"), mo("="), frac(row(mn("1"), mo("−"), sup(mi("μ"), mn("2"))), row(mn("2"), mi("R"), sub(mi("C"), mn("3")))), mo("·"), frac(row(sub(mi("C"), mn("1")), mo("+"), sub(mi("C"), mn("2")), sub(mi("Sh"), mi("A"))), row(mn("100"), mo("−"), sub(mi("Sh"), mi("A")))), mo("·"), par(mn("2.6"), mo("−"), mn("0.02"), sub(mi("Sh"), mi("A")))), "[N/mm²]")}</div>
        <div id="sh-chart"></div>
        <p class="faint">Valid for elastomers 30–95 Shore A. Derived for compression; in the small-strain elastic range the same E can be used in tension. Source: Kunststoffe 6/2006, IWK HSR Rapperswil, “Druck-E-Modul aus Shore-A-Härte”.</p>
      </div>`;
      const update = () => {
        const p = ["sh-C1", "sh-C2", "sh-C3", "sh-mu", "sh-R"].map((id) => num(root, id)), A = num(root, "sh-A");
        const E = EC.shoreAtoE(A, ...p);
        out(root, "sh-out", res("Young's modulus E", fmt(E, 5), "MPa", true) + res("Shear modulus G = E/(2(1+μ))", fmt(E / (2 * (1 + p[3])), 4), "MPa"));
        out(root, "sh-warn", A < 30 || A > 95 ? note("Outside the validated range 30–95 Shore A.") : "");
        out(root, "sh-chart", CH.lineChart({ id: "sh", xlabel: "Shore A", ylabel: "E [MPa]", xmin: 30, xmax: 95, series: [{ name: "E(Sh A)", pts: CH.linspace(30, 95, 66).map((a) => [a, EC.shoreAtoE(a, ...p)]) }], points: [{ x: A, y: E, label: fmtPlain(E, 3) + " MPa" }] }));
      };
      root.addEventListener("input", update); update();
    }
  });

  // 6 Neuber
  CALCS.push({
    id: "neuber", title: "Neuber rule",
    desc: "Elastic-plastic notch strain from linear-elastic FE stress (ideal plastic and Ramberg-Osgood).",
    render(root) {
      const d = DATA.neuber;
      root.innerHTML = `
      <div class="grid2">
      <div class="card">
        <h3>a) Plastic strain from linear stress</h3>
        <div class="fields">${field("ne-Re", "Yield limit R<sub>e</sub>", "MPa", d.a.Re)}${field("ne-E", "E", "MPa", d.a.E)}${field("ne-s", "Linear-elastic stress σ<sub>el</sub>", "MPa", d.a.sigEl)}</div>
        <div class="results" id="ne-aout"></div>
        <div class="formula">${math(row(mi("ε"), mo("="), frac(sup(sub(mi("σ"), mi("el")), mn("2")), row(sub(mi("R"), mi("e")), mi("E")))), "ideal plastic: σ = R_e")}</div>
      </div>
      <div class="card">
        <h3>b) Allowed linear stress from max strain</h3>
        <div class="fields">${field("ne-Re2", "Yield limit R<sub>e</sub>", "MPa", d.b.Re)}${field("ne-E2", "E", "MPa", d.b.E)}${field("ne-eps", "Max strain ε<sub>max</sub>", "–", d.b.eps)}</div>
        <div class="results" id="ne-bout"></div>
        <div class="formula">${math(row(sub(mi("σ"), mi("el")), mo("="), `<msqrt>${row(sub(mi("R"), mi("e")), mi("E"), sub(mi("ε"), mi("max")))}</msqrt>`))}</div>
      </div>
      </div>
      <div class="card">
        <h3>c) Neuber with a Ramberg-Osgood curve (uses inputs of a)</h3>
        <div class="fields">${field("ne-K", "K′", "MPa", 500)}${field("ne-n", "n′", "", 0.11)}</div>
        <div class="results" id="ne-cout"></div>
        <div class="formula">${math(row(mi("σ"), mi("ε"), mo("="), frac(sup(sub(mi("σ"), mi("el")), mn("2")), mi("E")), mo(","), mspace(), mi("ε"), mo("="), frac(mi("σ"), mi("E")), mo("+"), sup(par(mi("σ"), mo("/"), mi("K"), mo("′")), row(mn("1"), mo("/"), mi("n"), mo("′")))))}</div>
        <div id="ne-chart"></div>
        <p class="faint">K′, n′ e.g. from the UML: steel K′ = 1.65 S<sub>u</sub>, n′ = 0.15; aluminium K′ = 1.61 S<sub>u</sub>, n′ = 0.11. Ideal plastic (a) is conservative, as stated in the sheet.</p>
      </div>`;
      const update = () => {
        const Re = num(root, "ne-Re"), E = num(root, "ne-E"), s = num(root, "ne-s");
        const eA = EC.neuberStrainIdealPlastic(Re, E, s);
        out(root, "ne-aout", res("Total strain ε", fmt(eA, 6), "", true) + res("Plastic part ε − R<sub>e</sub>/E", fmt(eA - Re / E, 5)) + (s <= Re ? res("Note", "σ<sub>el</sub> ≤ R<sub>e</sub>: elastic") : ""));
        out(root, "ne-bout", res("Allowed linear-elastic stress", fmt(EC.neuberStressFromStrain(num(root, "ne-Re2"), num(root, "ne-E2"), num(root, "ne-eps")), 6), "MPa", true));
        const K = num(root, "ne-K"), n = num(root, "ne-n");
        const ro = EC.neuberRO(s, E, K, n);
        out(root, "ne-cout", res("Notch stress σ", fmt(ro.sigma, 5), "MPa", true) + res("Notch strain ε", fmt(ro.eps, 5)));
        const emax = Math.max(eA, ro.eps, s / E) * 1.25;
        const ss = CH.linspace(1, Math.max(s, ro.sigma) * 1.1, 120);
        out(root, "ne-chart", CH.lineChart({ id: "ne", xlabel: "Strain [–]", ylabel: "Stress [MPa]", xmin: 0, xmax: emax, ymin: 0, series: [
          { name: "Linear elastic", pts: [[0, 0], [s / E * 1.15, s * 1.15]], dash: true },
          { name: "Ideal plastic", pts: [[0, 0], [Re / E, Re], [emax, Re]] },
          { name: "Ramberg-Osgood", pts: ss.map((x) => [x / E + Math.pow(x / K, 1 / n), x]) },
          { name: "Neuber hyperbola σε = σ_el²/E", pts: CH.linspace(s * s / E / (s * 1.3), emax, 120).map((e) => [e, s * s / E / e]), dash: true }],
          points: [{ x: s / E, y: s, label: "σ_el" }, { x: eA, y: Re, label: "a)" }, { x: ro.eps, y: ro.sigma, label: "c)" }] }));
      };
      root.addEventListener("input", update); update();
    }
  });

  // 7 Rule of mixtures
  CALCS.push({
    id: "rule-of-mixtures", title: "Rule of mixtures",
    desc: "Upper/lower bound modulus and density of fibre-reinforced plastics from fibre mass fraction.",
    render(root) {
      const d = DATA.rom;
      root.innerHTML = `
      <div class="card">
        <div class="fields">
          <div class="field"><label for="rm-p">Preset</label><select id="rm-p">${d.map((m, i) => `<option value="${i}">${esc(m.name)}</option>`).join("")}</select></div>
          ${field("rm-Ef", "Fibre modulus E<sub>f</sub>", "MPa", d[0].Ef)}
          ${field("rm-Em", "Matrix modulus E<sub>m</sub>", "MPa", d[0].Em)}
          ${field("rm-fm", "Fibre mass fraction", "–", d[0].fm)}
          ${field("rm-rf", "Fibre density ρ<sub>f</sub>", "g/cm³", d[0].rhoF)}
          ${field("rm-rm", "Matrix density ρ<sub>m</sub>", "g/cm³", d[0].rhoM)}
        </div>
        <div class="results" id="rm-out"></div>
        <div class="formula">
          ${math(row(mi("f"), mo("="), frac(mn("1"), row(mn("1"), mo("+"), frac(row(mn("1"), mo("−"), sub(mi("f"), mi("m"))), sub(mi("f"), mi("m"))), frac(sub(mi("ρ"), mi("f")), sub(mi("ρ"), mi("m")))))), "volume fraction from mass fraction")}
          ${math(row(sub(mi("E"), mi("upper")), mo("="), mi("f"), sub(mi("E"), mi("f")), mo("+"), par(mn("1"), mo("−"), mi("f")), sub(mi("E"), mi("m")), mspace(), sub(mi("E"), mi("lower")), mo("="), sup(par(frac(mi("f"), sub(mi("E"), mi("f"))), mo("+"), frac(row(mn("1"), mo("−"), mi("f")), sub(mi("E"), mi("m")))), mn("−1"))))}
          ${math(row(sub(mi("ρ"), mi("c")), mo("="), frac(mi("f"), sub(mi("f"), mi("m"))), sub(mi("ρ"), mi("f")), mo("="), mi("f"), sub(mi("ρ"), mi("f")), mo("+"), par(mn("1"), mo("−"), mi("f")), sub(mi("ρ"), mi("m"))))}
        </div>
        <div id="rm-chart"></div>
        ${note("Upper bound (Voigt) = loading along fully aligned continuous fibres; lower bound (Reuss) = transverse. Short-fibre injection-moulded parts lie between; the arithmetic mean is a rough estimate, not a micromechanical model (use orientation-dependent data, e.g. Halpin-Tsai/Mori-Tanaka, for FE).")}
      </div>
      <div class="card"><h3>Spreadsheet materials</h3><div class="tbl-wrap" id="rm-all"></div></div>`;
      const update = () => {
        const p = ["rm-Ef", "rm-Em", "rm-fm", "rm-rf", "rm-rm"].map((id) => num(root, id));
        const r = EC.ruleOfMixtures(...p);
        out(root, "rm-out", res("Volume fraction f", fmt(r.f, 5)) + res("Upper bound (fibre dir.)", fmt(r.upper, 6), "MPa", true) + res("Lower bound (transverse)", fmt(r.lower, 6), "MPa", true) + res("Mean", fmt(r.mean, 6), "MPa") + res("Composite density", fmt(r.rho, 5), "g/cm³"));
        const fm = CH.linspace(0.001, 0.7, 70);
        const g = (x) => EC.ruleOfMixtures(p[0], p[1], x, p[3], p[4]);
        out(root, "rm-chart", CH.lineChart({ id: "rm", xlabel: "Fibre mass fraction [–]", ylabel: "E [MPa]", xmin: 0, xmax: 0.7, series: [
          { name: "Upper bound", pts: fm.map((x) => [x, g(x).upper]) }, { name: "Lower bound", pts: fm.map((x) => [x, g(x).lower]) }, { name: "Mean", pts: fm.map((x) => [x, g(x).mean]), dash: true }],
          points: [{ x: p[2], y: r.upper }, { x: p[2], y: r.lower }] }));
        out(root, "rm-all", `<table class="tbl"><thead><tr><th>Material</th><th>E<sub>m</sub></th><th>f<sub>m</sub></th><th>ρ<sub>m</sub></th><th>f (vol)</th><th>Upper [MPa]</th><th>Lower [MPa]</th><th>Mean [MPa]</th><th>ρ<sub>c</sub></th></tr></thead><tbody>${
          d.map((m) => { const q = EC.ruleOfMixtures(m.Ef, m.Em, m.fm, m.rhoF, m.rhoM); return `<tr><td>${esc(m.name)}</td><td>${m.Em}</td><td>${m.fm}</td><td>${m.rhoM}</td><td>${fmt(q.f, 4)}</td><td class="out">${fmt(q.upper, 6)}</td><td class="out">${fmt(q.lower, 6)}</td><td>${fmt(q.mean, 6)}</td><td>${fmt(q.rho, 4)}</td></tr>`; }).join("")}</tbody></table><p class="faint">E<sub>f</sub> = 72 000 MPa, ρ<sub>f</sub> = 2.5 g/cm³ (glass) for all. The sheet labels the Grivory matrix density “PA6 unfilled” although the matrix is PA66 (label only).</p>`);
      };
      root.addEventListener("input", (e) => {
        if (e.target.id === "rm-p") { const m = d[+e.target.value]; setVal(root, "rm-Ef", m.Ef); setVal(root, "rm-Em", m.Em); setVal(root, "rm-fm", m.fm); setVal(root, "rm-rf", m.rhoF); setVal(root, "rm-rm", m.rhoM); }
        update();
      });
      update();
    }
  });

  // 8 Notch factor TWB
  CALCS.push({
    id: "twb-notch", title: "Notch factor at TWB",
    desc: "Stress concentration α of a tailor-welded-blank laser weld as unsymmetric flat bar (Haibach).",
    render(root) {
      const d = DATA.twb, p = d.p;
      const colOpts = (sel) => ["gekerbt-z", "gekerbt-b", "abgesetzt-z", "abgesetzt-b"].map((k) => `<option value="${k}" ${k === sel ? "selected" : ""}>${k.replace("gekerbt", "notched").replace("abgesetzt", "stepped").replace("-z", ", tension").replace("-b", ", bending")}</option>`).join("");
      const pf = (k) => field("tw-" + k, k.replace(/(\d)$/, "<sub>$1</sub>"), "", p[k]);
      root.innerHTML = `
      <div class="card">
        <div class="fields">
          ${field("tw-rho", "Notch radius ρ", "mm", d.geo.rho)}
          ${field("tw-t", "Notch depth / step t", "mm", d.geo.t)}
          ${field("tw-a", "Net section a", "mm", d.geo.a)}
        </div>
        <div class="results" id="tw-out"></div>
        <div class="formula">
          ${math(row(sub(mi("α"), mn("1")), mo("="), mn("1"), mo("+"), sup(`<mrow><mo>[</mo>${row(mi("A"), sup(par(frac(mi("t"), mi("ρ"))), row(mo("−"), mi("k"))), mo("+"), mi("B"), sup(par(mn("1"), mo("+"), frac(mi("a"), mi("ρ"))), mi("l")), sup(par(frac(mi("a"), mi("ρ"))), row(mo("−"), mn("3"), mi("l"), mo("/"), mn("2"))), mo("+"), mi("C"), frac(mi("a"), mi("ρ")), sup(par(frac(mi("a"), mi("ρ")), mo("+"), frac(mi("t"), mi("ρ"))), row(mo("−"), mi("l"))), sup(par(frac(mi("t"), mi("ρ"))), row(mo("−"), mi("m"))))}<mo>]</mo></mrow>`, row(mo("−"), mn("1"), mo("/"), mn("2")))), "Haibach Tab. 5.3-1 (symmetric bar)")}
          ${math(row(sub(mi("α"), mn("2")), mo("="), sup(`<mrow><mo>[</mo>${row(mn("1"), mo("+"), mi("A"), sup(par(frac(mi("t"), mi("a"))), mi("k")), mo("+"), mi("B"), sup(par(frac(mi("t"), mi("ρ"))), mi("l")), mo("+"), mi("C"), sup(par(frac(mi("a"), mi("ρ"))), mi("m")))}<mo>]</mo></mrow>`, row(mo("−"), mn("1"), mo("/"), mn("2"))), mspace(), mi("α"), mo("="), sub(mi("α"), mn("1")), sub(mi("α"), mn("2"))), "Tab. 5.3-2 (unsymmetric correction)")}
        </div>
      </div>
      <div class="card">
        <h3>Parameters</h3>
        <div class="fields">
          <div class="field"><label for="tw-c1">α<sub>1</sub> column (Tab. 5.3-1, flat bar)</label><select id="tw-c1"><option value="">Sheet values</option>${colOpts("")}</select></div>
          <div class="field"><label for="tw-c2">α<sub>2</sub> column (Tab. 5.3-2)</label><select id="tw-c2"><option value="">Sheet values</option>${colOpts("")}</select></div>
        </div>
        <div class="fields" style="margin-top:10px">${["A1", "B1", "C1", "k1", "l1", "m1"].map(pf).join("")}</div>
        <div class="fields" style="margin-top:10px">${["A2", "B2", "C2", "k2", "l2", "m2"].map(pf).join("")}</div>
        <div class="actions"><label class="check"><input type="checkbox" id="tw-e1"> Third term exponent −1 instead of −l (see note)</label></div>
        <div id="tw-chart"></div>
        ${note("The sheet takes α<sub>1</sub> from the <b>stepped, bending</b> column (A = 0.40, B = 3.8 …) but α<sub>2</sub> from the <b>notched, bending</b> column (A = 0.25, B = 0.03 …). For a TWB thickness step the consistent choice is stepped/bending for both (A = 0.14, B = 0.004, C = 0.004, k = 0.12, l = m = 0.003), giving α ≈ 1.66 instead of 1.58 at the default geometry (+4.5 %). Defaults keep the sheet values; the alternative is shown in the results.", true)}
        ${note("In the printed Tab. 5.3-1 formula the exponent on (a/ρ + t/ρ) is hard to read in the photo (−l or −1). The sheet uses −l; the checkbox lets you compare.")}
        <p class="src">Source: Haibach, Betriebsfestigkeit, 3rd ed., pp. 641–643.</p>
      </div>`;
      const keys = ["A1", "B1", "C1", "k1", "l1", "m1", "A2", "B2", "C2", "k2", "l2", "m2"];
      const update = () => {
        const P = {}; keys.forEach((k) => (P[k] = num(root, "tw-" + k)));
        const geo = { rho: num(root, "tw-rho"), t: num(root, "tw-t"), a: num(root, "tw-a") };
        const opt = { thirdExpOne: root.querySelector("#tw-e1").checked };
        const r = EC.twbAlpha(P, geo, opt);
        const alt = EC.twbAlpha({ ...P, ...EC.HAIBACH_A2["abgesetzt-b"] }, geo, opt);
        out(root, "tw-out", res("α<sub>1</sub>", fmt(r.alpha1, 6)) + res("α<sub>2</sub>", fmt(r.alpha2, 6)) + res("Notch factor α", fmt(r.alpha, 6), "", true) + res("α with α<sub>2</sub> stepped/bending", fmt(alt.alpha, 5)));
        const rs = CH.logspace(0.05, 5, 60);
        out(root, "tw-chart", CH.lineChart({ id: "tw", xlog: true, xlabel: "Notch radius ρ [mm]", ylabel: "α [–]", series: [
          { name: "α (current parameters)", pts: rs.map((x) => [x, EC.twbAlpha(P, { ...geo, rho: x }, opt).alpha]) },
          { name: "α with α₂ stepped/bending", pts: rs.map((x) => [x, EC.twbAlpha({ ...P, ...EC.HAIBACH_A2["abgesetzt-b"] }, { ...geo, rho: x }, opt).alpha]), dash: true }],
          points: [{ x: geo.rho, y: r.alpha }] }));
      };
      root.addEventListener("input", (e) => {
        if (e.target.id === "tw-c1" || e.target.id === "tw-c2") {
          const which = e.target.id === "tw-c1" ? 1 : 2, v = e.target.value;
          const src = v ? (which === 1 ? EC.HAIBACH_A1 : EC.HAIBACH_A2)[v] : p;
          keys.filter((k) => k.endsWith(String(which))).forEach((k) => setVal(root, "tw-" + k, src[k]));
        }
        update();
      });
      update();
    }
  });

  // 9/10 damage
  function blocksText() { return "# block, n (cycles), s (amplitude)\n" + DATA.damage.rows.map((r) => r.join(", ")).join("\n"); }
  function readBlocks(root, id) {
    const { rows, errors } = parseTable(root.querySelector("#" + id).value, 2);
    const data = rows.map((r) => r.f.length >= 3 ? { block: r.f[0], n: r.nums[1], s: r.nums[2] } : { block: "1", n: r.nums[0], s: r.nums[1] });
    const order = []; data.forEach((r) => { if (!order.includes(String(r.block))) order.push(String(r.block)); });
    return { data, errors, order };
  }
  function spectrumChart(data, order, id) {
    return CH.lineChart({ id, xlog: true, xlabel: "Cumulative cycles", ylabel: "Amplitude", series: order.map((b) => {
      const rs = data.filter((r) => String(r.block) === b).slice().sort((x, y) => y.s - x.s);
      let cum = 0; const pts = [];
      rs.forEach((r) => { pts.push([Math.max(cum, 1), r.s]); cum += r.n; pts.push([cum, r.s]); });
      return { name: "Block " + b, pts };
    }) });
  }
  CALCS.push({
    id: "relative-damage", title: "Relative damage",
    desc: "Damage ratio between block programs, D_j/D_i = Σ n·s^k / Σ n·s^k.",
    render(root) {
      const d = DATA.damage;
      root.innerHTML = `
      <div class="card">
        <div class="fields">${field("rd-k", "S-N slope k", "", d.k)}${field("rd-N", "Reference cycles for S<sub>eq</sub>", "cycles", 1e6)}
        <div class="field"><label for="rd-ref">Reference block</label><select id="rd-ref"></select></div></div>
        <div class="formula">${math(row(frac(row(mo("∑"), sub(mi("D"), mi("j"))), row(mo("∑"), sub(mi("D"), mi("i")))), mo("="), frac(row(sub(mo("∑"), mi("j")), sub(mi("n"), mi("j")), mo("·"), sup(sub(mi("s"), mi("j")), mi("k"))), row(sub(mo("∑"), mi("i")), sub(mi("n"), mi("i")), mo("·"), sup(sub(mi("s"), mi("i")), mi("k"))))))}${math(row(sub(mi("S"), mi("eq")), mo("="), sup(par(frac(row(mo("∑"), mi("n"), sup(mi("s"), mi("k"))), sub(mi("N"), mi("ref")))), row(mn("1"), mo("/"), mi("k")))), "damage-equivalent amplitude")}</div>
        <div class="tbl-wrap" id="rd-out"></div>
      </div>
      <div class="card">
        <h3>Load spectrum</h3>
        <p class="faint">One level per line: <b>block, n, s</b> (or just n, s for one block). Comma, semicolon, tab or space separated; lines starting with # are ignored. Paste from Excel or load a CSV. Default: the three block programs from the sheet.</p>
        <textarea id="rd-data" spellcheck="false">${blocksText()}</textarea>
        <div class="actions"><label class="btn">Load CSV file<input id="rd-file" type="file" accept=".csv,.txt" hidden></label><button class="btn" id="rd-reset">Reset to sheet data</button></div>
        <div id="rd-err"></div><div id="rd-chart"></div>
      </div>`;
      const update = () => {
        const k = num(root, "rd-k"), Nref = num(root, "rd-N");
        const { data, errors, order } = readBlocks(root, "rd-data");
        const sel = root.querySelector("#rd-ref"), prev = sel.value;
        sel.innerHTML = order.map((b) => `<option value="${esc(b)}">Block ${esc(b)}</option>`).join("");
        sel.value = order.includes(prev) ? prev : order[0];
        out(root, "rd-err", errors.length ? `<div class="err">${esc(errors.join(" · "))}</div>` : "");
        const sums = order.map((b) => EC.damageSum(data.filter((r) => String(r.block) === b), k));
        const ref = sums[order.indexOf(sel.value)];
        out(root, "rd-out", `<table class="tbl"><thead><tr><th>Block</th><th>Levels</th><th>Σ n</th><th>Σ n·s<sup>k</sup></th><th>D / D<sub>ref</sub></th><th>S<sub>eq</sub> at N<sub>ref</sub></th></tr></thead><tbody>${
          order.map((b, i) => { const rs = data.filter((r) => String(r.block) === b); const n = rs.reduce((a, r) => a + r.n, 0); return `<tr><td>${esc(b)}</td><td>${rs.length}</td><td>${fmt(n, 6)}</td><td>${fmt(sums[i], 6)}</td><td class="out">${fmt(sums[i] / ref, 7)}</td><td>${fmt(Math.pow(sums[i] / Nref, 1 / k), 5)}</td></tr>`; }).join("")}</tbody></table>`);
        out(root, "rd-chart", spectrumChart(data, order, "rd"));
      };
      root.addEventListener("input", update);
      root.querySelector("#rd-file").onchange = (e) => fileToTextarea(e.target, root.querySelector("#rd-data"), update);
      root.querySelector("#rd-reset").onclick = () => { root.querySelector("#rd-data").value = blocksText(); update(); };
      update();
    }
  });
  CALCS.push({
    id: "absolute-damage", title: "Absolute damage",
    desc: "Palmgren-Miner damage per level and block from an S-N curve N = N_D (S/S_D)^-k.",
    render(root) {
      const d = DATA.damage;
      root.innerHTML = `
      <div class="card">
        <div class="fields">
          ${field("ad-k", "S-N slope k", "", d.k)}${field("ad-S", "Reference amplitude S<sub>D</sub>", "", d.SD)}${field("ad-N", "Reference cycles N<sub>D</sub>", "cycles", d.ND)}
          <div class="field"><label for="ad-m">Below S<sub>D</sub></label><select id="ad-m"><option value="elementary">Elementary Miner (sheet)</option><option value="haibach">Haibach, k′ = 2k − 1</option><option value="original">Original Miner (no damage)</option></select></div>
        </div>
        <div class="formula">${math(row(sub(mi("N"), mi("i")), mo("="), sub(mi("N"), mi("D")), sup(par(frac(sub(mi("s"), mi("i")), sub(mi("S"), mi("D")))), row(mo("−"), mi("k"))), mo(","), mspace(), sub(mi("D"), mi("i")), mo("="), frac(sub(mi("n"), mi("i")), sub(mi("N"), mi("i"))), mo(","), mspace(), mi("D"), mo("="), mo("∑"), sub(mi("D"), mi("i"))))}</div>
        <div class="tbl-wrap" id="ad-sum"></div>
      </div>
      <div class="card">
        <h3>Load spectrum</h3>
        <p class="faint">One level per line: <b>block, n, s</b> (or n, s). Default: the sheet's block programs.</p>
        <textarea id="ad-data" spellcheck="false">${blocksText()}</textarea>
        <div class="actions"><label class="btn">Load CSV file<input id="ad-file" type="file" accept=".csv,.txt" hidden></label><button class="btn" id="ad-reset">Reset to sheet data</button><button class="btn" id="ad-csv">Download results CSV</button></div>
        <div id="ad-err"></div>
        <div id="ad-chart"></div>
        <div class="tbl-wrap" id="ad-rows"></div>
      </div>`;
      let last = [];
      const update = () => {
        const k = num(root, "ad-k"), SD = num(root, "ad-S"), ND = num(root, "ad-N"), mode = root.querySelector("#ad-m").value;
        const { data, errors, order } = readBlocks(root, "ad-data");
        out(root, "ad-err", errors.length ? `<div class="err">${esc(errors.join(" · "))}</div>` : "");
        const rows = EC.absoluteDamage(data, SD, ND, k, mode); last = rows;
        const sums = order.map((b) => rows.filter((r) => String(r.block) === b).reduce((a, r) => a + r.D, 0));
        const tot = sums.reduce((a, x) => a + x, 0);
        out(root, "ad-sum", `<table class="tbl"><thead><tr><th>Block</th><th>Σ D</th><th>D / D<sub>1</sub></th><th>Repeats to failure 1/D</th></tr></thead><tbody>${
          order.map((b, i) => `<tr><td>${esc(b)}</td><td class="out">${fmt(sums[i], 6)}</td><td>${fmt(sums[i] / sums[0], 7)}</td><td>${fmt(1 / sums[i], 5)}</td></tr>`).join("")}<tr class="sum"><td>All blocks</td><td class="out">${fmt(tot, 6)}</td><td></td><td>${fmt(1 / tot, 5)}</td></tr></tbody></table>`);
        out(root, "ad-rows", `<table class="tbl"><thead><tr><th>Block</th><th>n<sub>i</sub></th><th>s<sub>i</sub></th><th>N<sub>i</sub></th><th>D<sub>i</sub></th></tr></thead><tbody>${
          rows.map((r) => `<tr><td>${esc(r.block)}</td><td>${fmt(r.n, 6)}</td><td>${fmt(r.s, 6)}</td><td>${fmt(r.N, 7)}</td><td class="out">${fmt(r.D, 7)}</td></tr>`).join("")}</tbody></table>`);
        const smax = Math.max(SD * 3, ...data.map((r) => r.s)), smin = Math.min(SD / 2, ...data.map((r) => r.s).filter((x) => x > 0));
        const ss = CH.logspace(smin, smax, 80).filter((s) => isFinite(EC.cyclesToFailure(s, SD, ND, k, mode)));
        out(root, "ad-chart", CH.lineChart({ id: "ad", xlog: true, ylog: true, xlabel: "Cycles", ylabel: "Amplitude", series: [
          { name: "S-N curve", pts: ss.map((s) => [EC.cyclesToFailure(s, SD, ND, k, mode), s]).sort((a, b) => a[0] - b[0]) },
          ...order.map((b) => ({ name: "Block " + b + " (n_i, s_i)", marker: true, pts: rows.filter((r) => String(r.block) === b).map((r) => [r.n, r.s]) }))] }));
      };
      root.addEventListener("input", update);
      root.querySelector("#ad-file").onchange = (e) => fileToTextarea(e.target, root.querySelector("#ad-data"), update);
      root.querySelector("#ad-reset").onclick = () => { root.querySelector("#ad-data").value = blocksText(); update(); };
      root.querySelector("#ad-csv").onclick = () => downloadCsv("damage.csv", "block,n,s,N,D\n" + last.map((r) => [r.block, r.n, r.s, +r.N.toPrecision(10), +r.D.toPrecision(10)].join(",")).join("\n") + "\n");
      update();
    }
  });

  // 11 Lorentz
  CALCS.push({
    id: "lorentz", title: "Lorentz transformation",
    desc: "Lorentz factor γ, time dilation and length contraction.",
    render(root) {
      const d = DATA.lorentz;
      root.innerHTML = `
      <div class="card">
        <div class="fields">
          ${field("lo-c", "Speed of light c", "km/s", d.c)}
          ${field("lo-b", "β = v/c", "–", d.beta, 'min="0" max="0.999999"')}
          ${field("lo-t", "Proper time Δt<sub>0</sub>", "s", 1)}
          ${field("lo-l", "Proper length l<sub>0</sub>", "m", 1)}
        </div>
        <div class="results" id="lo-out"></div>
        <div class="formula">${math(row(mi("γ"), mo("="), frac(mn("1"), `<msqrt>${row(mn("1"), mo("−"), sup(par(frac(mi("v"), mi("c"))), mn("2")))}</msqrt>`), mspace(), mi("Δ"), mi("t"), mo("="), mi("Δ"), sub(mi("t"), mn("0")), mi("γ"), mo(","), mspace(), mi("l"), mo("="), frac(sub(mi("l"), mn("0")), mi("γ"))))}</div>
        <div id="lo-chart"></div>
        <p class="faint">The sheet uses c = 300 000 km/s; the exact value is 299 792.458 km/s. γ depends only on β, so the result is the same.</p>
      </div>`;
      const update = () => {
        const c = num(root, "lo-c"), b = num(root, "lo-b"), v = c * b, g = EC.lorentzGamma(v, c);
        out(root, "lo-out", res("Speed v", fmt(v, 6), "km/s") + res("Lorentz factor γ", b >= 1 ? "β must be &lt; 1" : fmt(g, 7), "", true) + res("Dilated time Δt", fmt(num(root, "lo-t") * g, 6), "s") + res("Contracted length l", fmt(num(root, "lo-l") / g, 6), "m"));
        const bs = CH.linspace(0, 0.995, 120);
        out(root, "lo-chart", CH.lineChart({ id: "lo", xlabel: "v [km/s]", ylabel: "γ", ymin: 0, ymax: 12, xmin: 0, xmax: c, series: [{ name: "γ(v)", pts: bs.map((x) => [x * c, EC.lorentzGamma(x * c, c)]) }], points: b < 1 && g <= 12 ? [{ x: v, y: g, label: "γ = " + fmtPlain(g, 4) }] : [] }));
      };
      root.addEventListener("input", update); update();
    }
  });

  // ---------- shell ----------
  const ICON_SUN = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" fill="currentColor"/></svg>';

  function currentId() { const h = location.hash.replace("#", ""); return CALCS.some((c) => c.id === h) ? h : CALCS[0].id; }
  function themeBtn() {
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    return `<button class="icon-btn" data-action="theme" aria-label="${dark ? "Switch to light mode" : "Switch to dark mode"}">${dark ? ICON_SUN : ICON_MOON}</button>`;
  }
  function shell() {
    app.innerHTML = `
      <header class="top">
        <div class="brand"><img class="brand-icon" src="icon.svg?v=1" width="24" height="24" alt="">
          <div class="title"><h1>Engineering Calculations</h1><p>Durability, fatigue and material calculators</p></div></div>
        <span id="theme-slot">${themeBtn()}</span>
      </header>
      <div class="layout">
        <nav class="side" aria-label="Calculators"><ul>${CALCS.map((c) => `<li><a href="#${c.id}">${esc(c.title)}</a></li>`).join("")}</ul></nav>
        <main>
          <div class="mobile-nav"><select id="mnav" aria-label="Calculator">${CALCS.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}</select></div>
          <div class="card"><div class="head-row"><div><h2 id="calc-title"></h2><p class="muted" id="calc-desc"></p></div><button class="btn" id="reset">Reset to sheet values</button></div></div>
          <div id="panel" style="display:grid;gap:14px"></div>
        </main>
      </div>
      <footer>Based on the spreadsheet “Engineering calculations.xlsx”. Defaults are the sheet's inputs; all 200 formula cells are reproduced (see tests/verify.js).</footer>`;
    document.getElementById("mnav").onchange = (e) => { location.hash = e.target.value; };
    document.getElementById("reset").onclick = () => show(true);
  }
  function show(force) {
    const id = currentId(), c = CALCS.find((x) => x.id === id);
    document.querySelectorAll("nav.side a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === "#" + id ? "page" : "false"));
    document.getElementById("mnav").value = id;
    document.getElementById("calc-title").textContent = c.title;
    document.getElementById("calc-desc").textContent = c.desc;
    const old = document.getElementById("panel");
    const panel = old.cloneNode(false); old.replaceWith(panel); // drop old listeners
    c.render(panel);
    document.title = c.title + " · Engineering Calculations";
    if (!force) window.scrollTo(0, 0);
  }
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("engcalc-theme", t); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "light" ? "#f7f7f5" : "#0b0b0c");
    document.getElementById("theme-slot").innerHTML = themeBtn();
  }
  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (el && el.dataset.action === "theme") setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  });
  window.addEventListener("hashchange", () => show());
  shell(); show(true);
})();
