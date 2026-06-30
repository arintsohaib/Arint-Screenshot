/**
 * Arint Screenshot - Content Script
 * Handles region selection overlay and user interaction
 */

(function () {
    'use strict';

    // Prevent multiple injections
    if (window.__arintSelectionActive) {
        return;
    }
    window.__arintSelectionActive = true;

    // Selection state
    let overlay = null;
    let selectionBox = null;
    let infoBox = null;
    let isSelecting = false;
    let startX = 0;
    let startY = 0;

    /**
     * Initialize selection mode
     */
    function init() {
        createOverlay();
        addEventListeners();
    }

    /**
     * Create the selection overlay
     */
    function createOverlay() {
        // Main overlay
        overlay = document.createElement('div');
        overlay.className = 'arint-selection-overlay';
        document.body.appendChild(overlay);

        // Selection box (hidden initially)
        selectionBox = document.createElement('div');
        selectionBox.className = 'arint-selection-box';
        selectionBox.style.display = 'none';
        document.body.appendChild(selectionBox);

        // Info box showing dimensions
        infoBox = document.createElement('div');
        infoBox.className = 'arint-selection-info';
        infoBox.style.display = 'none';
        document.body.appendChild(infoBox);
    }

    /**
     * Add event listeners for selection
     */
    function addEventListeners() {
        overlay.addEventListener('mousedown', onMouseDown);
        overlay.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchend', onTouchEnd);
        document.addEventListener('touchcancel', onTouchEnd);
        document.addEventListener('keydown', onKeyDown);
    }

    function removeEventListeners() {
        overlay.removeEventListener('mousedown', onMouseDown);
        overlay.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
        document.removeEventListener('keydown', onKeyDown);
    }

    /**
     * Remove event listeners and cleanup
     */
    function cleanup() {
        removeEventListeners();

        if (overlay) overlay.remove();
        if (selectionBox) selectionBox.remove();
        if (infoBox) infoBox.remove();

        window.__arintSelectionActive = false;
    }

    /**
     * Handle mouse down - start selection
     */
    function beginSelection(clientX, clientY) {
        isSelecting = true;
        startX = clientX;
        startY = clientY;

        selectionBox.style.display = 'block';
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';

        infoBox.style.display = 'block';
    }

    function updateSelection(clientX, clientY) {
        const x = Math.min(startX, clientX);
        const y = Math.min(startY, clientY);
        const width = Math.abs(clientX - startX);
        const height = Math.abs(clientY - startY);

        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';

        infoBox.textContent = `${Math.round(width)} × ${Math.round(height)}`;
        infoBox.style.left = (x + width + 10) + 'px';
        infoBox.style.top = y + 'px';

        const infoRect = infoBox.getBoundingClientRect();
        if (infoRect.right > window.innerWidth) {
            infoBox.style.left = (x - infoRect.width - 10) + 'px';
        }
        if (infoRect.bottom > window.innerHeight) {
            infoBox.style.top = (y - infoRect.height - 10) + 'px';
        }
    }

    function onMouseDown(e) {
        e.preventDefault();
        beginSelection(e.clientX, e.clientY);
    }

    function onTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        beginSelection(touch.clientX, touch.clientY);
    }

    /**
     * Handle mouse move - update selection box
     */
    function onMouseMove(e) {
        if (!isSelecting) return;
        updateSelection(e.clientX, e.clientY);
    }

    function onTouchMove(e) {
        if (!isSelecting || e.touches.length !== 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        updateSelection(touch.clientX, touch.clientY);
    }

    function finishSelection(clientX, clientY) {
        if (!isSelecting) return;
        isSelecting = false;

        const x = Math.min(startX, clientX);
        const y = Math.min(startY, clientY);
        const width = Math.abs(clientX - startX);
        const height = Math.abs(clientY - startY);

        if (width < 10 || height < 10) {
            cleanup();
            browser.runtime.sendMessage({ type: 'SELECTION_CANCELLED' });
            return;
        }

        const selection = {
            x,
            y,
            width,
            height,
            devicePixelRatio: window.devicePixelRatio || 1
        };

        overlay.style.display = 'none';
        selectionBox.style.display = 'none';
        infoBox.style.display = 'none';

        setTimeout(() => {
            browser.runtime.sendMessage({
                type: 'SELECTION_COMPLETE',
                selection
            });
            cleanup();
        }, 50);
    }

    function onMouseUp(e) {
        finishSelection(e.clientX, e.clientY);
    }

    function onTouchEnd(e) {
        if (!isSelecting) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        finishSelection(touch.clientX, touch.clientY);
    }

    /**
     * Handle keyboard events
     */
    function onKeyDown(e) {
        if (e.key === 'Escape') {
            cleanup();
            browser.runtime.sendMessage({ type: 'SELECTION_CANCELLED' });
        }
    }

    // Initialize when script loads
    init();
})();
