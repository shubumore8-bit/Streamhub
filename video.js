import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const page = document.querySelector("#page");

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#39;"
}[c]));

const getVideoId = () => new URLSearchParams(location.search).get("id");

const visitorId = () => {
  let v = localStorage.getItem("desivexa_visitor_id");
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem("desivexa_visitor_id", v);
  }
  return v;
};

function isUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function age() {
  if (localStorage.getItem("desivexa_age_verified") === "1") return true;

  const ok = confirm(
    "18+ ONLY\n\nYou must be 18 years or older to access this website."
  );

  if (!ok) {
    location.href = "index.html";
    return false;
  }

  localStorage.setItem("desivexa_age_verified", "1");
  return true;
}

function showError(title, message) {
  page.innerHTML = `
    <div class="videoError">
      <h2>${esc(title)}</h2>
      <p>${esc(message)}</p>
      <a href="index.html">Go Home</a>
    </div>
  `;
}

function card(v) {
  const title = esc(v.title || "Untitled video");
  const cat = esc(v.category || "Other");
  const views = Number(v.views || 0).toLocaleString();

  const thumb = v.thumbnail_url
    ? `<img src="${esc(v.thumbnail_url)}" alt="${title}" loading="lazy">`
    : `<div class="noThumb">DESIVEXA</div>`;

  return `
    <a class="card" href="video.html?id=${encodeURIComponent(v.id)}">
      <div class="thumb">
        ${thumb}
        <div class="thumbOverlay"></div>
        <div class="playCircle">▶</div>
        <div class="cardViews">${views} views</div>
      </div>
      <div class="body">
        <h3>${title}</h3>
        <div class="cardMeta">
          <span>${cat}</span>
          <span>${views} views</span>
        </div>
      </div>
    </a>
  `;
}

async function related(current) {
  const box = document.querySelector("#relatedVideos");
  if (!box) return;

  const { data, error } = await supabase
    .from("videos")
    .select("id,title,category,thumbnail_url,views,created_at")
    .eq("published", true)
    .neq("id", current)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    box.innerHTML = `<p class="muted">No related videos yet.</p>`;
    return;
  }

  box.innerHTML = `
    <div class="dvSectionTitle">
      <div>
        <span class="sectionLabel">WATCH NEXT</span>
        <h2>Related Videos</h2>
      </div>
    </div>
    <div class="dvGrid">
      ${data.map(card).join("")}
    </div>
  `;
}

async function social(video) {
  const likeBtn = document.querySelector("#likeBtn");
  const likeCount = document.querySelector("#likeCount");
  const commentBtn = document.querySelector("#commentBtn");
  const comments = document.querySelector("#comments");
  const vid = visitorId();

  async function refreshLikes() {
    const { count } = await supabase
      .from("video_likes")
      .select("id", { count: "exact", head: true })
      .eq("video_id", video.id);

    if (likeCount) {
      likeCount.textContent = Number(count || 0).toLocaleString();
    }

    const { data } = await supabase
      .from("video_likes")
      .select("id")
      .eq("video_id", video.id)
      .eq("visitor_id", vid)
      .maybeSingle();

    if (likeBtn) {
      likeBtn.classList.toggle("active", !!data);
    }
  }

  let likeBusy = false;

  likeBtn?.addEventListener("click", async () => {
    if (likeBusy) return;

    likeBusy = true;
    likeBtn.disabled = true;

    try {
      const { data } = await supabase
        .from("video_likes")
        .select("id")
        .eq("video_id", video.id)
        .eq("visitor_id", vid)
        .maybeSingle();

      if (data) {
        await supabase
          .from("video_likes")
          .delete()
          .eq("id", data.id);
      } else {
        await supabase
          .from("video_likes")
          .insert({
            video_id: video.id,
            visitor_id: vid
          });
      }

      await refreshLikes();
    } catch (e) {
      console.warn("Like error:", e);
    } finally {
      likeBusy = false;
      likeBtn.disabled = false;
    }
  });

  commentBtn?.addEventListener("click", () => {
    document
      .querySelector("#commentSection")
      ?.scrollIntoView({ behavior: "smooth" });
  });

  async function loadComments() {
    if (!comments) return;

    const { data, error } = await supabase
      .from("video_comments")
      .select("display_name,body,created_at")
      .eq("video_id", video.id)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      comments.innerHTML =
        `<p class="muted">Comments are not available yet.</p>`;
      return;
    }

    comments.innerHTML = data?.length
      ? data.map(c => `
          <div class="comment">
            <strong>${esc(c.display_name || "User")}</strong>
            <p>${esc(c.body)}</p>
          </div>
        `).join("")
      : `<p class="muted">No comments yet.</p>`;
  }

  document.querySelector("#commentForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    const form = e.target;
    const submit = form.querySelector("button[type=submit]");
    const name =
      document.querySelector("#commentName")?.value.trim() || "User";
    const body =
      document.querySelector("#commentText")?.value.trim();

    if (!body) return;

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Submitting...";
    }

    try {
      const { error } = await supabase
        .from("video_comments")
        .insert({
          video_id: video.id,
          visitor_id: vid,
          display_name: name.slice(0, 60),
          body: body.slice(0, 2000),
          approved: false
        });

      if (error) {
        console.error(error);
        alert("Comment could not be submitted.");
        return;
      }

      form.reset();
      alert("Comment submitted for review.");
      await loadComments();

    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Post Comment";
      }
    }
  });

  refreshLikes();
  loadComments();
}

