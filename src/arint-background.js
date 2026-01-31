/**
 * Arint Screenshot - Background Service Worker
 * Central controller for screenshot capture and editor management
 */

// Configuration
const CONFIG = {
    MAX_PAGE_HEIGHT: 30000, // Maximum height to capture (pixels)
    CAPTURE_DELAY: 100,     // Delay between scroll captures (ms)
    EDITOR_URL: browser.runtime.getURL('src/editor/arint-editor.html')
};

// Temporary storage for captured images
let pendingCapture = null;

/**
 * Initialize extension
 */
browser.runtime.onInstalled.addListener(() => {
    console.log('Arint Screenshot: Extension installed');
});

/**
 * Handle messages from popup and content scripts
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Arint Screenshot: Received message', message);

    switch (message.type) {
        case 'CAPTURE_REQUEST':
            handleCaptureRequest(message.action, sender.tab)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'SELECTION_COMPLETE':
            handleSelectionComplete(message.selection, sender.tab);
            break;

        case 'SELECTION_CANCELLED':
            console.log('Arint Screenshot: Selection cancelled');
            break;

        case 'GET_PENDING_CAPTURE':
            // Editor requesting the captured image
            sendResponse({ imageData: pendingCapture });
            pendingCapture = null;
            break;

        case 'PAGE_DIMENSIONS':
            // Response from content script with page dimensions
            sendResponse({ received: true });
            break;
    }

    return true; // Keep message channel open for async responses
});

/**
 * Handle capture requests from popup
 * @param {string} action - 'visible', 'fullpage', or 'selection'
 * @param {object} tab - The active tab
 */
async function handleCaptureRequest(action, tab) {
    try {
        // Get the active tab
        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

        switch (action) {
            case 'visible':
                await captureVisibleArea(activeTab);
                break;

            case 'fullpage':
                await captureFullPage(activeTab);
                break;

            case 'selection':
                await initiateSelection(activeTab);
                break;

            default:
                console.error('Arint Screenshot: Unknown action', action);
        }
    } catch (error) {
        console.error('Arint Screenshot: Capture failed', error);
    }
}

/**
 * Capture the visible viewport
 * @param {object} tab - The tab to capture
 */
async function captureVisibleArea(tab) {
    try {
        // Capture the visible tab
        const imageData = await browser.tabs.captureVisibleTab(tab.windowId, {
            format: 'png'
        });

        // Open editor with captured image
        await openEditor(imageData);
    } catch (error) {
        console.error('Arint Screenshot: Visible capture failed', error);
        throw error;
    }
}

/**
 * Capture the full page by scrolling and stitching
 * @param {object} tab - The tab to capture
 */
async function captureFullPage(tab) {
    try {
        // Inject helper to get page dimensions and control scrolling
        const [result] = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: getPageDimensions
        });

        const dimensions = result.result;
        console.log('Arint Screenshot: Page dimensions', dimensions);

        // Calculate number of captures needed
        const viewportHeight = dimensions.viewportHeight;
        const totalHeight = Math.min(dimensions.scrollHeight, CONFIG.MAX_PAGE_HEIGHT);
        const captureCount = Math.ceil(totalHeight / viewportHeight);

        // Store original scroll position
        await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.__arintOriginalScroll = window.scrollY
        });

        // Capture each viewport segment
        const captures = [];

        for (let i = 0; i < captureCount; i++) {
            const scrollY = i * viewportHeight;

            // Scroll to position
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                func: (y) => window.scrollTo(0, y),
                args: [scrollY]
            });

            // Wait for scroll and content to settle
            await delay(CONFIG.CAPTURE_DELAY);

            // Capture visible viewport
            const imageData = await browser.tabs.captureVisibleTab(tab.windowId, {
                format: 'png'
            });

            captures.push({
                imageData,
                offsetY: scrollY,
                isLast: i === captureCount - 1
            });
        }

        // Restore original scroll position
        await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                window.scrollTo(0, window.__arintOriginalScroll || 0);
                delete window.__arintOriginalScroll;
            }
        });

        // Stitch images together
        const stitchedImage = await stitchImages(captures, dimensions);

        // Open editor with stitched image
        await openEditor(stitchedImage);
    } catch (error) {
        console.error('Arint Screenshot: Full page capture failed', error);
        throw error;
    }
}

/**
 * Get page dimensions (injected into page)
 */
function getPageDimensions() {
    return {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
    };
}

