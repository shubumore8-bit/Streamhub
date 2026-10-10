
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Apne admin account ki UID verify kar lena.
const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";

const $ = (selector) => document.querySelector(selector);

let currentUser = null;
let videos = [];
let previewToken = 0;

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function notify(message) {
  alert(message);
}

function statusOf(video) {
  if (["pending", "published", "hidden"].includes(video.status)) {
    return video.status;
  }
  return video.published ? "published" : "pending";
}

function statusLabel(status) {
  return ({
    pending: "Pending",
    published: "Published",
    hidden: "Hidden"
  })[status] || status;
}

// Handles a full URL or a Storage object path.
function normalizeStoragePath(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^videos\//, "");
}

async function storageUrl(bucket, value) {
  if (!value) throw new Error("Database mein video URL khaali hai.");

  const raw = String(value).trim();

  // Existing public/signed URLs can be used directly.
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const path = normalizeStoragePath(raw);
  if (!path) throw new Error("Storage file path khaali hai.");

  // Try a signed URL first. Works with private buckets when
  // the current user has the necessary Storage permissions.
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  // If the bucket is public, try its public URL as a fallback.
  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  if (publicData?.publicUrl) {
    return publicData.publicUrl;
  }

  throw error || new Error("Storage file ka URL nahi ban saka.");
}

function showAdmin() {
  const auth = $("#auth");
  const panel = $("#panel");

  if (auth) auth.hidden = true;
  if (panel) panel.hidden = false;
}

function showLogin() {
  const auth = $("#auth");
  const panel = $("#panel");

  if (auth) auth.hidden = false;
  if (panel) panel.hidden = true;
}

async function login(event) {
  event?.preventDefault();

  const email = $("#email")?.value.trim();
  const password = $("#password")?.value;

  if (!email || !password) {
    notify("Email aur password enter karo.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    notify("Login failed: " + error.message);
    return;
  }

  await boot();
}

async function logout() {
  await closePreview();
  await supabase.auth.signOut();
  currentUser = null;
  showLogin();
}

async function load() {
  const manage = $("#manage");
  if (manage) manage.innerHTML = "<p>Videos load ho rahi hain...</p>";

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (manage) {
      manage.innerHTML =
        `<p>Videos load nahi hui: ${escapeHTML(error.message)}</p>`;
    }
    throw error;
  }

  videos = data || [];
  renderStats();
  renderVideos();
}

function renderStats() {
  const total = videos.length;
  const published = videos.filter(v => statusOf(v) === "published");
  const hidden = videos.filter(v => statusOf(v) === "hidden");

  if ($("#statTotal")) $("#statTotal").textContent = total;
  if ($("#statPublished")) $("#statPublished").textContent = published.length;
  if ($("#statHidden")) $("#statHidden").textContent = hidden.length;

  const views = videos.reduce((sum, v) => sum + (Number(v.views) || 0), 0);
  if ($("#statViews")) $("#statViews").textContent = views.toLocaleString();
}

