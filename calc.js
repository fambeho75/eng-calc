/* Engineering Calculations — pure calculation functions (browser global + Node module).
   Based on Jürgen's spreadsheet "Engineering calculations.xlsx". */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EC = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const ln = Math.log, pow = Math.pow, sqrt = Math.sqrt;

  /* 1. Engineering -> true stress/strain (Abaqus *PLASTIC input) */
  function engToTrue(sEng, eEng, E) {
    const sTrue = sEng * (1 + eEng);
    const eTrue = ln(1 + eEng);
    const ePl = eTrue - sTrue / E;
    return { sTrue, eTrue, ePl };
  }

  /* 2. Bolt torque, K-method (Bosch Kraftfahrtechnisches Taschenbuch) */
  // Table 4 K values: rows mu_G, cols mu_K. (Book prints "2,284" at mu_G 0.18 / mu_K 0.24: typo for 0.284.)
  const K_TABLE = {
    muG: [0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.24, 0.28],
    muK: [0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.24, 0.28],
    K: [
      [0.094, 0.108, 0.120, 0.134, 0.148, 0.162, 0.176, 0.190, 0.204, 0.232, 0.260],
      [0.104, 0.118, 0.132, 0.146, 0.158, 0.172, 0.186, 0.200, 0.214, 0.242, 0.270],
      [0.114, 0.128, 0.142, 0.156, 0.170, 0.184, 0.196, 0.210, 0.224, 0.252, 0.280],
      [0.124, 0.138, 0.152, 0.166, 0.180, 0.194, 0.208, 0.222, 0.234, 0.262, 0.290],
      [0.134, 0.148, 0.162, 0.176, 0.190, 0.204, 0.218, 0.232, 0.246, 0.272, 0.300],
      [0.146, 0.160, 0.172, 0.186, 0.200, 0.214, 0.228, 0.242, 0.256, 0.284, 0.312],
      [0.156, 0.170, 0.184, 0.198, 0.210, 0.224, 0.238, 0.252, 0.266, 0.294, 0.322],
      [0.176, 0.190, 0.204, 0.218, 0.232, 0.246, 0.260, 0.274, 0.286, 0.314, 0.342],
      [0.198, 0.212, 0.224, 0.238, 0.252, 0.266, 0.280, 0.294, 0.308, 0.336, 0.362]
    ]
  };
  function interpIdx(arr, x) {
    if (x <= arr[0]) return [0, 0, 0];
    const n = arr.length - 1;
    if (x >= arr[n]) return [n, n, 0];
    let i = 0; while (arr[i + 1] < x) i++;
    return [i, i + 1, (x - arr[i]) / (arr[i + 1] - arr[i])];
  }
  function kFromTable(muG, muK) {
    const [i0, i1, ti] = interpIdx(K_TABLE.muG, muG);
    const [j0, j1, tj] = interpIdx(K_TABLE.muK, muK);
    const T = K_TABLE.K;
    const a = T[i0][j0] * (1 - tj) + T[i0][j1] * tj;
    const b = T[i1][j0] * (1 - tj) + T[i1][j1] * tj;
    return a * (1 - ti) + b * ti;
  }
  // Max tightening torque [Nm]; d in m, Fsp in N. K reduced by 5 % for M16 and larger (Table 4 note).
  function boltTorque(K, Fsp, d) {
    const red = d >= 0.016 - 1e-12 ? 0.95 : 1;
    return K * red * Fsp * d;
  }
  // Colly Company ch. 4.3: preload from torque. Mv [Nm], P, dm, Da [mm] -> Ff [kN]
  function collyPreload(Mv, P, dm, muG, Da, muA) {
    return Mv / (0.161 * P + 0.583 * dm * muG + 0.5 * Da * muA);
  }
  function collyTorque(Ff, P, dm, muG, Da, muA) {
    return Ff * (0.161 * P + 0.583 * dm * muG + 0.5 * Da * muA);
  }
  // Colly Fig. 145 metric coarse thread data: [name, d, dm, di, Dh, Ds, Da, P, As]
  const METRIC = [
    ["M3", 3, 2.68, 2.39, 3.4, 5.5, 4.45, 0.5, 5.05], ["M4", 4, 3.55, 3.14, 4.5, 7, 5.75, 0.7, 8.8],
    ["M5", 5, 4.48, 4.02, 5.5, 8.5, 7, 0.8, 14.2], ["M6", 6, 5.35, 4.77, 6.6, 10, 8.3, 1, 20.1],
    ["M7", 7, 6.35, 5.77, 7.6, 11, 9.3, 1, 28.8], ["M8", 8, 7.19, 6.47, 9, 13, 11, 1.25, 36.6],
    ["M10", 10, 9.03, 8.16, 11, 16, 13.5, 1.5, 58], ["M12", 12, 10.86, 9.85, 13.5, 18, 15.75, 1.75, 84.2],
    ["M14", 14, 12.7, 11.55, 15.5, 21, 18.25, 2, 115], ["M16", 16, 14.7, 13.55, 17.5, 24, 20.75, 2, 157],
    ["M18", 18, 16.38, 14.93, 20, 27, 23.5, 2.5, 192], ["M20", 20, 18.38, 16.93, 22, 30, 26, 2.5, 245],
    ["M22", 22, 20.38, 18.93, 24, 33, 28.5, 2.5, 303], ["M24", 24, 22.05, 20.32, 26, 36, 31, 3, 352],
    ["M27", 27, 25.05, 23.32, 30, 40, 35, 3, 459], ["M30", 30, 27.73, 25.71, 33, 45, 39, 3.5, 561],
    ["M33", 33, 30.73, 28.71, 36, 50, 43, 3.5, 694], ["M36", 36, 33.4, 31.09, 39, 54, 46.5, 4, 817],
    ["M39", 39, 36.4, 34.09, 42, 58, 50, 4, 976]
  ];

  /* 3. Fatigue calculation (stress-life + strain-life) */
  function goodman(Sa, Sm, Su) { return Sa / (1 - Sm / Su); }
  // Basquin in cycles (sheet form): Sa = Sf' * Nf^b * ksf*kl*ksize  (Sf' here = sigma_f' * 2^b)
  function basquinSa(Sf, b, Nf, kfac) { return Sf * pow(Nf, b) * kfac; }
  function basquinN(Sf, b, Sa, kfac) { return pow(Sa / (Sf * kfac), 1 / b); }
  function kSize(d) { return pow(d / 7.62, -0.1133); }
  // Manson-Coffin/Basquin strain-life: eps_a = kfac*sf'/E (2N)^b + ef' (2N)^c
  // kfac applied to the elastic (strength) term. The sheet multiplies k_sf on the plastic term instead
  // (identical for k_sf = 1); see note in UI.
  function strainLife(sf, E, b, ef, c, Nf, kfac) {
    const k = kfac == null ? 1 : kfac;
    const r = 2 * Nf;
    return k * sf / E * pow(r, b) + ef * pow(r, c);
  }
  function strainLifeSheet(sf, E, b, ef, c, Nf, ksf) { // literal spreadsheet form (for verification)
    const r = 2 * Nf;
    return sf / E * pow(r, b) + ef * pow(r, c) * ksf;
  }
  function solveN(fn, target, lo, hi) { // fn decreasing in N; bisection in log space
    lo = lo || 0.5; hi = hi || 1e12;
    if (fn(lo) < target) return lo;
    if (fn(hi) > target) return Infinity;
    let a = ln(lo), z = ln(hi);
    for (let i = 0; i < 200; i++) {
      const m = 0.5 * (a + z);
      if (fn(Math.exp(m)) > target) a = m; else z = m;
    }
    return Math.exp(0.5 * (a + z));
  }

  /* 4. Uniform Material Law (Bäumel & Seeger 1990) */
  function uml(Su, E, type) {
    if (type === "al") {
      return { sf: 1.67 * Su, b: -0.095, psi: 1, ef: 0.35, c: -0.69, Kp: 1.61 * Su, np: 0.11 };
    }
    const psi = Su / E <= 0.003 ? 1 : 1.375 - 125 * (Su / E);
    return { sf: 1.5 * Su, b: -0.087, psi, ef: 0.59 * psi, c: -0.58, Kp: 1.65 * Su, np: 0.15 };
  }

  /* 5. Shore A -> E (Boussinesq with fitting term, IWK / Kunststoffe 6/2006) */
  function shoreAtoE(ShA, C1, C2, C3, mu, R) {
    return (1 - mu * mu) / (2 * R * C3) * (C1 + C2 * ShA) / (100 - ShA) * (2.6 - 0.02 * ShA);
  }

  /* 6. Neuber */
  function neuberStrainIdealPlastic(Re, E, sigEl) { return sigEl * sigEl / (Re * E); }
  function neuberStressFromStrain(Re, E, epsMax) { return sqrt(Re * E * epsMax); }
  // Neuber with Ramberg-Osgood: sigma*eps = sigEl^2/E, eps = s/E + (s/K')^(1/n')
  function neuberRO(sigEl, E, Kp, np) {
    const target = sigEl * sigEl / E;
    const f = (s) => s * (s / E + pow(s / Kp, 1 / np)) - target;
    let lo = 0, hi = Math.max(sigEl, 1);
    for (let i = 0; i < 200; i++) { const m = 0.5 * (lo + hi); if (f(m) > 0) hi = m; else lo = m; }
    const s = 0.5 * (lo + hi);
    return { sigma: s, eps: s / E + pow(s / Kp, 1 / np) };
  }

  /* 7. Rule of mixtures */
  function ruleOfMixtures(Ef, Em, fm, rhoF, rhoM) {
    const f = 1 / (1 + (1 - fm) / fm * (rhoF / rhoM));
    const upper = f * Ef + (1 - f) * Em;
    const lower = 1 / (f / Ef + (1 - f) / Em);
    return { f, upper, lower, mean: (upper + lower) / 2, rho: f / fm * rhoF };
  }

  /* 8. Notch factor, unsymmetric flat bar (Haibach, Betriebsfestigkeit 3rd ed., Tab. 5.3-1/5.3-2) */
  function twbAlpha(p, geo, opt) {
    const { t, a, rho } = geo;
    const e3 = opt && opt.thirdExpOne ? 1 : p.l1;
    const a1 = 1 + pow(
      p.A1 * pow(t / rho, -p.k1) +
      p.B1 * pow(1 + a / rho, p.l1) * pow(a / rho, -3 * p.l1 / 2) +
      p.C1 * (a / rho) * pow(a / rho + t / rho, -e3) * pow(t / rho, -p.m1), -0.5);
    const a2 = pow(1 + p.A2 * pow(t / a, p.k2) + p.B2 * pow(t / rho, p.l2) + p.C2 * pow(a / rho, p.m2), -0.5);
    return { alpha1: a1, alpha2: a2, alpha: a1 * a2 };
  }
  const HAIBACH_A1 = { // Tab. 5.3-1, flat bar (Flachstab)
    "gekerbt-z": { A1: 0.10, B1: 0.7, C1: 0.13, k1: 1.00, l1: 2.00, m1: 1.25 },
    "gekerbt-b": { A1: 0.08, B1: 2.2, C1: 0.20, k1: 0.66, l1: 2.25, m1: 1.33 },
    "abgesetzt-z": { A1: 0.55, B1: 1.1, C1: 0.20, k1: 0.80, l1: 2.20, m1: 1.33 },
    "abgesetzt-b": { A1: 0.40, B1: 3.8, C1: 0.20, k1: 0.66, l1: 2.25, m1: 1.33 }
  };
  const HAIBACH_A2 = { // Tab. 5.3-2, unsymmetric flat bar
    "gekerbt-z": { A2: 1.35, B2: 0.10, C2: 0.10, k2: 0.50, l2: 0.20, m2: 0.20 },
    "gekerbt-b": { A2: 0.25, B2: 0.03, C2: 0.01, k2: 0.20, l2: 0.04, m2: 0.04 },
    "abgesetzt-z": { A2: 0.80, B2: 0.06, C2: 0.07, k2: 0.50, l2: 0.15, m2: 0.15 },
    "abgesetzt-b": { A2: 0.14, B2: 0.004, C2: 0.004, k2: 0.12, l2: 0.003, m2: 0.003 }
  };

  /* 9/10. Damage (Palmgren-Miner) */
  // Relative damage of a spectrum vs a reference: sum n*s^k
  function damageSum(blocks, k) { return blocks.reduce((acc, r) => acc + r.n * pow(r.s, k), 0); }
  // S-N: N = ND*(S/SD)^-k ; below SD: mode "elementary" (sheet), "haibach" (k' = 2k-1), "original" (no damage)
  function cyclesToFailure(S, SD, ND, k, mode) {
    if (S <= 0) return Infinity;
    if (S >= SD || !mode || mode === "elementary") return ND * pow(S / SD, -k);
    if (mode === "haibach") return ND * pow(S / SD, -(2 * k - 1));
    return Infinity;
  }
  function absoluteDamage(rows, SD, ND, k, mode) {
    return rows.map((r) => { const N = cyclesToFailure(r.s, SD, ND, k, mode); return { ...r, N, D: r.n / N }; });
  }

  /* 11. Lorentz */
  function lorentzGamma(v, c) { return 1 / sqrt(1 - pow(v / c, 2)); }

  return {
    engToTrue, K_TABLE, kFromTable, boltTorque, collyPreload, collyTorque, METRIC,
    goodman, basquinSa, basquinN, kSize, strainLife, strainLifeSheet, solveN,
    uml, shoreAtoE, neuberStrainIdealPlastic, neuberStressFromStrain, neuberRO,
    ruleOfMixtures, twbAlpha, HAIBACH_A1, HAIBACH_A2,
    damageSum, cyclesToFailure, absoluteDamage, lorentzGamma
  };
});
