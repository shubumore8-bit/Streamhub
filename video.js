import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MEDIA_FUNCTION = `${SUPABASE_URL}/functions/v1/get-video-media`;

// Your supplied HilltopAds VAST tag
const VAST_TAG_URL =
  "https://organic-package.com/d.mcFyzadqG/N/vGZTGVUM/Se-ms9wuZZbUElPkpP/T/cJ1/McTHEl3LOjTNMKt/N_z/Umx/MxT/co5lNywa";

const params = new URLSearchParams(window.location.search);
const videoId = params.get("id");

let currentVideo = null;
let visitorId = localStorage.getItem("desivexa_visitor_id");

if (!visitorId) {
  visitorId = crypto.randomUUID();
  localStorage.setItem("desivexa_visitor_id", visitorId);
}

// IMPORTANT: Render inside #page, not the entire <main>.
// This preserves the header and the separate banner ad below the page.
const root =
  document.getElementById("page") ||
  document.getElementById("videoContent") ||
  document.getElementById("videoPage") ||
  document.getElementById("videoApp") ||
  document.getElementById("app") ||
  document.querySelector("main") ||
  document.body.appendChild(document.createElement("main"));

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatViews(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function showMessage(message) {
  root.innerHTML = `
    <div style="background:#111;color:#fff;padding:25px;
      text-align:center;border-radius:10px;margin:15px;">
      ${escapeHTML(message)}
    </div>`;
}

// Resolve video and thumbnail URLs through the existing Supabase function.
async function getMedia(id) {
  const response = await fetch(MEDIA_FUNCTION, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ videoId: id, id })
  });

  if (!response.ok) {
    throw new Error(`Media function error: ${response.status}`);
  }

  const data = await response.json();

  return {
    videoUrl: data.videoUrl || data.signedUrl || data.url || "",
    thumbnailUrl:
      data.thumbnailUrl || data.thumbnail_url || data.thumbnail || ""
  };
}

