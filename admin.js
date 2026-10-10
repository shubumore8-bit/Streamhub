import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

/* ==============================
   DESIVEXA ADMIN CONFIG
============================== */

const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";

const VIDEO_BUCKET = "videos";
const THUMB_BUCKET = "thumbnails";
const PER_PAGE = 12;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ==============================
   ELEMENTS
============================== */

const $ = (id) => document.getElementById(id);

const authBox = $("auth");
const panel = $("panel");
const loginForm = $("loginForm");
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const globalStatus = $("globalStatus");

const uploadForm = $("uploadForm");
const uploadBtn = $("uploadBtn");
const uploadStatus = $("uploadStatus");

const videoList = $("videoList");
const pagination = $("pagination");
const searchInput = $("searchInput");
const filterSelect = $("filterSelect");
const manageStatus = $("manageStatus");

const previewModal = $("videoPreviewModal");
const previewVideo = $("previewVideo");
const previewInfo = $("previewInfo");

const editModal = $("editModal");
const editForm = $("editForm");
const editStatus = $("editStatus");

/* ==============================
   STATE
============================== */

let allVideos = [];
let currentPage = 1;
let busy = false;
let eventsAttached = false;

/* ==============================
   HELPERS
============================== */

function showStatus(element, message, type = "") {
  if (!element) return;

  element.textContent = message;
  element.className = "status" + (type ? " " + type : "");
  element.hidden = false;
}

function clearStatus(element) {
  if (!element) return;
  element.textContent = "";
  element.hidden = true;
}

