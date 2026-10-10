
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";
const VIDEO_BUCKET = "videos";
const THUMB_BUCKET = "thumbnails";
const PER_PAGE = 12;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (selector, root = document) => root.querySelector(selector);

const authBox = $("#auth");
const panel = $("#panel");
const manage = $("#manage");
const pagination = $("#adminPagination");
const uploadForm = $("#upload");
const uploadBtn = $("#uploadBtn");
const statusBox = $("#status");

const statTotal = $("#statTotal");
const statPublished = $("#statPublished");
const statHidden = $("#statHidden");
const statViews = $("#statViews");

const searchInput = $("#adminSearch");
const filterInput = $("#adminFilter");

let videos = [];
let currentPage = 1;
let busy = false;

/* ===============================
   HELPERS
================================ */

function message(text, type = "info") {
  if (!statusBox) {
    console.log(text);
    return;
  }

  statusBox.textContent = text;
  statusBox.dataset.type = type;
  statusBox.style.display = "block";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getStoragePath(bucket, value) {
  if (!value) return null;

  let path = String(value).trim();

  if (/^https?:\/\//i.test(path)) {
    let url;

    try {
      url = new URL(path);
    } catch {
      throw new Error("Storage URL valid nahi hai.");
    }

    if (!url.hostname.endsWith(".supabase.co")) {
      throw new Error("External URL ko Supabase Storage se delete nahi kar sakte.");
    }

    const match = url.pathname.match(
      /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/
    );

    if (!match) {
      throw new Error("Storage URL se file path nahi mila.");
    }

    const urlBucket = decodeURIComponent(match[1]);

    if (urlBucket !== bucket) {
      throw new Error(`Galat bucket: ${urlBucket}`);
    }

    path = decodeURIComponent(match[2]);
  }

  path = path.replace(/^\/+/, "");

  if (path.startsWith(bucket + "/")) {
    path = path.slice(bucket.length + 1);
  }

  if (!path) throw new Error("Storage file path khaali hai.");

  return path;
}

/* ===============================
   STEP 2: STORAGE URL
================================ */

async function storageUrl(bucket, value) {
  if (!value) return "";

  const raw = String(value).trim();

  if (/^https?:\/\//i.test(raw)) {
    let url;

    try {
      url = new URL(raw);
    } catch {
      throw new Error("Video ya thumbnail URL valid nahi hai.");
    }

    if (!url.hostname.endsWith(".supabase.co")) {
      return raw;
    }

    if (
      /\/storage\/v1\/object\/(?:public|authenticated|sign)\//.test(
        url.pathname
      )
    ) {
      // Existing signed/public URL ko reuse karo.
      return raw;
    }
  }

  const path = getStoragePath(bucket, raw);

  // Private bucket: signed URL.
  const { data: signedData, error: signedError } =
    await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  // Public bucket fallback.
  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  if (publicData?.publicUrl) {
    return publicData.publicUrl;
  }

  throw signedError || new Error("Storage URL generate nahi hui.");
}

/* ===============================
   ADMIN AUTH
================================ */

async function checkAdmin() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  if (!data.user || data.user.id !== ADMIN_UID) {
    throw new Error("Admin permission nahi hai. Sahi account se login karo.");
  }

  return data.user;
}

function showLogin() {
  if (!authBox) {
    message("admin.html mein #auth element missing hai.", "error");
    return;
  }

  if (panel) panel.style.display = "none";

  authBox.style.display = "block";

  authBox.innerHTML = `
    <div class="admin-login-card">
      <h2>DesiVexa Admin</h2>
      <p>Admin account se login karo.</p>

      <form id="adminLoginForm">
        <label>Email</label>
        <input id="adminEmail" type="email"
          autocomplete="username" required placeholder="Admin email">

        <label>Password</label>
        <input id="adminPassword" type="password"
          autocomplete="current-password" required placeholder="Password">

        <button id="adminLoginBtn" type="submit">Login</button>
        <p id="adminLoginMessage" role="status"></p>
      </form>
    </div>
  `;

  $("#adminLoginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const btn = $("#adminLoginBtn");
    const output = $("#adminLoginMessage");

    btn.disabled = true;
    output.textContent = "Login ho raha hai...";

    try {
      const email = $("#adminEmail").value.trim();
      const password = $("#adminPassword").value;

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await checkAdmin();

      authBox.style.display = "none";
      if (panel) panel.style.display = "block";

      setupEvents();
      await load();
    } catch (error) {
      await supabase.auth.signOut();
      output.textContent = error.message || "Login failed.";
    } finally {
      btn.disabled = false;
    }
  });
}

