
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MEDIA_FUNCTION = `${SUPABASE_URL}/functions/v1/get-video-media`;
const page = document.getElementById("page");

// =====================================================
// HELPERS
// =====================================================

function getVideoId() {
  const url = new URL(window.location.href);
  let id = url.searchParams.get("id");
  if (!id) return null;

  id = id.trim();
  if (id.includes("?")) id = id.split("?")[0];
  if (id.includes("=")) id = id.split("=")[0];

  return id.trim();
}

const videoId = getVideoId();

function isValidUUID(value) {
  return !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fallbackThumbnail(title) {
  const safeTitle = String(title || "DesiVexa")
    .substring(0, 28)
    .replace(/[<>&"']/g, "");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#181818"/>
      <text x="320" y="170" text-anchor="middle"
        fill="#e50914" font-size="34" font-family="Arial"
        font-weight="700">DesiVexa</text>
      <text x="320" y="215" text-anchor="middle"
        fill="#777" font-size="17" font-family="Arial">${safeTitle}</text>
    </svg>`;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function showError(message) {
  if (!page) return;

  page.innerHTML = `
    <div style="min-height:60vh;display:flex;align-items:center;
      justify-content:center;padding:25px 15px;">
      <div style="width:100%;max-width:600px;background:#111;
        border:1px solid #292929;border-radius:14px;padding:25px;
        text-align:center;">
        <div style="color:#ff3030;font-size:21px;font-weight:700;
          margin-bottom:12px;">Could not load video</div>
        <div style="color:#aaa;font-size:14px;line-height:1.5;
          word-break:break-word;">${escapeHtml(message)}</div>
        <a href="index.html" style="display:inline-block;margin-top:20px;
          padding:11px 18px;background:#e50914;color:#fff;
          text-decoration:none;border-radius:8px;font-weight:600;">
          Go Home
        </a>
      </div>
    </div>`;
}

// =====================================================
// SUPABASE SIGNED MEDIA
// =====================================================

async function getMedia(id) {
  const response = await fetch(MEDIA_FUNCTION, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ videoId: id })
  });

  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch {
    result = { error: text };
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      result.message ||
      `Media request failed (${response.status})`
    );
  }

  if (!result.videoUrl) {
    throw new Error("Signed video URL nahi mili.");
  }

  return result;
}

async function getThumbnail(id) {
  try {
    const media = await getMedia(id);
    return media.thumbnailUrl || "";
  } catch (error) {
    console.warn("Thumbnail error:", id, error);
    return "";
  }
}

// =====================================================
// LIKE AND COMMENT COUNTS
// =====================================================

async function getLikeCount(id) {
  const { count, error } = await supabase
    .from("video_likes")
    .select("*", { count: "exact", head: true })
    .eq("video_id", id);

  if (error) {
    console.warn("LIKE COUNT ERROR:", error);
    return 0;
  }

  return Number(count || 0);
}

async function getCommentCount(id) {
  const { count, error } = await supabase
    .from("video_comments")
    .select("*", { count: "exact", head: true })
    .eq("video_id", id);

  if (error) {
    console.warn("COMMENT COUNT ERROR:", error);
    return 0;
  }

  return Number(count || 0);
}

async function updateCounts(id) {
  const [likes, comments] = await Promise.all([
    getLikeCount(id),
    getCommentCount(id)
  ]);

  const likeCount = document.getElementById("likeCount");
  const commentCount = document.getElementById("commentCount");

  if (likeCount) likeCount.textContent = likes;
  if (commentCount) commentCount.textContent = comments;

  return { likes, comments };
}

// =====================================================
// LOAD VIDEO
// =====================================================

async function loadVideo() {
  if (!page) return;

  if (!videoId) {
    showError("Video ID URL me nahi mili.");
    return;
  }

  if (!isValidUUID(videoId)) {
    showError(`Invalid video ID: ${videoId}`);
    return;
  }

  page.innerHTML = `
    <div style="padding:30px;color:#aaa;text-align:center;">
      Loading video...
    </div>`;

  try {
    const { data: video, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .eq("published", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!video) throw new Error("Published video nahi mila.");

    const media = await getMedia(video.id);

    renderVideo(video, media);

    updateCounts(video.id);
    increaseViews(video.id, video.views);
    loadComments(video.id);
    setupLikeButton(video.id);
    loadRandomVideos(video.id);

  } catch (error) {
    console.error("LOAD VIDEO ERROR:", error);
    showError(error.message || "Unknown error");
  }
}

// =====================================================
// RENDER VIDEO PAGE
// =====================================================

function renderVideo(video, media) {
  page.innerHTML = `
    <section style="width:100%;padding:12px;box-sizing:border-box;">

      <div style="width:100%;background:#000;border-radius:10px;overflow:hidden;">
        <video id="mainVideo" controls playsinline preload="metadata"
          style="display:block;width:100%;max-height:75vh;background:#000;">
        </video>
      </div>

      <div style="padding:15px 2px;">
        <h1 style="margin:0 0 10px;color:#fff;font-size:20px;line-height:1.4;">
          ${escapeHtml(video.title)}
        </h1>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:15px;">
          <span style="background:#181818;border:1px solid #292929;color:#aaa;padding:6px 10px;border-radius:20px;font-size:13px;">
            ${escapeHtml(video.category || "Other")}
          </span>
          <span style="background:#181818;border:1px solid #292929;color:#aaa;padding:6px 10px;border-radius:20px;font-size:13px;">
            <span id="viewCount">${Number(video.views || 0)}</span> views
          </span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:20px;">
          <button id="likeBtn" type="button"
            style="min-width:0;padding:10px 5px;background:#151515;border:1px solid #333;color:#fff;border-radius:8px;cursor:pointer;">
            <span>❤️ Like</span>
            <span id="likeCount" style="color:#aaa;margin-left:3px;">0</span>
          </button>

          <button id="commentScrollBtn" type="button"
            style="min-width:0;padding:10px 5px;background:#151515;border:1px solid #333;color:#fff;border-radius:8px;cursor:pointer;">
            💬 Comments
            <span id="commentCount" style="color:#aaa;margin-left:3px;">0</span>
          </button>

          <button id="shareBtn" type="button"
            style="min-width:0;padding:10px 5px;background:#151515;border:1px solid #333;color:#fff;border-radius:8px;cursor:pointer;">
            ↗ Share
          </button>
        </div>

        ${video.description ? `
          <div style="background:#111;border:1px solid #222;border-radius:10px;padding:14px;color:#aaa;font-size:14px;line-height:1.6;margin-bottom:25px;white-space:pre-wrap;">
            ${escapeHtml(video.description)}
          </div>` : ""}

        <section id="commentsSection" style="margin-top:25px;scroll-margin-top:70px;">
          <h2 style="margin:0 0 15px;font-size:19px;color:#fff;">Comments</h2>
          <div id="commentForm"></div>
          <div id="commentsList" style="color:#777;">Loading comments...</div>
        </section>

        <section style="margin-top:35px;">
          <h2 style="margin:0 0 15px;font-size:19px;color:#fff;">Related Videos</h2>
          <div id="randomVideos" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
            <div style="color:#777;grid-column:1/-1;">Loading related videos...</div>
          </div>
        </section>
      </div>
    </section>`;

  const player = document.getElementById("mainVideo");

  if (player) {
    player.src = media.videoUrl;
    player.poster = media.thumbnailUrl || fallbackThumbnail(video.title);
    player.load();
  }

  document.getElementById("commentScrollBtn")?.addEventListener("click", () => {
    document.getElementById("commentsSection")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  document.getElementById("shareBtn")?.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          url: window.location.href
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        alert("Video link copied!");
      } else {
        prompt("Copy video link:", window.location.href);
      }
    } catch (error) {
      console.log("Share cancelled:", error);
    }
  });
}

// =====================================================
// VIEWS
// =====================================================

async function increaseViews(id, currentViews) {
  try {
    const newViews = Number(currentViews || 0) + 1;

    const { error } = await supabase
      .from("videos")
      .update({ views: newViews })
      .eq("id", id);

    if (error) throw error;

    const viewCount = document.getElementById("viewCount");
    if (viewCount) viewCount.textContent = newViews;

  } catch (error) {
    console.warn("Views error:", error);
  }
}

// =====================================================
// VISITOR ID
// =====================================================

function getVisitorId() {
  let id = localStorage.getItem("desivexa_visitor_id");

  if (!id) {
    id = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : "visitor-" + Date.now() + "-" + Math.random().toString(36).slice(2);

    localStorage.setItem("desivexa_visitor_id", id);
  }

  return id;
}

// =====================================================
// LIKE BUTTON
// =====================================================

async function setupLikeButton(id) {
  const button = document.getElementById("likeBtn");
  if (!button) return;

  const visitorId = getVisitorId();

  try {
    const { data, error } = await supabase
      .from("video_likes")
      .select("video_id")
      .eq("video_id", id)
      .eq("visitor_id", visitorId)
      .maybeSingle();

    button.dataset.liked = !error && data ? "true" : "false";

  } catch {
    button.dataset.liked = "false";
  }

  function updateButton() {
    const liked = button.dataset.liked === "true";
    const label = button.querySelector("span");

    if (label) label.textContent = liked ? "❤️ Liked" : "❤️ Like";
    button.style.borderColor = liked ? "#e50914" : "#333";
  }

  updateButton();

  button.addEventListener("click", async () => {
    const liked = button.dataset.liked === "true";
    button.disabled = true;

    try {
      let result;

      if (liked) {
        result = await supabase
          .from("video_likes")
          .delete()
          .eq("video_id", id)
          .eq("visitor_id", visitorId);
      } else {
        result = await supabase
          .from("video_likes")
          .insert({
            video_id: id,
            visitor_id: visitorId
          });
      }

      if (result.error) throw result.error;

      button.dataset.liked = liked ? "false" : "true";
      updateButton();

      const count = await getLikeCount(id);
      const likeCount = document.getElementById("likeCount");

      if (likeCount) likeCount.textContent = count;

    } catch (error) {
      console.error("LIKE ERROR:", error);
      alert("Like update nahi hua. Supabase permissions check karo.");
    } finally {
      button.disabled = false;
    }
  });
}

// =====================================================
// COMMENTS
// =====================================================

async function loadComments(id) {
  const form = document.getElementById("commentForm");
  const list = document.getElementById("commentsList");

  if (!form || !list) return;

  form.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:18px;">
      <input id="commentInput" type="text" maxlength="500"
        placeholder="Write a comment..." autocomplete="off"
        style="flex:1;min-width:0;padding:11px;background:#111;color:#fff;border:1px solid #333;border-radius:8px;outline:none;">
      <button id="commentSubmit" type="button"
        style="padding:0 15px;border:0;border-radius:8px;background:#e50914;color:#fff;font-weight:600;cursor:pointer;">
        Post
      </button>
    </div>`;

  const input = document.getElementById("commentInput");
  const submit = document.getElementById("commentSubmit");

  async function postComment() {
    const body = input.value.trim();

    if (!body || submit.disabled) return;

    submit.disabled = true;
    submit.textContent = "Posting...";

    try {
      const { error } = await supabase
        .from("video_comments")
        .insert({
          video_id: id,
          visitor_id: getVisitorId(),
          body
        });

      if (error) throw error;

      input.value = "";
      await fetchComments(id);

      const count = await getCommentCount(id);
      const commentCount = document.getElementById("commentCount");

      if (commentCount) commentCount.textContent = count;

    } catch (error) {
      console.error("COMMENT ERROR:", error);
      alert("Comment post nahi hua. Supabase permissions check karo.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Post";
    }
  }

  submit.addEventListener("click", postComment);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      postComment();
    }
  });

  await fetchComments(id);
}

// =====================================================
// FETCH COMMENTS
// =====================================================

async function fetchComments(id) {
  const list = document.getElementById("commentsList");
  if (!list) return;

  try {
    const { data, error } = await supabase
      .from("video_comments")
      .select("*")
      .eq("video_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = `
        <div style="color:#777;padding:12px 0;">No comments yet.</div>`;
      return;
    }

    list.innerHTML = data.map(comment => `
      <div style="background:#111;border:1px solid #222;border-radius:10px;padding:12px;margin-bottom:10px;">
        <div style="color:#777;font-size:11px;margin-bottom:6px;">Visitor</div>
        <div style="color:#eee;font-size:14px;line-height:1.5;word-break:break-word;">
          ${escapeHtml(comment.body)}
        </div>
      </div>
    `).join("");

  } catch (error) {
    console.error("COMMENTS ERROR:", error);

    list.innerHTML = `
      <div style="color:#777;padding:10px 0;">Comments unavailable.</div>`;
  }
}

// =====================================================
// RELATED VIDEOS — 20 VIDEOS
// duration COLUMN REMOVED
// =====================================================

async function loadRandomVideos(currentVideoId) {
  const container = document.getElementById("randomVideos");
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("id,title,category,thumbnail_url,views,created_at")
      .eq("published", true)
      .neq("id", currentVideoId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div style="color:#777;grid-column:1/-1;">
          No related videos found.
        </div>`;
      return;
    }

    container.innerHTML = "";

    const cards = new Map();

    // Render cards immediately with fallback thumbnails.
    for (const video of data) {
      const card = document.createElement("a");

      card.href = `video.html?id=${encodeURIComponent(video.id)}`;

      card.style.cssText = `
        display:block;
        text-decoration:none;
        color:#fff;
        background:#111;
        border:1px solid #222;
        border-radius:9px;
        overflow:hidden;
        min-width:0;
      `;

      card.innerHTML = `
        <div style="position:relative;width:100%;aspect-ratio:16/9;background:#181818;overflow:hidden;">
          <img class="related-thumb"
            src="${fallbackThumbnail(video.title)}"
            alt="${escapeHtml(video.title)}"
            loading="lazy"
            style="width:100%;height:100%;object-fit:cover;display:block;">
        </div>

        <div style="padding:9px;">
          <div style="color:#fff;font-size:13px;font-weight:600;line-height:1.35;
            display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${escapeHtml(video.title)}
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap;color:#777;font-size:11px;margin-top:6px;">
            <span>${escapeHtml(video.category || "Other")}</span>
            <span>•</span>
            <span>${Number(video.views || 0)} views</span>
          </div>
        </div>`;

      container.appendChild(card);
      cards.set(video.id, card);
    }

    // Fetch thumbnails independently; failures won't hide video cards.
    await Promise.allSettled(data.map(async video => {
      const thumbnailUrl = await getThumbnail(video.id);
      if (!thumbnailUrl) return;

      const card = cards.get(video.id);
      const image = card?.querySelector(".related-thumb");

      if (image) image.src = thumbnailUrl;
    }));

  } catch (error) {
    console.error("RELATED VIDEOS ERROR:", error);

    container.innerHTML = `
      <div style="color:#777;grid-column:1/-1;">
        Related videos unavailable. Please refresh the page.
      </div>`;
  }
}

// =====================================================
// START
// =====================================================

loadVideo();
