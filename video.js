import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const page = document.getElementById("page");

const params = new URLSearchParams(window.location.search);
const videoId = params.get("id");

if (!videoId) {
  page.innerHTML = `
    <div class="error">
      <h2>Video ID missing</h2>
      <p>Please open a valid video link.</p>
    </div>
  `;
} else {
  loadVideo();
}

async function loadVideo() {
  page.innerHTML = `
    <div class="loading">Loading video...</div>
  `;

  try {
    const { data: video, error } = await supabase
      .from("videos")
      .select(`
        id,
        title,
        category,
        description,
        video_url,
        thumbnail_url,
        views,
        created_at
      `)
      .eq("id", videoId)
      .eq("published", true)
      .maybeSingle();

    if (error) {
      console.error("Supabase error:", error);

      page.innerHTML = `
        <div class="error">
          <h2>Could not load video</h2>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;

      return;
    }

    if (!video) {
      page.innerHTML = `
        <div class="error">
          <h2>Video not found</h2>
          <p>This video does not exist or is not published.</p>
        </div>
      `;

      return;
    }

    if (!video.video_url) {
      page.innerHTML = `
        <div class="error">
          <h2>Video file missing</h2>
          <p>This video does not have a video URL.</p>
        </div>
      `;

      return;
    }

    renderVideo(video);

  } catch (err) {
    console.error("Unexpected error:", err);

    page.innerHTML = `
      <div class="error">
        <h2>Something went wrong</h2>
        <p>${escapeHTML(err.message || "Unknown error")}</p>
      </div>
    `;
  }
}

function renderVideo(video) {
  const title = escapeHTML(video.title || "Untitled Video");
  const category = escapeHTML(video.category || "Video");
  const description = escapeHTML(video.description || "");
  const thumbnail = video.thumbnail_url || "";

  page.innerHTML = `
    <div style="
      width:100%;
      max-width:1000px;
      margin:0 auto;
    ">

      <video
        id="mainVideo"
        controls
        playsinline
        preload="metadata"
        ${thumbnail ? `poster="${escapeHTML(thumbnail)}"` : ""}
        style="
          width:100%;
          display:block;
          background:#000;
          border-radius:8px;
        "
      ></video>

      <h1 style="
        color:#fff;
        font-size:21px;
        margin:15px 0 7px;
      ">
        ${title}
      </h1>

      <div style="
        color:#999;
        font-size:13px;
      ">
        ${category} · ${Number(video.views || 0)} views
      </div>

      ${
        description
          ? `
            <div style="
              color:#ccc;
              font-size:14px;
              line-height:1.5;
              margin-top:15px;
              white-space:pre-wrap;
            ">
              ${description}
            </div>
          `
          : ""
      }

    </div>
  `;

  const player = document.getElementById("mainVideo");

  player.src = video.video_url;
  player.load();

  player.addEventListener("error", () => {
    console.error("Video playback error:", player.error);
  });

  let counted = false;

  player.addEventListener("play", async () => {
    if (counted) return;

    counted = true;

    await increaseViews(
      video.id,
      Number(video.views || 0)
    );
  });
}

async function increaseViews(id, currentViews) {
  const newViews = currentViews + 1;

  const { error } = await supabase
    .from("videos")
    .update({
      views: newViews
    })
    .eq("id", id);

  if (error) {
    console.error("View update error:", error);
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
