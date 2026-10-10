
/* ==========================================
   DESIVEXA ADS MANAGER
   All ad codes go in this file only.
========================================== */

const DESIVEXA_ADS = {

  enabled: true,

  // Homepage ads
  homeTop: `
    <!-- PASTE HOMEPAGE TOP AD CODE HERE -->
  `,

  homeMiddle: `
    <!-- PASTE HOMEPAGE MIDDLE AD CODE HERE -->
  `,

  homeBottom: `
    <!-- PASTE HOMEPAGE BOTTOM AD CODE HERE -->
  `,

  // Video page ads
  videoTop: `
    <!-- PASTE VIDEO PAGE TOP AD CODE HERE -->
  `,

  videoBelowPlayer: `
    <!-- PASTE AD CODE BELOW VIDEO PLAYER HERE -->
  `,

  videoRelated: `
    <!-- PASTE AD CODE ABOVE RELATED VIDEOS HERE -->
  `,

  videoBottom: `
    <!-- PASTE VIDEO PAGE BOTTOM AD CODE HERE -->
  `
};

(function () {
  "use strict";

  function runAdCode(container, html) {
    if (!html || !html.trim()) return;

    container.innerHTML = html;

    // Execute scripts included in the ad snippet
    container.querySelectorAll("script").forEach(oldScript => {
      const script = document.createElement("script");

      Array.from(oldScript.attributes).forEach(attr => {
        script.setAttribute(attr.name, attr.value);
      });

      script.textContent = oldScript.textContent;
      oldScript.replaceWith(script);
    });
  }

  function addAd(name, target, position, html) {
    if (!html || !html.trim() || !target) return;

    const box = document.createElement("div");
    box.className = "desivexa-ad desivexa-ad-" + name;
    box.dataset.adName = name;

    box.style.cssText =
      "width:100%;max-width:100%;margin:18px auto;" +
      "text-align:center;overflow:hidden;";

    if (position === "before") {
      target.parentNode.insertBefore(box, target);
    } else if (position === "after") {
      target.parentNode.insertBefore(box, target.nextSibling);
    } else {
      target.appendChild(box);
    }

    runAdCode(box, html);
  }

  function initAds() {
    if (!DESIVEXA_ADS.enabled) return;

    const path = location.pathname.toLowerCase();
    const isVideoPage =
      /(^|\/)video\.html?$/.test(path) ||
      document.body.classList.contains("video-page");

    if (isVideoPage) {
      const player = document.querySelector(
        "#videoPlayer, .video-player, video, iframe"
      );

      const header = document.querySelector("header");
      const related = document.querySelector(
        "#relatedVideos, .related-videos, #related, .related"
      );

      addAd(
        "video-top",
        header || document.body.firstElementChild,
        "after",
        DESIVEXA_ADS.videoTop
      );

      if (player) {
        const playerBox =
          player.closest(".video-player, .player-container") || player;

        addAd(
          "video-below-player",
          playerBox,
          "after",
          DESIVEXA_ADS.videoBelowPlayer
        );
      }

      if (related) {
        addAd(
          "video-related",
          related,
          "before",
          DESIVEXA_ADS.videoRelated
        );
      }

      addAd(
        "video-bottom",
        document.querySelector("footer") || document.body,
        "append",
        DESIVEXA_ADS.videoBottom
      );

    } else {
      const header = document.querySelector("header");
      const main = document.querySelector("main");
      const sections = document.querySelectorAll(
        "main section, .video-section, .video-grid"
      );

      addAd(
        "home-top",
        header || main || document.body.firstElementChild,
        "after",
        DESIVEXA_ADS.homeTop
      );

      if (sections.length) {
        addAd(
          "home-middle",
          sections[0],
          "after",
          DESIVEXA_ADS.homeMiddle
        );

        addAd(
          "home-bottom",
          sections[sections.length - 1],
          "after",
          DESIVEXA_ADS.homeBottom
        );
      } else if (main) {
        addAd(
          "home-bottom",
          main,
          "append",
          DESIVEXA_ADS.homeBottom
        );
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAds, {
      once: true
    });
  } else {
    initAds();
  }
})();