function setButtonBusy(button, isBusy, busyText = "Please wait...") {
  if (!button) return;

  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function isPublished(video) {
  return video.published === true;
}

function fileExtension(file, fallback) {
  const name = file?.name || "";
  const match = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  return match ? match[1].toLowerCase() : fallback;
}

function storagePathFromUrl(url, bucket) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/`;
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) return null;

    const rest = parsed.pathname.slice(markerIndex + marker.length);
    const parts = rest.split("/");
    const objectIndex = parts.findIndex((part) =>
      part === "public" ||
      part === "sign" ||
      part === "authenticated"
    );

    if (objectIndex === -1) return null;

    const bucketName = parts[objectIndex + 1];

    if (bucketName !== bucket) return null;

    return parts.slice(objectIndex + 2)
      .map((part) => decodeURIComponent(part))
      .join("/");
  } catch {
    return null;
  }
}

function getPublicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

async function getPlayableUrl(bucket, storedUrl) {
  if (!storedUrl) return "";

  const path = storagePathFromUrl(storedUrl, bucket);

  if (path) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  // Public buckets ke liye saved URL fallback.
  return storedUrl;
}

function getErrorMessage(error) {
  return error?.message || String(error || "Unknown error");
}

/* ==============================
   AUTH / PAGE VISIBILITY
============================== */

function showLogin(message = "") {
  authBox.hidden = false;
  authBox.style.display = "block";

  panel.hidden = true;
  panel.style.display = "none";

  logoutBtn.hidden = true;

  if (message) {
    showStatus($("loginStatus"), message, "error");
  } else {
    clearStatus($("loginStatus"));
  }
}

function showDashboard() {
  authBox.hidden = true;
  authBox.style.display = "none";

  panel.hidden = false;
  panel.style.display = "block";

  logoutBtn.hidden = false;
  clearStatus(globalStatus);
}

async function requireAdmin() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  const user = data?.user;

  if (!user) {
    throw new Error("Please log in first.");
  }

  if (user.id !== ADMIN_UID) {
    await supabase.auth.signOut();
    throw new Error("This account is not authorized as the admin.");
  }

  return user;
}

/* ==============================
   LOGIN / LOGOUT
============================== */

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus($("loginStatus"));

  const email = $("email").value.trim();
  const password = $("password").value;

  setButtonBusy(loginBtn, true, "Logging in...");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    await requireAdmin();
    showDashboard();
    attachEvents();
    await loadVideos();

  } catch (error) {
    await supabase.auth.signOut().catch(() => {});
    showLogin(getErrorMessage(error));
  } finally {
    setButtonBusy(loginBtn, false);
  }
});

logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;

  try {
    await supabase.auth.signOut();
    allVideos = [];
    videoList.innerHTML = "";
    pagination.innerHTML = "";
    showLogin("You have been logged out.");
  } catch (error) {
    showStatus(globalStatus, getErrorMessage(error), "error");
  } finally {
    logoutBtn.disabled = false;
  }
});

/* ==============================
   LOAD VIDEOS
============================== */

async function loadVideos() {
  if (busy) return;

  busy = true;
  showStatus(manageStatus, "Loading videos...");

  try {
    await requireAdmin();

    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allVideos = data || [];
    currentPage = 1;

    updateStats();
    renderVideos();

    clearStatus(manageStatus);

    if (allVideos.length === 0) {
      showStatus(manageStatus, "Abhi videos table mein koi video nahi hai.");
    }
  } catch (error) {
    showStatus(manageStatus, "Videos load nahi hue: " + getErrorMessage(error), "error");
  } finally {
    busy = false;
  }
}

/* ==============================
   DASHBOARD STATS
============================== */

function updateStats() {
  const total = allVideos.length;
  const published = allVideos.filter(isPublished).length;
  const hidden = total - published;

  const views = allVideos.reduce((sum, video) => {
    return sum + (Number(video.views) || 0);
  }, 0);

  $("statTotal").textContent = formatNumber(total);
  $("statPublished").textContent = formatNumber(published);
  $("statHidden").textContent = formatNumber(hidden);
  $("statViews").textContent = formatNumber(views);
}

/* ==============================
   SEARCH / FILTER / PAGINATION
============================== */

function getFilteredVideos() {
  const search = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;

  return allVideos.filter((video) => {
    const title = String(video.title || "").toLowerCase();
    const category = String(video.category || "").toLowerCase();

    const matchesSearch =
      !search ||
      title.includes(search) ||
      category.includes(search);

    const matchesFilter =
      filter === "all" ||
      (filter === "published" && isPublished(video)) ||
      (filter === "hidden" && !isPublished(video));

    return matchesSearch && matchesFilter;
  });
}

function renderVideos() {
  const filtered = getFilteredVideos();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PER_PAGE;
  const pageVideos = filtered.slice(start, start + PER_PAGE);

  if (filtered.length === 0) {
    videoList.innerHTML = '<div class="card empty">Koi video nahi mila.</div>';
  } else {
    videoList.innerHTML = pageVideos.map((video) => {
      const published = isPublished(video);

      const thumbnail = video.thumbnail_url
        ? escapeHTML(video.thumbnail_url)
        : "";

      return `
        <article class="admin-video-card">
          <div class="video-row">
            <img
              class="thumb"
              src="${thumbnail}"
              alt="Video thumbnail"
              loading="lazy"
              onerror="this.style.visibility='hidden'"
            >

            <div class="video-info">
              <div class="video-title">${escapeHTML(video.title || "Untitled video")}</div>

              <div class="meta">
                Category: ${escapeHTML(video.category || "Uncategorized")}<br>
                Status: ${published ? "Published" : "Hidden / Pending"}<br>
                Views: ${formatNumber(video.views)}<br>
                Added: ${escapeHTML(formatDate(video.created_at))}
              </div>
            </div>
          </div>

          <div class="actions">
            <button class="btn" data-action="preview" data-id="${escapeHTML(video.id)}">
              Preview
            </button>

            <button class="btn" data-action="edit" data-id="${escapeHTML(video.id)}">
              Edit
            </button>

            <button class="btn ${published ? "" : "btn-green"}"
                    data-action="toggle" data-id="${escapeHTML(video.id)}">
              ${published ? "Unpublish" : "Publish"}
            </button>

            <button class="btn btn-danger" data-action="delete"
                    data-id="${escapeHTML(video.id)}">
              Delete
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  renderPagination(totalPages, filtered.length);
}