async function loadVideo() {
  if (!videoId) {
    showMessage("Video ID nahi mili. Homepage se video open karein.");
    return;
  }

  try {
    const { data: video, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .maybeSingle();

    if (error) throw error;

    if (!video) {
      showMessage("Video nahi mila ya delete ho chuka hai.");
      return;
    }

    currentVideo = video;

    let media = { videoUrl: "", thumbnailUrl: "" };

    try {
      media = await getMedia(video.id);
    } catch (error) {
      console.error("Video media error:", error);
    }

    renderVideo(video, media);

    recordView(video.id);
    loadLikes(video.id);
    loadComments(video.id);
    loadRelatedVideos(video.id, video.category);

  } catch (error) {
    console.error("Video loading error:", error);
    showMessage("Video load nahi ho paaya. Please dobara try karein.");
  }
}

function renderVideo(video, media) {
  const thumbnail =
    media.thumbnailUrl ||
    video.thumbnail_url ||
    video.thumbnail ||
    "";

  root.innerHTML = `
    <div style="background:#080808;color:#fff;min-height:100vh;
      padding:12px 12px 40px;box-sizing:border-box;
      font-family:Arial,sans-serif;">

      <div style="display:flex;align-items:center;
        justify-content:space-between;gap:10px;margin-bottom:15px;">

        <a href="index.html"
          style="color:#ff3030;font-size:25px;font-weight:bold;
          text-decoration:none;">DesiVexa</a>

        <a href="index.html"
          style="background:#202020;color:white;padding:9px 13px;
          border-radius:7px;text-decoration:none;">Home</a>
      </div>

      <!-- VIDEO PLAYER + VAST AD OVERLAY -->
      <div id="playerWrapper"
        style="position:relative;width:100%;background:#000;
        border-radius:10px;overflow:hidden;">

        <video id="mainVideo" controls playsinline preload="auto"
          poster="${escapeHTML(thumbnail)}"
          style="display:block;width:100%;max-height:70vh;
          min-height:200px;background:#000;">

          ${media.videoUrl
            ? `<source src="${escapeHTML(media.videoUrl)}">`
            : ""}

          Your browser does not support video playback.
        </video>

        <div id="imaAdContainer"
          aria-label="Video advertisement"
          style="display:none;position:absolute;inset:0;
          z-index:5;background:#000;">
        </div>
      </div>

      <p id="adStatus"
        style="display:none;color:#aaa;font-size:12px;margin:7px 2px;">
        Advertisement
      </p>

      <!-- Banner slot: real banner tag needs to be configured separately -->
      <div id="videoBannerAd" class="dv-ad-slot"
        aria-label="Banner ad below video player"
        style="width:100%;min-height:90px;margin:18px 0;
        display:flex;align-items:center;justify-content:center;
        background:#101010;border:1px dashed #444;border-radius:8px;
        color:#888;font-size:11px;">
        Advertisement
      </div>

      ${!media.videoUrl ? `
        <p style="color:#ff7777;margin:10px 0;">
          Video URL load nahi hui. Supabase media function check karein.
        </p>` : ""}

      <h1 style="font-size:21px;line-height:1.4;margin:15px 0 8px;">
        ${escapeHTML(video.title || "Untitled video")}
      </h1>

      <div style="display:flex;flex-wrap:wrap;gap:8px;
        color:#aaa;font-size:13px;margin-bottom:15px;">

        <span>👁 <span id="viewsCount">${formatViews(video.views)}</span> views</span>

        ${video.category
          ? `<span>• ${escapeHTML(video.category)}</span>`
          : ""}
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:9px;margin:15px 0 20px;">

        <button id="likeButton" type="button"
          style="background:#242424;color:white;border:0;
          padding:11px 15px;border-radius:8px;font-size:14px;">
          ❤️ Like <span id="likeCount">0</span>
        </button>

        <button id="commentButton" type="button"
          style="background:#242424;color:white;border:0;
          padding:11px 15px;border-radius:8px;font-size:14px;">
          💬 Comments
        </button>

        <button id="shareButton" type="button"
          style="background:#242424;color:white;border:0;
          padding:11px 15px;border-radius:8px;font-size:14px;">
          🔗 Share
        </button>
      </div>

      ${video.description ? `
        <section style="background:#151515;padding:14px;
          border-radius:9px;margin-bottom:25px;">

          <h3 style="font-size:16px;margin:0 0 8px;">Description</h3>

          <p style="color:#ccc;line-height:1.6;margin:0;white-space:pre-wrap;">
            ${escapeHTML(video.description)}
          </p>
        </section>` : ""}

      <!-- RELATED VIDEOS -->
      <section id="relatedSection" style="margin-top:28px;">

        <h2 style="font-size:19px;margin:0 0 15px;">Related Videos</h2>

        <div id="randomVideos"
          style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">

          <p style="color:#888;grid-column:1/-1;">
            Loading related videos...
          </p>
        </div>
      </section>

      <!-- COMMENTS -->
      <section id="commentsSection"
        style="margin-top:35px;scroll-margin-top:75px;">

        <h2 style="font-size:19px;margin:0 0 15px;">Comments</h2>

        <form id="commentForm" style="margin-bottom:18px;">

          <textarea id="commentInput" maxlength="2000" required
            placeholder="Apna comment likhein..."
            style="box-sizing:border-box;width:100%;min-height:90px;
            background:#171717;color:#fff;border:1px solid #333;
            border-radius:9px;padding:12px;font-size:14px;resize:vertical;">
          </textarea>

          <button type="submit"
            style="margin-top:9px;background:#e5242a;color:#fff;
            border:0;border-radius:8px;padding:11px 17px;font-weight:bold;">
            Post Comment
          </button>
        </form>

        <div id="commentsList" style="color:#aaa;">
          Loading comments...
        </div>
      </section>

      <footer style="text-align:center;color:#777;font-size:12px;
        margin-top:35px;padding:15px 0;">
        © ${new Date().getFullYear()} DesiVexa
      </footer>
    </div>
  `;

  setupBannerAd();

  document.getElementById("likeButton").addEventListener("click", () => {
    toggleLike(video.id);
  });

  document.getElementById("commentButton").addEventListener("click", () => {
    document.getElementById("commentsSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    setTimeout(() => {
      document.getElementById("commentInput")?.focus({ preventScroll: true });
    }, 350);
  });

  document.getElementById("shareButton").addEventListener("click", shareVideo);

  document.getElementById("commentForm").addEventListener("submit", event => {
    submitComment(event, video.id);
  });

  setupVastPreRoll();
}


