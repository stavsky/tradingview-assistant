/* TradingView Assistant - content.js 
*/

// --- INITIAL SETTINGS & SYNC ---
let settings = {
    enableAltMouseWheelForVZoom: true,
    enableAltMouseDragForVZoom: true,
    enableAltUpDownKeysForVZoom: true,
    enableArrowsForChartNav: true,
    disableUpDownForSymbols: true,
    disableSpaceForSymbols: true
};

chrome.storage.sync.get(Object.keys(settings), (data) => {
    if (data) Object.assign(settings, data);
});

chrome.storage.onChanged.addListener((changes) => {
    for (let [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
});

// --- HELPERS ---
const getMainChart = (el) => {
    const container = el?.closest('.chart-container') || document.querySelector('.chart-container.active');
    if (!container) return null;

    const wrappers = container.querySelectorAll('.chart-gui-wrapper');
    for (const wrapper of wrappers) {
        // Search for the legend specific to the main series:
        // wrapper > div > div > [class^="legendMainSourceWrapper"]
        const legend = wrapper.querySelector('div > div > [class^="legendMainSourceWrapper"]');
        if (legend) return wrapper;
    }

    return null;
};

const getMainPriceAxis = (el) => {
    let axis = el?.closest('.price-axis canvas');
    if (axis) return axis;

    // Grand-parent of main chart contains the chart container and left/right price axis containers
    const bothAxes = getMainChart(el).parentElement?.parentElement?.querySelectorAll('.price-axis-container');
    return bothAxes[1]?.querySelector('.price-axis canvas') ||
        bothAxes[0]?.querySelector('.price-axis canvas');
};

const isTextElement = (el) =>
    !el ? false : el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;

const dispatchToAxis = (EventClass, type, origEv, extra = {}) => {
    const axis = getMainPriceAxis(origEv.target);
    if (!axis) return;
    const rect = axis.getBoundingClientRect();
    const ev = new EventClass(type, {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 5,
        clientY: origEv.clientY || rect.top + rect.height / 2,
        ...extra
    });
    ev.isRedirected = true;
    axis.dispatchEvent(ev);
};

// --- KEYBOARD ENGINE ---
window.addEventListener('keydown', (e) => {
    if (isTextElement(e.target)) return;

    const { key, altKey, shiftKey, ctrlKey, metaKey } = e;

    // 1. Vertical zoom using Alt + Up/Down
    const isAltOnly = altKey && !shiftKey && !ctrlKey && !metaKey;
    if (settings.enableAltUpDownKeysForVZoom && isAltOnly && (key === 'ArrowUp' || key === 'ArrowDown')) {
        const axis = getMainPriceAxis();
        if (axis) {
            e.preventDefault();
            const rect = axis.getBoundingClientRect();
            dispatchToAxis(WheelEvent, 'wheel', e, {
                deltaY: (key === 'ArrowUp' ? -rect.height / 2 : rect.height / 2),
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                altKey: true
            });
        }
        return;
    }

    // 2. Horizontal panning using Left/Right arrows
    const noMods = !altKey && !shiftKey && !ctrlKey && !metaKey;
    if (settings.enableArrowsForChartNav && noMods && (key === 'ArrowLeft' || key === 'ArrowRight')) {
        const wrapper = getMainChart();
        if (wrapper) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const rect = wrapper.getBoundingClientRect();
            const ev = new WheelEvent('wheel', {
                deltaX: key === 'ArrowLeft' ? -rect.width / 6 : rect.width / 6,
                deltaY: 0,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                bubbles: true,
                cancelable: true
            });
            wrapper.dispatchEvent(ev);
        }
        return;
    }

    // 3. Prevents symbol change using (Alt+) Space and Up/Down keys
    const isUpDown = key === 'ArrowUp' || key === 'ArrowDown';
    const isSpace = key === ' ';
    const spaceMods = !altKey && !ctrlKey && !metaKey; // Allows plain Space or Shift + Space

    if ((settings.disableUpDownForSymbols && isUpDown && noMods) ||
        (settings.disableSpaceForSymbols && isSpace && spaceMods)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
    }
}, { capture: true });

// --- MOUSE ENGINE ---
let isDraggingAxis = false;
let wasDraggingAxis = false;
let wasWheelingAxis = false;

window.addEventListener('mousedown', (e) => {
    if (e.isRedirected || isTextElement(e.target)) return;

    const isAltOnly = e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey;
    if (settings.enableAltMouseDragForVZoom && isAltOnly && e.button === 0) {
        isDraggingAxis = true;
        e.preventDefault();
        e.stopImmediatePropagation();
        dispatchToAxis(MouseEvent, 'mousedown', e);
        return;
    }
}, { capture: true });

window.addEventListener('mousemove', (e) => {
    if (!isDraggingAxis || e.isRedirected) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    wasDraggingAxis = true;
    dispatchToAxis(MouseEvent, 'mousemove', e);
}, { capture: true });

window.addEventListener('mouseup', (e) => {
    if (!isDraggingAxis || e.isRedirected) return;
    isDraggingAxis = false;
    e.preventDefault();
    e.stopImmediatePropagation();
    dispatchToAxis(MouseEvent, 'mouseup', e);
}, { capture: true });

window.addEventListener('click', (e) => {
    // Prevents Alt+Click for chart maximization after Alt+Drag and Alt+Wheel zoom
    if (wasDraggingAxis && !e.isRedirected) {
        wasDraggingAxis = false;
        e.preventDefault();
        e.stopImmediatePropagation();
    }
}, { capture: true });

window.addEventListener('wheel', (e) => {
    if (e.isRedirected || isTextElement(e.target)) return;

    const isAltOnly = e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey;
    if (settings.enableAltMouseWheelForVZoom && isAltOnly) {
        wasWheelingAxis = true;
        e.preventDefault();
        e.stopImmediatePropagation();
        dispatchToAxis(WheelEvent, 'wheel', e, { deltaY: e.deltaY * 5, deltaMode: 0 });
        return;
    }
}, { capture: true, passive: false });

window.addEventListener('keyup', (e) => {
    const { key, altKey, shiftKey, ctrlKey, metaKey } = e;
    const noMods = !altKey && !shiftKey && !ctrlKey && !metaKey;

    // Prevents plain Alt for Windows menu trigger in a browser afer Alt+Wheel zoom
    if (wasWheelingAxis && !e.isRedirected && key === 'Alt' && noMods) {
        wasWheelingAxis = false;
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
    }
}, { capture: true });
