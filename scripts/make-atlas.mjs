import { writeFile } from "node:fs/promises";

// Original explanatory drawings. These are not product photographs or scale models.
const styles = `<defs><linearGradient id="metal" x2=".5" y2="1"><stop stop-color="#708079"/><stop offset=".45" stop-color="#354840"/><stop offset="1" stop-color="#14241e"/></linearGradient><linearGradient id="lens" x2=".8" y2="1"><stop stop-color="#477267" stop-opacity=".35"/><stop offset="1" stop-color="#0d2020" stop-opacity=".7"/></linearGradient><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#9fc5b6" stroke-opacity=".035"/></pattern></defs><rect width="768" height="480" fill="#142320"/><rect width="768" height="480" fill="url(#grid)"/>`;
const round = (metal = true) =>
  `<g stroke="${metal ? "#a6b3a6" : "#4e6254"}" stroke-width="${metal ? 5 : 13}" fill="url(#lens)"><ellipse cx="258" cy="220" rx="90" ry="78"/><ellipse cx="509" cy="220" rx="90" ry="78"/><path d="M347 208q35-26 73 0M167 195h-21m454 0h21" fill="none"/></g><path d="m185 167 75-16-46 116m235-99 70-16-45 117" fill="#a1d9c810"/>`;
const browline = `<g fill="url(#lens)" stroke="#aab5a6" stroke-width="3"><path d="M171 183h170l-15 86q-4 27-69 29-69 0-78-35Z"/><path d="M427 183h170l-8 80q-9 35-78 35-65-2-69-29Z"/></g><path d="M157 177q93-30 191 0l-6 28q-85-23-171-1l-13 2Zm263 0q98-30 191 0l-1 29-13-2q-86-22-171 1Z" fill="url(#metal)" stroke="#738176"/><path d="M345 196q36-26 78 0" fill="none" stroke="#b3bfad" stroke-width="5"/>`;
const arms = `<path d="m157 180 81-71q10-9 25-5l65 14-6 15-62-8-80 74m431-19-81-71q-10-9-25-5l-65 14 6 15 62-8 80 74" fill="url(#metal)" stroke="#6a7f72" stroke-width="1.2"/>`;
const marker = (x, y, n) =>
  `<g><circle cx="${x}" cy="${y}" r="13" fill="#a6edc7"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="#123526" font-size="11" font-weight="bold" font-family="monospace">${n}</text></g>`;
const temple = `<path d="M191 374h326q29 0 37 20l12 32-22 7-13-29q-4-10-19-10H191Z" fill="url(#metal)" stroke="#708276"/><path d="M226 383h37m9 0h11" stroke="#a9bdac" stroke-width="2"/>`;
for (const kind of ["g1", "xreal", "mijia", "huawei"]) {
  let front, detail, markers;
  if (kind === "g1") {
    front =
      arms +
      round(false) +
      '<g fill="#92c4b05c" stroke="#b3e7c67a"><rect x="231" y="207" width="58" height="31" rx="6"/><rect x="479" y="207" width="58" height="31" rx="6"/></g>';
    detail =
      temple +
      '<path d="M478 373h40q29 0 37 21l12 32-23 7-14-30q-4-9-16-9h-36Z" fill="#566c5a" stroke="#9bab99"/><ellipse cx="514" cy="384" rx="18" ry="6" fill="#2c4233" stroke="#b5cab0"/>';
    markers =
      marker(278, 192, "1") + marker(495, 358, "2") + marker(570, 407, "3");
  } else if (kind === "xreal") {
    front =
      arms +
      '<path d="M147 158q108-25 201 1h73q93-26 201-1l-14 110q-7 36-96 34-82-2-89-48l-8-52h-63l-8 52q-7 46-89 48-89 2-96-34Z" fill="#192322" stroke="#7c8c7e" stroke-width="3"/><g fill="url(#lens)" stroke="#607b6f"><path d="M180 181h145l-12 78q-4 25-62 26-56 0-61-24Z"/><path d="M443 181h145l-10 80q-5 24-61 24-58-1-62-26Z"/></g><g fill="none" stroke="#94c7b488" stroke-width="5"><path d="M203 203h100l-8 48h-85Z"/><path d="M461 203h100l-7 48h-85Z"/></g>';
    detail =
      temple +
      '<rect x="530" y="397" width="23" height="11" rx="5" fill="#07130d" stroke="#a4b29e"/>';
    markers = marker(313, 253, "1") + marker(577, 397, "2");
  } else {
    front = arms + (kind === "mijia" ? browline : round(true));
    detail =
      temple +
      '<rect x="322" y="381" width="42" height="5" rx="2" fill="#081a10"/><g stroke="#718e7a" stroke-width="1"><path d="M326 381v5m5-5v5m5-5v5m5-5v5m5-5v5m5-5v5m5-5v5"/></g><g fill="#b0a46f"><circle cx="440" cy="385" r="3"/><circle cx="453" cy="385" r="3"/></g>';
    markers =
      marker(343, 359, "1") + marker(242, 359, "2") + marker(464, 410, "3");
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="480" viewBox="0 0 768 480">${styles}<g fill="#80aa94" font-family="monospace" font-size="10" letter-spacing="2"><text x="30" y="34">${kind.toUpperCase()} / FORM &amp; COMPONENTS</text><text x="30" y="345">TEMPLE DETAIL · SCHEMATIC</text></g>${front}<path d="M30 325h708" stroke="#85b09b33"/>${detail}${markers}<text x="30" y="462" fill="#779a87" font-family="monospace" font-size="8" letter-spacing="2">EXAMGUARD / ORIGINAL ILLUSTRATION · NOT TO SCALE</text></svg>`;
  await writeFile(`public/sample-${kind}.svg`, svg);
}
console.log("Generated four model-specific inspection diagrams.");
