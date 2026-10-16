// Illustraties voor de zones, als inline SVG zodat er geen afbeeldingsbestanden nodig zijn.
// Ze vullen de hele zone (slice) en worden gedimd achter de kaarten getoond.

const svg = (body: string) =>
  `<svg viewBox="0 0 340 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const stars = (n: number, seed: number, maxY: number) =>
  Array.from({ length: n }, (_, i) => {
    const x = (seed * (i + 3) * 97) % 340;
    const y = (seed * (i + 7) * 53) % maxY;
    const r = ((i * 7) % 3) * 0.4 + 0.6;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.4 + ((i * 13) % 6) / 10}"/>`;
  }).join('');

const wachttoren = svg(`
  <defs>
    <linearGradient id="wt-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a1035"/>
      <stop offset="0.55" stop-color="#4a2a5a"/>
      <stop offset="0.85" stop-color="#c0603a"/>
      <stop offset="1" stop-color="#e8a050"/>
    </linearGradient>
    <radialGradient id="wt-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffd27a" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#ffd27a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="340" height="420" fill="url(#wt-sky)"/>
  ${stars(40, 31, 220)}
  <circle cx="255" cy="80" r="26" fill="#fff4d6"/>
  <circle cx="265" cy="74" r="24" fill="#3a2350" opacity="0.35"/>
  <path d="M0 330 Q60 290 120 315 T240 300 T340 320 V420 H0Z" fill="#2b1838"/>
  <path d="M0 360 Q80 330 160 352 T340 345 V420 H0Z" fill="#1c1026"/>
  <g fill="#120a18">
    <rect x="130" y="150" width="80" height="230"/>
    <rect x="124" y="132" width="92" height="22"/>
    <rect x="124" y="116" width="14" height="18"/><rect x="150" y="116" width="14" height="18"/>
    <rect x="176" y="116" width="14" height="18"/><rect x="202" y="116" width="14" height="18"/>
    <rect x="168" y="70" width="3" height="48"/>
    <path d="M171 72 L200 80 L171 90Z" fill="#7a1f2b"/>
    <path d="M100 380 L130 300 L130 380Z"/><path d="M240 380 L210 300 L210 380Z"/>
  </g>
  <circle cx="170" cy="200" r="34" fill="url(#wt-glow)"/>
  <path d="M160 214 V196 Q170 182 180 196 V214Z" fill="#ffcf6b"/>
  <circle cx="170" cy="275" r="22" fill="url(#wt-glow)" opacity="0.7"/>
  <rect x="164" y="266" width="12" height="18" rx="6" fill="#ffb84d"/>
`);

const elfenwoud = svg(`
  <defs>
    <linearGradient id="ew-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d2b22"/>
      <stop offset="0.6" stop-color="#174a35"/>
      <stop offset="1" stop-color="#0a1f17"/>
    </linearGradient>
    <linearGradient id="ew-ray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6ffd0" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#e6ffd0" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="ew-fly" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fffbb0"/>
      <stop offset="0.4" stop-color="#d4ff6a" stop-opacity="0.8"/>
      <stop offset="1" stop-color="#d4ff6a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="340" height="420" fill="url(#ew-bg)"/>
  <g fill="#1f5c42" opacity="0.7">
    <path d="M20 330 L60 150 L100 330Z"/><path d="M90 330 L140 120 L190 330Z"/>
    <path d="M200 330 L245 140 L290 330Z"/><path d="M270 330 L320 170 L360 330Z"/>
  </g>
  <path d="M120 0 L170 0 L230 420 L110 420Z" fill="url(#ew-ray)"/>
  <path d="M210 0 L235 0 L300 420 L240 420Z" fill="url(#ew-ray)" opacity="0.7"/>
  <path d="M40 0 L60 0 L90 420 L40 420Z" fill="url(#ew-ray)" opacity="0.5"/>
  <g fill="#0b2419">
    <path d="M-20 420 L30 170 L80 420Z"/><path d="M-10 300 L30 120 L70 300Z"/>
    <path d="M250 420 L310 150 L370 420Z"/><path d="M265 300 L310 100 L355 300Z"/>
    <rect x="25" y="380" width="10" height="40"/><rect x="305" y="380" width="10" height="40"/>
  </g>
  <path d="M0 395 Q85 375 170 392 T340 388 V420 H0Z" fill="#081a12"/>
  ${[[70, 250], [150, 200], [215, 290], [260, 220], [120, 330], [190, 150], [95, 140], [240, 360]]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${7 + (i % 3) * 2}" fill="url(#ew-fly)"/>`)
    .join('')}
