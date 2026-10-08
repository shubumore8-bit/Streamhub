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
const videoId = new URLSearchParams(location.search).get("id");

const visitorKey = "desivexa_visitor_id";

function getVisitorId() {
  let id = localStorage.getItem(visitorKey);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(visitorKey, id);
  }

  return id;
}

const visitorId = getVisitorId();

if (!videoId) {
  page.innerHTML = `<p class="muted">Video ID missing.</p>`;
} else {
  loadVideo();
}

async function loadVideo() {
  page.innerHTML = `<p class="muted">Loading video...</p>`;

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
        views
      `)
      .eq("id", videoId)
      .eq("published", true)
      .maybeSingle();

    if (error) {
      showError(error.message);
      return;
    }

    if (!video) {
      showError("Video not found.");
      return;
    }

    renderVideo(video);

    loadLikes();
    loadComments();
    loadRandomVideos(video.id);

  } catch (error) {
    showError(error.message || "Unable to load video.");
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
            cursor:pointer;
          "
        >
          ❤️ <span id="likeText">Like</span>
          <span id="likeCount">0</span>
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
            cursor:pointer;
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

        <div style="
          display:flex;
          gap:8px;
          margin:15px 0;
        ">

          <input
            id="commentInput"
            type="text"
            maxlength="500"
            placeholder="Write a comment..."
            style="
              flex:1;
              min-width:0;
              background:#171717;
              color:white;
              border:1px solid #333;
              border-radius:8px;
              padding:12px;
              outline:none;
            "
          >

          <button
            id="commentSubmit"
            type="button"
            style="
              background:#e00000;
              color:white;
              border:0;
              border-radius:8px;
              padding:0 16px;
              cursor:pointer;
            "
          >
            Post
          </button>

        </div>

        <div id="commentsList">
          <p style="color:#888;">
            Loading comments...
          </p>
        </div>

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

  const player = document.getElementById("mainVideo");

  player.src = video.video_url;

  if (video.thumbnail_url) {
    player.poster = video.thumbnail_url;
  }

  player.load();

  let counted = false;

  player.addEventListener("play", async () => {
    if (counted) return;

    counted = true;

    const newViews = Number(video.views || 0) + 1;

    document.getElementById("viewCount").textContent = newViews;

    await supabase
      .from("videos")
      .update({
        views: newViews
      })
      .eq("id", video.id);
  });

  document.getElementById("likeBtn").onclick = toggleLike;

  document.getElementById("commentBtn").onclick = () => {
    document
      .getElementById("commentsSection")
      .scrollIntoView({
        behavior: "smooth"
      });
  };

  document.getElementById("commentSubmit").onclick = addComment;

  document.getElementById("commentInput").addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        addComment();
      }
    }
  );
}


/* =========================
   LIKES
========================= */

async function loadLikes() {
  const countEl = document.getElementById("likeCount");
  const textEl = document.getElementById("likeText");
  const button = document.getElementById("likeBtn");

  if (!countEl) return;

  const { count, error } = await supabase
    .from("video_likes")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("video_id", videoId);

  if (error) {
    console.error("Like count error:", error);
    countEl.textContent = "0";
  } else {
    countEl.textContent = Number(count || 0);
  }

  const { data, error: userLikeError } = await supabase
    .from("video_likes")
    .select("id")
    .eq("video_id", videoId)
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (userLikeError) {
    console.error("User like error:", userLikeError);
    return;
  }

  if (data) {
    textEl.textContent = "Liked";
    button.style.background = "#e00000";
  } else {
    textEl.textContent = "Like";
    button.style.background = "#222";
  }
}

async function toggleLike() {
  const button = document.getElementById("likeBtn");

  button.disabled = true;

  const { data: existing, error: checkError } = await supabase
    .from("video_likes")
    .select("id")
    .eq("video_id", videoId)
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (checkError) {
    console.error("Like check error:", checkError);
    button.disabled = false;
    return;
  }

  if (existing) {

    const { error } = await supabase
      .from("video_likes")
      .delete()
      .eq("id", existing.id);

    if (error) {
      console.error("Unlike error:", error);
    }

  } else {

    const { error } = await supabase
      .from("video_likes")
      .insert({
        video_id: videoId,
        visitor_id: visitorId
      });

    if (error) {
      console.error("Like error:", error);
    }
  }

  await loadLikes();

  button.disabled = false;
}


/* =========================
   COMMENTS
========================= */

async function loadComments() {
  const list = document.getElementById("commentsList");

  if (!list) return;

  const { data, error } = await supabase
    .from("video_comments")
    .select(`
      id,
      comment,
      created_at
    `)
    .eq("video_id", videoId)
    .order("created_at", {
      ascending: false
    })
    .limit(100);

  if (error) {
    console.error("Comments error:", error);

    list.innerHTML = `
      <p style="color:#888;">
        Could not load comments.
      </p>
    `;

    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <p style="color:#888;">
        No comments yet. Be the first!
      </p>
    `;

    return;
  }

  list.innerHTML = data.map(item => `
    <div style="
      background:#171717;
      border-radius:8px;
      padding:12px;
      margin-bottom:8px;
    ">

      <strong style="color:white;">
        Guest
      </strong>

      <p style="
        color:#ccc;
        margin:6px 0 0;
        word-break:break-word;
      ">
        ${escapeHTML(item.comment)}
      </p>

    </div>
  `).join("");
}

