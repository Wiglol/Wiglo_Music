/* ===== WIGLO — CUSTOM CURSOR =====
   Dot follows instantly. Outline ring trails with lerp.
   Scales on hover, shrinks on click. Hidden on touch devices.
*/

document.addEventListener('DOMContentLoaded', () => {
    // Only run on pointer:fine devices
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const dot     = document.querySelector('.cursor-dot');
    const outline = document.querySelector('.cursor-outline');
    if (!dot || !outline) return;

    let mx = -100, my = -100;
    let ox = -100, oy = -100;
    let isHovering = false;

    // Dot follows instantly
    document.addEventListener('mousemove', e => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.left = mx + 'px';
        dot.style.top  = my + 'px';
    });

    // Outline trails with lerp
    function animateCursor() {
        ox += (mx - ox) * 0.14;
        oy += (my - oy) * 0.14;
        outline.style.left = ox + 'px';
        outline.style.top  = oy + 'px';
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover state on interactive elements
    const INTERACTIVE = 'a, button, input, select, textarea, label, .chip, .track-row, .nav-item, .q-item, .rail-item, .menu-btn, .icon-btn, .ghost, .link-btn, .primary, [role="button"], [tabindex="0"]';

    function addHover(el) {
        el.addEventListener('mouseenter', () => {
            dot.classList.add('is-hovering');
            outline.classList.add('is-hovering');
        });
        el.addEventListener('mouseleave', () => {
            dot.classList.remove('is-hovering');
            outline.classList.remove('is-hovering');
        });
    }

    // Initial pass
    document.querySelectorAll(INTERACTIVE).forEach(addHover);

    // Watch for dynamically added elements (track rows, etc.)
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.matches && node.matches(INTERACTIVE)) addHover(node);
                node.querySelectorAll && node.querySelectorAll(INTERACTIVE).forEach(addHover);
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Click shrink
    document.addEventListener('mousedown', () => {
        dot.classList.add('is-clicking');
        outline.classList.add('is-clicking');
    });
    document.addEventListener('mouseup', () => {
        dot.classList.remove('is-clicking');
        outline.classList.remove('is-clicking');
    });

    // Theme toggle — update Three.js bg color too
    const btnTheme = document.getElementById('btnTheme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            if (window.updateThreeBgColor) {
                window.updateThreeBgColor(isLight ? 0x9e6b35 : 0xd4a574);
            }
        });
    }
});
