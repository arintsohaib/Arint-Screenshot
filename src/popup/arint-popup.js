/**
 * Arint Screenshot - Popup Script
 * Handles user interactions and sends capture commands to background worker
 */

(function () {
  'use strict';

  // DOM Elements
  const btnVisible = document.getElementById('btn-visible');
  const btnFullPage = document.getElementById('btn-fullpage');
  const btnSelection = document.getElementById('btn-selection');

  // Check if current page is supported
  async function checkPageSupport() {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const isRestricted = tab.url.startsWith('about:') ||
        tab.url.startsWith('moz-extension:') ||
        tab.url.startsWith('view-source:') ||
        tab.url.startsWith('chrome:');

      if (isRestricted) {
        document.body.insertAdjacentHTML('afterbegin', `
          <div style="background: #ef4444; color: white; padding: 8px; font-size: 12px; text-align: center; margin-bottom: 8px; border-radius: 4px;">
            ⚠️ Cannot capture strict browser pages
          </div>
        `);
        [btnFullPage, btnSelection].forEach(btn => {
          btn.style.opacity = '0.5';
          btn.style.pointerEvents = 'none';
        });
      }
    } catch (e) {
      console.error('Page check failed', e);
    }
  }

  checkPageSupport();

  /**
   * Send message to background script and close popup
   * @param {string} action - The capture action type
   */
  async function triggerCapture(action) {
    const button = document.querySelector(`[data-action="${action}"]`);

    try {
      // Add loading state
      button.classList.add('loading');

      // Send message to background script
      const response = await browser.runtime.sendMessage({
        type: 'CAPTURE_REQUEST',
        action: action
      });

      if (response && response.success) {
        // Close popup only on success
        window.close();
      } else {
        throw new Error(response ? response.error : 'Unknown error');
      }
    } catch (error) {
      console.error('Arint Screenshot: Capture failed', error);
      button.classList.remove('loading');

      // Show error feedback
      button.style.borderColor = '#ef4444';
      button.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';

      const originalText = button.querySelector('.btn-text').textContent;
      const textSpan = button.querySelector('.btn-text');
      textSpan.textContent = 'Failed: ' + error.message.substring(0, 15) + '...';

      setTimeout(() => {
        button.style.borderColor = '';
        button.style.backgroundColor = '';
        textSpan.textContent = originalText;
      }, 3000);
    }
  }

  // Event Listeners
  btnVisible.addEventListener('click', () => triggerCapture('visible'));
  btnFullPage.addEventListener('click', () => triggerCapture('fullpage'));
  btnSelection.addEventListener('click', () => triggerCapture('selection'));

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === '1') triggerCapture('visible');
    if (e.key === '2') triggerCapture('fullpage');
    if (e.key === '3') triggerCapture('selection');
    if (e.key === 'Escape') window.close();
  });
})();