function renderPagination(totalPages, totalItems) {
  pagination.innerHTML = "";

  if (totalItems <= PER_PAGE) return;

  const addButton = (label, page, disabled = false, active = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-btn" + (active ? " active" : "");
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener("click", () => {
      currentPage = page;
      renderVideos();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    pagination.appendChild(button);
  };

  addButton("Prev", currentPage - 1, currentPage === 1);

  // Show first page, nearby pages, and last page.
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 2; page <= currentPage + 2; page++) {
    if (page >= 1 && page <= totalPages) pages.add(page);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  let previous = 0;

  for (const page of sortedPages) {
    if (previous && page - previous > 1) {
      const dots = document.createElement("span");
      dots.className = "page-btn";
      dots.textContent = "...";
      dots.disabled = true;
      pagination.appendChild(dots);
    }

    addButton(String(page), page, false, page === currentPage);
    previous = page;
  }

  addButton("Next", currentPage + 1, currentPage === totalPages);
}

/* ==============================
   UPLOAD VIDEO
============================== */

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus(uploadStatus);

  const title = $("uploadTitle").value.trim();
  const category = $("uploadCategory").value.trim();
  const description = $("uploadDescription").value.trim();

  const thumbnailFile = $("uploadThumbnail").files?.[0];
  const videoFile = $("uploadVideo").files?.[0];
  const published = $("uploadPublished").checked;
  const rightsConfirmed = $("rightsConfirm").checked;

  if (!title || !category) {
    showStatus(uploadStatus, "Title aur category bharna zaroori hai.", "error");
    return;
  }

  if (!thumbnailFile || !videoFile) {
    showStatus(uploadStatus, "Thumbnail aur video dono select karein.", "error");
    return;
  }

  if (!rightsConfirmed) {
    showStatus(uploadStatus, "Upload karne se pehle rights confirmation select karein.", "error");
    return;
  }

  setButtonBusy(uploadBtn, true, "Uploading...");

  let uploadedVideoPath = null;
  let uploadedThumbPath = null;

  try {
    await requireAdmin();

    const uniqueId = crypto.randomUUID();
    const videoExt = fileExtension(videoFile, "mp4");
    const thumbExt = fileExtension(thumbnailFile, "jpg");

    uploadedVideoPath = `${uniqueId}.${videoExt}`;
    uploadedThumbPath = `${uniqueId}.${thumbExt}`;

    showStatus(uploadStatus, "Video file upload ho rahi hai...");

    const { error: videoError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(uploadedVideoPath, videoFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: videoFile.type || "video/mp4"
      });

    if (videoError) throw videoError;

    showStatus(uploadStatus, "Thumbnail upload ho raha hai...");

    const { error: thumbError } = await supabase.storage
      .from(THUMB_BUCKET)
      .upload(uploadedThumbPath, thumbnailFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: thumbnailFile.type || "image/jpeg"
      });

    if (thumbError) throw thumbError;

    const videoUrl = getPublicUrl(VIDEO_BUCKET, uploadedVideoPath);
    const thumbnailUrl = getPublicUrl(THUMB_BUCKET, uploadedThumbPath);

    if (!videoUrl || !thumbnailUrl) {
      throw new Error("Storage URL create nahi hua. Bucket settings check karein.");
    }

    showStatus(uploadStatus, "Database mein video save ho raha hai...");

    const { error: insertError } = await supabase
      .from("videos")
      .insert({
        title,
        category,
        description: description || "",
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        published,
        views: 0
      });

    if (insertError) throw insertError;

    uploadForm.reset();

    showStatus(uploadStatus, "Video successfully upload ho gaya!", "success");
    await loadVideos();

  } catch (error) {
    // Failed DB insert ke baad uploaded objects ko clean up karne ki koshish.
    if (uploadedVideoPath) {
      await supabase.storage.from(VIDEO_BUCKET)
        .remove([uploadedVideoPath]).catch(() => {});
    }

    if (uploadedThumbPath) {
      await supabase.storage.from(THUMB_BUCKET)
        .remove([uploadedThumbPath]).catch(() => {});
    }

    showStatus(
      uploadStatus,
      "Upload fail hua: " + getErrorMessage(error) +
      " — agar Storage policy error hai to Supabase permissions check karein.",
      "error"
    );
  } finally {
    setButtonBusy(uploadBtn, false);
  }
});

/* ==============================
   VIDEO LIST ACTIONS
============================== */

videoList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const video = allVideos.find((item) => String(item.id) === String(id));

  if (!video) {
    showStatus(manageStatus, "Video record nahi mila. List refresh karein.", "error");
    return;
  }

  if (action === "preview") {
    await openPreview(video);
  } else if (action === "edit") {
    openEdit(video);
  } else if (action === "toggle") {
    await togglePublished(video, button);
  } else if (action === "delete") {
    await deleteVideo(video, button);
  }
});

/* ==============================
   PREVIEW
============================== */

async function openPreview(video) {
  clearStatus(globalStatus);
  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();

  $("previewTitle").textContent = video.title || "Video Preview";
  previewInfo.textContent =
    `Category: ${video.category || "Uncategorized"} · ` +
    `Status: ${isPublished(video) ? "Published" : "Hidden / Pending"}`;

  previewModal.hidden = false;
  previewModal.style.display = "flex";

  try {
    const url = await getPlayableUrl(VIDEO_BUCKET, video.video_url);

    if (!url) throw new Error("Video URL database mein nahi hai.");

    previewVideo.src = url;
    previewVideo.load();
  } catch (error) {
    showStatus(globalStatus, "Preview error: " + getErrorMessage(error), "error");
  }
}

function closePreview() {
  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();
  previewModal.hidden = true;
  previewModal.style.display = "none";
}

$("closePreviewBtn").addEventListener("click", closePreview);

previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) closePreview();
});

/* ==============================
   EDIT VIDEO
============================== */

function openEdit(video) {
  $("editId").value = video.id;
  $("editVideoTitle").value = video.title || "";
  $("editCategory").value = video.category || "";
  $("editDescription").value = video.description || "";

  clearStatus(editStatus);
  editModal.hidden = false;
  editModal.style.display = "flex";
}

