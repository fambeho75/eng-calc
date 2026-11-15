/* Default inputs, taken from the spreadsheet "Engineering calculations.xlsx". */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ECDATA = factory();
})(typeof self !== "undefined" ? self : this, function () {
  return {
    engTrue: { sEng: 500, eEng: 0.4, E: 200000 },
    bolt: {
      K: 0.158, muG: 0.10, muK: 0.12,
      classes: {
        "8.8": [["M4", 0.004, 3600], ["M6", 0.006, 8300], ["M8", 0.008, 15200], ["M10", 0.01, 24200],
                ["M12", 0.012, 35300], ["M14", 0.014, 48500], ["M16", 0.016, 66900], ["M20", 0.02, 105000]],
        "10.9": [["M4", 0.004, 5000], ["M6", 0.006, 11700], ["M8", 0.008, 21400], ["M10", 0.01, 34100],
                 ["M12", 0.012, 49700], ["M14", 0.014, 68300], ["M16", 0.016, 94100], ["M20", 0.02, 147000]]
      },
      colly: { Mv: 60, P: 1.5, dm: 9.03, muG: 0.15, Da: 13.5, muA: 0.125 }
    },
    fatigue: {
      ksf: 1, kl: 1, ksize: 1, Su: 414, Sa: 186, Sm: 186,
      materials: [
        { name: "Steel 1008, HR sheet", Su: 363, b: -0.143, Sf: 1109, NfHcf: 50000, c: -0.522, ef: 0.35, sf: 1225, E: 200000, NfLcf: 8000 },
        { name: "Steel 1015, normalized", Su: 414, b: -0.124, Sf: 811, NfHcf: 144000, c: -0.581, ef: 0.729, sf: 884, E: 207000, NfLcf: 530000 },
        { name: "Aluminum 6061-T6, forged", Su: 389, b: -0.094, Sf: 646, NfHcf: 50000, c: -0.67, ef: 0.35, sf: 689, E: 69000, NfLcf: 8560 }
      ]
    },
    uml: {
      groups: {
        structural: { label: "Structural steel (Byggstål, EN 13001-3-1 Tab. 2)", mats: [
          ["S315", 207000, 390], ["S355", 207000, 430], ["S420", 207000, 480],
          ["S500", 207000, 550], ["S600", 207000, 650], ["S700", 207000, 750]] },
        sheet: { label: "Sheet steel (Tunnplåt, Volvo STD 311-0002 min. Rm)", mats: [
          ["VSCR140", 207000, 270], ["VSCR180Y", 207000, 330], ["VSCR220Y", 207000, 340], ["VSCR260Y", 207000, 380],
          ["VSCR260LA", 207000, 350], ["VSCR340LA", 207000, 410], ["VSCR420LA", 207000, 470]] }
      },
      Nf: 20000, Ntable: [10, 100, 1000, 10000, 100000]
    },
    shore: { C1: 0.549, C2: 0.07516, C3: 0.025, mu: 0.45, R: 0.395, ShA: 65 },
    neuber: { a: { Re: 215, E: 70000, sigEl: 420 }, b: { Re: 456, E: 210000, eps: 0.0025 } },
    rom: [
      { name: "PP GF15", Ef: 72000, Em: 1700, fm: 0.15, rhoF: 2.5, rhoM: 0.946, matrix: "PP" },
      { name: "Grivory HT1V-65H", Ef: 72000, Em: 2760, fm: 0.65, rhoF: 2.5, rhoM: 1.15, matrix: "PA66" },
      { name: "PA6 GF30", Ef: 72000, Em: 970, fm: 0.3, rhoF: 2.5, rhoM: 1.14, matrix: "PA6" },
      { name: "PA6 GF50", Ef: 72000, Em: 970, fm: 0.5, rhoF: 2.5, rhoM: 1.14, matrix: "PA6" }
    ],
    twb: {
      p: { A1: 0.4, B1: 3.8, C1: 0.2, k1: 0.66, l1: 2.25, m1: 1.33, A2: 0.25, B2: 0.03, C2: 0.01, k2: 0.2, l2: 0.04, m2: 0.04 },
      geo: { rho: 0.5, t: 0.5, a: 2 }
    },
    damage: {
      k: 5, SD: 10, ND: 1e6,
      // block, n, s  (spreadsheet columns si1 / si2 / si3)
      rows: [[1, 10000, 15], [1, 3500, 18], [1, 2000, 20], [1, 1000, 24],
             [2, 13000, 14], [2, 4000, 20], [2, 2400, 22], [2, 1200, 27],
             [3, 12000, 10], [3, 3000, 13], [3, 2300, 17], [3, 1100, 22]]
    },
    lorentz: { c: 300000, beta: 0.97 }
  };
});