function renderVideos() {
  const manage = $("#manage");
  if (!manage) return;

  const query = ($("#adminSearch")?.value || "").toLowerCase().trim();
  const filter = $("#adminFilter")?.value || "all";

  const filtered = videos.filter(video => {
    const status = statusOf(video);
    const matchesStatus = filter === "all" || status === filter;
    const matchesQuery = [
      video.title,
      video.category,
      video.description
    ].some(value => String(value || "").toLowerCase().includes(query));

    return matchesStatus && matchesQuery;
  });

  if (!filtered.length) {
    manage.innerHTML = "<p>Koi video nahi mili.</p>";
    return;
  }

  manage.innerHTML = filtered.map(video => {
    const status = statusOf(video);
    const id = escapeHTML(video.id);
    const title = escapeHTML(video.title || "Untitled video");
    const category = escapeHTML(video.category || "Other");
    const thumb = video.thumbnail_url
      ? escapeHTML(
          /^https?:\/\//i.test(video.thumbnail_url)
            ? video.thumbnail_url
            : supabase.storage
                .from("thumbnails")
                .getPublicUrl(normalizeStoragePath(video.thumbnail_url))
                .data.publicUrl
        )
      : "";

    return `
      <article class="admin-video-card" data-id="${id}"
        style="background:#151515;border:1px solid #333;border-radius:12px;
        padding:12px;margin:12px 0;color:white">
        ${
          thumb
            ? `<img src="${thumb}" alt=""
                style="width:100%;max-height:200px;object-fit:cover;
                border-radius:8px">`
            : ""
        }
        <h3>${title}</h3>
        <p>Category: ${category}</p>
        <p>Status: <strong>${statusLabel(status)}</strong></p>
        <p>Views: ${Number(video.views) || 0}</p>

        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button type="button" data-action="preview" data-id="${id}">
            ▶ Preview
          </button>
          <button type="button" data-action="publish" data-id="${id}">
            ✓ Approve
          </button>
          <button type="button" data-action="hide" data-id="${id}">
            Hide
          </button>
          <button type="button" data-action="delete" data-id="${id}">
            Delete
          </button>
        </div>
      </article>
    `;
  }).join("");
}

async function previewVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));

  if (!video) {
    notify("Video record nahi mili.");
    return;
  }

  if (!video.video_url) {
    notify("Is video ka video_url database mein khaali hai.");
    return;
  }

  const modal = $("#videoPreviewModal");
  const player = $("#previewPlayer");
  const errorBox = $("#previewError");

  if (!modal || !player) {
    // If your admin.html doesn't include the preview modal,
    // open the URL directly as a fallback.
    try {
      const url = await storageUrl("videos", video.video_url);
      window.open(url, "_blank", "noopener");
    } catch (error) {
      notify("Preview failed: " + error.message);
    }
    return;
  }

  closePreview();

  const token = ++previewToken;
  $("#previewTitle").textContent = video.title || "Video Preview";
  $("#previewInfo").textContent =
    `${video.category || "Other"} · ${statusLabel(statusOf(video))}`;

  if (errorBox) errorBox.textContent = "Video load ho rahi hai...";
  modal.hidden = false;

  try {
    const url = await storageUrl("videos", video.video_url);

    if (token !== previewToken) return;

    player.src = url;
    player.controls = true;
    player.preload = "metadata";
    player.load();

    if (errorBox) {
  errorBox.textContent = "Video load ho rahi hai...";
}

player.onerror = () => {
  const mediaError = player.error;
  const messages = {
    1: "Video loading cancel hui.",
    2: "Network ya Storage se video load nahi hui.",
    3: "Video format decode nahi ho paaya.",
    4: "Video URL ya format browser support nahi karta."
  };

  if (errorBox) {
    errorBox.textContent =
      messages[mediaError?.code] || "Video play nahi hui. URL aur Storage permissions check karo.";
  }
};

player.onloadedmetadata = () => {
  if (errorBox) {
    errorBox.textContent =
      `Video ready: ${player.videoWidth} × ${player.videoHeight}`;
  }
};

player.oncanplay = () => {
  if (errorBox) errorBox.textContent = "Video play karne ke liye ready hai.";
};

    player.play().catch(() => {});
  } catch (error) {
    if (token === previewToken && errorBox) {
      errorBox.textContent = "Preview failed: " + error.message;
    }
  }
}

function closePreview() {
  previewToken++;

  const modal = $("#videoPreviewModal");
  const player = $("#previewPlayer");

  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
  }

  if (modal) modal.hidden = true;
}

async function setVideoStatus(id, newStatus) {
  if (!["pending", "published", "hidden"].includes(newStatus)) {
    throw new Error("Invalid status.");
  }

  const { error } = await supabase
    .from("videos")
    .update({
      status: newStatus,
      published: newStatus === "published"
    })
    .eq("id", id);

  if (error) throw error;

  await load();
  notify("Video status update ho gaya.");
}

async function deleteVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));
  if (!video) throw new Error("Video nahi mili.");

  if (!confirm(
    `Kya tum "${video.title || "is video"}" ko database se delete karna chahte ho?`
  )) return;

  // Delete the database record. Storage files are not automatically deleted.
  const { error } = await supabase
    .from("videos")
    .delete()
    .eq("id", id);

  if (error) throw error;

  await load();
  notify("Video record delete ho gaya.");
}

async function uploadVideo(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const title = $("#uploadTitle")?.value.trim();
  const category = $("#uploadCategory")?.value || "Other";
  const description = $("#uploadDescription")?.value.trim() || "";
  const videoFile = $("#uploadVideo")?.files?.[0];
  const thumbnailFile = $("#uploadThumbnail")?.files?.[0];

  if (!title || !videoFile) {
    notify("Title aur video file required hain.");
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError) throw userError;

    const user = userData.user;
    if (!user) throw new Error("Please login again.");

    const id = crypto.randomUUID();
    const safeName = videoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const videoPath = `${user.id}/${id}/${safeName}`;

    const { data: videoUpload, error: videoError } = await supabase.storage
      .from("videos")
      .upload(videoPath, videoFile, {
        upsert: false,
        contentType: videoFile.type || "video/mp4"
      });

    if (videoError) throw videoError;

    let thumbnailPath = null;

    if (thumbnailFile) {
      const safeThumb = thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { data: thumbUpload, error: thumbError } = await supabase.storage
        .from("thumbnails")
        .upload(`${user.id}/${id}/${safeThumb}`, thumbnailFile, {
          upsert: false,
          contentType: thumbnailFile.type || "image/jpeg"
        });

      if (thumbError) throw thumbError;
      thumbnailPath = thumbUpload.path;
    }

    const { error: insertError } = await supabase.from("videos").insert({
      id,
      user_id: user.id,
      title,
      category,
      description,
      video_url: videoUpload.path,
      thumbnail_url: thumbnailPath,
      views: 0,
      published: false,
      status: "pending"
    });

    if (insertError) throw insertError;

    form.reset();
    await load();
    notify("Video upload ho gayi. Ab approval ke liye Pending hai.");
  } catch (error) {
    notify("Upload failed: " + error.message);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function attachEvents() {
  $("#loginForm")?.addEventListener("submit", login);
  $("#logout")?.addEventListener("click", logout);
  $("#upload")?.addEventListener("submit", uploadVideo);
  $("#adminSearch")?.addEventListener("input", renderVideos);
  $("#adminFilter")?.addEventListener("change", renderVideos);
  $("#refreshVideos")?.addEventListener("click", () =>
    load().catch(error => notify(error.message))
  );

  $("#manage")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;

    try {
      if (action === "preview") await previewVideo(id);
      if (action === "publish") await setVideoStatus(id, "published");
      if (action === "hide") await setVideoStatus(id, "hidden");
      if (action === "delete") await deleteVideo(id);
    } catch (error) {
      notify("Error: " + error.message);
    }
  });

  $("#closeVideoPreview")?.addEventListener("click", closePreview);

  $("#videoPreviewModal")?.addEventListener("click", event => {
    if (event.target.id === "videoPreviewModal") closePreview();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closePreview();
  });
}

async function boot() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    notify(error.message);
    showLogin();
    return;
  }

  currentUser = data.session?.user || null;

  if (!currentUser) {
    showLogin();
    return;
  }

  if (currentUser.id !== ADMIN_UID) {
    await supabase.auth.signOut();
    currentUser = null;
    showLogin();
    notify("Is account ko admin access nahi hai.");
    return;
  }

  showAdmin();

  try {
    await load();
  } catch (error) {
    notify("Dashboard load failed: " + error.message);
  }
}

attachEvents();
boot();