`);

const kristalgrot = svg(`
  <defs>
    <radialGradient id="kg-bg" cx="0.5" cy="0.55" r="0.7">
      <stop offset="0" stop-color="#2a1d52"/>
      <stop offset="0.6" stop-color="#140d2e"/>
      <stop offset="1" stop-color="#07040f"/>
    </radialGradient>
    <linearGradient id="kg-c1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#b8fbff"/>
      <stop offset="1" stop-color="#1a9fc0"/>
    </linearGradient>
    <linearGradient id="kg-c2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffc4f6"/>
      <stop offset="1" stop-color="#9c27b0"/>
    </linearGradient>
    <radialGradient id="kg-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#7fe8ff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#7fe8ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="340" height="420" fill="url(#kg-bg)"/>
  <ellipse cx="170" cy="300" rx="170" ry="120" fill="url(#kg-glow)"/>
  <path d="M0 0 H340 V60 L320 110 L300 60 L280 90 L255 50 L230 120 L210 55 L185 85 L160 45 L140 105
           L115 50 L95 80 L70 40 L45 115 L25 55 L0 90Z" fill="#0a0618"/>
  <g stroke="#ffffff" stroke-opacity="0.35" stroke-width="1">
    <path d="M60 400 L80 280 L100 400Z" fill="url(#kg-c1)"/>
    <path d="M85 400 L110 300 L125 400Z" fill="url(#kg-c2)"/>
    <path d="M140 400 L170 230 L200 400Z" fill="url(#kg-c1)"/>
    <path d="M190 400 L215 310 L235 400Z" fill="url(#kg-c2)"/>
    <path d="M230 400 L265 260 L290 400Z" fill="url(#kg-c1)"/>
    <path d="M20 400 L35 330 L50 400Z" fill="url(#kg-c2)"/>
    <path d="M285 400 L305 335 L325 400Z" fill="url(#kg-c2)"/>
    <path d="M270 140 L285 100 L295 150Z" fill="url(#kg-c1)" opacity="0.7"/>
    <path d="M40 170 L52 135 L62 175Z" fill="url(#kg-c2)" opacity="0.7"/>
  </g>
  <path d="M0 400 Q170 380 340 400 V420 H0Z" fill="#05030b"/>
  ${stars(18, 17, 300).replace(/#fff/g, '#a8f0ff')}
`);


const drakennest = svg(`
  <defs>
    <linearGradient id="dn-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a0606"/>
      <stop offset="0.6" stop-color="#4a120c"/>
      <stop offset="1" stop-color="#a8320f"/>
    </linearGradient>
    <linearGradient id="dn-lava" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe082"/>
      <stop offset="0.5" stop-color="#ff7a1a"/>
      <stop offset="1" stop-color="#b71c1c"/>
    </linearGradient>
    <radialGradient id="dn-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ff9a3c" stop-opacity="0.8"/>
      <stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="340" height="420" fill="url(#dn-sky)"/>
  <circle cx="170" cy="150" r="120" fill="url(#dn-glow)" opacity="0.6"/>
  <path d="M40 420 L140 140 L160 155 L180 135 L200 150 L300 420Z" fill="#1c0a08"/>
  <path d="M150 150 Q160 230 140 300 Q170 330 160 420 L185 420 Q195 330 180 290 Q200 220 185 145Z" fill="url(#dn-lava)"/>
  <g fill="#ffb74d" opacity="0.8">
    <circle cx="165" cy="110" r="5"/><circle cx="150" cy="80" r="3"/><circle cx="185" cy="90" r="4"/><circle cx="172" cy="55" r="2.5"/>
  </g>
  <g fill="#0c0403">
    <path d="M230 120 Q260 95 295 110 Q275 112 268 125 Q300 125 320 145 Q285 140 270 150 Q258 138 230 120Z"/>
    <path d="M60 70 Q80 55 105 62 Q92 66 88 74 Q110 74 122 86 Q98 84 88 90 Q80 80 60 70Z" opacity="0.8"/>
  </g>
  <path d="M0 380 Q90 360 170 385 T340 375 V420 H0Z" fill="#120504"/>
`);

const spookmoeras = svg(`
  <defs>
    <linearGradient id="sm-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1a1c"/>
      <stop offset="0.6" stop-color="#1d3a36"/>
      <stop offset="1" stop-color="#0a1614"/>
    </linearGradient>
    <linearGradient id="sm-fog" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c8f5e6" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#c8f5e6" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#c8f5e6" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="sm-wisp" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#e0fff4"/>
      <stop offset="0.4" stop-color="#7fffd4" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#7fffd4" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="340" height="420" fill="url(#sm-bg)"/>
  <circle cx="90" cy="70" r="22" fill="#e8f5e9" opacity="0.8"/>
  <g fill="#081210">
    <path d="M40 420 L48 220 Q30 190 10 185 Q40 180 52 200 L55 150 Q70 175 62 210 Q85 190 105 195 Q75 205 64 235 L70 420Z"/>
    <path d="M250 420 L258 180 Q240 150 215 150 Q248 140 262 165 L268 110 Q285 140 272 180 Q300 160 325 168 Q290 178 276 205 L282 420Z"/>
    <path d="M140 420 L146 300 Q132 285 118 285 Q140 276 150 292 L155 260 Q166 280 158 300 L162 420Z"/>
  </g>
  <rect x="0" y="250" width="340" height="40" fill="url(#sm-fog)"/>
  <rect x="-60" y="320" width="400" height="50" fill="url(#sm-fog)"/>
  <path d="M0 380 Q60 370 120 382 T240 378 T340 385 V420 H0Z" fill="#0d2420"/>
  <ellipse cx="200" cy="395" rx="70" ry="8" fill="#3d7a6a" opacity="0.4"/>
  ${[[110, 240], [205, 300], [300, 260], [170, 200]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${8 + i * 2}" fill="url(#sm-wisp)"/>`).join('')}
  <g fill="#050a09"><path d="M190 110 l8 -6 l8 6 l-8 -2Z"/><path d="M225 135 l6 -5 l6 5 l-6 -2Z"/></g>
`);

const zonnetempel = svg(`
  <defs>
    <linearGradient id="zt-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b6fb0"/>
      <stop offset="0.6" stop-color="#f2b25c"/>
      <stop offset="1" stop-color="#f7d58b"/>
    </linearGradient>
    <radialGradient id="zt-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fffbe6"/>
      <stop offset="0.35" stop-color="#ffe28a"/>
      <stop offset="1" stop-color="#ffe28a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="340" height="420" fill="url(#zt-sky)"/>
  <circle cx="170" cy="120" r="110" fill="url(#zt-sun)"/>
  <g stroke="#fff3c4" stroke-width="3" opacity="0.5">
    ${Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      return `<line x1="${170 + Math.cos(a) * 50}" y1="${120 + Math.sin(a) * 50}" x2="${170 + Math.cos(a) * 95}" y2="${120 + Math.sin(a) * 95}"/>`;
    }).join('')}
  </g>
  <path d="M0 330 Q85 300 170 320 T340 310 V420 H0Z" fill="#c98a3c"/>
  <g fill="#7a4a1c">
    <path d="M70 200 L170 150 L270 200Z"/>
    <rect x="80" y="200" width="180" height="14"/>
    <rect x="92" y="214" width="16" height="120"/><rect x="132" y="214" width="16" height="120"/>
    <rect x="192" y="214" width="16" height="120"/><rect x="232" y="214" width="16" height="120"/>
    <rect x="70" y="334" width="200" height="12"/><rect x="60" y="346" width="220" height="12"/>
  </g>
  <rect x="155" y="240" width="30" height="94" rx="15" fill="#ffe9a8" opacity="0.8"/>
  <path d="M0 380 Q170 360 340 382 V420 H0Z" fill="#a86f2c"/>
`);

/** Illustratie per zonenaam (zie ZONE_NAMES in game/zones.ts). */
export const ZONE_ART: Record<string, string> = {
  Wachttoren: wachttoren,
  Elfenwoud: elfenwoud,
  Kristalgrot: kristalgrot,
  Drakennest: drakennest,
  Spookmoeras: spookmoeras,
  Zonnetempel: zonnetempel,
};
