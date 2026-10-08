import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  if (error || !video) {
    page.innerHTML = `
      <div class="error">
        <h2>Video not found</h2>
        <p>${escapeHTML(error?.message || "Video unavailable.")}</p>
      </div>
    `;
    return;
  }

  renderVideo(video);
  loadLikes();
  loadComments();
  loadRandomVideos(video.id);
}

function renderVideo(video) {
  page.innerHTML = `
    <div class="videoPage">

      <video
        id="mainVideo"
        controls
        playsinline
        preload="metadata"
        ${video.thumbnail_url
          ? `poster="${escapeHTML(video.thumbnail_url)}"`
          : ""}
        style="
          width:100%;
          display:block;
          background:#000;
          border-radius:10px;
        "
      ></video>

      <h1 class="videoTitle">
        ${escapeHTML(video.title || "Untitled")}
      </h1>

      <div class="videoMeta">
        ${escapeHTML(video.category || "Video")}
        ·
        <span id="viewCount">${Number(video.views || 0)}</span>
        views
      </div>

      <div class="actionBar">

        <button id="likeBtn" class="actionBtn">
          ❤️ <span id="likeText">Like</span>
          <span id="likeCount">0</span>
        </button>

        <button id="commentBtn" class="actionBtn">
          💬 Comment
        </button>

      </div>

      ${
        video.description
          ? `
            <div class="description">
              ${escapeHTML(video.description)}
            </div>
          `
          : ""
      }

      <section id="commentsSection" class="commentsSection">

        <h2>Comments</h2>

        <div class="commentForm">

          <input
            id="commentInput"
            type="text"
            maxlength="500"
            placeholder="Write a comment..."
          />

          <button id="commentSubmit">
            Post
          </button>

        </div>

        <div id="commentsList">
          <p class="muted">Loading comments...</p>
        </div>

      </section>

      <section class="relatedSection">

        <h2>Random Videos</h2>

        <div id="relatedGrid" class="relatedGrid">
          <p class="muted">Loading videos...</p>
        </div>

      </section>

    </div>
  `;

  const player = document.getElementById("mainVideo");

  player.src = video.video_url;
  player.load();

  let counted = false;

  player.addEventListener("play", async () => {
    if (counted) return;

    counted = true;

    const newViews = Number(video.views || 0) + 1;

    document.getElementById("viewCount").textContent = newViews;

    await supabase
      .from("videos")
      .update({ views: newViews })
      .eq("id", video.id);
  });

  document
    .getElementById("likeBtn")
    .addEventListener("click", toggleLike);

  document
    .getElementById("commentBtn")
    .addEventListener("click", () => {
      document
        .getElementById("commentsSection")
        .scrollIntoView({ behavior: "smooth" });
    });

  document
    .getElementById("commentSubmit")
    .addEventListener("click", addComment);

  document
    .getElementById("commentInput")
    .addEventListener("keydown", e => {
      if (e.key === "Enter") addComment();
    });
}

async function loadLikes() {
  const { count } = await supabase
    .from("video_likes")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("video_id", videoId);

  document.getElementById("likeCount").textContent =
    Number(count || 0);

  const { data } = await supabase
    .from("video_likes")
    .select("id")
    .eq("video_id", videoId)
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (data) {
    document.getElementById("likeText").textContent = "Liked";
    document.getElementById("likeBtn").classList.add("liked");
  }
}

async function toggleLike() {
  const btn = document.getElementById("likeBtn");
  const liked = btn.classList.contains("liked");

  if (liked) {

    await supabase
      .from("video_likes")
      .delete()
      .eq("video_id", videoId)
      .eq("visitor_id", visitorId);

  } else {

    const { error } = await supabase
      .from("video_likes")
      .insert({
        video_id: videoId,
        visitor_id: visitorId
      });

    if (error) {
      console.error("Like error:", error);
      return;
    }
  }

  await loadLikes();
}

async function loadComments() {
  const list = document.getElementById("commentsList");

  const { data, error } = await supabase
    .from("video_comments")
    .select("id, comment, created_at")
    .eq("video_id", videoId)
    .order("created_at", {
      ascending: false
    })
    .limit(100);

  if (error) {
    console.error("Comment load error:", error);

    list.innerHTML =
      `<p class="muted">Could not load comments.</p>`;

    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML =
      `<p class="muted">No comments yet. Be the first!</p>`;

    return;
  }

  list.innerHTML = data.map(item => `
    <div class="commentItem">

      <strong>Guest</strong>

      <p>
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
    console.error("Comment error:", error);
    alert("Comment could not be posted.");
    return;
  }

  input.value = "";

  await loadComments();
}

async function loadRandomVideos(currentId) {
  const grid = document.getElementById("relatedGrid");

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

  if (error || !data || data.length === 0) {
    grid.innerHTML =
      `<p class="muted">No other videos available.</p>`;

    return;
  }

  const videos = [...data]
    .sort(() => Math.random() - 0.5)
    .slice(0, 20);

  grid.innerHTML = videos.map(video => `

    <a
      class="relatedCard"
      href="video.html?id=${encodeURIComponent(video.id)}"
    >

      ${
        video.thumbnail_url
          ? `
            <img
              src="${escapeHTML(video.thumbnail_url)}"
              loading="lazy"
              alt=""
            />
          `
          : `
            <div class="noThumb">
              ▶
            </div>
          `
      }

      <div class="relatedInfo">

        <div class="relatedTitle">
          ${escapeHTML(video.title || "Untitled")}
        </div>

        <div class="relatedViews">
          ${Number(video.views || 0)} views
        </div>

      </div>

    </a>

  `).join("");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
      }
