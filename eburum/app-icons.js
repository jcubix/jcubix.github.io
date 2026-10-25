// Small outline icons for the isolated domain HTML surfaces.
const paths = {
  check: '<path d="m20 6-11 11-5-5"/>',
  minus: '<path d="M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  arrowUp: '<path d="M7 17 17 7M7 7h10v10"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  substitution: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 6H9l-2-6 5-4Zm0-4v4M3 12l4-1M6 20l3-3m9 3-3-3m6-5-4-1"/>',
  card: '<rect x="6" y="3" width="12" height="18" rx="2"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  checks: '<path d="m18 6-7 7-3-3M22 10l-7 7-3-3M2 12l3 3 4-4"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  clipboard:
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M8 11h8M8 16h8"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6"/>',
  shield:
    '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11m-4-11 3 3 5-5"/>',
  flag: '<path d="M4 22V3m0 1c4-3 8 3 12 0v10c-4 3-8-3-12 0"/>',
};
function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
}
export { icon };
