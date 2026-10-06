import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const page = document.querySelector("#page");
const id = new URLSearchParams(location.search).get("id");

// ExoClick VAST tag
const EXOCLICK_VAST =
  "https://s.magsrv.com/v1/vast.php?idz=6048654";

function show(message) {
  page.innerHTML = `
    <h1>${message}</h1>
    <p><a href="index.html">← Back to videos</a></p>
  `;
}

// Load Fluid Player CSS + JS
function loadFluidPlayer() {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.fluidPlayer) {
      resolve();
      return;
    }

    // CSS
    if (!document.querySelector('link[data-fluid-player]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href =
        "https://cdn.fluidplayer.com/v2/current/fluidplayer.min.css";
      css.dataset.fluidPlayer = "true";
      document.head.appendChild(css);
    }

    // JS
    const script = document.createElement("script");
    script.src =
      "https://cdn.fluidplayer.com/v3/current/fluidplayer.min.js";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Fluid Player load failed"));

    document.head.appendChild(script);
  });
}

async function run() {
  try {
    // 18+ check
    if (localStorage.dv18 !== "yes") {
      show("18+ only");
      return;
    }

    // Video ID check
    if (!id) {
      show("Video not found");
      return;
    }

    // Get video from Supabase
    const { data: v, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();

    if (error) {
      console.error("Supabase video error:", error);
      show(`Database error: ${error.message || "Unknown error"}`);
      return;
    }

    if (!v) {
      show("Video not found");
      return;
    }

    // Create video player
    page.innerHTML = `
      <a href="index.html">← Back</a>

      <div class="videoPlayerWrap">
        <video
          id="player"
          controls
          playsinline
          preload="metadata"
          poster="${esc(v.thumbnail_url || "")}"
          style="width:100%;height:auto;"
        >
          <source
            src="${esc(v.video_url)}"
            type="video/mp4"
          >

          Your browser does not support HTML5 video.
        </video>
      </div>

      <h1>${esc(v.title)}</h1>

      <p class="muted">
        ${esc(v.category || "")}
        ·
        ${Number(v.views || 0).toLocaleString()} views
      </p>

      <p>${esc