// One banner ad slot using the supplied ad-network script URL.
function setupBannerAd() {
  const slot = document.getElementById("videoBannerAd");
  if (!slot || slot.dataset.adLoaded === "true") return;

  slot.dataset.adLoaded = "true";
  slot.replaceChildren();

  const script = document.createElement("script");
  script.settings = {};
  script.src = "https://nervousstroke.com/bXXXV/s.dmGnlk0TYTWBcW/_e/mH9xuAZmU/lHkrPPTtcs1XMLTdEEyqODTzMFt/NMzJUzxsMWTaIe5mNzws";
  script.async = true;
  script.referrerPolicy = "no-referrer-when-downgrade";
  slot.appendChild(script);
}

/*
 * VAST pre-roll using Google IMA.
 * Mobile browsers commonly require a user gesture before ad playback.
 * If IMA is unavailable or the ad fails, the main video remains usable.
 */
function setupVastPreRoll() {
  const videoElement = document.getElementById("mainVideo");
  const adContainer = document.getElementById("imaAdContainer");
  const adStatus = document.getElementById("adStatus");

  if (!videoElement || !adContainer) return;

  // Helpful diagnostic: if this appears, the IMA SDK was not loaded.
  if (!window.google?.ima) {
    console.error("[DesiVexa VAST] Google IMA SDK is unavailable. Check the ima3.js request/ad blockers.");
    return;
  }

  let adsLoader = null;
  let adsManager = null;
  let adDisplayContainer = null;
  let adRequested = false;
  let adPlaying = false;
  let contentShouldResume = false;
  let fallbackTimer = null;

  function showContent() {
    adPlaying = false;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    adContainer.style.display = "none";
    adContainer.style.opacity = "0";
    adContainer.style.pointerEvents = "none";
    if (adStatus) adStatus.style.display = "none";
    videoElement.style.visibility = "visible";
  }

  function resumeContent() {
    showContent();
    if (!contentShouldResume) return;
    const promise = videoElement.play();
    if (promise?.catch) promise.catch(() => {
      console.info("[DesiVexa VAST] Browser requires the viewer to tap Play again.");
    });
  }

  function describeAdError(error) {
    try {
      const e = error?.getError?.();
      if (!e) return error || "No detailed IMA error was provided.";
      return {
        code: e.getErrorCode?.(),
        type: e.getType?.(),
        message: e.getMessage?.(),
        vastErrorCode: e.getVastErrorCode?.(),
        adSystem: e.getAd?.()?.getAdSystem?.(),
        innerError: e.getInnerError?.()?.message
      };
    } catch (_) {
      return error || "Unable to read IMA error details.";
    }
  }

  function failOpen(reason, error) {
    console.warn(`[DesiVexa VAST] ${reason}`, describeAdError(error));
    resumeContent();
  }

  function requestAds() {
    if (adRequested) return;
    adRequested = true;

    try {
      // IMA needs a measurable, visible ad slot when it initializes.
      // Keep the paused content frame visible while the ad server responds.
      // The overlay becomes opaque only after IMA has a manager to start.
      adContainer.style.display = "block";
      adContainer.style.visibility = "visible";
      adContainer.style.opacity = "0";
      adContainer.style.pointerEvents = "none";
      adContainer.style.background = "transparent";
      adContainer.style.position = "absolute";
      adContainer.style.inset = "0";
      adContainer.style.width = "100%";
      adContainer.style.height = "100%";

      adDisplayContainer = new google.ima.AdDisplayContainer(adContainer, videoElement);
      adDisplayContainer.initialize();
      adsLoader = new google.ima.AdsLoader(adDisplayContainer);

      adsLoader.addEventListener(
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        event => {
          try {
            // Only cover the content once an ad manager actually arrives.
            videoElement.pause();
            adContainer.style.opacity = "1";
            adContainer.style.pointerEvents = "auto";
            adsManager = event.getAdsManager(videoElement);
            adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, e => failOpen("Ad manager error; playing content instead.", e));
            adsManager.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, resumeContent);
            adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, resumeContent);
            adsManager.addEventListener(google.ima.AdEvent.Type.LOADED, () => {
              if (adStatus) adStatus.style.display = "block";
              // Keep the paused content frame behind the ad until the ad's
              // STARTED event confirms that playback really began. Leave the
              // fallback timer active in case the ad never actually starts.
            });
            adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => {
              adPlaying = true;
              if (fallbackTimer) clearTimeout(fallbackTimer);
              if (adStatus) adStatus.style.display = "block";
              console.info("[DesiVexa VAST] Ad playback started.");
            });

            const width = Math.max(1, videoElement.clientWidth || 640);
            const height = Math.max(1, videoElement.clientHeight || 360);
            adsManager.init(width, height, google.ima.ViewMode.NORMAL);
            adsManager.start();
          } catch (e) {
            failOpen("Could not initialize ad playback; playing content instead.", e);
          }
        },
        false
      );

      adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, e => {
        failOpen("VAST request failed or returned no playable ad.", e);
      }, false);
      adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        () => console.info("[DesiVexa VAST] Ads manager loaded."), false);

      const request = new google.ima.AdsRequest();
      request.adTagUrl = VAST_TAG_URL;
      request.linearAdSlotWidth = Math.max(1, videoElement.clientWidth || 640);
      request.linearAdSlotHeight = Math.max(1, videoElement.clientHeight || 360);
      request.nonLinearAdSlotWidth = request.linearAdSlotWidth;
      request.nonLinearAdSlotHeight = Math.max(50, Math.round(request.linearAdSlotHeight / 3));
      request.forceNonLinearFullSlot = false;
      // Explicitly declare the content video to IMA; useful for VAST wrappers
      // and ad servers that make decisions based on player dimensions.
      request.setAdWillAutoPlay(false);
      request.setAdWillPlayMuted(false);
      console.info("[DesiVexa VAST] Requesting pre-roll", {
        tag: VAST_TAG_URL,
        width: request.linearAdSlotWidth,
        height: request.linearAdSlotHeight
      });
      adsLoader.requestAds(request);

      // Never leave the viewer stuck if the ad server does not answer.
      fallbackTimer = setTimeout(() => {
        if (!adPlaying) failOpen("VAST response timed out; continuing to the video.");
      }, 8000);
    } catch (e) {
      failOpen("IMA setup failed; playing content instead.", e);
    }
  }

  // Only request once, on the first user-initiated play attempt.
  videoElement.addEventListener("play", function firstPlay() {
    if (adRequested || adPlaying) return;
    contentShouldResume = true;

    // Treat the first Play as a true pre-roll: pause synchronously within the
    // user's gesture and initialize IMA before making the asynchronous request.
    // If no ad is returned, failOpen() resumes the content video.
    videoElement.pause();
    requestAds();
  });

  window.addEventListener("resize", () => {
    if (!adsManager || !adPlaying) return;
    try {
      adsManager.resize(
        Math.max(1, videoElement.clientWidth || 640),
        Math.max(1, videoElement.clientHeight || 360),
        google.ima.ViewMode.NORMAL
      );
    } catch (e) {
      console.warn("[DesiVexa VAST] Resize failed.", e);
    }
  });
}

