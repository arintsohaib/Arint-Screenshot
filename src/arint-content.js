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
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);
    }

    /**
     * Remove event listeners and cleanup
     */
    function cleanup() {
        overlay.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', onKeyDown);

        if (overlay) overlay.remove();
        if (selectionBox) selectionBox.remove();
        if (infoBox) infoBox.remove();

        window.__arintSelectionActive = false;
    }

    /**
     * Handle mouse down - start selection
     */
    function onMouseDown(e) {
        e.preventDefault();
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;

        selectionBox.style.display = 'block';
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';

        infoBox.style.display = 'block';
    }

    /**
     * Handle mouse move - update selection box
     */
    function onMouseMove(e) {
        if (!isSelecting) return;

        const currentX = e.clientX;
        const currentY = e.clientY;

        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';

        // Update info box
        infoBox.textContent = `${width} × ${height}`;
        infoBox.style.left = (x + width + 10) + 'px';
        infoBox.style.top = y + 'px';

        // Keep info box in viewport
        const infoRect = infoBox.getBoundingClientRect();
        if (infoRect.right > window.innerWidth) {
            infoBox.style.left = (x - infoRect.width - 10) + 'px';
        }
        if (infoRect.bottom > window.innerHeight) {
            infoBox.style.top = (y - infoRect.height - 10) + 'px';
        }
    }

    /**
     * Handle mouse up - complete selection
     */
    function onMouseUp(e) {
        if (!isSelecting) return;
        isSelecting = false;

        const currentX = e.clientX;
        const currentY = e.clientY;

        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        // Minimum selection size
        if (width < 10 || height < 10) {
            console.log('Arint Screenshot: Selection too small, cancelled');
            cleanup();
            browser.runtime.sendMessage({ type: 'SELECTION_CANCELLED' });
            return;
        }

        // Send selection to background script
        const selection = {
            x: x,
            y: y,
            width: width,
            height: height,
            devicePixelRatio: window.devicePixelRatio || 1
        };

        // Hide overlay before capture
        overlay.style.display = 'none';
        selectionBox.style.display = 'none';
        infoBox.style.display = 'none';

        // Small delay to ensure overlay is hidden
        setTimeout(() => {
            browser.runtime.sendMessage({
                type: 'SELECTION_COMPLETE',
                selection: selection
            });
            cleanup();
        }, 50);
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
