
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MEDIA_FUNCTION = `${SUPABASE_URL}/functions/v1/get-video-media`;

const params = new URLSearchParams(window.location.search);
const videoId = params.get("id");

let currentVideo = null;
let currentVideoUrl = "";
let visitorId = localStorage.getItem("desivexa_visitor_id");

if (!visitorId) {
  visitorId = crypto.randomUUID();
  localStorage.setItem("desivexa_visitor_id", visitorId);
}

const root =
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
  const number = Number(value || 0);
  return number.toLocaleString("en-IN");
}

function showMessage(message) {
  root.innerHTML = `
    <div style="background:#111;color:#fff;padding:25px;
      text-align:center;border-radius:10px;margin:15px;">
      ${escapeHTML(message)}
    </div>`;
}

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
    throw new Error("Video media load nahi ho paaya.");
  }

  const data = await response.json();

  return {
    videoUrl: data.videoUrl || data.signedUrl || data.url || "",
    thumbnailUrl: data.thumbnailUrl || data.thumbnail_url || ""
  };
}

async function loadVideo() {
  if (!videoId) {
    showMessage("Video ID nahi mili. Homepage se video open karein.");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      showMessage("Video nahi mila ya delete ho chuka hai.");
      return;
    }

    currentVideo = data;

    let media = { videoUrl: "", thumbnailUrl: "" };

    try {
      media = await getMedia(data.id);
    } catch (error) {
      console.error("Media error:", error);
    }

    currentVideoUrl = media.videoUrl;

    renderVideo(data, media);
    recordView(data.id);
    loadLikes(data.id);
    loadComments(data.id);
    loadRelatedVideos(data.id, data.category);
  } catch (error) {
    console.error("Video error:", error);
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
      padding:12px 12px 90px;box-sizing:border-box;
      font-family:Arial,sans-serif;">

      <header style="display:flex;align-items:center;
        justify-content:space-between;gap:10px;margin-bottom:15px;">
        <a href="/" style="color:#ff3030;font-size:25px;
          font-weight:bold;text-decoration:none;">DesiVexa</a>
        <a href="/" style="background:#202020;color:white;
          padding:9px 13px;border-radius:7px;text-decoration:none;">
          Home
        </a>
      </header>

      <div style="width:100%;background:#000;border-radius:10px;
        overflow:hidden;">
        <video id="mainVideo" controls playsinline preload="metadata"
          poster="${escapeHTML(thumbnail)}"
          style="display:block;width:100%;max-height:70vh;min-height:200px;
          background:#000;">
          ${media.videoUrl
            ? `<source src="${escapeHTML(media.videoUrl)}">`
            : ""}
          Your browser does not support video playback.
        </video>
      </div>

      ${!media.videoUrl ? `
        <p style="color:#ff7777;margin:10px 0;">
          Video playback URL load nahi hui. Storage aur get-video-media
          function settings check karein.
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

      <div style="display:flex;flex-wrap:wrap;gap:9px;
        margin:15px 0 20px;">

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
          <p style="color:#ccc;line-height:1.6;margin:0;
            white-space:pre-wrap;">${escapeHTML(video.description)}</p>
        </section>` : ""}

      <!-- RELATED VIDEOS: COMMENTS SE PEHLE -->
      <section id="relatedSection" style="margin-top:28px;">
        <h2 style="font-size:19px;margin:0 0 15px;">
          Related Videos
        </h2>

        <div id="randomVideos"
          style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;">
          <div style="color:#888;grid-column:1/-1;">
            Loading related videos...
          </div>
        </div>
      </section>

      <!-- COMMENTS: RELATED VIDEOS KE BAAD -->
      <section id="commentsSection"
        style="margin-top:35px;scroll-margin-top:20px;">
        <h2 style="font-size:19px;margin:0 0 15px;">Comments</h2>

        <form id="commentForm" style="margin-bottom:18px;">
          <textarea id="commentInput" maxlength="2000" required
            placeholder="Apna comment likhein..."
            style="box-sizing:border-box;width:100%;min-height:90px;
            background:#171717;color:#fff;border:1px solid #333;
            border-radius:9px;padding:12px;font-size:14px;
            resize:vertical;"></textarea>

          <button type="submit"
            style="margin-top:9px;background:#e5242a;color:#fff;
            border:0;border-radius:8px;padding:11px 17px;
            font-weight:bold;">
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

  document.getElementById("likeButton").addEventListener("click", () => {
    toggleLike(video.id);
  });

  document.getElementById("commentButton").addEventListener("click", () => {
    document.getElementById("commentsSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    setTimeout(() => {
      document.getElementById("commentInput")?.focus({
        preventScroll: true
      });
    }, 350);
  });

  document.getElementById("shareButton").addEventListener("click", shareVideo);

  document.getElementById("commentForm").addEventListener("submit", event => {
    submitComment(event, video.id);
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

    const result = await supabase
      .from("videos")
      .update({ views: nextViews })
      .eq("id", id);

    if (result.error) {
      console.warn("View count update failed:", result.error);
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
        <p style="color:#888;background:#151515;padding:14px;
          border-radius:8px;">Abhi koi comment nahi hai. Pehla comment karein!</p>`;
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
          <div style="color:#eee;line-height:1.5;
            white-space:pre-wrap;overflow-wrap:anywhere;">
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
    alert("Comment post nahi hua. Supabase table ke columns aur policies check karein.");
  } finally {
    button.disabled = false;
    button.textContent = "Post Comment";
  }
}

async function loadRelatedVideos(id, category) {
  const container = document.getElementById("randomVideos");
  if (!container) return;

  container.innerHTML = `
    <p style="color:#888;grid-column:1/-1;">Loading related videos...</p>`;

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

    // Category mein kam videos hon to baaki recent videos bhi dikhao.
    if ((!data || data.length < 20) && category) {
      const existingIds = [id, ...(data || []).map(item => item.id)];

      const fallback = await supabase
        .from("videos")
        .select("id,title,category,thumbnail_url,views,created_at")
        .eq("published", true)
        .not("id", "in", `(${existingIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(20 - (data || []).length);

      if (!fallback.error && fallback.data) {
        data = [...(data || []), ...fallback.data];
      }
    }

    if (!data || data.length === 0) {
      container.innerHTML = `
        <p style="color:#888;grid-column:1/-1;">
          Abhi koi related video available nahi hai.
        </p>`;
      return;
    }

    container.innerHTML = data.map(item => {
      const thumb = item.thumbnail_url || item.thumbnail || "";

      return `
        <a href="video.html?id=${encodeURIComponent(item.id)}"
          style="display:block;text-decoration:none;color:#fff;
          background:#151515;border-radius:8px;overflow:hidden;
          min-width:0;">

          <div style="aspect-ratio:16/10;background:#252525;
            overflow:hidden;">
            ${thumb
              ? `<img src="${escapeHTML(thumb)}"
                  alt="${escapeHTML(item.title || "Video thumbnail")}"
                  loading="lazy"
                  style="width:100%;height:100%;object-fit:cover;display:block;">`
              : `<div style="height:100%;display:flex;align-items:center;
                  justify-content:center;color:#ff4444;font-weight:bold;">
                  DesiVexa
                </div>`}
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
