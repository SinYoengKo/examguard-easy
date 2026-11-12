import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const common = `<defs>
  <radialGradient id="bg"><stop stop-color="#1b3335"/><stop offset="1" stop-color="#0c161e"/></radialGradient>
  <linearGradient id="metal" x2=".2" y2="1"><stop stop-color="#647277"/><stop offset=".18" stop-color="#222d32"/><stop offset=".64" stop-color="#0c1519"/><stop offset="1" stop-color="#48545a"/></linearGradient>
  <linearGradient id="lens" x2=".7" y2="1"><stop stop-color="#6fada5" stop-opacity=".35"/><stop offset=".45" stop-color="#1a3038" stop-opacity=".5"/><stop offset="1" stop-color="#8dbbab" stop-opacity=".16"/></linearGradient>
  <linearGradient id="temple" x2="0" y2="1"><stop stop-color="#526267"/><stop offset=".4" stop-color="#1a282f"/><stop offset="1" stop-color="#10191e"/></linearGradient>
  <filter id="shadow"><feGaussianBlur stdDeviation="12"/></filter>
  <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#769e9014" stroke-width=".6"/></pattern>
</defs><rect width="768" height="480" fill="url(#bg)"/><rect width="768" height="480" fill="url(#grid)"/><ellipse cx="384" cy="338" rx="240" ry="29" fill="#03090d" opacity=".7" filter="url(#shadow)"/>`;
for (const kind of ["camera", "display", "normal", "audio"]) {
  const thin = kind === "display";
  const frame = thin
    ? `
    <path d="M156 205 230 130q22-16 48-7l12 6-7 9-20-5q-10-3-20 6l-70 73M612 205 538 130q-22-16-48-7l-12 6 7 9 20-5q10-3 20 6l70 73" fill="url(#temple)" stroke="#7b8a83" stroke-width="2"/>
    <path d="M164 205q-20 74 22 104 24 16 72 9 75-7 79-88 0-39-80-38-55-2-93 13ZM604 205q20 74-22 104-24 16-72 9-75-7-79-88 0-39 80-38 55-2 93 13Z" fill="url(#lens)" stroke="#9aa69a" stroke-width="4"/>
    <path d="M337 224q47-36 94 0" fill="none" stroke="#b1b6a7" stroke-width="4"/>
    <path d="M183 216h132v70H183zM453 216h132v70H453z" fill="#7fd7a30d" stroke="#93d4af66" stroke-width="1.3"/>
    <path d="M197 231h103m-103 7h103m-103 7h103m-103 7h103m-103 7h103M467 231h103m-103 7h103m-103 7h103m-103 7h103m-103 7h103" stroke="#83c69933" stroke-width="1"/>
    <circle cx="258" cy="133" r="3" fill="#c8b984"/><circle cx="510" cy="133" r="3" fill="#c8b984"/>`
    : `
    <path d="M145 211 226 120q14-17 35-9l44 15-3 12-44-8q-9-3-15 7l-67 86M623 211 542 120q-14-17-35-9l-44 15 3 12 44-8q9-3 15 7l67 86" fill="url(#temple)" stroke="#516267" stroke-width="1.5"/>
    <path d="M139 204q50-22 113-21 78 0 101 26h62q23-26 101-26 63-1 113 21l-1 31-20 5q-6 68-44 86-35 17-91 1-33-8-47-77-5-19-19-19h-46q-14 0-19 19-14 69-47 77-56 16-91-1-38-18-44-86l-20-5Z" fill="url(#metal)" stroke="#607175" stroke-width="1.5"/>
    <path d="M174 219q38-14 83-12 57 1 67 24-7 65-29 79-29 17-76 4-35-9-45-95ZM594 219q-38-14-83-12-57 1-67 24 7 65 29 79 29 17 76 4 35-9 45-95Z" fill="url(#lens)" stroke="#83988f55" stroke-width="1"/>
    <path d="m194 223 80-10-51 93M461 231l71-15-42 95" fill="#c6e9dd08"/>
    <path d="M192 216q54-14 91-3M485 213q38-11 91 3" fill="none" stroke="#c5ded544" stroke-width="1.5"/>
    ${kind === "camera" ? '<circle cx="156" cy="221" r="10" fill="#070d12" stroke="#8caaa0" stroke-width="1.5"/><circle cx="156" cy="221" r="5.5" fill="#1b4350"/><circle cx="154" cy="219" r="2.5" fill="#e4faf6"/><circle cx="612" cy="221" r="7" fill="#d2dbd3"/><circle cx="611" cy="220" r="2" fill="#fff"/>' : '<path d="M147 218h12M609 218h12" stroke="#9caaa3" stroke-width="3"/>'}
    ${kind === "audio" ? '<path d="m215 152 16 7m-22-1 16 7m-22-1 16 7m340-19-16 7m22-1-16 7m22-1-16 7" stroke="#8fa99b" stroke-width="2"/><circle cx="246" cy="129" r="3" fill="#d1bc83"/><circle cx="255" cy="132" r="3" fill="#d1bc83"/>' : ""}`;
  const annotations =
    kind === "camera"
      ? '<g fill="none" stroke="#8be5bc" stroke-width=".8" opacity=".65"><circle cx="156" cy="221" r="18"/><path d="M141 209 108 180H63"/><circle cx="612" cy="221" r="15"/><path d="m624 211 35-31h46"/></g><g fill="#8ebfa8" font-size="8" font-family="monospace"><text x="65" y="173">FRONT COMPONENT</text><text x="641" y="173">INDICATOR</text></g>'
      : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="480" viewBox="0 0 768 480">${common}${frame}${annotations}<g fill="#638777" font-size="8" letter-spacing="2" font-family="monospace"><text x="30" y="444">EXAMGUARD / REFERENCE ILLUSTRATION</text><text x="639" y="444">${kind.toUpperCase()}</text></g></svg>`;
  await writeFile(`public/sample-${kind}.svg`, svg);
}
const logo =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#10241e"/><path d="m256 107 119 45v104c0 77-119 145-119 145s-119-68-119-145V152l119-45Z" fill="none" stroke="#96e5c3" stroke-width="19" stroke-linejoin="round"/><path d="m199 252 39 39 78-85" fill="none" stroke="#96e5c3" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/></svg>';
await writeFile("public/icon.svg", logo);
execFileSync("python3", [
  "-c",
  "import cairosvg; [cairosvg.svg2png(url='public/icon.svg',write_to=f'public/icon-{n}.png',output_width=n,output_height=n) for n in (192,512)]",
]);
const samples = [];
for (const [key, name, readings] of [
  [
    "demo-device-a",
    "가상 기기 A",
    [
      ["창가", [-54, -57, -55, -56, -55]],
      ["가운데", [-71, -73, -70, -72, -73]],
      ["복도 쪽", [-85, -83, -86, -84, -85]],
    ],
  ],
  [
    "demo-device-b",
    "가상 기기 B",
    [
      ["창가", [-81, -84, -83]],
      ["가운데", [-77, -78, -75]],
      ["복도 쪽", [-60, -63, -62]],
    ],
  ],
])
  for (const [zone, values] of readings)
    for (const rssi of values)
      samples.push({
        deviceKey: key,
        name,
        zone,
        rssi,
        timestamp: new Date(
          Date.UTC(2026, 10, 7, 0, 0, samples.length * 2),
        ).toISOString(),
      });
await writeFile(
  "public/radio-example.json",
  JSON.stringify(
    {
      schema: "examguard.radio.v1",
      source: "ExamGuard training fixture",
      isDemo: true,
      samples,
    },
    null,
    2,
  ),
);
console.log(
  "Generated four reference illustrations, PWA icons, and a labelled training fixture.",
);
