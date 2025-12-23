// Content script for screen selection overlay
// Prevent duplicate injection
if (window.fashionAssistantLoaded) {
  // Script already loaded, exit
} else {
  window.fashionAssistantLoaded = true;

let overlay = null;
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionEndX = 0;
let selectionEndY = 0;
let selectionCanvas = null;
let resizeHandler = null;

// Inject font-face styles into the document
function injectFontStyles() {
  // Check if styles already injected
  if (document.getElementById('fashion-assistant-font-styles')) {
    return;
  }

  // Add Inter font from Google Fonts
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://fonts.googleapis.com';
  document.head.appendChild(link);
  
  const link2 = document.createElement('link');
  link2.rel = 'preconnect';
  link2.href = 'https://fonts.gstatic.com';
  link2.crossOrigin = 'anonymous';
  document.head.appendChild(link2);
  
  const link3 = document.createElement('link');
  link3.rel = 'stylesheet';
  link3.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
  document.head.appendChild(link3);

  const style = document.createElement('style');
  style.id = 'fashion-assistant-font-styles';
  const lightFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Light-Trial.otf');
  const lightItalicFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Light-Italic-Trial.otf');
  const regularFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Regular-Trial.otf');
  const regularItalicFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Regular-Italic-Trial.otf');
  const mediumFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Medium-Trial.otf');
  const mediumItalicFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Medium-Italic-Trial.otf');
  const boldFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Bold-Trial.otf');
  const boldItalicFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Bold-Italic-Trial.otf');
  const superFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Super-Trial.otf');
  const superItalicFont = chrome.runtime.getURL('GT-Super/GT-Super-Display-Super-Italic-Trial.otf');
  
  style.textContent = `
    @font-face {
      font-family: 'GT Super Display';
      src: url('${lightFont}') format('opentype');
      font-weight: 300;
      font-style: normal;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${lightItalicFont}') format('opentype');
      font-weight: 300;
      font-style: italic;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${regularFont}') format('opentype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${regularItalicFont}') format('opentype');
      font-weight: 400;
      font-style: italic;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${mediumFont}') format('opentype');
      font-weight: 500;
      font-style: normal;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${mediumItalicFont}') format('opentype');
      font-weight: 500;
      font-style: italic;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${boldFont}') format('opentype');
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${boldItalicFont}') format('opentype');
      font-weight: 700;
      font-style: italic;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${superFont}') format('opentype');
      font-weight: 900;
      font-style: normal;
    }
    @font-face {
      font-family: 'GT Super Display';
      src: url('${superItalicFont}') format('opentype');
      font-weight: 900;
      font-style: italic;
    }
    .accent-text {
      font-family: 'GT Super Display', serif;
      font-weight: 700;
      font-style: normal;
    }
  `;
  document.head.appendChild(style);
}

// Create and inject the overlay
function createOverlay() {
  // Remove existing overlay if present
  removeOverlay();

  // Inject font styles
  injectFontStyles();

  // Create overlay container
  overlay = document.createElement('div');
  overlay.id = 'fashion-assistant-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647;
    pointer-events: auto;
    background: transparent;
    border: 4px solid #4169E1;
    box-sizing: border-box;
  `;

  // Create selection canvas
  selectionCanvas = document.createElement('canvas');
  selectionCanvas.id = 'selection-canvas';
  selectionCanvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    pointer-events: auto;
  `;
  selectionCanvas.width = window.innerWidth;
  selectionCanvas.height = window.innerHeight;

  // Create instruction text
  const instruction = document.createElement('div');
  instruction.id = 'selection-instruction';
  instruction.innerHTML = 'Click and drag to <span class="accent-text">select</span> the area you want to capture';
  instruction.style.cssText = `
    position: absolute;
    top: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10, 10, 10, 0.95);
    color: #FFFFFF;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(229, 229, 229, 0.1);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 0.875rem;
    font-weight: 400;
    pointer-events: none;
    z-index: 2147483648;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(8px);
  `;

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'button-container';
  buttonContainer.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    z-index: 2147483648;
  `;

  // Create capture button
  const captureBtn = document.createElement('button');
  captureBtn.id = 'capture-selection-btn';
  captureBtn.innerHTML = '<span class="accent-text">Capture</span> Selection';
  captureBtn.style.cssText = `
    background-color: #4169E1;
    color: #FFFFFF;
    border: none;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 0.5rem;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    white-space: nowrap;
  `;
  captureBtn.addEventListener('mouseenter', () => {
    captureBtn.style.backgroundColor = '#1E40AF';
    captureBtn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
  });
  captureBtn.addEventListener('mouseleave', () => {
    captureBtn.style.backgroundColor = '#4169E1';
    captureBtn.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
  });

  // Create cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'cancel-selection-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    background-color: #F5F5F5;
    color: #0A0A0A;
    border: 1px solid #E5E5E5;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 0.5rem;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    white-space: nowrap;
  `;
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.backgroundColor = '#E5E5E5';
    cancelBtn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.backgroundColor = '#F5F5F5';
    cancelBtn.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
  });

  buttonContainer.appendChild(captureBtn);
  buttonContainer.appendChild(cancelBtn);
  overlay.appendChild(selectionCanvas);
  overlay.appendChild(instruction);
  overlay.appendChild(buttonContainer);
  document.body.appendChild(overlay);

  // Handle window resize
  resizeHandler = () => {
    if (selectionCanvas) {
      selectionCanvas.width = window.innerWidth;
      selectionCanvas.height = window.innerHeight;
      if (isSelecting) {
        const ctx = selectionCanvas.getContext('2d');
        drawSelection(ctx, selectionCanvas.width, selectionCanvas.height);
      }
    }
  };
  window.addEventListener('resize', resizeHandler);

  // Setup event listeners
  setupSelectionListeners(selectionCanvas, captureBtn, cancelBtn);
}

