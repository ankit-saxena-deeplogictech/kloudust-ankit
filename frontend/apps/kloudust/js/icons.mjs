/**
 * The console's icon set — the same 24px, stroke-only symbols the redesign
 * wireframes use, ported here as inline markup.
 *
 * Why inline and not <img src="img/*.svg"> or <use href="#i-x">:
 *  - The legacy img icons are multi-colour clipart with baked fills (one is
 *    pure white, invisible on a light page), so they need a filter to be
 *    readable and lose their colour anyway.
 *  - <use> resolves ids against the containing document, so a document-level
 *    sprite is invisible from inside a shadow root — table-list and form-runner
 *    could never reference it.
 * Inline markup with class="icon" sidesteps both: stroke is currentColor, so an
 * icon takes the colour of whatever it sits in, in either theme, anywhere.
 *
 * Usage:
 *   icons.svg("host")                 -> <svg class="icon" …>
 *   icons.svg("trash", "icon icon-sm")
 * Command lists name an icon with the "icon" key; "logo" (a file path) still
 * works and stays the fallback, so nothing has to migrate at once.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

const ICONS = {
    "activity": `<path d="M3 12h4l3-8 4 16 3-8h4"/>`,
    "admin": `<path d="M12 3 2.5 20h19z"/><path d="M12 9.5V14m0 3v.01"/>`,
    "automation": `<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>`,
    "balancer": `<circle cx="12" cy="4" r="2"/><path d="M12 6v3H5v5M12 9v5m0-5h7v5"/><circle cx="5" cy="16" r="2"/><circle cx="12" cy="16" r="2"/><circle cx="19" cy="16" r="2"/>`,
    "bell": `<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>`,
    "check": `<path d="m4 12.5 5 5L20 6.5"/>`,
    "check-circle": `<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9"/>`,
    "chevron-down": `<path d="m6 9 6 6 6-6"/>`,
    "chevron-left": `<path d="m15 6-6 6 6 6"/>`,
    "chevron-right": `<path d="m9 6 6 6-6 6"/>`,
    "clock": `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
    "clone": `<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 4H5a2 2 0 0 0-2 2v11"/>`,
    "columns": `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>`,
    "copy": `<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 5H5a2 2 0 0 0-2 2v10"/>`,
    "dashboard": `<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>`,
    "disk": `<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>`,
    "download": `<path d="M12 15V3m0 12-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>`,
    "edit": `<path d="M17 3.5 20.5 7 8 19.5 3.5 20.5 4.5 16z"/>`,
    "export": `<path d="M12 3v12m0-12L8 7m4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>`,
    "external": `<path d="M14 4h6v6M20 4 11 13M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>`,
    "eye": `<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12"/><circle cx="12" cy="12" r="2.8"/>`,
    "filter": `<path d="M3 5h18l-7 8v6l-4-2v-4z"/>`,
    "firewall": `<path d="M12 3l8 3v6c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>`,
    "help": `<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8v.5M12 17v.01"/>`,
    "host": `<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>`,
    "image": `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>`,
    "info": `<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>`,
    "ip": `<circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>`,
    "kebab": `<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>`,
    "key": `<circle cx="8" cy="15" r="4.5"/><path d="m11.5 11.5 8-8M17 6l2.5 2.5M14 9l2 2"/>`,
    "link": `<path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.3-1.3"/>`,
    "mail": `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>`,
    "menu": `<path d="M4 6h16M4 12h16M4 18h16"/>`,
    "migrate": `<path d="M3 8h14m0 0-3.5-3.5M17 8l-3.5 3.5M21 16H7m0 0 3.5-3.5M7 16l3.5 3.5"/>`,
    "network": `<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5V13m0 0-5.5 4M12 13l5.5 4"/>`,
    "pause": `<path d="M9 5v14M15 5v14"/>`,
    "play": `<path d="M7 4.5v15l12-7.5z"/>`,
    "plus": `<path d="M12 5v14M5 12h14"/>`,
    "power": `<path d="M12 3v8"/><path d="M7 6a8 8 0 1 0 10 0"/>`,
    "projects": `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
    "reboot": `<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4"/>`,
    "refresh": `<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4"/>`,
    "resize": `<path d="M4 20h6m-6 0v-6m0 6L20 4m0 0h-6m6 0v6"/>`,
    "router": `<rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 16.5h.01M11 16.5h.01M17 9V5m0 4-2.5-2.5M17 9l2.5-2.5"/>`,
    "search": `<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`,
    "shell": `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3M12 15h6"/>`,
    "snapshot": `<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 7 1.5-2.5h5L16 7"/><circle cx="12" cy="13" r="3.5"/>`,
    "sort": `<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>`,
    "stop": `<rect x="6" y="6" width="12" height="12" rx="1.5"/>`,
    "tasks": `<path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-7 7-2 2m11 0-2-2m-7-7-2-2"/>`,
    "theme": `<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9"/>`,
    "trash": `<path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v6M14 11v6"/>`,
    "upload": `<path d="M12 3v12M12 3 8 7m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>`,
    "user": `<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>`,
    "users": `<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5a6.5 6.5 0 0 1 13 0M16 5.5a3.5 3.5 0 0 1 0 6.6M21.5 19.5a6.5 6.5 0 0 0-4.5-6"/>`,
    "vm": `<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>`,
    "warn": `<path d="M12 3 2.5 20h19z"/><path d="M12 10v4m0 3v.01"/>`,
    "wrench": `<path d="M20 5.5a5 5 0 0 1-6.6 6.4L5.6 19.7a2 2 0 0 1-2.8-2.8l7.8-7.8A5 5 0 0 1 17 2.5z"/>`,
    "x": `<path d="M6 6l12 12M18 6 6 18"/>`,
    "x-circle": `<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6m0-6-6 6"/>`
};

/**
 * Returns inline SVG markup for a named icon.
 * @param {string} name The icon name, e.g. "host"
 * @param {string} cssClass Optional class, defaults to "icon"
 * @returns The markup, or "" when the name is unknown so callers can fall back
 */
function svg(name, cssClass="icon") {
    const inner = ICONS[name]; if (!inner) return "";
    return `<svg class="${cssClass}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

const has = name => Object.prototype.hasOwnProperty.call(ICONS, name);
const names = _ => Object.keys(ICONS);

export const icons = {svg, has, names};
