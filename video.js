import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const page = document.getElementById("page");

const params = new URLSearchParams(
  window.location.search
);

const videoId = params.get("id");

if (!videoId) {

  page.innerHTML = `
    <div style="padding:30px;color:white">
      Video ID missing.
    </div>
  `;

} else {

  loadVideo();

}

async function loadVideo() {

  try {

    const result = await supabase
      .from("videos")
      .select(`
        id,
        title,
        category,
        description,
        video_url,
        thumbnail_url,
        views
      `)
      .eq("id", videoId)
      .eq("published", true)
      .maybeSingle();

    if (result.error) {

      showError(result.error.message);

      return;

    }

    const video = result.data;

    if (!video) {

      showError("Video not found.");

      return;

    }

    renderVideo(video);

    loadRandomVideos(video.id);

  } catch (error) {

    showError(
      error.message || "Unable to load video."
    );

  }

}

function renderVideo(video) {

  page.innerHTML = `

    <div style="
      width:100%;
      max-width:1000px;
      margin:auto;
    ">

      <video
        id="mainVideo"
        controls
        playsinline
        preload="metadata"
        style="
          width:100%;
          display:block;
          background:#000;
          border-radius:10px;
        "
      ></video>

      <h1 style="
        color:white;
        font-size:21px;
        margin:15px 0 8px;
      ">
        ${escapeHTML(video.title || "Untitled")}
      </h1>

      <div style="
        color:#999;
        font-size:13px;
      ">
        ${escapeHTML(video.category || "Video")}
        ·
        <span id="viewCount">
          ${Number(video.views || 0)}
        </span>
        views
      </div>

      <div style="
        display:flex;
        gap:10px;
        margin:18px 0;
      ">

        <button
          id="likeBtn"
          type="button"
          style="
            background:#222;
            color:white;
            border:0;
            border-radius:8px;
            padding:12px 18px;
            font-size:15px;
          "
        >
          ❤️ Like
        </button>

        <button
          id="commentBtn"
          type="button"
          style="
            background:#222;
            color:white;
            border:0;
            border-radius:8px;
            padding:12px 18px;
            font-size:15px;
          "
        >
          💬 Comment
        </button>

      </div>

      ${
        video.description
          ? `
            <div style="
              color:#ccc;
              line-height:1.5;
              margin-bottom:25px;
            ">
              ${escapeHTML(video.description)}
            </div>
          `
          : ""
      }

      <section
        id="commentsSection"
        style="
          margin-top:30px;
        "
      >

        <h2 style="color:white;">
          Comments
        </h2>

        <p style="color:#888;">
          Comments system will be connected next.
        </p>

      </section>

      <section style="
        margin-top:35px;
      ">

        <h2 style="color:white;">
          Random Videos
        </h2>

        <div
          id="randomVideos"
          style="
            display:grid;
            grid-template-columns:
              repeat(3,minmax(0,1fr));
            gap:8px;
          "
        >
          <p style="color:#888;">
            Loading videos...
          </p>
        </div>

      </section>

    </div>
  `;

  const player =
    document.getElementById("mainVideo");

  player.src = video.video_url;

  if (video.thumbnail_url) {
    player.poster = video.thumbnail_url;
  }

  player.load();

  let counted = false;

  player.addEventListener(
    "play",
    async () => {

      if (counted) return;

      counted = true;

      const newViews =
        Number(video.views || 0) + 1;

      document.getElementById(
        "viewCount"
      ).textContent = newViews;

      await supabase
        .from("videos")
        .update({
          views: newViews
        })
        .eq("id", video.id);

    }
  );

  document
    .getElementById("commentBtn")
    .onclick = () => {

      document
        .getElementById("commentsSection")
        .scrollIntoView({
          behavior:"smooth"
        });

    };

}

async function loadRandomVideos(currentId) {

  const box =
    document.getElementById("randomVideos");

  try {

    const result = await supabase
      .from("videos")
      .select(`
        id,
        title,
        category,
        thumbnail_url,
        views
      `)
      .eq("published", true)
      .neq("id", currentId)
      .limit(50);

    if (result.error) {

      box.innerHTML = `
        <p style="color:#888">
          Unable to load videos.
        </p>
      `;

      return;

    }

    const videos = result.data || [];

    if (!videos.length) {

      box.innerHTML = `
        <p style="color:#888">
          No other videos available.
        </p>
      `;

      return;

    }

    videos.sort(
      () => Math.random() - 0.5
    );

    box.innerHTML =
      videos
        .slice(0,20)
        .map(video => {

          const id =
            encodeURIComponent(video.id);

          return `

            <a
              href="video.html?id=${id}"
              style="
                display:block;
                text-decoration:none;
                color:white;
              "
            >

              ${
                video.thumbnail_url
                  ? `
                    <img
                      src="${escapeHTML(
                        video.thumbnail_url
                      )}"
                      loading="lazy"
                      style="
                        width:100%;
                        aspect-ratio:16/9;
                        object-fit:cover;
                        border-radius:7px;
                        display:block;
                      "
                    >
                  `
                  : `
                    <div style="
                      width:100%;
                      aspect-ratio:16/9;
                      background:#171717;
                      border-radius:7px;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      font-size:25px;
                    ">
                      ▶
                    </div>
                  `
              }

              <div style="
                font-size:13px;
                margin-top:6px;
                line-height:1.3;
              ">
                ${escapeHTML(
                  video.title || "Untitled"
                )}
              </div>

              <div style="
                color:#888;
                font-size:11px;
                margin-top:3px;
              ">
                ${Number(video.views || 0)}
                views
              </div>

            </a>

          `;

        })
        .join("");

  } catch (error) {

    box.innerHTML = `
      <p style="color:#888">
        Unable to load videos.
      </p>
    `;

  }

}

function showError(message) {

  page.innerHTML = `

    <div style="
      padding:30px 20px;
      color:white;
      text-align:center;
    ">

      <h2>
        Could not load video
      </h2>

      <p style="color:#aaa;">
        ${escapeHTML(message)}
      </p>

    </div>

  `;

}

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  }
