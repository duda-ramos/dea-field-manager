/**
 * Chrome Extension Content Script
 * Provides helper functions for communicating with background script
 */

// Helper function to send messages to background script
window.deaManagerExtension = {
  async fetchLovableAPI(path, options = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "FETCH_LOVABLE",
          path,
          method: options.method || "GET",
          token: options.token,
          body: options.body,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response?.ok) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || "API call failed"));
          }
        }
      );
    });
  },

  async getAuthToken(username, password, clientId) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_AUTH_TOKEN",
          username,
          password,
          clientId,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response?.ok) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || "Token request failed"));
          }
        }
      );
    });
  },
};

console.log("DEA Manager Extension content script loaded");