// Setup selection event listeners
function setupSelectionListeners(canvas, captureBtn, cancelBtn) {
  const ctx = canvas.getContext('2d');

  const getCoordinates = (e) => {
    return {
      x: e.clientX,
      y: e.clientY
    };
  };

  canvas.addEventListener('mousedown', (e) => {
    isSelecting = true;
    const coords = getCoordinates(e);
    selectionStartX = coords.x;
    selectionStartY = coords.y;
    selectionEndX = coords.x;
    selectionEndY = coords.y;
    drawSelection(ctx, canvas.width, canvas.height);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isSelecting) {
      const coords = getCoordinates(e);
      selectionEndX = coords.x;
      selectionEndY = coords.y;
      drawSelection(ctx, canvas.width, canvas.height);
      captureBtn.style.display = 'block';
    }
  });

  canvas.addEventListener('mouseup', () => {
    isSelecting = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isSelecting = false;
  });

  // Capture button click
  captureBtn.addEventListener('click', async () => {
    await captureSelection();
  });

  // Cancel button click
  cancelBtn.addEventListener('click', () => {
    removeOverlay();
  });

  // ESC key to cancel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay) {
      removeOverlay();
    }
  });
}

// Draw selection rectangle
function drawSelection(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);

  const x = Math.min(selectionStartX, selectionEndX);
  const y = Math.min(selectionStartY, selectionEndY);
  const w = Math.abs(selectionEndX - selectionStartX);
  const h = Math.abs(selectionEndY - selectionStartY);

  // Draw semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, width, height);

  // Clear the selected area
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';

  // Draw selection border
  ctx.strokeStyle = '#4169E1';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

// Capture the selected region
async function captureSelection() {
  try {
    const x = Math.min(selectionStartX, selectionEndX);
    const y = Math.min(selectionStartY, selectionEndY);
    const w = Math.abs(selectionEndX - selectionStartX);
    const h = Math.abs(selectionEndY - selectionStartY);

    if (w === 0 || h === 0) {
      alert('Please select an area first');
      return;
    }

    // Update instruction
    const instruction = document.getElementById('selection-instruction');
    if (instruction) {
      instruction.innerHTML = '<span class="accent-text">Capturing</span>...';
    }

    // Request background script to capture the current tab
    // This captures the current tab directly without needing user selection
    const dataUrl = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'captureCurrentTab' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.dataUrl) {
          resolve(response.dataUrl);
        } else {
          reject(new Error('Failed to capture tab'));
        }
      });
    });

    // Load the captured image
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });

    // Calculate scale factors between the captured image and the viewport
    // The captured image might be at device pixel ratio resolution
    const scaleX = img.width / window.innerWidth;
    const scaleY = img.height / window.innerHeight;

    // Calculate the coordinates in the captured image
    const imageX = x * scaleX;
    const imageY = y * scaleY;
    const imageW = w * scaleX;
    const imageH = h * scaleY;

    // Create canvas to crop the selected region
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Draw the selected region from the captured image
    ctx.drawImage(
      img,
      imageX,
      imageY,
      imageW,
      imageH,
      0,
      0,
      w,
      h
    );

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL('image/png');

    // Remove overlay
    removeOverlay();

    // Send image to background script
    chrome.runtime.sendMessage({
      action: 'capturedImage',
      imageData: imageDataUrl
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
      } else {
        // Open side panel
        chrome.runtime.sendMessage({
          action: 'openSidePanel'
        });
      }
    });

  } catch (error) {
    console.error('Error capturing selection:', error);
    alert('Failed to capture selection: ' + error.message);
    // Reset instruction
    const instruction = document.getElementById('selection-instruction');
    if (instruction) {
      instruction.innerHTML = 'Click and drag to <span class="accent-text">select</span> the area you want to capture';
    }
  }
}

// Remove overlay
function removeOverlay() {
  if (overlay) {
    // Remove resize listener
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    
    overlay.remove();
    overlay = null;
    selectionCanvas = null;
    isSelecting = false;
  }
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSelection') {
    createOverlay();
    sendResponse({ success: true });
  }
  return true;
});

} // End of duplicate injection guard
