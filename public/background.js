/**
 * Chrome Extension Background Script
 * Fixes: "A listener indicated an asynchronous response by returning true, 
 * but the message channel closed before a response was received"
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async operations properly
  (async () => {
    try {
      if (message?.type === "FETCH_LOVABLE") {
        const { path, method = "GET", token, body } = message;
        
        const response = await fetch(`/api/lovable/${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          ...(body && { body: JSON.stringify(body) }),
        });

        const data = await response.json().catch(() => null);
        
        // Always call sendResponse
        sendResponse({ 
          ok: response.ok, 
          status: response.status, 
          data,
          error: response.ok ? null : `HTTP ${response.status}` 
        });
      } else if (message?.type === "GET_AUTH_TOKEN") {
        // Handle token requests
        const { username, password, clientId } = message;
        
        const body = new URLSearchParams({
          grant_type: "password",
          username,
          password,
          ...(clientId && { client_id: clientId }),
        });

        const response = await fetch("/api/lovable/oauth/token", {
          method: "POST",
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        const data = await response.json().catch(() => null);
        
        sendResponse({ 
          ok: response.ok, 
          status: response.status, 
          data,
          error: response.ok ? null : `Token error ${response.status}` 
        });
      } else {
        // Unknown message type
        sendResponse({ 
          ok: false, 
          error: "unknown_message_type",
          supportedTypes: ["FETCH_LOVABLE", "GET_AUTH_TOKEN"]
        });
      }
    } catch (error) {
      // Always call sendResponse even on error
      sendResponse({ 
        ok: false, 
        error: String(error),
        message: "Background script error" 
      });
    }
  })();

  // Return true to indicate async response
  return true;
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("DEA Manager Extension installed");
});