async function recordView(id) {
  try {
    const { data, error } = await supabase
      .from("videos")
      .select("views")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return;

    const nextViews = Number(data.views || 0) + 1;

    const { error: updateError } = await supabase
      .from("videos")
      .update({ views: nextViews })
      .eq("id", id);

    if (updateError) {
      console.warn("View count update failed:", updateError);
      return;
    }

    const element = document.getElementById("viewsCount");
    if (element) element.textContent = formatViews(nextViews);

  } catch (error) {
    console.error("View count error:", error);
  }
}

async function loadLikes(id) {
  const countElement = document.getElementById("likeCount");
  if (!countElement) return;

  try {
    const { count, error } = await supabase
      .from("video_likes")
      .select("*", { count: "exact", head: true })
      .eq("video_id", id);

    if (error) throw error;

    countElement.textContent = formatViews(count || 0);

    const { data: mine, error: mineError } = await supabase
      .from("video_likes")
      .select("id")
      .eq("video_id", id)
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (!mineError && mine) {
      document.getElementById("likeButton").style.color = "#ff4040";
    }

  } catch (error) {
    console.error("Likes load error:", error);
  }
}

async function toggleLike(id) {
  const button = document.getElementById("likeButton");
  if (!button) return;

  button.disabled = true;

  try {
    const { data: existing, error: findError } = await supabase
      .from("video_likes")
      .select("id")
      .eq("video_id", id)
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      const { error } = await supabase
        .from("video_likes")
        .delete()
        .eq("id", existing.id);

      if (error) throw error;
      button.style.color = "#fff";

    } else {
      const { error } = await supabase
        .from("video_likes")
        .insert({
          video_id: id,
          visitor_id: visitorId
        });

      if (error) throw error;
      button.style.color = "#ff4040";
    }

    await loadLikes(id);

  } catch (error) {
    console.error("Like error:", error);
    alert("Like update nahi hua. Supabase video_likes table aur policies check karein.");

  } finally {
    button.disabled = false;
  }
}