async function boot() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    message("config.js ki settings check karo.", "error");
    return;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    showLogin();
    return;
  }

  try {
    await checkAdmin();

    if (authBox) authBox.style.display = "none";
    if (panel) panel.style.display = "block";

    setupEvents();
    await load();
  } catch {
    await supabase.auth.signOut();
    showLogin();
  }
}

/* ===============================
   EVENTS
================================ */

function setupEvents() {
  if (setupEvents.done) return;
  setupEvents.done = true;

  searchInput?.addEventListener("input", () => {
    currentPage = 1;
    render();
  });

  filterInput?.addEventListener("change", () => {
    currentPage = 1;
    render();
  });

  $("#refreshVideos")?.addEventListener("click", load);

  $("#adminLogout")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    showLogin();
  });

  $("#closeVideoPreview")?.addEventListener("click", closePreview);

  $("#videoPreviewModal")?.addEventListener("click", event => {
    if (event.target.id === "videoPreviewModal") closePreview();
  });

  uploadForm?.addEventListener("submit", uploadVideo);
}

/* ===============================
   LOAD VIDEOS
================================ */

async function load() {
  if (busy) return;
  busy = true;

  if (manage) manage.innerHTML = "<p>Videos load ho rahi hain...</p>";

  try {
    await checkAdmin();

    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    videos = data || [];
    currentPage = 1;

    updateStats();
    render();

    message(`${videos.length} videos load ho gayi.`, "success");
  } catch (error) {
    console.error(error);

    if (manage) {
      manage.innerHTML =
        `<p>Load error: ${escapeHTML(error.message)}</p>`;
    }

    message("Videos load nahi hui: " + error.message, "error");
  } finally {
    busy = false;
  }
}

/* ===============================
   STATS
================================ */

function updateStats() {
  const published = videos.filter(v => v.published === true);
  const hidden = videos.filter(v => v.published !== true);

  if (statTotal) statTotal.textContent = videos.length;
  if (statPublished) statPublished.textContent = published.length;
  if (statHidden) statHidden.textContent = hidden.length;

  const totalViews = videos.reduce(
    (sum, video) => sum + (Number(video.views) || 0),
    0
  );

  if (statViews) statViews.textContent = totalViews.toLocaleString();
}

/* ===============================
   FILTER
================================ */

function filteredVideos() {
  const term = (searchInput?.value || "").trim().toLowerCase();
  const filter = filterInput?.value || "all";

  return videos.filter(video => {
    const searchable = [
      video.title,
      video.category,
      video.description,
      video.id
    ].join(" ").toLowerCase();

    if (term && !searchable.includes(term)) return false;

    if (filter === "published" && video.published !== true) return false;

    if (filter === "pending" && video.published === true) return false;

    if (filter === "hidden" && video.published === true) return false;

    return true;
  });
}

/* ===============================
   RENDER + PAGINATION
================================ */