async function load() {
  if (!age()) return;

  const videoId = getVideoId();

  if (!videoId) {
    showError("Video not found", "No video ID was provided.");
    return;
  }

  // IMPORTANT: videos.id is a UUID column.
  if (!isUUID(videoId)) {
    showError(
      "Invalid video link",
      "This link does not contain a valid video ID."
    );
    return;
  }

  const { data: video, error: e } = await supabase
    .from("videos")
    .select(
      "id,title,category,description,video_url,thumbnail_url,views,created_at"
    )
    .eq("id", videoId)
    .eq("published", true)
    .maybeSingle();

  if (e) {
    console.error(e);
    showError("Could not load video", e.message);
    return;
  }

  if (!video) {
    showError(
      "Video unavailable",
      "This video does not exist or is not published."
    );
    return;
  }

  if (!video.video_url) {
    showError(
      "Video unavailable",
      "This video has no video file URL."
    );
    return;
  }

  const title = esc(video.title || "Untitled video");
  const cat = esc(video.category || "Other");
  const desc = esc(video.description || "");
  const views = Number(video.views || 0).toLocaleString();
  const poster = video.thumbnail_url
    ? `poster="${esc(video.thumbnail_url)}"`
    : "";

  page.innerHTML = `
    <section class="videoWatch">

      <div class="videoPlayerWrap">
        <video
          id="player"
          controls
          playsinline
          preload="metadata"
          ${poster}
        >
          <source
            src="${esc(video.video_url)}"
            type="video/mp4"
          >
          Your browser does not support HTML5 video.
        </video>
      </div>

      <div class="videoInfo">
        <h1>${title}</h1>

        <div class="videoMeta">
          <span>${cat}</span>
          <span>${views} views</span>
        </div>

        ${desc
          ? `<p class="videoDescription">${desc}</p>`
          : ""}

        <div class="videoActions">
          <button type="button" id="likeBtn">
            ❤ <span id="likeCount">0</span>
          </button>

          <button type="button" id="commentBtn">
            💬 Comment
          </button>

          <button type="button" id="shareBtn">
            Share
          </button>

          <button type="button" id="copyBtn">
            Copy Link
          </button>
        </div>

        <span class="videoTag">${cat}</span>
      </div>

      <div class="dvAdSlot midAd"></div>

      <section id="commentSection" class="commentSection">

        <div class="dvSectionTitle">
          <div>
            <span class="sectionLabel">COMMUNITY</span>
            <h2>Comments</h2>
          </div>
        </div>

        <form id="commentForm" class="commentForm">
          <input
            id="commentName"
            maxlength="60"
            placeholder="Your name"
            required
          >

          <textarea
            id="commentText"
            maxlength="2000"
            rows="4"
            placeholder="Write a comment..."
            required
          ></textarea>

          <button type="submit">
            Post Comment
          </button>
        </form>

        <div id="comments"></div>

      </section>

      <div id="relatedVideos"></div>

    </section>
  `;

  document.querySelector("#shareBtn")?.addEventListener(
    "click",
    async () => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: video.title || "DesiVexa",
            url: location.href
          });
        } else {
          await navigator.clipboard.writeText(location.href);
          alert("Video link copied.");
        }
      } catch {}
    }
  );

  document.querySelector("#copyBtn")?.addEventListener(
    "click",
    async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        alert("Video link copied.");
      } catch {
        prompt("Copy this link:", location.href);
      }
    }
  );

  try {
    await supabase.rpc(
      "increment_video_views",
      { video_id: video.id }
    );
  } catch (e) {
    console.warn("View counter:", e);
  }

  await social(video);
  await related(video.id);
}

load();
