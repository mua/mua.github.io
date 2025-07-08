/*  Markup Calculator — L2B version (monthly inputs)
    -------------------------------------------------
    S   : monthly searches
    L   : look-to-book (searches per booking)
    B   : avg. booking value (€)
    m0  : baseline markup %
    m1  : test markup %
    ks  : cost per 1 000 searches (€)
    kb  : cost per booking (€)
    elasL : optional; added looks per booking per +1pp markup
------------------------------------------------------------------- */

function pct(v)         { return v / 100; }          // % → decimal
function perThousand(v) { return v / 1000; }         // €/1k → €/1

document.getElementById('run').addEventListener('click', e => {
  e.preventDefault();

  // --- 1. Read inputs ------------------------------------------
  const S     = +document.getElementById('S').value;      // searches / month
  const L0    = +document.getElementById('L').value;      // baseline L2B
  const B     = +document.getElementById('B').value;      // €
  const m0    = +document.getElementById('m0').value;     // %
  const m1    = +document.getElementById('m1').value;     // %
  const ks    = +document.getElementById('ks').value;     // €/1k
  const kb    = +document.getElementById('kb').value;     // € per booking
  const elasL = +document.getElementById('elasL').value || 0; // ΔL per +1pp

  // --- 2. Adjust L2B for higher markup --------------------------
  const L1 = L0 + (m1 - m0) * elasL;                      // new look-to-book
  // guard against divide-by-zero
  const safeDiv = (num, den) => den ? num / den : 0;

  // --- 3. Bookings ---------------------------------------------
  const N0 = safeDiv(S, L0);   // baseline bookings
  const N1 = safeDiv(S, L1);   // test bookings

  // --- 4. Revenue ----------------------------------------------
  const R0 = N0 * B;
  const R1 = N1 * B;

  // --- 5. Costs -------------------------------------------------
  const C0 = (S * perThousand(ks)) + (N0 * kb);
  const C1 = (S * perThousand(ks)) + (N1 * kb);

  // --- 6. Markup revenue ---------------------------------------
  const G0 = R0 * pct(m0);
  const G1 = R1 * pct(m1);

  // --- 7. Contribution margin ----------------------------------
  const M0 = (G0 - C0) / R0;
  const M1 = (G1 - C1) / R1;

  // --- 8. Incremental margin € ---------------------------------
  const deltaEUR = (G1 - G0) - (C1 - C0);

     // --- 9. Output -----------------------------------------------
   const formatNumber = (num) => Math.round(num).toLocaleString('en-US');
   const formatEuro = (num) => `€${Math.round(num).toLocaleString('en-US')}`;
   const formatPercent = (num) => `${(num * 100).toFixed(2)}%`;
   
   document.getElementById('output').textContent =
`Monthly Performance:

Bookings (baseline):     ${formatNumber(N0)}
Bookings (test):         ${formatNumber(N1)}
Booking difference:      ${formatNumber(N1 - N0)}

Revenue Performance:
  • Baseline revenue:    ${formatEuro(R0)}
  • Test revenue:        ${formatEuro(R1)}

Contribution Margins:
  • Baseline ${m0}%:       ${formatPercent(M0)}
  • Test     ${m1}%:       ${formatPercent(M1)}

Bottom Line:
Extra margin / month:    ${formatEuro(deltaEUR)}`;
});
