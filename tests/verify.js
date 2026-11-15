// Verifies calc.js + data.js against the spreadsheet's cached values (sheet-values.json, exported with openpyxl).
const EC = require("../calc.js");
const D = require("../data.js");
const S = require("./sheet-values.json");
const RTOL = 1e-6;
const results = {};
const fails = [];
function check(sheet, cell, got) {
  const exp = S[sheet].values[cell];
  if (!(cell in S[sheet].formulas)) throw new Error(`${sheet}!${cell} is not a formula cell`);
  let ok;
  if (typeof exp === "number") ok = Math.abs(got - exp) <= RTOL * Math.max(1, Math.abs(exp));
  else ok = String(got) === String(exp);
  results[sheet] = results[sheet] || { n: 0, pass: 0, cells: new Set() };
  results[sheet].n++; if (ok) results[sheet].pass++;
  results[sheet].cells.add(cell);
  if (!ok) fails.push(`${sheet}!${cell}: expected ${exp}, got ${got}`);
}
function inp(sheet, cell, ours) { // assert the app default equals the spreadsheet input cell
  const exp = S[sheet].values[cell];
  if (Math.abs(exp - ours) > 1e-12 * Math.max(1, Math.abs(exp))) fails.push(`default ${sheet}!${cell}: sheet ${exp} vs app ${ours}`);
}
const col = (i) => String.fromCharCode(67 + i); // C, D, E ...

// 1 Conversion engineering to true
{ const sh = "Conversion engineering to true", d = D.engTrue;
  inp(sh, "C4", d.sEng); inp(sh, "C5", d.eEng); inp(sh, "C6", d.E);
  const r = EC.engToTrue(d.sEng, d.eEng, d.E);
  check(sh, "C7", r.sTrue); check(sh, "C8", r.eTrue); check(sh, "C9", r.ePl); }

// 2 Bolt torque
{ const sh = "Bolt torque", d = D.bolt;
  inp(sh, "G5", d.K);
  [["8.8", 8], ["10.9", 19]].forEach(([cls, r0]) => d.classes[cls].forEach((row, i) => {
    inp(sh, "C" + (r0 + i), row[1]); inp(sh, "D" + (r0 + i), row[2]);
    check(sh, "E" + (r0 + i), EC.boltTorque(d.K, row[2], row[1]));
  }));
  const c = d.colly;
  inp(sh, "C116", c.Mv); inp(sh, "C117", c.P); inp(sh, "C118", c.dm); inp(sh, "C119", c.muG); inp(sh, "C120", c.Da); inp(sh, "C121", c.muA);
  check(sh, "C122", EC.collyPreload(c.Mv, c.P, c.dm, c.muG, c.Da, c.muA)); }

// 3 Fatigue Calculation
{ const sh = "Fatigue Calculation", d = D.fatigue;
  inp(sh, "C3", d.ksf); inp(sh, "C4", d.kl); inp(sh, "C5", d.ksize); inp(sh, "C6", d.Su); inp(sh, "C7", d.Sa); inp(sh, "C8", d.Sm);
  check(sh, "C9", EC.goodman(d.Sa, d.Sm, d.Su));
  const k = d.ksf * d.kl * d.ksize;
  d.materials.forEach((m, i) => {
    const C = col(i);
    inp(sh, C + "13", m.b); inp(sh, C + "14", m.Sf); inp(sh, C + "15", m.NfHcf);
    inp(sh, C + "38", m.b); inp(sh, C + "39", m.c); inp(sh, C + "40", m.ef); inp(sh, C + "41", m.sf); inp(sh, C + "42", m.E); inp(sh, C + "43", m.NfLcf);
    check(sh, C + "16", Math.round(EC.basquinSa(m.Sf, m.b, m.NfHcf, k)) + " MPa");
    check(sh, C + "44", EC.strainLife(m.sf, m.E, m.b, m.ef, m.c, m.NfLcf, k));        // app form (k on elastic term)
    if (Math.abs(EC.strainLife(m.sf, m.E, m.b, m.ef, m.c, m.NfLcf, k) - EC.strainLifeSheet(m.sf, m.E, m.b, m.ef, m.c, m.NfLcf, d.ksf)) > 1e-15) fails.push("LCF k placement differs at default inputs");
  }); }

