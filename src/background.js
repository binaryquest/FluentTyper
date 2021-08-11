"use strict";

import { isDomainOnList, checkLastError } from "./utils.js";

import { Store } from "./third_party/fancy-settings/lib/store.js";

const settings = new Store("settings");

// Check whether new version is installed
chrome.runtime.onInstalled.addListener(function (details) {
  checkLastError();
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "new_installation/index.html",
    });
  } else if (details.reason === "update") {
    const thisVersion = chrome.runtime.getManifest().version;
    console.log(
      "Updated from " + details.previousVersion + " to " + thisVersion + "!"
    );
    // chrome.tabs.create({url: "options/index.html"});
  }
});

function sendMsgToSandbox(message) {
  const iframe = document.getElementById("sandboxFrame");
  iframe.contentWindow.postMessage(message, "*");
}

function isEnabledForDomain(domainURL) {
  let enabledForDomain = settings.get("enable");
  if (enabledForDomain) {
    enabledForDomain = false;

    if (isDomainOnList(settings, domainURL)) {
      enabledForDomain = true;
    } else if (domainURL.indexOf(chrome.runtime.getURL("")) !== -1) {
      enabledForDomain = true;
    }
  }
  return enabledForDomain;
}

// Called when a message is passed.  We assume that the content script
// wants to show the page action.
function onRequest(request, sender, sendResponse) {
  checkLastError();

  request.context.tabId = sender.tab.id;
  request.context.frameId = sender.frameId;

  switch (request.command) {
    case "contentScriptPredictReq":
      request.context.lang = settings.get("language");
      request.command = "backgroundPagePredictReq";
      sendMsgToSandbox(request);
      break;
    case "status":
      // showPageAction(sender.tab.id, request.context.enabled);
      break;

    case "optionsPageConfigChange":
      updatePresageConfig();
      break;

    case "contentScriptGetConfig":
      const respMsg = {
        command: "backgroundPageSetConfig",
        context: {
          enabled: isEnabledForDomain(sender.tab.url),
          useEnter: settings.get("useEnter"),
        },
      };
      sendResponse(respMsg);
      break;
  }

  // SendResponse
}

// Listen for the content script to send a message to the background page.
chrome.runtime.onMessage.addListener(onRequest);

function receiveMessage(event) {
  checkLastError();

  switch (event.data.command) {
    case "sandBoxPredictResp":
      // Make sure that tabId is still valid
      chrome.tabs.get(event.data.context.tabId, function (tab) {
        checkLastError();

        if (tab) {
          // Update command to indicate orign of the message
          event.data.command = "backgroundPagePredictResp";
          chrome.tabs.sendMessage(event.data.context.tabId, event.data, {
            frameId: event.data.context.frameId,
          });
        }
      });
      break;

    default:
      console.log("Unkown message:");
      console.log(event);
      break;
  }
}

/*
function setPageActionIcon(tabId, isActive) {
  chrome.browserAction.setBadgeText({
    text: isActive ? "On" : "Off",
  });
}

function showPageAction(tabId, isActive) {
  setPageActionIcon(tabId, isActive);
}
*/

window.addEventListener("message", receiveMessage, false);

function toggleOnOffActiveTab() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
    checkLastError();
    if (tabs.length === 1) {
      const currentTab = tabs[0];

      const message = {
        command: "backgroundPageToggle",
        context: {},
      };

      chrome.tabs.sendMessage(currentTab.id, message);
    }
  });
}

chrome.commands.onCommand.addListener(function (command) {
  switch (command) {
    case "toggle-ft-active-tab":
      toggleOnOffActiveTab();
      break;

    default:
      console.log("Unknown command: ", command);
      break;
  }
});

function updatePresageConfig() {
  sendMsgToSandbox({
    command: "backgroundPageSetConfig",
    context: {
      lang: settings.get("language"),
      numSuggestions: settings.get("numSuggestions"),
      minWordLenghtToPredict: settings.get("minWordLenghtToPredict"),
      predictNextWordAfterWhiteSpace: settings.get(
        "predictNextWordAfterWhiteSpace"
      ),
    },
  });
}

// Trigger config update after sandboxFrame 'load' event
window.addEventListener("DOMContentLoaded", (event) => {
  const iframe = document.getElementById("sandboxFrame");
  iframe.addEventListener("load", function () {
    updatePresageConfig();
  });
});
