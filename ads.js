/* ==========================================
   DESIVEXA ADS MANAGER
   All ad codes go in this file only.
========================================== */

const DESIVEXA_ADS = {
  enabled: true,

  // Paste approved ad network snippets here.
  // Keep the string empty until you have real ad code.
  homeTop: ``,
  homeMiddle: ``,
  homeBottom: ``,

  videoTop: ``,
  videoBelowPlayer: ``,
  videoRelated: ``,
  videoBottom: ``
};

(function () {
  "use strict";

  const SLOT_IDS = {
    homeTop: "homeTop",
    homeMiddle: "homeMiddle",
    homeBottom: "homeBottom",
    videoTop: "videoTop",
    videoBelowPlayer: "videoBelowPlayer",
    videoRelated: "videoRelated",
    videoBottom: "videoBottom"
  };

  function insertAdCode(container, html) {
    if (!container || !html || !html.trim()) return;

    // Prevent injecting the same ad repeatedly.
    if (container.dataset.adLoaded === "true") return;

    container.replaceChildren();

    const template = document.createElement("template");
    template.innerHTML = html.trim();

    // Scripts inserted through innerHTML do not execute automatically.
    const scripts = Array.from(
      template.content.querySelectorAll("script")
    );

    scripts.forEach(script => script.remove());

    container.appendChild(template.content.cloneNode(true));
    container.dataset.adLoaded = "true";

    // Execute scripts after the ad markup is inserted.
    scripts.forEach(oldScript => {
      const newScript = document.createElement("script");

      Array.from(oldScript.attributes).forEach(attribute => {
        newScript.setAttribute(attribute.name, attribute.value);
      });

      newScript.textContent = oldScript.textContent;
      container.appendChild(newScript);
    });
  }

  function getSlot(name) {
    return document.getElementById(SLOT_IDS[name]);
  }

  function createSlot(name, target, position) {
    if (!target) return null;

    const existing = getSlot(name);
    if (existing) return existing;

    const slot = document.createElement("div");
    slot.id = SLOT_IDS[name];
    slot.className = "ad-banner";
    slot.dataset.adName = name;

    slot.style.cssText =
      "width:100%;max-width:100%;min-height:90px;" +
      "margin:16px auto;text-align:center;overflow:hidden;" +
      "display:flex;justify-content:center;align-items:center;";

    if (position === "before") {
      target.parentNode?.insertBefore(slot, target);
    } else if (position === "after") {
      target.parentNode?.insertBefore(slot, target.nextSibling);
    } else {
      target.appendChild(slot);
    }

    return slot;
  }

  function renderSlot(name, target, position) {
    const html = DESIVEXA_ADS[name];

    // Do not create empty ad containers.
    if (!html || !html.trim()) return;

    const slot = getSlot(name) || createSlot(name, target, position);
    if (slot) insertAdCode(slot, html);
  }

  function isVideoPage() {
    const path = location.pathname.toLowerCase();

    return /(^|\/)video\.html?$/.test(path) ||
      document.body.classList.contains("video-page");
  }

  function initHomeAds() {
    const header = document.querySelector("header");
    const main = document.querySelector("main");

    const sections = main
      ? main.querySelectorAll("section")
      : document.querySelectorAll(
          ".video-section, .video-grid"
        );

    renderSlot("homeTop", main, "after");

    if (sections.length >= 2) {
      renderSlot("homeMiddle", sections[1], "after");
    } else {
      renderSlot("homeMiddle", main, "append");
    }

    if (sections.length) {
      renderSlot(
        "homeBottom",
        sections[sections.length - 1],
        "after"
      );
    } else {
      renderSlot(
        "homeBottom",
        document.querySelector("footer") || main,
        "before"
      );
    }
  }

  function initVideoAds() {
    const header = document.querySelector("header");
    const main = document.querySelector("main") || document.body;
    const page = document.querySelector("#page") || main;

    renderSlot("videoTop", main, "after");

    const player = document.querySelector(
      "#videoPlayer, .video-player, .player-container, video, iframe"
    );

    if (player) {
      const playerBox =
        player.closest(".player-container, .video-player") || player;

      renderSlot("videoBelowPlayer", playerBox, "after");
    }

    const related = document.querySelector(
      "#relatedVideos, .related-videos, #related, .related"
    );

    if (related) {
      renderSlot("videoRelated", related, "before");
    }

    const footer = document.querySelector("footer");
    renderSlot("videoBottom", footer || main, "before");
  }

  function initAds() {
    if (!DESIVEXA_ADS.enabled) return;

    if (isVideoPage()) {
      initVideoAds();
    } else {
      initHomeAds();
    }
  }

  function start() {
    initAds();

    // Re-check when video.js inserts the player or related videos.
    const observer = new MutationObserver(() => {
      initAds();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Stop observing after 30 seconds to avoid watching the page forever.
    setTimeout(() => observer.disconnect(), 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