// 4 Fatigue Calculation UML
{ const sh = "Fatigue Calculation UML", d = D.uml;
  [["structural", 8, 20], ["sheet", 62, 74]].forEach(([g, r0, t0]) => d.groups[g].mats.forEach(([name, E, Su], i) => {
    const C = col(i);
    inp(sh, C + r0, E); inp(sh, C + (r0 + 1), Su); inp(sh, C + (r0 + 7), d.Nf);
    const u = EC.uml(Su, E, "steel");
    inp(sh, C + (r0 + 3), u.b); inp(sh, C + (r0 + 6), u.c);
    check(sh, C + (r0 + 2), u.sf); check(sh, C + (r0 + 4), u.psi); check(sh, C + (r0 + 5), u.ef);
    check(sh, C + (r0 + 8), EC.strainLife(u.sf, E, u.b, u.ef, u.c, d.Nf));
    d.Ntable.forEach((N, j) => { inp(sh, "B" + (t0 + j), N); check(sh, C + (t0 + j), EC.strainLife(u.sf, E, u.b, u.ef, u.c, N)); });
  })); }

// 5 Shore A
{ const sh = "Conversion ShoreA to E", d = D.shore;
  ["C7", "C8", "C9", "C10", "C11", "C12"].forEach((c, i) => inp(sh, c, [d.C1, d.C2, d.C3, d.mu, d.R, d.ShA][i]));
  check(sh, "C13", EC.shoreAtoE(d.ShA, d.C1, d.C2, d.C3, d.mu, d.R)); }

// 6 Neuber
{ const sh = "Neuber rule", a = D.neuber.a, b = D.neuber.b;
  inp(sh, "C7", a.Re); inp(sh, "C8", a.E); inp(sh, "C9", a.sigEl); inp(sh, "C13", b.Re); inp(sh, "C14", b.E); inp(sh, "C15", b.eps);
  check(sh, "C10", EC.neuberStrainIdealPlastic(a.Re, a.E, a.sigEl));
  check(sh, "C16", EC.neuberStressFromStrain(b.Re, b.E, b.eps)); }

// 7 Rule of mixtures
{ const sh = "Rule of mixtures";
  D.rom.forEach((m, i) => {
    const r0 = 6 + 12 * i;
    inp(sh, "C" + r0, m.Ef); inp(sh, "C" + (r0 + 1), m.Em); inp(sh, "C" + (r0 + 2), m.fm); inp(sh, "C" + (r0 + 3), m.rhoF); inp(sh, "C" + (r0 + 4), m.rhoM);
    const r = EC.ruleOfMixtures(m.Ef, m.Em, m.fm, m.rhoF, m.rhoM);
    check(sh, "C" + (r0 + 5), r.f); check(sh, "C" + (r0 + 6), r.upper); check(sh, "C" + (r0 + 7), r.lower);
    check(sh, "C" + (r0 + 8), r.mean); check(sh, "C" + (r0 + 9), r.rho);
  }); }

// 8 Notch factor at TWB
{ const sh = "Notch factor at TWB", p = D.twb.p, g = D.twb.geo;
  [["C5", p.A1], ["C6", p.B1], ["C7", p.C1], ["C8", p.k1], ["C9", p.l1], ["C10", p.m1], ["F5", p.A2], ["F6", p.B2], ["F7", p.C2], ["F8", p.k2], ["F9", p.l2], ["F10", p.m2], ["C11", g.rho], ["C12", g.t], ["C13", g.a]].forEach(([c, v]) => inp(sh, c, v));
  const r = EC.twbAlpha(p, g);
  check(sh, "C15", r.alpha1); check(sh, "F15", r.alpha2); check(sh, "C16", r.alpha); }

// 9 Relative Damage
{ const sh = "Relative Damage", d = D.damage;
  inp(sh, "C2", d.k);
  const blk = (b) => d.rows.filter((r) => r[0] === b).map((r) => ({ n: r[1], s: r[2] }));
  d.rows.forEach((r, i) => { inp(sh, "B" + (5 + i), r[1]); inp(sh, ["C", "D", "E"][r[0] - 1] + (5 + i), r[2]); });
  const D1 = EC.damageSum(blk(1), d.k);
  check(sh, "C20", EC.damageSum(blk(2), d.k) / D1); check(sh, "D20", EC.damageSum(blk(3), d.k) / D1); }

// 10 Absolute Damage
{ const sh = "Absolute Damage", d = D.damage;
  inp(sh, "C3", d.k); inp(sh, "D4", d.SD); inp(sh, "D5", d.ND);
  const rows = EC.absoluteDamage(d.rows.map((r) => ({ block: r[0], n: r[1], s: r[2] })), d.SD, d.ND, d.k, "elementary");
  rows.forEach((r, i) => { inp(sh, "B" + (8 + i), r.n); check(sh, "F" + (8 + i), r.N); check(sh, "G" + (8 + i), r.D); });
  const sum = (b) => rows.filter((r) => r.block === b).reduce((a, r) => a + r.D, 0);
  check(sh, "C23", sum(2) / sum(1)); check(sh, "D23", sum(3) / sum(1)); }

