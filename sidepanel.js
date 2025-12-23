// Side panel functionality
let currentImageData = null;

// Get DOM elements
const imageContainer = document.getElementById('image-container');
const capturedImage = document.getElementById('captured-image');
const noImageMessage = document.getElementById('no-image');
const downloadBtn = document.getElementById('download-btn');
const newCaptureBtn = document.getElementById('new-capture-btn');
const findSimilarBtn = document.getElementById('find-similar-btn');
const recommendationsContainer = document.getElementById('recommendations-container');
const recommendationsList = document.getElementById('recommendations-list');
const recommendationsLoading = document.getElementById('recommendations-loading');
const recommendationsTitle = document.getElementById('recommendations-title');

const APIKEY = "AIzaSyAvTNp6TlY_UONGPke6qZ_3TSt0NNJhcc8";
// Display captured image
function displayImage(imageDataUrl) {
  currentImageData = imageDataUrl;
  
  // Show image, hide no-image message
  capturedImage.src = imageDataUrl;
  capturedImage.style.display = 'block';
  noImageMessage.style.display = 'none';
  
  // Enable download and find similar buttons
  downloadBtn.disabled = false;
  findSimilarBtn.disabled = false;
  
  // Hide previous recommendations
  recommendationsContainer.classList.remove('has-results');
  recommendationsList.innerHTML = '';
  // Reset title
  recommendationsTitle.innerHTML = '<span class="accent-text">Similar</span> Items';
}

