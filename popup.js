// Popup script - triggers content script injection for screen selection
document.addEventListener('DOMContentLoaded', () => {
  const captureButton = document.getElementById('capture-btn');
  if (captureButton) {
    captureButton.addEventListener('click', startSelection);
  }
});

// Start the selection overlay
async function startSelection() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      alert('No active tab found');
      return;
    }

    // Inject content script if not already injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (err) {
      // Script might already be injected, that's okay
      console.log('Script injection:', err.message);
    }

    // Send message to start selection
    chrome.tabs.sendMessage(tab.id, { action: 'startSelection' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error starting selection:', chrome.runtime.lastError);
        alert('Failed to start selection. Please refresh the page and try again.');
      } else {
        // Close popup
        window.close();
      }
    });
  } catch (error) {
    console.error('Error starting selection:', error);
    alert('Failed to start selection: ' + error.message);
  }
}