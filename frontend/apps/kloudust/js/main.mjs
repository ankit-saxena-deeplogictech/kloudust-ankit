/**
 * Post login main page support. 
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {cmdlist} from "./cmdlist.mjs";
import {cmdmanager as cmdman} from "./cmdmanager.mjs";

const LEFTBAR_COMMANDS = `${APP_CONSTANTS.FORMS_PATH}/main_leftbar.json`,
    MAIN_COMMANDS = `${APP_CONSTANTS.FORMS_PATH}/main_content.json`;

// Must stay in step with the .drawer transition in css/components.css
const DRAWER_ANIMATION_MS = 220, TOAST_MS = 6000, TOAST_ERROR_MS = 15000,
    TOAST_TYPES = ["success", "error", "info"], SVG_NS = "http://www.w3.org/2000/svg";

let _hostingDiv, _initialContentTemplate, _closingClass, _animationWait, _lastFocusBeforeDrawer;

/**
 * Registers the hosting DIV which will host all content
 * @param {element} div The hosting DIV
 * @param {element} initialContentTemplate HTML5 template element hosting initial content
 * @param {string} closingClass Optional: The class to add when closing (useful for effects)
 * @param {number} animationWait Optional: The wait time for the animation (useful for effects)
 */
function registerHostingDivAndInitialContentTemplate(div, initialContentTemplate, closingClass, animationWait=0) {
    _hostingDiv = div; _initialContentTemplate = initialContentTemplate; _closingClass = closingClass; _animationWait = animationWait;
}

/**
 * Shows the given content. Must be either HTML string or
 * a DOM subtree of nodes. If no content given then same as 
 * hiding and going back to home content.
 * @param {string|Object} contentNode The content to show
 * @param {boolean} disableAnimation Whether to disable animation, default is false
 */
function showContent(contentNode, disableAnimation=false) { 
    if (!_hostingDiv) {LOG.error(`Asked to show content but no hosting DIV is registered`); return;}
    if (_closingClass && (!disableAnimation)) _hostingDiv.classList.add(_closingClass);
    const _refreshWithNewContent = _ => {
        $$.libutil.removeAllChildElements(_hostingDiv); 
        const content = contentNode ? (typeof contentNode === "string" ? _getHTMLNodesToInsert(contentNode) : contentNode) : 
            _initialContentTemplate.content.cloneNode(true);
        _hostingDiv.appendChild(content);
        if (_closingClass && (!disableAnimation)) _hostingDiv.classList.remove(_closingClass);
    }
    if (_animationWait && (!disableAnimation)) setTimeout(_refreshWithNewContent, _animationWait); else _refreshWithNewContent();
}

/**
 * Hides open content
 * @param {boolean} disableAnimation Whether to disable animation, default is false
 */
function hideOpenContent(disableAnimation) {showContent(undefined, disableAnimation);}

/* --------------------------------------------------------------------- drawer */

/**
 * Mounts content into the shared slide-over. Unlike showContent this leaves the
 * page underneath in the DOM, so a list keeps its filter, sort, page and
 * selection while a short form runs over it.
 * @param {string|Object} contentNode HTML string or DOM subtree
 * @param {string} title Heading for the drawer; the content should be rendered
 *                 embedded so it does not repeat its own heading
 */
function openDrawer(contentNode, title) {
    const drawer = document.querySelector("#drawer"), overlay = document.querySelector("#drawer_overlay");
    const body = document.querySelector("#drawer_body"); if (!drawer || !body) return;

    $$.libutil.removeAllChildElements(body);
    body.appendChild(typeof contentNode === "string" ? _getHTMLNodesToInsert(contentNode) : contentNode);
    document.querySelector("#drawer_title").textContent = title || "";
    overlay.classList.add("open"); drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false");
    _lastFocusBeforeDrawer = document.activeElement;
    // Wait out the slide-in before focusing, else the browser scrolls the panel.
    setTimeout(_ => drawer.querySelector("input:not([type=hidden]), select, textarea, button")?.focus(), DRAWER_ANIMATION_MS);
}

/**
 * Closes the slide-over if it is open.
 * @returns true if a drawer was actually open and got closed
 */