async function addComment() {
  const input = document.getElementById("commentInput");
  const button = document.getElementById("commentSubmit");

  const comment = input.value.trim();

  if (!comment) return;

  button.disabled = true;
  button.textContent = "Posting...";

  const { error } = await supabase
    .from("video_comments")
    .insert({
      video_id: videoId,
      visitor_id: visitorId,
      comment: comment
    });

  button.disabled = false;
  button.textContent = "Post";

  if (error) {
    console.error("Comment insert error:", error);

    alert("Comment could not be posted.");

    return;
  }

  input.value = "";

  await loadComments();
}


/* =========================
   RANDOM VIDEOS
========================= */

async function loadRandomVideos(currentId) {
  const box = document.getElementById("randomVideos");

  try {

    const { data, error } = await supabase
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

    if (error) {
      box.innerHTML = `
        <p style="color:#888;">
          Unable to load videos.
        </p>
      `;

      console.error("Random videos error:", error);

      return;
    }

    const videos = data || [];

    if (!videos.length) {
      box.innerHTML = `
        <p style="color:#888;">
          No other videos available.
        </p>
      `;

      return;
    }

    videos.sort(() => Math.random() - 0.5);

    box.innerHTML = videos
      .slice(0, 20)
      .map(video => {

        const id = encodeURIComponent(video.id);

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
                    src="${escapeHTML(video.thumbnail_url)}"
                    loading="lazy"
                    style="
                      width:100%;
                      aspect-ratio:16/9;
                      object-fit:cover;
                      border-radius:7px;
                      display:block;
                    "
                    alt=""
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
              ${escapeHTML(video.title || "Untitled")}
            </div>

            <div style="
              color:#888;
              font-size:11px;
              margin-top:3px;
            ">
              ${Number(video.views || 0)} views
            </div>

          </a>
        `;
      })
      .join("");

  } catch (error) {

    console.error(error);

    box.innerHTML = `
      <p style="color:#888;">
        Unable to load videos.
      </p>
    `;
  }
}


/* =========================
   HELPERS
========================= */

function showError(message) {
  page.innerHTML = `
    <div style="
      padding:30px 20px;
      color:white;
      text-align:center;
    ">
      <h2>Could not load video</h2>

      <p style="color:#aaa;">
        ${escapeHTML(message)}
      </p>
    </div>
  `;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
