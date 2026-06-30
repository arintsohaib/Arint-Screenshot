/**
 * Arint Screenshot - Popup Script
 * Handles user interactions and sends capture commands to background worker
 */

(function () {
  'use strict';

  const btnVisible = document.getElementById('btn-visible');
  const btnFullPage = document.getElementById('btn-fullpage');
  const btnSelection = document.getElementById('btn-selection');
  const allButtons = [btnVisible, btnFullPage, btnSelection];

  let isCapturing = false;

  const RESTRICTED_PREFIXES = ['about:', 'moz-extension:', 'view-source:', 'chrome:', 'file:'];

  function isRestrictedUrl(url) {
    if (!url) return true;
    return RESTRICTED_PREFIXES.some(prefix => url.startsWith(prefix));
  }

  async function checkPageSupport() {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      if (isRestrictedUrl(tab.url)) {
        const warning = document.createElement('div');
        warning.className = 'page-warning';
        warning.textContent = 'Cannot capture this page type';
        document.querySelector('.popup-container').prepend(warning);

        allButtons.forEach(btn => {
          btn.disabled = true;
          btn.classList.add('disabled');
        });
      }
    } catch (e) {
      console.error('Page check failed', e);
    }
  }

  function setButtonsDisabled(disabled) {
    allButtons.forEach(btn => {
      btn.disabled = disabled;
      btn.classList.toggle('disabled', disabled);
    });
  }

  async function triggerCapture(action) {
    if (isCapturing) return;

    const button = document.querySelector(`[data-action="${action}"]`);
    const textSpan = button.querySelector('.btn-text');
    const originalText = textSpan.textContent;

    try {
      isCapturing = true;
      setButtonsDisabled(true);
      button.classList.add('loading');
      textSpan.textContent = 'Capturing...';

      const response = await browser.runtime.sendMessage({
        type: 'CAPTURE_REQUEST',
        action: action
      });

      if (response && response.success) {
        window.close();
        return;
      }

      throw new Error(response?.error || 'Capture failed');
    } catch (error) {
      console.error('Arint Screenshot: Capture failed', error);
      button.classList.remove('loading');
      button.classList.add('error');

      textSpan.textContent = 'Failed — try again';

      setTimeout(() => {
        button.classList.remove('error');
        textSpan.textContent = originalText;
        setButtonsDisabled(false);
        isCapturing = false;
      }, 2500);
    }
  }

  checkPageSupport();

  btnVisible.addEventListener('click', () => triggerCapture('visible'));
  btnFullPage.addEventListener('click', () => triggerCapture('fullpage'));
  btnSelection.addEventListener('click', () => triggerCapture('selection'));

  document.addEventListener('keydown', (e) => {
    if (isCapturing) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case '1':
        triggerCapture('visible');
        break;
      case '2':
        triggerCapture('fullpage');
        break;
      case '3':
        triggerCapture('selection');
        break;
      case 'Escape':
        window.close();
        break;
    }
  });
})();