// 11 Lorentz
{ const sh = "Lorentz transformation", d = D.lorentz;
  inp(sh, "C5", d.c);
  check(sh, "C6", d.c * d.beta); check(sh, "C7", EC.lorentzGamma(d.c * d.beta, d.c)); }


// ---------- extra cross-checks against the source tables (not spreadsheet cells) ----------
const extra = [];
function near(name, got, exp, tol) { const ok = Math.abs(got - exp) <= tol; extra.push(`${ok ? "PASS" : "FAIL"}  ${name}: got ${+got.toPrecision(6)}, expected ${exp} (±${tol})`); if (!ok) fails.push(name); }
// Colly table (Fig. 147): M10 8.8, mu_g = 0.15, mu_a = 0.125: F = 25.8 kN at Mv = 48.4 Nm; M8 8.8 mu_g 0.10: 17.9 kN at 23.4 Nm; M20 10.9 mu_g 0.125: 164 kN at 552 Nm
near("Colly M10 8.8 mu 0.15", EC.collyPreload(48.4, 1.5, 9.03, 0.15, 13.5, 0.125), 25.8, 0.06);
near("Colly M8 8.8 mu 0.10", EC.collyPreload(23.4, 1.25, 7.19, 0.10, 11, 0.125), 17.9, 0.06);
near("Colly M20 10.9 mu 0.125", EC.collyPreload(552, 2.5, 18.38, 0.125, 26, 0.125), 164, 0.6);
// Bosch Table 4: K at table nodes and the sheet's K_min
near("K table mu_G 0.10 / mu_K 0.12", EC.kFromTable(0.10, 0.12), 0.158, 1e-12);
near("K table mu_G 0.14 / mu_K 0.18", EC.kFromTable(0.14, 0.18), 0.222, 1e-12);
near("K table midpoint 0.11/0.10", EC.kFromTable(0.11, 0.10), (0.146 + 0.156) / 2, 1e-12);
// HCF Sf' = sigma_f' * 2^b (consistency of the two fatigue tables)
D.fatigue.materials.forEach((m) => near(`Sf'(HCF) = sigma_f' 2^b, ${m.name}`, m.sf * Math.pow(2, m.b), m.Sf, 1));
// inverse solvers round-trip
near("Basquin inverse round trip", EC.basquinN(811, -0.124, EC.basquinSa(811, -0.124, 144000, 1), 1), 144000, 1e-6 * 144000);
near("Strain-life inverse round trip", EC.solveN((n) => EC.strainLife(884, 207000, -0.124, 0.729, -0.581, n), EC.strainLife(884, 207000, -0.124, 0.729, -0.581, 530000)), 530000, 1e-6 * 530000);
// Neuber-RO: sigma*eps equals sigma_el^2/E
{ const r = EC.neuberRO(420, 70000, 500, 0.11); near("Neuber RO energy product", r.sigma * r.eps, 420 * 420 / 70000, 1e-9); }
// Rule of mixtures density identity
{ const r = EC.ruleOfMixtures(72000, 970, 0.3, 2.5, 1.14); near("rho_c = f rho_f + (1-f) rho_m", r.rho, r.f * 2.5 + (1 - r.f) * 1.14, 1e-12); }

// report
let tot = 0, totp = 0, totF = 0;
console.log("| Sheet | Formula cells in sheet | Outputs checked | Pass | Result |");
console.log("|---|---|---|---|---|");
for (const sh of Object.keys(S)) {
  const r = results[sh] || { n: 0, pass: 0, cells: new Set() };
  const nf = Object.keys(S[sh].formulas).length;
  const missing = Object.keys(S[sh].formulas).filter((c) => !r.cells.has(c));
  tot += r.n; totp += r.pass; totF += nf;
  console.log(`| ${sh} | ${nf} | ${r.n} | ${r.pass} | ${r.pass === r.n && !missing.length ? "PASS" : "FAIL"}${missing.length ? " (unchecked: " + missing.join(",") + ")" : ""} |`);
}
console.log(`\nTotal: ${totp}/${tot} outputs pass (formula cells in workbook: ${totF}); rtol ${RTOL}`);
console.log("\nCross-checks:\n" + extra.join("\n"));
if (fails.length) { console.log("\nFailures:\n" + fails.join("\n")); process.exit(1); }
