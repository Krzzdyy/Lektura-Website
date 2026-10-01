/* ------------------------------------------------------------------
   Cube faces — drawn to match the logo (viewBox 0 0 100 100)
   Opposite faces share a colour, like the logo: ivory / orange / navy.
   Shared by the CSS cube (inline SVG) and the WebGL cube (textures).
------------------------------------------------------------------- */
export const NAVY = "#16293d";
export const ORANGE = "#e09b2d";
export const IVORY = "#f1f1ee";

export const FACES = {
  // Brand face — the serif "L"
  front: `
    <svg viewBox="0 0 100 100"><text class="fx" x="50" y="79" text-anchor="middle"
      font-family="DM Serif Display, Georgia, serif" font-size="76" fill="${NAVY}">L</text></svg>`,

  // AI generation — chat bubbles + spark (top of the logo)
  top: `
    <svg viewBox="0 0 100 100"><g class="fx">
      <rect x="12" y="28" width="46" height="36" rx="9" fill="${ORANGE}"/>
      <path d="M20 60 L15 75 L31 63 Z" fill="${ORANGE}"/>
      <rect x="34" y="40" width="54" height="38" rx="9" fill="${IVORY}"/>
      <rect x="46" y="53" width="30" height="4.5" rx="2.25" fill="${NAVY}"/>
      <rect x="52" y="63" width="24" height="4.5" rx="2.25" fill="${NAVY}"/>
      <path d="M80 10 Q82 19 91 21 Q82 23 80 32 Q78 23 69 21 Q78 19 80 10 Z" fill="${IVORY}"/>
    </g></svg>`,

  // Voice cloning — waveform (left of the logo)
  left: `
    <svg viewBox="0 0 100 100"><g class="fx">
      <rect x="17" y="38" width="8" height="24" rx="4" fill="${IVORY}"/>
      <rect x="31" y="25" width="8" height="50" rx="4" fill="${IVORY}"/>
      <rect x="45" y="18" width="8" height="64" rx="4" fill="${NAVY}"/>
      <rect x="59" y="31" width="8" height="38" rx="4" fill="${NAVY}"/>
      <rect x="73" y="40" width="8" height="20" rx="4" fill="${IVORY}"/>
    </g></svg>`,

  // Full editing — a slide with a selected element and a cursor
  back: `
    <svg viewBox="0 0 100 100"><g class="fx">
      <rect x="12" y="20" width="76" height="54" rx="5" fill="${NAVY}"/>
      <rect x="20" y="29" width="28" height="19" rx="2" fill="${ORANGE}"/>
      <rect x="16.5" y="25.5" width="35" height="26" fill="none" stroke="${IVORY}" stroke-width="1.2" stroke-dasharray="3 2"/>
      <rect x="15" y="24" width="3" height="3" fill="${IVORY}"/><rect x="50" y="24" width="3" height="3" fill="${IVORY}"/>
      <rect x="15" y="50" width="3" height="3" fill="${IVORY}"/><rect x="50" y="50" width="3" height="3" fill="${IVORY}"/>
      <rect x="57" y="30" width="24" height="4.5" rx="2.25" fill="${IVORY}"/>
      <rect x="57" y="39" width="17" height="3" rx="1.5" fill="${IVORY}" opacity=".55"/>
      <rect x="20" y="58" width="40" height="3" rx="1.5" fill="${IVORY}" opacity=".55"/>
      <rect x="20" y="64" width="28" height="3" rx="1.5" fill="${IVORY}" opacity=".55"/>
      <path d="M64 58 L64 86 L70.5 79.5 L75.5 90 L80 88 L75 77.5 L84 77.5 Z" fill="${ORANGE}" stroke="${IVORY}" stroke-width="1.8" stroke-linejoin="round"/>
    </g></svg>`,

  // Face animation cloning — a face inside scan brackets
  right: `
    <svg viewBox="0 0 100 100"><g class="fx">
      <path d="M15 31 V15 H31 M69 15 H85 V31 M85 69 V85 H69 M31 85 H15 V69" fill="none" stroke="${NAVY}"
        stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M27 81 Q29 64 50 64 Q71 64 73 81 Z" fill="${IVORY}"/>
      <circle cx="50" cy="42" r="18" fill="${IVORY}"/>
      <circle cx="43.5" cy="40" r="2.6" fill="${NAVY}"/>
      <circle cx="56.5" cy="40" r="2.6" fill="${NAVY}"/>
      <path d="M43 48.5 Q50 55 57 48.5" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M80 36 Q81.5 42 88 43.5 Q81.5 45 80 51 Q78.5 45 72 43.5 Q78.5 42 80 36 Z" fill="${IVORY}"/>
    </g></svg>`,

  // Classroom — graduation cap
  bottom: `
    <svg viewBox="0 0 100 100"><g class="fx">
      <path d="M28 47 V63 Q50 76 72 63 V47 L50 57 Z" fill="#cfd3d6"/>
      <polygon points="50,22 90,39 50,56 10,39" fill="${IVORY}"/>
      <path d="M50 39 L80 46 V66" fill="none" stroke="${ORANGE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="50" cy="39" r="3" fill="${ORANGE}"/>
      <rect x="76.5" y="64" width="7" height="12" rx="2.5" fill="${ORANGE}"/>
    </g></svg>`,
};

// Base colour of each face
export const FACE_BG = {
  front: IVORY, back: IVORY,
  left: ORANGE, right: ORANGE,
  top: NAVY, bottom: NAVY,
};