/**
 * Stitch multiple captures into one image
 * @param {Array} captures - Array of capture objects
 * @param {object} dimensions - Page dimensions
 * @returns {string} - Stitched image data URL
 */
async function stitchImages(captures, dimensions) {
    // Create an offscreen canvas for stitching
    const canvas = new OffscreenCanvas(
        dimensions.viewportWidth * dimensions.devicePixelRatio,
        Math.min(dimensions.scrollHeight, CONFIG.MAX_PAGE_HEIGHT) * dimensions.devicePixelRatio
    );
    const ctx = canvas.getContext('2d');

    // Draw each capture at the correct position
    for (const capture of captures) {
        const img = await createImageBitmap(await (await fetch(capture.imageData)).blob());

        const drawY = capture.offsetY * dimensions.devicePixelRatio;

        // For the last segment, we may need to crop to avoid overlap
        if (capture.isLast) {
            const remainingHeight = (dimensions.scrollHeight * dimensions.devicePixelRatio) - drawY;
            const sourceY = img.height - remainingHeight;

            if (sourceY > 0) {
                ctx.drawImage(
                    img,
                    0, sourceY, img.width, remainingHeight,
                    0, drawY, img.width, remainingHeight
                );
            } else {
                ctx.drawImage(img, 0, drawY);
            }
        } else {
            ctx.drawImage(img, 0, drawY);
        }
    }

    // Convert to data URL
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

/**
 * Initiate selection mode by injecting content script
 * @param {object} tab - The tab to inject into
 */
async function initiateSelection(tab) {
    try {
        // Inject selection content script
        await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/arint-content.js']
        });

        // Also inject styling
        await browser.scripting.insertCSS({
            target: { tabId: tab.id },
            css: `
        .arint-selection-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: rgba(0, 0, 0, 0.3) !important;
          cursor: crosshair !important;
          z-index: 2147483647 !important;
        }
        .arint-selection-box {
          position: fixed !important;
          border: 2px dashed #6366f1 !important;
          background: rgba(99, 102, 241, 0.1) !important;
          z-index: 2147483647 !important;
          pointer-events: none !important;
        }
        .arint-selection-info {
          position: fixed !important;
          background: rgba(15, 15, 20, 0.9) !important;
          color: #f0f0f5 !important;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
          font-size: 12px !important;
          padding: 4px 8px !important;
          border-radius: 4px !important;
          z-index: 2147483647 !important;
          pointer-events: none !important;
        }
      `
        });
    } catch (error) {
        console.error('Arint Screenshot: Selection initiation failed', error);
        throw error;
    }
}

/**
 * Handle selection completion from content script
 * @param {object} selection - Selection coordinates
 * @param {object} tab - The source tab
 */
async function handleSelectionComplete(selection, tab) {
    try {
        // Get the active tab (sender.tab might not have windowId in some cases)
        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

        // Capture the visible viewport
        const imageData = await browser.tabs.captureVisibleTab(activeTab.windowId, {
            format: 'png'
        });

        // Crop the image to selection bounds
        const croppedImage = await cropImage(imageData, selection);

        // Open editor with cropped image
        await openEditor(croppedImage);
    } catch (error) {
        console.error('Arint Screenshot: Selection capture failed', error);
        throw error;
    }
}

/**
 * Crop image to specified bounds
 * @param {string} imageData - Image data URL
 * @param {object} selection - {x, y, width, height}
 * @returns {string} - Cropped image data URL
 */
async function cropImage(imageData, selection) {
    const img = await createImageBitmap(await (await fetch(imageData)).blob());

    // Account for device pixel ratio
    const dpr = selection.devicePixelRatio || 1;

    const canvas = new OffscreenCanvas(
        selection.width * dpr,
        selection.height * dpr
    );
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
        img,
        selection.x * dpr,
        selection.y * dpr,
        selection.width * dpr,
        selection.height * dpr,
        0,
        0,
        selection.width * dpr,
        selection.height * dpr
    );

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

/**
 * Open editor page with captured image
 * @param {string} imageData - Image data URL
 */
async function openEditor(imageData) {
    // Store image data for editor to retrieve
    pendingCapture = imageData;

    // Open editor in new tab
    await browser.tabs.create({
        url: CONFIG.EDITOR_URL,
        active: true
    });
}

/**
 * Utility: Delay execution
 * @param {number} ms - Milliseconds to delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
