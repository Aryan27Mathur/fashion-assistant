// Background service worker for handling messages and side panel

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capturedImage') {
    // Store the image data
    chrome.storage.local.set({ capturedImage: request.imageData }, () => {
      // Send to side panel if it's open
      chrome.runtime.sendMessage({
        action: 'displayImage',
        imageData: request.imageData
      }).catch(() => {
        // Side panel might not be open, that's okay
      });
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'captureCurrentTab') {
    // Capture the visible tab using Chrome Extension API
    chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl: dataUrl });
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'openSidePanel') {
    // Open the side panel
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(() => {
      // Wait a bit for side panel to load, then send the image
      setTimeout(() => {
        chrome.storage.local.get(['capturedImage'], (result) => {
          if (result.capturedImage) {
            chrome.runtime.sendMessage({
              action: 'displayImage',
              imageData: result.capturedImage
            }).catch(() => {
              // Side panel might not be ready yet, that's okay - it will load from storage
            });
          }
        });
      }, 500);
    });
    sendResponse({ success: true });
  }

  return true;
});

// Check if URL is injectable (not chrome://, chrome-extension://, etc.)
function isInjectableUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol.toLowerCase();
    // Block chrome://, chrome-extension://, edge://, about:, etc.
    return !['chrome:', 'chrome-extension:', 'edge:', 'about:', 'moz-extension:'].includes(protocol);
  } catch (e) {
    return false;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if the tab URL is injectable
  if (!isInjectableUrl(tab.url)) {
    console.warn('Cannot inject script into restricted URL:', tab.url);
    // Optionally show a notification or alert to the user
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'shirt.png',
      title: 'Fashion Assistant',
      message: 'This extension cannot be used on Chrome internal pages. Please navigate to a regular webpage.'
    }).catch(() => {
      // Notifications permission might not be granted, that's okay
    });
    return;
  }

  // Inject content script and start selection
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).then(() => {
    // Send message to start selection
    chrome.tabs.sendMessage(tab.id, { action: 'startSelection' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
      }
    });
  }).catch(err => {
    console.error('Error injecting script:', err);
    // Show user-friendly error message
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'shirt.png',
      title: 'Fashion Assistant',
      message: 'Unable to start selection. Please refresh the page and try again.'
    }).catch(() => {
      // Notifications permission might not be granted, that's okay
    });
  });
});