function closeDrawer() {
    const drawer = document.querySelector("#drawer"), overlay = document.querySelector("#drawer_overlay");
    if (!drawer?.classList.contains("open")) return false;

    drawer.classList.remove("open"); overlay?.classList.remove("open"); drawer.setAttribute("aria-hidden", "true");
    // Empty it only after the slide-out, so the content does not vanish mid-animation.
    setTimeout(_ => {if (!drawer.classList.contains("open")) $$.libutil.removeAllChildElements(document.querySelector("#drawer_body"));},
        DRAWER_ANIMATION_MS);
    if (_lastFocusBeforeDrawer?.isConnected) _lastFocusBeforeDrawer.focus();
    _lastFocusBeforeDrawer = null;
    return true;
}

const isDrawerOpen = _ => document.querySelector("#drawer")?.classList.contains("open") === true;

/* ---------------------------------------------------------------------- toasts */

/**
 * Shows a transient outcome. The alerts stack remains the durable log — this is
 * only the immediate signal, so it never carries information found nowhere else.
 * @param {string} message The message, treated as text and never as HTML
 * @param {string} type "success" | "error" | "info", default "info"
 */
function toast(message, type="info") {
    const region = document.querySelector("#toast_region"); if (!region || !message) return;

    const element = document.createElement("div");
    element.className = `toast ${TOAST_TYPES.includes(type) ? type : "info"}`;
    element.appendChild(_toastIcon(type));
    const text = document.createElement("div"); text.textContent = message; element.appendChild(text);

    const dismiss = document.createElement("button");
    dismiss.className = "close"; dismiss.setAttribute("aria-label", "Dismiss");
    dismiss.textContent = "✕";
    dismiss.onclick = _ => element.remove();
    element.appendChild(dismiss);

    region.appendChild(element);
    setTimeout(_ => element.remove(), type == "error" ? TOAST_ERROR_MS : TOAST_MS);
}

function _toastIcon(type) {
    const paths = {success: "M20 6 9 17l-5-5", error: "M18 6 6 18M6 6l12 12"};
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "icon"); svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", paths[type] || "M12 8v.01M12 11v5");
    svg.appendChild(path);
    if (!paths[type]) {   // info gets a ring around the glyph
        const circle = document.createElementNS(SVG_NS, "circle");
        circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "9");
        svg.appendChild(circle);
    }
    return svg;
}

/** Plugs in our data interceptor which loads initial main and leftbar contents */
const interceptPageLoadData = _ => $$.librouter.addOnLoadPageData(APP_CONSTANTS.MAIN_HTML, async (data, _url) => {
    const mustache = await $$.librouter.getMustache(), mainPageData = {};
    mainPageData.welcomeHeading = mustache.render(await $$.libi18n.get("WelcomeHeading"), {user: $$.libsession.get(APP_CONSTANTS.USERNAME)});
    const leftbar = await cmdlist.fetchCommandsWithGroups(LEFTBAR_COMMANDS);
    mainPageData.leftbarCommands = leftbar.commands;
    mainPageData.leftbarGroups = _groupCommands(leftbar.commands, leftbar.groups);
    mainPageData.mainCommands = await cmdlist.fetchCommands(MAIN_COMMANDS);

    const seenPaletteIDs = new Set(); mainPageData.paletteCommands = [];
    for (const command of [...mainPageData.leftbarCommands, ...mainPageData.mainCommands])
        if (!seenPaletteIDs.has(command.id)) {seenPaletteIDs.add(command.id); mainPageData.paletteCommands.push(command);}

    const username = String($$.libsession.get(APP_CONSTANTS.USERNAME)||"");
    mainPageData.username = username;
    mainPageData.userInitials = username.split(/\s+/).filter(word=>word).slice(0,2).map(word=>word[0].toUpperCase()).join("") || "?";
    mainPageData.userrole = await _roleLabel();
    mainPageData.alertcount = Object.keys(cmdman.getAlerts()).length;
    const projectsLookupResult = await window.monkshu_env.frameworklibs.apimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 
        'POST', {cmd: 'getUserProjects'}, true);
    mainPageData.userprojects = projectsLookupResult?projectsLookupResult.projects:[];

    const selectedProject = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT) || mainPageData.userprojects[0]?.name;
    const selectProjectIndex = mainPageData.userprojects.findIndex(prj=>prj.name==selectedProject);
    if (selectProjectIndex != -1) mainPageData.userprojects[selectProjectIndex].selected = true;
    $$.libsession.set(APP_CONSTANTS.ACTIVE_PROJECT, selectedProject);

    data.mainPageData = mainPageData;
    
    for (const cmd of [...mainPageData.leftbarCommands, ...mainPageData.mainCommands]) try{
        cmdman.registerCommand(cmd); } catch (err) {LOG.error(`Error registering command ${cmd.id}.`);}
});