// Download image
function downloadImage() {
  if (!currentImageData) return;
  
  const link = document.createElement('a');
  link.href = currentImageData;
  link.download = `shirt-capture-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Start new capture
function startNewCapture() {
  // Get current tab and inject content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'startSelection' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error starting capture:', chrome.runtime.lastError);
          // If content script isn't loaded, inject it first
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }).then(() => {
            // Try again after injection
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'startSelection' });
            }, 100);
          }).catch(err => {
            console.error('Error injecting script:', err);
          });
        }
      });
    }
  });
}

// Convert base64 data URL to base64 string (remove data:image/png;base64, prefix)
function extractBase64FromDataUrl(dataUrl) {
  return dataUrl.split(',')[1];
}

// Find similar items using Gemini API
async function findSimilarItems() {
  if (!currentImageData) {
    alert('No image available');
    return;
  }

  // Show loading state
  findSimilarBtn.disabled = true;
  recommendationsContainer.classList.add('loading');
  recommendationsContainer.classList.remove('has-results');
  recommendationsLoading.style.display = 'block';
  recommendationsList.innerHTML = '';

  try {
    // Extract base64 from data URL
    const base64Image = extractBase64FromDataUrl(currentImageData);

    // Prepare the request
    const model = 'gemini-3-flash-preview';
    const generateContentApi = 'generateContent';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${generateContentApi}?key=${APIKEY}`;

    const tools = [
      {
        google_search: {}
      }
    ];

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Use Google Search to find 5 similar pieces of clothing (any type: tops, dresses, jackets, etc.) to this item. Search for product images and links. For each item, provide the name, description, style, and a direct image URL link to the product. The image URL must be a direct link to an image file (ending in .jpg, .png, .webp, etc.) that can be displayed in a browser. Use search grounding to find real, current product listings with images.'
            },
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Image
              }
            }
          ]
        }
      ],
      tools: tools,
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: 'MINIMAL'
        },
        temperature: 0
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
    } catch (networkError) {
      throw new Error(`Network error: Unable to connect to Gemini API. Please check your internet connection.`);
    }

    if (!response.ok) {
      let errorMessage = `API error (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error.message || errorData.error.status || errorMessage;
          if (errorData.error.details) {
            errorMessage += `: ${JSON.stringify(errorData.error.details)}`;
          }
        }
      } catch (parseError) {
        const text = await response.text().catch(() => '');
        errorMessage = text || errorMessage;
      }
      
      // Provide user-friendly error messages for common status codes
      if (response.status === 400) {
        errorMessage = `Invalid request: ${errorMessage}. Please check your image and try again.`;
      } else if (response.status === 401) {
        errorMessage = `Authentication error: Invalid API key. Please check your API key.`;
      } else if (response.status === 403) {
        errorMessage = `Permission denied: ${errorMessage}. The API key may not have access to this model.`;
      } else if (response.status === 429) {
        errorMessage = `Rate limit exceeded: Too many requests. Please wait a moment and try again.`;
      } else if (response.status === 500) {
        errorMessage = `Server error: Gemini API is experiencing issues. Please try again later.`;
      } else if (response.status === 503) {
        errorMessage = `Service unavailable: Gemini API is temporarily unavailable. Please try again later.`;
      }
      
      throw new Error(errorMessage);
    }

    // Parse non-streaming JSON response
    const data = await response.json();
    
    // Check for errors in response
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    
    // Extract text and grounding metadata from response
    let fullResponse = '';
    let groundingInfo = null;
    
    if (data.candidates && data.candidates[0]) {
      const candidate = data.candidates[0];
      
      // Check for finish reason (errors)
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Content was blocked due to safety filters.');
      } else if (candidate.finishReason === 'RECITATION') {
        throw new Error('Content was blocked due to recitation detection.');
      }
      
      // Extract text from content.parts
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            fullResponse += part.text;
          }
        }
      }
      
      // Extract grounding metadata (handle both camelCase and snake_case)
      const groundingMeta = candidate.groundingMetadata || candidate.grounding_metadata;
      if (groundingMeta) {
        groundingInfo = {
          searchQueries: groundingMeta.webSearchQueries || groundingMeta.web_search_queries || [],
          groundingChunks: groundingMeta.groundingChunks || groundingMeta.grounding_chunks || [],
          searchEntryPoint: groundingMeta.searchEntryPoint || groundingMeta.search_entry_point
        };
        
        // Log grounding info for debugging
        console.log('Grounding metadata:', groundingInfo);
      }
    }
    
    // Check if we got any response
    if (!fullResponse || fullResponse.trim().length === 0) {
      console.error('Empty response. Full API response:', JSON.stringify(data, null, 2));
      throw new Error('Empty response from API. The model may not have generated any content. Check console for details.');
    }

    // Display raw response with grounding information
    displayRawResponse(fullResponse, groundingInfo);

  } catch (error) {
    console.error('Error finding similar items:', error);
    displayError(error.message || 'An unknown error occurred while finding similar items.');
  } finally {
    recommendationsLoading.style.display = 'none';
    findSimilarBtn.disabled = false;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Display grounding information in the UI (without raw response)
function displayRawResponse(rawText, groundingInfo = null) {
  recommendationsList.innerHTML = '';
  
  try {
    if (!groundingInfo) {
      displayError('No grounding information available in the response.');
      return;
    }
    
    // Get top search query
    const topQuery = groundingInfo.searchQueries && groundingInfo.searchQueries.length > 0 
      ? groundingInfo.searchQueries[0] 
      : '';
    
    // Update title with query text
    if (topQuery) {
      recommendationsTitle.innerHTML = `this looks the most like a <span class="accent-text">${escapeHtml(topQuery)}</span>, here are similar items`;
    } else {
      recommendationsTitle.innerHTML = '<span class="accent-text">Similar</span> Items';
    }
    
    // Extract grounded sources
    const urls = [];
    if (groundingInfo.groundingChunks && groundingInfo.groundingChunks.length > 0) {
      groundingInfo.groundingChunks.forEach(chunk => {
        // Handle different property name formats
        const web = chunk.web || chunk.web_data;
        if (web) {
          const uri = web.uri || web.url || web.link;
          const title = web.title || web.name || uri;
          if (uri) {
            urls.push({
              url: uri,
              title: title
            });
          }
        } else if (chunk.uri || chunk.url || chunk.link) {
          // Direct URI property
          urls.push({
            url: chunk.uri || chunk.url || chunk.link,
            title: chunk.title || chunk.name || (chunk.uri || chunk.url || chunk.link)
          });
        }
      });
    }
    
    if (urls.length === 0) {
      displayError('No grounded sources found in the response.');
      return;
    }
    
    // Create simple list items with just links
    urls.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'grounded-source-link-item';
      
      li.innerHTML = `
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="grounded-source-link">
          ${escapeHtml(item.title)}
        </a>
      `;
      recommendationsList.appendChild(li);
    });
    
  } catch (displayErr) {
    console.error('Error displaying grounding information:', displayErr);
    displayError(`Failed to display grounding information: ${displayErr.message}`);
  }
  
  recommendationsContainer.classList.remove('loading');
  recommendationsContainer.classList.add('has-results');
}

// Display error message in the UI
function displayError(errorMessage) {
  recommendationsList.innerHTML = `
    <li class="error-item">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <div class="error-title">Error</div>
        <div class="error-message">${errorMessage}</div>
        <div class="error-suggestion">Please try again or check your connection.</div>
      </div>
    </li>
  `;
  recommendationsContainer.classList.remove('loading');
  recommendationsContainer.classList.add('has-results');
}


// Event listeners
downloadBtn.addEventListener('click', downloadImage);
newCaptureBtn.addEventListener('click', startNewCapture);
findSimilarBtn.addEventListener('click', findSimilarItems);

// Listen for messages from content script or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'displayImage' && request.imageData) {
    displayImage(request.imageData);
    sendResponse({ success: true });
  }
  return true;
});

// Load image from storage on page load
chrome.storage.local.get(['capturedImage'], (result) => {
  if (result.capturedImage) {
    displayImage(result.capturedImage);
  }
});

