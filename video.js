
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MEDIA_FUNCTION =
  "https://mfrbbclweacgjqmyoiub.supabase.co/functions/v1/get-video-media";

const BUCKET = "thumbnails";
const RELATED_LIMIT = 20;

const params = new URLSearchParams(location.search);
const videoId = params.get("id");

const visitorId = getVisitorId();

function getVisitorId() {
  try {
    let id = localStorage.getItem("desivexa_visitor_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("desivexa_visitor_id", id);
    }
    return id;
  } catch {
    return "visitor-" + Math.random().toString(36).slice(2);
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatViews(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

/*
 * Supports:
 * 1. Complete public URL
 * 2. Storage path inside thumbnails bucket
 * 3. Path beginning with thumbnails/
 *
 * Do not store temporary signed URLs permanently in the database.
 */
function getThumbnailUrl(value) {
  if (!value || typeof value !== "string") return "";

  const input = value.trim();
  if (!input) return "";

  if (/^https?:\/\//i.test(input)) return input;

  let path = input.replace(/^\/+/, "");
  path = path.replace(
    /^storage\/v1\/object\/public\/thumbnails\//i,
    ""
  );
  path = path.replace(
    /^storage\/v1\/object\/sign\/thumbnails\//i,
    ""
  );
  path = path.replace(/^thumbnails\//i, "");

  if (!path || path.includes("..")) return "";

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

async function getMedia(id) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(MEDIA_FUNCTION, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + (session?.access_token || SUPABASE_ANON_KEY)
      },
      body: JSON.stringify({ videoId: id, id })
    });

    if (!response.ok) return {};

    const data = await response.json();
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    console.error("Media request failed:", error);
    return {};
  }
}

function addStyles() {
  if (document.getElementById("desivexa-video-styles")) return;

  const style = document.createElement("style");
  style.id = "desivexa-video-styles";
  style.textContent = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: #090909; color: #f5f5f5;
      font-family: Arial, sans-serif;
    }
    a { color: inherit; text-decoration: none; }
    .dv-wrap { max-width: 1200px; margin: auto; padding: 14px; padding-bottom: 80px; }
    .dv-header {
      display:flex; align-items:center; justify-content:space-between;
      gap:12px; padding:10px 0 16px; border-bottom:1px solid #262626;
    }
    .dv-logo { color:#ff3038; font-size:23px; font-weight:800; }
    .dv-back { background:#202020; border:1px solid #333; color:white;
      padding:9px 12px; border-radius:9px; }
    .dv-player-box { width:100%; background:#000; border-radius:12px; overflow:hidden; }
    .dv-player { display:block; width:100%; max-height:70vh; aspect-ratio:16/9; background:#000; }
    .dv-title { font-size:22px; line-height:1.35; margin:14px 0 8px; }
    .dv-meta { color:#aaa; font-size:13px; margin-bottom:14px; }
    .dv-actions { display:flex; flex-wrap:wrap; gap:9px; margin:12px 0 20px; }
    .dv-btn { border:1px solid #343434; background:#1b1b1b; color:#fff;
      border-radius:22px; padding:10px 14px; cursor:pointer; font-size:14px; }
    .dv-btn:active { transform:scale(.98); }
    .dv-primary { background:#e92332; border-color:#e92332; }
    .dv-section { margin-top:25px; }
    .dv-section h2 { font-size:19px; margin:0 0 14px; }
    .dv-description { white-space:pre-wrap; line-height:1.5; color:#ccc; }
    .dv-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px 10px; }
    .dv-card { min-width:0; cursor:pointer; }
    .dv-thumb-wrap { aspect-ratio:16/9; background:#1d1d1d; border-radius:8px;
      overflow:hidden; position:relative; }
    .dv-thumb { width:100%; height:100%; object-fit:cover; display:block; }
    .dv-thumb-fallback { display:flex; width:100%; height:100%; align-items:center;
      justify-content:center; color:#aaa; font-size:12px; text-align:center; padding:8px; }
    .dv-card-title { font-size:13px; font-weight:600; line-height:1.4; margin-top:7px;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .dv-card-meta { font-size:11px; color:#999; margin-top:5px; }
    .dv-comments { border-top:1px solid #292929; padding-top:18px; }
    .dv-comment-form { display:flex; flex-direction:column; gap:9px; margin-bottom:18px; }
    .dv-input, .dv-textarea { width:100%; background:#171717; color:white;
      border:1px solid #383838; border-radius:9px; padding:12px; font:inherit; }
    .dv-textarea { min-height:85px; resize:vertical; }
    .dv-comment { padding:12px 0; border-bottom:1px solid #252525; }
    .dv-comment-body { white-space:pre-wrap; line-height:1.5; overflow-wrap:anywhere; }
    .dv-small { font-size:12px; color:#999; margin-top:6px; }
    .dv-status { color:#aaa; padding:14px 0; font-size:14px; }
    .dv-error { color:#ff7b82; }
    .dv-footer-nav { display:flex; justify-content:space-around; gap:6px;
      position:fixed; bottom:0; left:0; right:0; background:#101010;
      border-top:1px solid #292929; padding:11px 5px calc(11px + env(safe-area-inset-bottom));
      z-index:20; }
    .dv-footer-nav a { font-size:12px; color:#ddd; padding:3px 6px; }
    @media (min-width:700px) {
      .dv-wrap { padding:22px; }
      .dv-grid { grid-template-columns:repeat(4,minmax(0,1fr)); gap:18px 14px; }
      .dv-title { font-size:26px; }
    }
  `;
  document.head.appendChild(style);
}

function ensureRoot() {
  let root = document.getElementById("videoContainer") ||
             document.getElementById("video-content") ||
             document.getElementById("app");

  if (!root) {
    root = document.createElement("main");
    root.id = "videoContainer";
    document.body.appendChild(root);
  }
  return root;
}

function renderShell() {
  const root = ensureRoot();
  root.innerHTML = `
    <div class="dv-wrap">
      <header class="dv-header">
        <a class="dv-logo" href="index.html">DesiVexa</a>
        <a class="dv-back" href="index.html">← Home</a>
      </header>

      <div id="dv-status" class="dv-status">Loading video...</div>
      <section id="dv-main" hidden>
        <div class="dv-player-box">
          <video id="dv-player" class="dv-player" controls playsinline preload="metadata"></video>
        </div>
        <h1 id="dv-title" class="dv-title"></h1>
        <div id="dv-meta" class="dv-meta"></div>
        <div class="dv-actions">
          <button id="dv-like" class="dv-btn" type="button">♡ Like</button>
          <button id="dv-comment-jump" class="dv-btn" type="button">💬 Comments</button>
          <button id="dv-share" class="dv-btn" type="button">↗ Share</button>
        </div>
        <section class="dv-section">
          <h2>Description</h2>
          <div id="dv-description" class="dv-description"></div>
        </section>
        <section class="dv-section">
          <h2>Related Videos</h2>
          <div id="dv-related" class="dv-grid"></div>
          <div id="dv-related-status" class="dv-status"></div>
        </section>
        <section id="dv-comments-section" class="dv-section dv-comments">
          <h2>Comments</h2>
          <form id="dv-comment-form" class="dv-comment-form">
            <textarea id="dv-comment-input" class="dv-textarea"
              maxlength="2000" placeholder="Write a comment..." required></textarea>
            <button class="dv-btn dv-primary" type="submit">Post Comment</button>
          </form>
          <div id="dv-comments-list" class="dv-status">Loading comments...</div>
        </section>
      </section>
    </div>
    <nav class="dv-footer-nav">
      <a href="index.html">⌂ Home</a>
      <a href="new.html">New</a>
      <a href="trending.html">Trending</a>
      <a href="recommended.html">Recommended</a>
    </nav>
  `;
  return root;
}

function showStatus(message, isError = false) {
  const el = document.getElementById("dv-status");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("dv-error", isError);
}

async function getCurrentVideo(id) {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getRelatedVideos(current) {
  let query = supabase
    .from("videos")
    .select("id,title,category,thumbnail_url,views,created_at,published")
    .neq("id", current.id)
    .order("created_at", { ascending: false })
    .limit(RELATED_LIMIT);

  if (current.category) {
    query = query.eq("category", current.category);
  }

  let result = await query;

  if (result.error || !result.data?.length) {
    result = await supabase
      .from("videos")
      .select("id,title,category,thumbnail_url,views,created_at,published")
      .neq("id", current.id)
      .order("created_at", { ascending: false })
      .limit(RELATED_LIMIT);
  }

  if (result.error) throw result.error;

  return (result.data || []).filter(item =>
    item.published === true ||
    item.published === "true" ||
    item.published === 1
  ).slice(0, RELATED_LIMIT);
}

function renderRelated(items) {
  const grid = document.getElementById("dv-related");
  const status = document.getElementById("dv-related-status");

  if (!items.length) {
    grid.innerHTML = "";
    status.textContent = "No related videos found.";
    return;
  }

  status.textContent = "";

  grid.innerHTML = items.map(item => {
    const title = escapeHTML(item.title || "Untitled video");
    const thumb = getThumbnailUrl(item.thumbnail_url);
    const href = "video.html?id=" + encodeURIComponent(item.id);

    return `
      <a class="dv-card" href="${href}">
        <div class="dv-thumb-wrap">
          ${
            thumb
              ? `<img class="dv-thumb" src="${escapeHTML(thumb)}"
                    alt="${title}" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ""
          }
          <div class="dv-thumb-fallback" style="${thumb ? "display:none" : "display:flex"}">
            Thumbnail unavailable
          </div>
        </div>
        <div class="dv-card-title">${title}</div>
        <div class="dv-card-meta">${formatViews(item.views)} views · ${escapeHTML(item.category || "Video")}</div>
      </a>
    `;
  }).join("");
}

async function loadVideoSource(video) {
  const player = document.getElementById("dv-player");

  // A direct video URL may already be stored in the database.
  if (video.video_url && /^https?:\/\//i.test(video.video_url)) {
    player.src = video.video_url;
    return;
  }

  // Otherwise ask the existing Edge Function for its playback URL.
  const media = await getMedia(video.id);
  const source =
    media.videoUrl ||
    media.video_url ||
    media.url ||
    media.signedUrl ||
    media.signed_url;

  if (source && /^https?:\/\//i.test(source)) {
    player.src = source;
  } else {
    player.insertAdjacentHTML(
      "afterend",
      '<div class="dv-status dv-error">Video URL could not be loaded. Check the get-video-media function.</div>'
    );
  }
}

async function loadComments(id) {
  const list = document.getElementById("dv-comments-list");
  list.textContent = "Loading comments...";

  const { data, error } = await supabase
    .from("video_comments")
    .select("*")
    .eq("video_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    list.innerHTML =
      '<div class="dv-status">Comments could not be loaded. Check video_comments table policies and column names.</div>';
    console.error("Comments query failed:", error);
    return;
  }

  if (!data?.length) {
    list.textContent = "No comments yet. Be the first to comment.";
    return;
  }

  list.innerHTML = data.map(comment => `
    <article class="dv-comment">
      <div class="dv-comment-body">${escapeHTML(comment.body || comment.comment || "")}</div>
      <div class="dv-small">${formatDate(comment.created_at)}</div>
    </article>
  `).join("");
}

async function postComment(event) {
  event.preventDefault();

  const input = document.getElementById("dv-comment-input");
  const body = input.value.trim();
  if (!body) return;

  const button = event.submitter;
  if (button) button.disabled = true;

  try {
    const { error } = await supabase
      .from("video_comments")
      .insert({
        video_id: videoId,
        visitor_id: visitorId,
        body
      });

    if (error) throw error;

    input.value = "";
    await loadComments(videoId);
  } catch (error) {
    console.error("Comment insert failed:", error);
    alert("Comment post nahi hua. Table columns aur Supabase policies check karo.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleLike() {
  const button = document.getElementById("dv-like");
  button.disabled = true;

  try {
    // This assumes video_likes has video_id and visitor_id columns.
    const { data: existing, error: findError } = await supabase
      .from("video_likes")
      .select("id")
      .eq("video_id", videoId)
      .eq("visitor_id", visitorId)
      .limit(1);

    if (findError) throw findError;

    if (existing?.length) {
      const { error } = await supabase
        .from("video_likes")
        .delete()
        .eq("video_id", videoId)
        .eq("visitor_id", visitorId);

      if (error) throw error;
      button.textContent = "♡ Like";
    } else {
      const { error } = await supabase
        .from("video_likes")
        .insert({ video_id: videoId, visitor_id: visitorId });

      if (error) throw error;
      button.textContent = "♥ Liked";
    }
  } catch (error) {
    console.error("Like action failed:", error);
    alert("Like feature ke table columns/policies tumhare database se match nahi kar rahe.");
  } finally {
    button.disabled = false;
  }
}

async function init() {
  addStyles();
  renderShell();

  if (!videoId) {
    showStatus("Video ID missing. Homepage se video dobara kholo.", true);
    return;
  }

  try {
    const video = await getCurrentVideo(videoId);

    if (!video) {
      showStatus("Video nahi mila. Link ya video ID check karo.", true);
      return;
    }

    document.getElementById("dv-status").hidden = true;
    document.getElementById("dv-main").hidden = false;

    document.getElementById("dv-title").textContent =
      video.title || "Untitled video";

    document.getElementById("dv-meta").textContent =
      `${formatViews(video.views)} views` +
      (video.created_at ? " · " + formatDate(video.created_at) : "") +
      (video.category ? " · " + video.category : "");

    document.getElementById("dv-description").textContent =
      video.description || "No description available.";

    document.getElementById("dv-like").addEventListener("click", handleLike);

    document.getElementById("dv-comment-jump").addEventListener("click", () => {
      document.getElementById("dv-comments-section").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    document.getElementById("dv-share").addEventListener("click", async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: video.title || "DesiVexa", url: location.href });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(location.href);
          alert("Video link copied!");
        } else {
          prompt("Copy this video link:", location.href);
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          prompt("Copy this video link:", location.href);
        }
      }
    });

    document.getElementById("dv-comment-form")
      .addEventListener("submit", postComment);

    await Promise.allSettled([
      loadVideoSource(video),
      loadComments(videoId)
    ]);

    try {
      const related = await getRelatedVideos(video);
      renderRelated(related);
    } catch (error) {
      console.error("Related videos failed:", error);
      document.getElementById("dv-related-status").textContent =
        "Related videos could not be loaded. Check the videos table query and RLS policies.";
    }
  } catch (error) {
    console.error("Video load failed:", error);
    showStatus("Could not load video. Check video ID, Supabase config, and videos table.", true);
  }
}

init();