function activeProjectChanged(new_project) {
    $$.libsession.set(APP_CONSTANTS.ACTIVE_PROJECT, new_project);
}

/** The signed-in role, as a display string. Read straight off the session — this
 *  is what rolemanager already gates the whole UI on, so it is never a guess. */
async function _roleLabel() {
    const role = String($$.libsession.get(APP_CONSTANTS.LOGGEDIN_USEROLE)||"").toLowerCase();
    const keys = {[APP_CONSTANTS.KLOUDUST_ROLES.cloudadmin]: "RoleCloudadmin",
        [APP_CONSTANTS.KLOUDUST_ROLES.orgadmin]: "RoleOrgadmin",
        [APP_CONSTANTS.KLOUDUST_ROLES.user]: "RoleUser"};
    return keys[role] ? await $$.libi18n.get(keys[role]) : "";
}

/** Buckets commands into the ordered "groups" declared by the list file.
 *  No groups declared -> one unlabeled group (legacy flat sidebar). */
function _groupCommands(commands, groupDefs) {
    if (!groupDefs || !groupDefs.length) return [{items: commands}];
    const groups = groupDefs.map(groupDef => ({...groupDef, items: []}));
    for (const command of commands) {
        const group = groups.find(candidate => candidate.id == command.group) || groups[0];
        group.items.push(command);
    }
    return groups.filter(group => group.items.length);
}

/** Wires document-level shell interactions: command palette shortcut and menu dismissal */
function initShell() {
    document.addEventListener("keydown", event => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() == "k") {event.preventDefault(); togglePalette(true);}
        if (event.key != "Escape") return;
        // Escape peels one layer at a time: palette, then drawer, then menus.
        if (document.querySelector("#palette_overlay")?.classList.contains("open")) {togglePalette(false); return;}
        if (isDrawerOpen()) {cmdman.closeForm(); return;}   // closeForm owns the drawer bookkeeping
        _closeAllMenus();
    });
    document.addEventListener("click", event => {if (!event.target.closest(".menu-wrap")) _closeAllMenus();});
}

function togglePalette(open) {
    const overlay = document.querySelector("#palette_overlay"); if (!overlay) return;
    const shouldOpen = open !== undefined ? open : !overlay.classList.contains("open");
    overlay.classList.toggle("open", shouldOpen);
    if (shouldOpen) {const input = overlay.querySelector("input"); input.value = ""; paletteFilter(""); input.focus();}
}

function paletteFilter(filter) {
    const query = (filter||"").trim().toLowerCase();
    for (const item of document.querySelectorAll("#palette_list li"))
        item.classList.toggle("hide", query != "" && !item.textContent.toLowerCase().includes(query));
}

function paletteKeydown(event) {
    if (event.key != "Enter") return;
    const firstMatch = document.querySelector("#palette_list li:not(.hide) button");
    if (firstMatch) firstMatch.click();
}

function paletteRun(id) {togglePalette(false); cmdman.cmdClicked(id);}

function toggleMenu(button) {
    const menu = button.parentNode.querySelector(".menu"); if (!menu) return;
    const wasOpen = menu.classList.contains("open");
    _closeAllMenus();
    if (!wasOpen) menu.classList.add("open");
    button.setAttribute("aria-expanded", String(!wasOpen));
}

const _closeAllMenus = _ => {for (const menu of document.querySelectorAll(".menu.open")) menu.classList.remove("open");}

function _getHTMLNodesToInsert(htmlContent) {
    const wrapper = document.createElement("div"); wrapper.innerHTML = htmlContent;
    return wrapper;
}

export const main = {interceptPageLoadData, registerHostingDivAndInitialContentTemplate, showContent,
    cmdClicked: (_element, id) => cmdman.cmdClicked(id), hideOpenContent, activeProjectChanged,
    initShell, togglePalette, paletteFilter, paletteKeydown, paletteRun, toggleMenu,
    openDrawer, closeDrawer, isDrawerOpen, toast};
