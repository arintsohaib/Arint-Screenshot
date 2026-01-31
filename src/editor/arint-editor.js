/**
 * Arint Screenshot - Image Editor
 * Canvas-based editor with crop, pen, zoom, and undo/redo functionality
 */

(function () {
    'use strict';

    /**
     * ArintEditor Class
     * Main editor controller handling all tools and interactions
     */
    class ArintEditor {
        constructor() {
            // Canvas elements
            this.mainCanvas = document.getElementById('main-canvas');
            this.overlayCanvas = document.getElementById('overlay-canvas');
            this.mainCtx = this.mainCanvas.getContext('2d', { willReadFrequently: true });
            this.overlayCtx = this.overlayCanvas.getContext('2d');
            this.container = document.getElementById('canvas-container');
            this.wrapper = document.getElementById('canvas-wrapper');

            // State
            this.originalImage = null;
            this.currentTool = 'select';
            this.zoom = 1;
            this.minZoom = 0.1;
            this.maxZoom = 5;

            // History for undo/redo
            this.history = [];
            this.historyIndex = -1;
            this.maxHistory = 20;

            // Pen tool state
            this.penColor = '#ef4444';
            this.penSize = 4;
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;

            // Crop tool state
            this.cropStart = null;
            this.cropEnd = null;
            this.isCropping = false;

            // Pan state
            this.isPanning = false;
            this.panStart = { x: 0, y: 0 };
            this.scrollStart = { x: 0, y: 0 };

            // Initialize
            this.init();
        }

        /**
         * Initialize the editor
         */
        async init() {
            this.setupEventListeners();
            await this.loadCapturedImage();
            this.updateUI();
        }

        /**
         * Load the captured image from background script
         */
        async loadCapturedImage() {
            try {
                const response = await browser.runtime.sendMessage({
                    type: 'GET_PENDING_CAPTURE'
                });

                if (response && response.imageData) {
                    await this.loadImage(response.imageData);
                    this.showToast('Screenshot loaded', 'success');
                } else {
                    this.showToast('No screenshot data found', 'error');
                    this.updateStatus('No image loaded');
                }
            } catch (error) {
                console.error('Arint Editor: Failed to load image', error);
                this.showToast('Failed to load screenshot', 'error');
            }
        }

        /**
         * Load an image from data URL
         * @param {string} dataUrl - Image data URL
         */
        async loadImage(dataUrl) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.originalImage = img;

                    // Set canvas dimensions
                    this.mainCanvas.width = img.width;
                    this.mainCanvas.height = img.height;
                    this.overlayCanvas.width = img.width;
                    this.overlayCanvas.height = img.height;

                    // Draw image
                    this.mainCtx.drawImage(img, 0, 0);

                    // Save initial state
                    this.saveState();

                    // Update UI
                    this.updateDimensions();
                    this.updateStatus('Ready');

                    resolve();
                };
                img.onerror = reject;
                img.src = dataUrl;
            });
        }

        /**
         * Setup all event listeners
         */
        setupEventListeners() {
            // Tool buttons
            document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
                btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
            });

            // Zoom buttons
            document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
            document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
            document.getElementById('zoom-reset').addEventListener('click', () => this.resetZoom());

            // Undo/Redo
            document.getElementById('undo').addEventListener('click', () => this.undo());
            document.getElementById('redo').addEventListener('click', () => this.redo());

            // Action buttons
            document.getElementById('btn-copy').addEventListener('click', () => this.copyToClipboard());
            document.getElementById('btn-download').addEventListener('click', () => this.downloadImage());

            // Pen options
            document.getElementById('pen-color').addEventListener('input', (e) => {
                this.penColor = e.target.value;
            });
            document.getElementById('pen-size').addEventListener('input', (e) => {
                this.penSize = parseInt(e.target.value);
                document.getElementById('pen-size-label').textContent = this.penSize + 'px';
            });

            // Crop actions
            document.getElementById('crop-apply').addEventListener('click', () => this.applyCrop());
            document.getElementById('crop-cancel').addEventListener('click', () => this.cancelCrop());

            // Canvas events
            this.mainCanvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
            this.mainCanvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.mainCanvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
            this.mainCanvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));

            // Wheel zoom
            this.container.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => this.onKeyDown(e));

            // Track cursor position
            this.mainCanvas.addEventListener('mousemove', (e) => this.updateCursorPosition(e));
        }

        /**
         * Set the active tool
         * @param {string} tool - Tool name
         */
        setTool(tool) {
            // Cancel any ongoing crop
            if (this.currentTool === 'crop' && tool !== 'crop') {
                this.cancelCrop();
            }

            this.currentTool = tool;

            // Update button states
            document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === tool);
            });

            // Show/hide pen options
            const penOptions = document.getElementById('pen-options');
            penOptions.classList.toggle('hidden', tool !== 'pen');

            // Show/hide crop bar
            const cropBar = document.getElementById('crop-bar');
            cropBar.classList.toggle('hidden', tool !== 'crop');

            // Update cursor
            this.updateCursor();

            // Clear overlay when switching tools
            this.clearOverlay();

            this.updateStatus(`Tool: ${tool.charAt(0).toUpperCase() + tool.slice(1)}`);
        }

        /**
         * Update canvas cursor based on current tool
         */
        updateCursor() {
            this.mainCanvas.classList.remove('cursor-crosshair', 'cursor-pen', 'cursor-grab', 'cursor-grabbing');

            switch (this.currentTool) {
                case 'crop':
                    this.mainCanvas.classList.add('cursor-crosshair');
                    break;
                case 'pen':
                    this.mainCanvas.classList.add('cursor-crosshair');
                    break;
                case 'select':
                    this.mainCanvas.classList.add('cursor-grab');
                    break;
            }
        }

        // ============================================
        // Mouse Event Handlers
        // ============================================

        onMouseDown(e) {
            const coords = this.getCanvasCoordinates(e);
            if (!coords) return;

            switch (this.currentTool) {
                case 'pen':
                    this.startDrawing(coords.x, coords.y);
                    break;
                case 'crop':
                    this.startCrop(coords.x, coords.y);
                    break;
                case 'select':
                    this.startPan(e);
                    break;
            }
        }

        onMouseMove(e) {
            const coords = this.getCanvasCoordinates(e);
            if (!coords) return;

            switch (this.currentTool) {
                case 'pen':
                    if (this.isDrawing) this.draw(coords.x, coords.y);
                    break;
                case 'crop':
                    if (this.isCropping) this.updateCrop(coords.x, coords.y);
                    break;
                case 'select':
                    if (this.isPanning) this.pan(e);
                    break;
            }
        }

        /**
         * Get canvas coordinates from mouse event, accounting for zoom and scroll
         * @param {MouseEvent} e
         * @returns {{x: number, y: number}|null}
         */
        getCanvasCoordinates(e) {
            const rect = this.mainCanvas.getBoundingClientRect();

            // The rect is already scaled by CSS transform, so we need to:
            // 1. Get position within the scaled bounding box
            // 2. Divide by zoom to get canvas coordinates
            const scaleX = this.mainCanvas.width / rect.width;
            const scaleY = this.mainCanvas.height / rect.height;

            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            // Clamp to canvas bounds
            if (x < 0 || x > this.mainCanvas.width || y < 0 || y > this.mainCanvas.height) {
                return null;
            }

            return { x, y };
        }

        onMouseUp(e) {
            switch (this.currentTool) {
                case 'pen':
                    this.stopDrawing();
                    break;
                case 'crop':
                    this.finishCropSelection();
                    break;
                case 'select':
                    this.stopPan();
                    break;
            }
        }

        // ============================================
        // Pen Tool
        // ============================================

        startDrawing(x, y) {
            this.isDrawing = true;
            this.lastX = x;
            this.lastY = y;

            // Start a new path
            this.mainCtx.beginPath();
            this.mainCtx.moveTo(x, y);
            this.mainCtx.strokeStyle = this.penColor;
            this.mainCtx.lineWidth = this.penSize;
            this.mainCtx.lineCap = 'round';
            this.mainCtx.lineJoin = 'round';
        }

        draw(x, y) {
            if (!this.isDrawing) return;

            // Use quadratic curves for smoother lines
            const midX = (this.lastX + x) / 2;
            const midY = (this.lastY + y) / 2;

            this.mainCtx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
            this.mainCtx.stroke();

            // Start new path from midpoint for continuous drawing
            this.mainCtx.beginPath();
            this.mainCtx.moveTo(midX, midY);

            this.lastX = x;
            this.lastY = y;
        }

        stopDrawing() {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.mainCtx.stroke();
                this.saveState();
            }
        }

        // ============================================
        // Crop Tool
        // ============================================

        startCrop(x, y) {
            this.isCropping = true;
            this.cropStart = { x, y };
            this.cropEnd = { x, y };
        }

        updateCrop(x, y) {
            this.cropEnd = { x, y };
            this.drawCropOverlay();
        }

        finishCropSelection() {
            this.isCropping = false;

            if (this.cropStart && this.cropEnd) {
                const width = Math.abs(this.cropEnd.x - this.cropStart.x);
                const height = Math.abs(this.cropEnd.y - this.cropStart.y);

                if (width > 10 && height > 10) {
                    document.getElementById('crop-apply').disabled = false;
                    document.querySelector('.crop-info').textContent =
                        `Selection: ${Math.round(width)} × ${Math.round(height)} px`;
                } else {
                    this.cancelCrop();
                }
            }
        }

        drawCropOverlay() {
            this.clearOverlay();

            if (!this.cropStart || !this.cropEnd) return;

            const x = Math.min(this.cropStart.x, this.cropEnd.x);
            const y = Math.min(this.cropStart.y, this.cropEnd.y);
            const width = Math.abs(this.cropEnd.x - this.cropStart.x);
            const height = Math.abs(this.cropEnd.y - this.cropStart.y);

            // Draw semi-transparent overlay outside selection
            this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.overlayCtx.fillRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

            // Clear the selected area
            this.overlayCtx.clearRect(x, y, width, height);

            // Draw selection border
            this.overlayCtx.strokeStyle = '#6366f1';
            this.overlayCtx.lineWidth = 2 / this.zoom;
            this.overlayCtx.setLineDash([5 / this.zoom, 5 / this.zoom]);
            this.overlayCtx.strokeRect(x, y, width, height);

            // Draw dimension label
            if (width > 50 && height > 20) {
                const label = `${Math.round(width)} × ${Math.round(height)}`;
                this.overlayCtx.font = `${12 / this.zoom}px system-ui`;
                this.overlayCtx.fillStyle = 'rgba(15, 15, 20, 0.8)';
                const textWidth = this.overlayCtx.measureText(label).width;
                this.overlayCtx.fillRect(x + 4, y + 4, textWidth + 8, 18 / this.zoom);
                this.overlayCtx.fillStyle = '#f0f0f8';
                this.overlayCtx.fillText(label, x + 8, y + 16 / this.zoom);
            }
        }

        applyCrop() {
            if (!this.cropStart || !this.cropEnd) return;

            const x = Math.min(this.cropStart.x, this.cropEnd.x);
            const y = Math.min(this.cropStart.y, this.cropEnd.y);
            const width = Math.abs(this.cropEnd.x - this.cropStart.x);
            const height = Math.abs(this.cropEnd.y - this.cropStart.y);

            // Get cropped image data
            const imageData = this.mainCtx.getImageData(x, y, width, height);

            // Resize canvas
            this.mainCanvas.width = width;
            this.mainCanvas.height = height;
            this.overlayCanvas.width = width;
            this.overlayCanvas.height = height;

            // Draw cropped image
            this.mainCtx.putImageData(imageData, 0, 0);

            // Save state
            this.saveState();

            // Clear crop state
            this.cancelCrop();

            // Update UI
            this.updateDimensions();
            this.showToast('Image cropped', 'success');
        }

        cancelCrop() {
            this.cropStart = null;
            this.cropEnd = null;
            this.isCropping = false;
            this.clearOverlay();

            document.getElementById('crop-apply').disabled = true;
            document.querySelector('.crop-info').textContent = 'Drag to select crop area';
        }

        // ============================================
        // Pan (Select Tool)
        // ============================================

        startPan(e) {
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.scrollStart = {
                x: this.container.scrollLeft,
                y: this.container.scrollTop
            };
            this.mainCanvas.classList.remove('cursor-grab');
            this.mainCanvas.classList.add('cursor-grabbing');
        }

        pan(e) {
            if (!this.isPanning) return;

            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;

            this.container.scrollLeft = this.scrollStart.x - dx;
            this.container.scrollTop = this.scrollStart.y - dy;
        }

        stopPan() {
            this.isPanning = false;
            this.mainCanvas.classList.remove('cursor-grabbing');
            this.mainCanvas.classList.add('cursor-grab');
        }

        // ============================================
        // Zoom
        // ============================================

        zoomIn() {
            this.setZoom(this.zoom * 1.25);
        }

        zoomOut() {
            this.setZoom(this.zoom / 1.25);
        }

        resetZoom() {
            this.setZoom(1);
        }

        setZoom(level) {
            this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, level));

            // Apply zoom to wrapper, not individual canvases
            this.wrapper.style.transform = `scale(${this.zoom})`;

            document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
        }

        onWheel(e) {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                this.setZoom(this.zoom * delta);
            }
        }

        // ============================================
        // Undo / Redo
        // ============================================

        saveState() {
            // Remove any redo states
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }

            // Save current state
            const imageData = this.mainCtx.getImageData(
                0, 0, this.mainCanvas.width, this.mainCanvas.height
            );

            this.history.push({
                imageData: imageData,
                width: this.mainCanvas.width,
                height: this.mainCanvas.height
            });

            // Limit history size
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            } else {
                this.historyIndex++;
            }

            this.updateHistoryButtons();
        }

        undo() {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.restoreState(this.history[this.historyIndex]);
                this.updateHistoryButtons();
                this.showToast('Undo', 'success');
            }
        }

        redo() {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                this.restoreState(this.history[this.historyIndex]);
                this.updateHistoryButtons();
                this.showToast('Redo', 'success');
            }
        }

        restoreState(state) {
            this.mainCanvas.width = state.width;
            this.mainCanvas.height = state.height;
            this.overlayCanvas.width = state.width;
            this.overlayCanvas.height = state.height;
            this.mainCtx.putImageData(state.imageData, 0, 0);
            this.updateDimensions();
        }

        updateHistoryButtons() {
            document.getElementById('undo').disabled = this.historyIndex <= 0;
            document.getElementById('redo').disabled = this.historyIndex >= this.history.length - 1;
        }

        // ============================================
        // Export Actions
        // ============================================

        async copyToClipboard() {
            try {
                const blob = await this.canvasToBlob();
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                this.showToast('Copied to clipboard!', 'success');
            } catch (error) {
                console.error('Arint Editor: Copy failed', error);
                this.showToast('Failed to copy', 'error');
            }
        }

        downloadImage() {
            const dataUrl = this.mainCanvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `arint-screenshot-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            this.showToast('Image downloaded', 'success');
        }

        canvasToBlob() {
            return new Promise((resolve) => {
                this.mainCanvas.toBlob((blob) => resolve(blob), 'image/png');
            });
        }

        // ============================================
        // Keyboard Shortcuts
        // ============================================

        onKeyDown(e) {
            // Ctrl/Cmd shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'c':
                        if (!e.shiftKey) {
                            e.preventDefault();
                            this.copyToClipboard();
                        }
                        break;
                    case 's':
                        e.preventDefault();
                        this.downloadImage();
                        break;
                }
                return;
            }

            // Tool shortcuts
            switch (e.key.toLowerCase()) {
                case 'v':
                    this.setTool('select');
                    break;
                case 'c':
                    this.setTool('crop');
                    break;
                case 'p':
                    this.setTool('pen');
                    break;
                case '=':
                case '+':
                    this.zoomIn();
                    break;
                case '-':
                    this.zoomOut();
                    break;
                case '0':
                    this.resetZoom();
                    break;
                case 'escape':
                    if (this.currentTool === 'crop') {
                        this.cancelCrop();
                    }
                    break;
            }
        }

        // ============================================
        // UI Helpers
        // ============================================

        clearOverlay() {
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }

        updateDimensions() {
            const dim = document.getElementById('image-dimensions');
            dim.textContent = `${this.mainCanvas.width} × ${this.mainCanvas.height} px`;
        }

        updateCursorPosition(e) {
            const coords = this.getCanvasCoordinates(e);
            const pos = document.getElementById('cursor-position');

            if (coords) {
                pos.textContent = `X: ${Math.round(coords.x)}, Y: ${Math.round(coords.y)}`;
            } else {
                pos.textContent = '--';
            }
        }

        updateStatus(message) {
            document.getElementById('status-message').textContent = message;
        }

        updateUI() {
            this.updateHistoryButtons();
            this.updateCursor();
        }

        showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            container.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 2500);
        }
    }

    // Initialize editor when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new ArintEditor());
    } else {
        new ArintEditor();
    }
})();