function closeEdit() {
  editModal.hidden = true;
  editModal.style.display = "none";
}

$("closeEditBtn").addEventListener("click", closeEdit);

editModal.addEventListener("click", (event) => {
  if (event.target === editModal) closeEdit();
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus(editStatus);

  const id = $("editId").value;
  const title = $("editVideoTitle").value.trim();
  const category = $("editCategory").value.trim();
  const description = $("editDescription").value.trim();

  if (!title || !category) {
    showStatus(editStatus, "Title aur category required hain.", "error");
    return;
  }

  setButtonBusy($("saveEditBtn"), true, "Saving...");

  try {
    await requireAdmin();

    const { error } = await supabase
      .from("videos")
      .update({ title, category, description })
      .eq("id", id);

    if (error) throw error;

    closeEdit();
    await loadVideos();
    showStatus(manageStatus, "Video details update ho gayi hain.", "success");

  } catch (error) {
    showStatus(editStatus, "Update fail hua: " + getErrorMessage(error), "error");
  } finally {
    setButtonBusy($("saveEditBtn"), false);
  }
});

/* ==============================
   PUBLISH / UNPUBLISH
============================== */

async function togglePublished(video, button) {
  const newValue = !isPublished(video);
  const actionText = newValue ? "publish" : "unpublish";

  if (!confirm(`Kya aap is video ko ${actionText} karna chahte hain?`)) {
    return;
  }

  button.disabled = true;

  try {
    await requireAdmin();

    const { error } = await supabase
      .from("videos")
      .update({ published: newValue })
      .eq("id", video.id);

    if (error) throw error;

    await loadVideos();
    showStatus(
      manageStatus,
      newValue ? "Video publish ho gaya." : "Video unpublish ho gaya.",
      "success"
    );

  } catch (error) {
    showStatus(manageStatus, "Status update fail hua: " + getErrorMessage(error), "error");
  } finally {
    button.disabled = false;
  }
}

/* ==============================
   DELETE VIDEO + STORAGE FILES
============================== */

async function deleteVideo(video, button) {
  const confirmed = confirm(
    `Kya aap "${video.title || "this video"}" ko permanently delete karna chahte hain?\n\n` +
    "Database record aur matching Storage files delete karne ki koshish hogi."
  );

  if (!confirmed) return;

  button.disabled = true;

  try {
    await requireAdmin();

    // Pehle database record delete karte hain.
    const { error: deleteError } = await supabase
      .from("videos")
      .delete()
      .eq("id", video.id);

    if (deleteError) throw deleteError;

    // Uske baad URL se original Storage paths nikalte hain.
    const videoPath = storagePathFromUrl(video.video_url, VIDEO_BUCKET);
    const thumbPath = storagePathFromUrl(video.thumbnail_url, THUMB_BUCKET);

    const videoFiles = videoPath ? [videoPath] : [];
    const thumbFiles = thumbPath ? [thumbPath] : [];

    let storageWarning = "";

    if (videoFiles.length) {
      const { error } = await supabase.storage
        .from(VIDEO_BUCKET)
        .remove(videoFiles);

      if (error) storageWarning += " Video file delete nahi hui: " + error.message;
    }

    if (thumbFiles.length) {
      const { error } = await supabase.storage
        .from(THUMB_BUCKET)
        .remove(thumbFiles);

      if (error) storageWarning += " Thumbnail delete nahi hui: " + error.message;
    }

    await loadVideos();

    if (storageWarning) {
      showStatus(
        manageStatus,
        "Database se video delete ho gayi, lekin Storage mein cleanup issue hai." + storageWarning,
        "error"
      );
    } else {
      showStatus(manageStatus, "Video delete ho gayi.", "success");
    }

  } catch (error) {
    showStatus(manageStatus, "Delete fail hua: " + getErrorMessage(error), "error");
  } finally {
    button.disabled = false;
  }
}

/* ==============================
   SEARCH / FILTER EVENTS
============================== */

function attachEvents() {
  if (eventsAttached) return;
  eventsAttached = true;

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    renderVideos();
  });

  filterSelect.addEventListener("change", () => {
    currentPage = 1;
    renderVideos();
  });
}

/* ==============================
   STARTUP
============================== */

async function boot() {
  // Login section ko default mein visible rakho.
  showLogin();

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (!data?.session) {
      showLogin();
      return;
    }

    await requireAdmin();
    showDashboard();
    attachEvents();
    await loadVideos();

  } catch (error) {
    await supabase.auth.signOut().catch(() => {});
    showLogin(getErrorMessage(error));
  }
}

boot();