function render() {
  if (!manage) return;

  const list = filteredVideos();
  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));

  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * PER_PAGE;
  const pageVideos = list.slice(start, start + PER_PAGE);

  if (!list.length) {
    manage.innerHTML = "<p>Koi video nahi mili.</p>";
    renderPagination(0);
    return;
  }

  manage.innerHTML = pageVideos.map(video => {
    const id = escapeHTML(video.id);
    const title = escapeHTML(video.title || "Untitled");
    const category = escapeHTML(video.category || "Uncategorized");
    const published = video.published === true;

    return `
      <article class="admin-video-card" data-video-card="${id}">
        <img
          data-thumb-id="${id}"
          alt="${title}"
          loading="lazy"
          style="width:100%;aspect-ratio:16/9;object-fit:cover"
        >

        <div class="admin-video-info">
          <h3>${title}</h3>
          <p>Category: ${category}</p>
          <p>Status: <strong>${published ? "Published" : "Pending / Hidden"}</strong></p>
          <p>Views: ${Number(video.views) || 0}</p>

          <div class="admin-video-actions">
            <button data-action="preview" data-id="${id}" type="button">Preview</button>
            <button data-action="edit" data-id="${id}" type="button">Edit</button>
            <button data-action="publish" data-id="${id}" type="button">
              ${published ? "Unpublish" : "Publish"}
            </button>
            <button data-action="delete" data-id="${id}" type="button">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  for (const video of pageVideos) {
    const image = manage.querySelector(
      `[data-thumb-id="${CSS.escape(String(video.id))}"]`
    );

    if (!image || !video.thumbnail_url) continue;

    storageUrl(THUMB_BUCKET, video.thumbnail_url)
      .then(url => { image.src = url; })
      .catch(error => {
        console.warn("Thumbnail error:", error);
        image.alt = "Thumbnail unavailable";
      });
  }

  manage.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const { id, action } = button.dataset;

      if (action === "preview") await previewVideo(id);
      if (action === "edit") await editVideo(id);

      if (action === "publish") {
        const video = videos.find(v => String(v.id) === String(id));
        if (video) await setPublished(id, video.published !== true);
      }

      if (action === "delete") await deleteVideo(id);
    });
  });

  renderPagination(list.length);
}

function renderPagination(totalItems) {
  if (!pagination) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));

  pagination.innerHTML = `
    <button type="button" data-page="${currentPage - 1}"
      ${currentPage <= 1 ? "disabled" : ""}>Previous</button>
    <span>Page ${currentPage} / ${totalPages}</span>
    <button type="button" data-page="${currentPage + 1}"
      ${currentPage >= totalPages ? "disabled" : ""}>Next</button>
  `;

  pagination.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.page);

      if (page < 1 || page > totalPages) return;

      currentPage = page;
      render();

      manage?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
}

/* ===============================
   VIDEO PREVIEW
================================ */

async function previewVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));
  if (!video) return;

  const modal = $("#videoPreviewModal");
  const player = $("#previewPlayer");
  const title = $("#previewTitle");
  const info = $("#previewInfo");
  const errorBox = $("#previewError");

  if (!modal || !player) {
    alert("Preview elements admin.html mein missing hain.");
    return;
  }

  if (title) title.textContent = video.title || "Untitled";

  if (info) {
    info.textContent =
      `Category: ${video.category || "N/A"} | Views: ${Number(video.views) || 0}`;
  }

  if (errorBox) errorBox.textContent = "Video load ho rahi hai...";

  modal.style.display = "flex";
  player.pause();
  player.removeAttribute("src");
  player.load();

  try {
    const url = await storageUrl(VIDEO_BUCKET, video.video_url);
    if (!url) throw new Error("Video URL nahi mili.");

    player.src = url;
    player.load();

    if (errorBox) errorBox.textContent = "";

    player.play().catch(() => {});
  } catch (error) {
    if (errorBox) errorBox.textContent = "Preview error: " + error.message;
  }
}

function closePreview() {
  const modal = $("#videoPreviewModal");
  const player = $("#previewPlayer");

  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
  }

  if (modal) modal.style.display = "none";
}

/* ===============================
   PUBLISH / UNPUBLISH
================================ */

async function setPublished(id, published) {
  try {
    await checkAdmin();

    const { error } = await supabase
      .from("videos")
      .update({ published })
      .eq("id", id);

    if (error) throw error;

    message(
      published ? "Video publish ho gayi." : "Video unpublish ho gayi.",
      "success"
    );

    await load();
  } catch (error) {
    message("Status update failed: " + error.message, "error");
  }
}

/* ===============================
   EDIT VIDEO
================================ */

async function editVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));
  if (!video) return;

  const title = prompt("Video title:", video.title || "");
  if (title === null) return;

  const category = prompt("Category:", video.category || "");
  if (category === null) return;

  const description = prompt("Description:", video.description || "");
  if (description === null) return;

  if (!title.trim()) {
    alert("Title khaali nahi ho sakta.");
    return;
  }

  try {
    await checkAdmin();

    const { error } = await supabase
      .from("videos")
      .update({
        title: title.trim(),
        category: category.trim(),
        description: description.trim()
      })
      .eq("id", id);

    if (error) throw error;

    message("Video details update ho gayi.", "success");
    await load();
  } catch (error) {
    message("Edit failed: " + error.message, "error");
  }
}

/* ===============================
   PERMANENT DELETE
================================ */

async function deleteVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));

  if (!video) {
    alert("Video nahi mili. Dashboard refresh karo.");
    return;
  }

  const confirmed = confirm(
    "PERMANENT DELETE\n\n" +
    `Video: ${video.title || "Untitled"}\n\n` +
    "Database record, video file aur thumbnail file delete karne ki " +
    "koshish hogi. Yeh action undo nahi kiya ja sakta.\n\n" +
    "Kya tum sure ho?"
  );

  if (!confirmed) return;

  const card = manage?.querySelector(
    `[data-video-card="${CSS.escape(String(id))}"]`
  );
  const buttons = card ? card.querySelectorAll("button") : [];

  buttons.forEach(button => { button.disabled = true; });

  try {
    await checkAdmin();

    const videoPath = getStoragePath(VIDEO_BUCKET, video.video_url);
    const thumbPath = getStoragePath(THUMB_BUCKET, video.thumbnail_url);

    if (videoPath) {
      const { error } = await supabase.storage
        .from(VIDEO_BUCKET)
        .remove([videoPath]);

      if (error) {
        throw new Error("Video file delete nahi hui: " + error.message);
      }
    }

    if (thumbPath) {
      const { error } = await supabase.storage
        .from(THUMB_BUCKET)
        .remove([thumbPath]);

      if (error) {
        throw new Error("Thumbnail delete nahi hui: " + error.message);
      }
    }

    const { data, error } = await supabase
      .from("videos")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      throw new Error("Database record delete nahi hua: " + error.message);
    }

    if (!data?.length) {
      throw new Error("Database record delete nahi hua. DELETE policy check karo.");
    }

    alert("Video file, thumbnail aur database record delete ho gaye.");
    await load();
  } catch (error) {
    console.error("Delete failed:", error);

    alert(
      "Delete poora nahi ho saka:\n" +
      error.message +
      "\n\nSupabase permissions aur Storage paths check karo."
    );

    await load();
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

/* ===============================
   UPLOAD HELPERS
================================ */

function findField(names, type = null) {
  for (const name of names) {
    const element =
      document.getElementById(name) ||
      uploadForm?.querySelector(`[name="${name}"]`);

    if (element) return element;
  }

  return type
    ? uploadForm?.querySelector(`input[type="${type}"]`) || null
    : null;
}

/* ===============================
   UPLOAD VIDEO
================================ */

async function uploadVideo(event) {
  event.preventDefault();

  if (busy) return;

  const titleField = findField(["uploadTitle", "videoTitle", "title"]);
  const categoryField = findField(["uploadCategory", "videoCategory", "category"]);
  const descriptionField = findField([
    "uploadDescription", "videoDescription", "description"
  ]);
  const videoField = findField([
    "uploadVideoFile", "videoFile", "video", "video_file"
  ], "file");
  const thumbField = findField([
    "uploadThumbnailFile", "thumbnailFile", "thumbnail", "thumbnail_file"
  ], "file");

  const title = titleField?.value?.trim() || "";
  const category = categoryField?.value?.trim() || "";
  const description = descriptionField?.value?.trim() || "";
  const videoFile = videoField?.files?.[0];
  const thumbFile = thumbField?.files?.[0];

  if (!title) {
    message("Video title daalo.", "error");
    titleField?.focus();
    return;
  }

  if (!videoFile) {
    message("Video file select karo.", "error");
    videoField?.focus();
    return;
  }

  if (!thumbFile) {
    message("Thumbnail image select karo.", "error");
    thumbField?.focus();
    return;
  }

  busy = true;

  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";
  }

  let uploadedVideoPath = null;
  let uploadedThumbPath = null;

  try {
    const user = await checkAdmin();
    const randomId = crypto.randomUUID();

    const safeExt = file =>
      (file.name.split(".").pop() || "bin")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    uploadedVideoPath = `${user.id}/${randomId}.${safeExt(videoFile)}`;
    uploadedThumbPath = `${user.id}/${randomId}.${safeExt(thumbFile)}`;

    const { error: videoError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(uploadedVideoPath, videoFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: videoFile.type || "video/mp4"
      });

    if (videoError) throw videoError;

    const { error: thumbError } = await supabase.storage
      .from(THUMB_BUCKET)
      .upload(uploadedThumbPath, thumbFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: thumbFile.type || "image/jpeg"
      });

    if (thumbError) throw thumbError;

    const { error: insertError } = await supabase
      .from("videos")
      .insert({
        title,
        category,
        description,
        video_url: uploadedVideoPath,
        thumbnail_url: uploadedThumbPath,
        published: false,
        views: 0,
        user_id: user.id
      });

    if (insertError) throw insertError;

    uploadForm.reset();

    message("Upload successful! Video Pending status mein hai.", "success");
    await load();
  } catch (error) {
    console.error("Upload failed:", error);

    if (uploadedVideoPath) {
      const { error: cleanupError } = await supabase.storage
        .from(VIDEO_BUCKET)
        .remove([uploadedVideoPath]);

      if (cleanupError) console.warn(cleanupError);
    }

    if (uploadedThumbPath) {
      const { error: cleanupError } = await supabase.storage
        .from(THUMB_BUCKET)
        .remove([uploadedThumbPath]);

      if (cleanupError) console.warn(cleanupError);
    }

    message("Upload failed: " + error.message, "error");
  } finally {
    busy = false;

    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload Video";
    }
  }
}

/* ===============================
   START
================================ */

boot();
