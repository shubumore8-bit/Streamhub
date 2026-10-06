import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ===============================
// HILLTOPADS VAST
// ===============================
const HILLTOPADS_VAST =
  "https://organic-package.com/dYm/F.zHdyGONAvyZkGAUS/qeGmn9PuvZDUclVkvPITVcs0/O-T/MwxWN/j/EPtqNizIQj5FMbzmEV2/NIQU";

// ===============================
// HELPERS
// ===============================
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getVideoId() {
  const params = new URLSearchParams(location.search);
  return params.get("id");
}

// ===============================
// AGE GATE
// ===============================
function ageGate() {
  const key = "desivexa_age_verified";

  if (localStorage.getItem(key) === "1") {
    return true;
  }

  const ok = confirm(
    "18+ ONLY\n\nYou must be 18 years or older to access this website.\n\nPress OK to continue."
  );

  if (!ok) {
    location.href = "index.html";
    return false;
  }

  localStorage.setItem(key, "1");
  return true;
}

// ===============================
// LOAD VIDEO
// ===============================
async function loadVideo() {
  const page = document.querySelector("#page");

  if (!page) return;

  const id = getVideoId();

  if (!id) {
    page.innerHTML = `
      <div class="videoError">
        <h3>Video not found</h3>
        <p>No video ID was provided.</p>
        <a href="index.html">Go Home</a>
      </div>
    `;
    return;
  }

  page.innerHTML = `<p class="muted">Loading video...</p>`;

  try {
    const { data: video, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();

    if (error) throw error;

    if (!video) {
      page.innerHTML = `
        <div class="videoError">
          <h3>Video not found</h3>
          <p>This video may have been removed or is not published.</p>
          <a href="index.html">Go Home</a>
        </div>
      `;
      return;
    }

    const title = esc(video.title || "Untitled video");
    const category = esc(video.category || "Other");
    const description = esc(video.description || "");
    const videoUrl = esc(video.video_url || "");
    const thumbnail = esc(video.thumbnail_url || "");

    if (!videoUrl) {
      page.innerHTML = `
        <div class="videoError">
          <h3>Video unavailable</h3>
          <p>This video does not currently have a playable video file.</p>
        </div>
      `;
      return;
    }

    // ===============================
    // VIDEO PLAYER HTML
    // ===============================
    page.innerHTML = `
      <section class="videoWatch">

        <div class="videoPlayerWrap">
          <video
            id="player"
            class="video-js"
            controls
            playsinline
            preload="metadata"
            ${thumbnail ? `poster="${thumbnail}"` : ""}
            style="width:100%;height:auto;background:#000;"
          >
            <source
              src="${videoUrl}"
              type="video/mp4"
            >
          </video>
        </div>

        <div class="videoInfo">

          <h1>${title}</h1>

          <div class="videoMeta">
            <span>${category}</span>
            <span>${Number(video.views || 0).toLocaleString()} views</span>
          </div>

          ${
            description
              ? `<p class="videoDescription">${description}</p>`
              : ""
          }

        </div>

        <div id="relatedVideos"></div>

      </section>
    `;

    // ===============================
    // HILLTOPADS PRE-ROLL
    // ===============================
    if (window.fluidPlayer) {
      try {
        window.fluidPlayer("player", {
          layoutControls: {
            autoPlay: false,
            allowDownload: false,
            playbackRateEnabled: true,
            fillToContainer: true,
            playButtonShowing: true,
            primaryColor: "#d90000"
          },

          vastOptions: {
            adList: [
              {
                roll: "preRoll",
                vastTag: HILLTOPADS_VAST
              }
            ],

            maxAllowedVastTagRedirects: 5,

            vastTimeout: 15000,

            allowVPAID: true
          }
        });
      } catch (e) {
        console.error("HilltopAds / Fluid Player error:", e);
      }
    } else {
      console.error("Fluid Player library not loaded.");
    }

    // ===============================
    // COUNT VIEW
    // ===============================
    try {
      await supabase.rpc("increment_video_views", {
        video_id: video.id
      });
    } catch (viewError) {
      console.warn("View counter error:", viewError);
    }

    // ===============================
    // RELATED VIDEOS
    // ===============================
    loadRelatedVideos(video);

  } catch (error) {
    console.error(error);

    page.innerHTML = `
      <div class="videoError">
        <h3>Something went wrong</h3>
        <p>Please try again later.</p>
        <a href="index.html">Go Home</a>
      </div>
    `;
  }
}

// ===============================
// RELATED VIDEOS
// ===============================
async function loadRelatedVideos(currentVideo) {
  const box = document.querySelector("#relatedVideos");

  if (!box) return;

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("published", true)
      .eq("category", currentVideo.category)
      .neq("id", currentVideo.id)
      .order("created_at", {
        ascending: false
      })
      .limit(8);

    if (error) throw error;

    if (!data || data.length === 0) {
      box.innerHTML = "";
      return;
    }

    box.innerHTML = `
      <section class="dvSection">
        <div class="dvSectionTitle">
          <h2>
            <span>▸</span>
            Related Videos
          </h2>
        </div>

        <div class="dvGrid">
          ${data.map(videoCard).join("")}
        </div>
      </section>
    `;

  } catch (error) {
    console.warn("Related videos error:", error);
  }
}

// ===============================
// VIDEO CARD
// ===============================
function videoCard(video) {
  const id = encodeURIComponent(video.id);
  const title = esc(video.title || "Untitled video");
  const category = esc(video.category || "Other");
  const views = Number(video.views || 0).toLocaleString();
  const thumbnail = video.thumbnail_url
    ? esc(video.thumbnail_url)
    : "";

  return `
    <a
      class="card"
      href="video.html?id=${id}"
    >

      <div class="thumb">

        ${
          thumbnail
            ? `
              <img
                src="${thumbnail}"
                alt="${title}"
                loading="lazy"
              >
            `
            : ""
        }

        <div class="thumbOverlay">

          <div class="playCircle">
            ▶
          </div>

          <span class="cardViews">
            ${views} views
          </span>

        </div>

      </div>

      <div class="body">

        <h3>${title}</h3>

        <div class="cardMeta">
          <span>${category}</span>
          <span>${views} views</span>
        </div>

      </div>

    </a>
  `;
}

// ===============================
// SEARCH
// ===============================
function setupSearch() {
  const search = document.querySelector("#topSearch");

  if (!search) return;

  search.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;

    const value = search.value.trim();

    if (!value) return;

    location.href =
      `index.html?search=${encodeURIComponent(value)}`;
  });
}

// ===============================
// START
// ===============================
document.addEventListener("DOMContentLoaded", () => {

  if (!ageGate()) return;

  setupSearch();

  loadVideo();

});