async function loadComments(id) {
  const list = document.getElementById("commentsList");
  if (!list) return;

  list.innerHTML = `<p style="color:#888;">Loading comments...</p>`;

  try {
    const { data, error } = await supabase
      .from("video_comments")
      .select("*")
      .eq("video_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = `
        <p style="color:#888;background:#151515;padding:14px;border-radius:8px;">
          Abhi koi comment nahi hai. Pehla comment karein!
        </p>`;
      return;
    }

    list.innerHTML = data.map(comment => {
      const body = comment.body ?? comment.comment ?? "";
      const date = comment.created_at
        ? new Date(comment.created_at).toLocaleString("en-IN")
        : "";

      return `
        <article style="background:#151515;border-radius:9px;
          padding:13px;margin-bottom:10px;">

          <div style="color:#ff5555;font-size:12px;margin-bottom:7px;">
            Viewer · ${escapeHTML(date)}
          </div>

          <div style="color:#eee;line-height:1.5;white-space:pre-wrap;
            overflow-wrap:anywhere;">
            ${escapeHTML(body)}
          </div>
        </article>`;
    }).join("");

  } catch (error) {
    console.error("Comments load error:", error);
    list.innerHTML = `
      <p style="color:#ff8888;">
        Comments load nahi hue. video_comments table aur RLS policies check karein.
      </p>`;
  }
}

async function submitComment(event, id) {
  event.preventDefault();

  const input = document.getElementById("commentInput");
  const button = document.querySelector('#commentForm button[type="submit"]');
  const body = input.value.trim();

  if (!body) {
    alert("Pehle comment likhein.");
    return;
  }

  button.disabled = true;
  button.textContent = "Posting...";

  try {
    const { error } = await supabase
      .from("video_comments")
      .insert({
        video_id: id,
        visitor_id: visitorId,
        body
      });

    if (error) throw error;

    input.value = "";
    await loadComments(id);

  } catch (error) {
    console.error("Comment submit error:", error);
    alert("Comment post nahi hua. Supabase columns aur policies check karein.");

  } finally {
    button.disabled = false;
    button.textContent = "Post Comment";
  }
}

async function loadRelatedVideos(id, category) {
  const container = document.getElementById("randomVideos");
  if (!container) return;

  container.innerHTML = `
    <p style="color:#888;grid-column:1/-1;">
      Loading related videos...
    </p>`;

  try {
    let query = supabase
      .from("videos")
      .select("id,title,category,thumbnail_url,views,created_at")
      .eq("published", true)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (category) {
      query = query.eq("category", category);
    }

    let { data, error } = await query;
    if (error) throw error;

    // Fill with other recent videos if this category has fewer than 20.
    if ((!data || data.length < 20) && category) {
      const existingIds = new Set([id, ...(data || []).map(item => item.id)]);

      const fallbackResult = await supabase
        .from("videos")
        .select("id,title,category,thumbnail_url,views,created_at")
        .eq("published", true)
        .neq("id", id)
        .order("created_at", { ascending: false })
        .limit(40);

      if (!fallbackResult.error && fallbackResult.data) {
        const extra = fallbackResult.data.filter(
          item => !existingIds.has(item.id)
        );

        data = [...(data || []), ...extra].slice(0, 20);
      }
    }

    if (!data || data.length === 0) {
      container.innerHTML = `
        <p style="color:#888;grid-column:1/-1;">
          Abhi koi related video available nahi hai.
        </p>`;
      return;
    }

    const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="#202020"/><text x="50%" y="50%" fill="#ff4444" font-size="22" text-anchor="middle" dominant-baseline="middle">DesiVexa</text></svg>'
    )}`;

    const videos = data.map(item => ({
      ...item,
      resolvedThumbnail: /^https?:\/\//i.test(
        String(item.thumbnail_url || item.thumbnail || "")
      ) ? (item.thumbnail_url || item.thumbnail) : ""
    }));

    container.innerHTML = videos.map(item => {
      const thumb = item.resolvedThumbnail || fallbackSvg;

      return `
        <a href="video.html?id=${encodeURIComponent(item.id)}"
          style="display:block;text-decoration:none;color:#fff;
          background:#151515;border-radius:8px;overflow:hidden;min-width:0;">

          <div style="position:relative;aspect-ratio:16/10;
            background:#252525;overflow:hidden;">

            <img
              src="${escapeHTML(thumb)}"
              data-related-video-id="${escapeHTML(String(item.id))}"
              alt="${escapeHTML(item.title || "Video thumbnail")}"
              loading="lazy"
              style="width:100%;height:100%;object-fit:cover;display:block;"
              onerror="this.onerror=null;this.style.opacity='.25';">
          </div>

          <div style="padding:9px;">
            <div style="font-size:13px;font-weight:bold;line-height:1.4;
              display:-webkit-box;-webkit-line-clamp:2;
              -webkit-box-orient:vertical;overflow:hidden;">
              ${escapeHTML(item.title || "Untitled video")}
            </div>

            <div style="font-size:11px;color:#999;margin-top:6px;">
              👁 ${formatViews(item.views)} views
            </div>
          </div>
        </a>`;
    }).join("");

    // Resolve private thumbnails in the background.
    videos.filter(item => !item.resolvedThumbnail).forEach(async item => {
      try {
        const media = await getMedia(item.id);
        if (!media.thumbnailUrl) return;

        const image = [...container.querySelectorAll("img[data-related-video-id]")]
          .find(img => img.dataset.relatedVideoId === String(item.id));

        if (image) image.src = media.thumbnailUrl;

      } catch (error) {
        console.warn("Thumbnail resolution failed:", item.id, error);
      }
    });

  } catch (error) {
    console.error("Related videos error:", error);

    container.innerHTML = `
      <p style="color:#ff8888;grid-column:1/-1;">
        Related videos load nahi hue. Videos table aur published column check karein.
      </p>`;
  }
}

async function shareVideo() {
  const shareData = {
    title: currentVideo?.title || "DesiVexa",
    text: currentVideo?.title || "Watch this video on DesiVexa",
    url: window.location.href
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);

    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(window.location.href);
      alert("Video link copy ho gaya!");

    } else {
      prompt("Video link copy karein:", window.location.href);
    }

  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Share error:", error);
    }
  }
}

loadVideo();
