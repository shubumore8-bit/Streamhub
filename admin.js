
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";
const VIDEO_BUCKET = "videos";
const THUMB_BUCKET = "thumbnails";
const PER_PAGE = 12;

const $ = (id) => document.getElementById(id);

let allVideos = [];
let currentPage = 1;
let busy = false;
let previewRequest = 0;

const authSection = $("auth");
const panel = $("panel");
const loginForm = $("loginForm");
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const loginStatus = $("loginStatus");
const uploadForm = $("upload");
const uploadBtn = $("uploadBtn");
const uploadStatus = $("uploadStatus");
const globalStatus = $("globalStatus");
const videoList = $("videoList");
const pagination = $("pagination");
const previewModal = $("previewModal");
const previewVideo = $("previewVideo");
const previewInfo = $("previewInfo");
const editModal = $("editModal");
const editForm = $("editForm");
const editStatus = $("editStatus");

function message(element, text = "", type = "") {
  if (!element) return;
  element.textContent = text;
  element.className = "status" + (type ? " " + type : "");
}

function errorText(error) {
  return error?.message || String(error || "Unknown error");
}

function isPublished(video) {
  return video.published === true;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

/*
  URL se bucket aur file path nikalta hai.
  Public, signed aur authenticated URL formats supported hain.
*/
function storagePathFromUrl(url, bucket) {
  if (!url) return null;

  try {
    const parsed = new URL(url, SUPABASE_URL);
    const prefix = "/storage/v1/object/";
    const index = parsed.pathname.indexOf(prefix);

    if (index === -1) return null;

    const rest = parsed.pathname.slice(index + prefix.length);
    const parts = rest.split("/");
    const modes = ["public", "sign", "authenticated"];

    const modeIndex = parts.findIndex((part) =>
      modes.includes(part)
    );

    if (modeIndex === -1) return null;
    if (parts[modeIndex + 1] !== bucket) return null;

    const encodedPath = parts.slice(modeIndex + 2).join("/");

    return encodedPath.split("/").map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    }).join("/");
  } catch {
    return null;
  }
}

function getPublicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

/*
  Signed URL agar pehle se database mein hai,
  to uska token preserve kiya jata hai.
*/
async function getPlayableUrl(bucket, storedUrl) {
  if (!storedUrl) {
    throw new Error("Database mein video URL nahi hai.");
  }

  let parsed;

  try {
    parsed = new URL(storedUrl);
  } catch {
    throw new Error("Video URL valid nahi hai.");
  }

  const expectedHost = new URL(SUPABASE_URL).host;

  if (parsed.host !== expectedHost) {
    // Supabase ke bahar ka direct URL.
    if (/^https?:$/.test(parsed.protocol)) return storedUrl;
    throw new Error("Video URL ka protocol supported nahi hai.");
  }

  const path = storagePathFromUrl(storedUrl, bucket);

  if (!path) {
    throw new Error(
      "Storage path nahi mila. URL mein bucket ya file path check karein."
    );
  }

  // Pehle se signed URL hai: existing token use karo.
  if (
    parsed.pathname.includes("/storage/v1/object/sign/") &&
    parsed.searchParams.has("token")
  ) {
    return storedUrl;
  }

  // Public URL ko direct use karna signed URL se zyada seedha hai.
  if (parsed.pathname.includes("/storage/v1/object/public/")) {
    return storedUrl;
  }

  // Private/authenticated object ke liye naya signed URL.
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  throw new Error(
    "Supabase Storage access error: " +
    (error?.message || "Signed URL generate nahi hua.")
  );
}

function showLogin() {
  authSection.hidden = false;
  panel.hidden = true;
  logoutBtn.hidden = true;
}

function showPanel() {
  authSection.hidden = true;
  panel.hidden = false;
  logoutBtn.hidden = false;
}

async function requireAdmin() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const user = data?.session?.user;

  if (!user) {
    showLogin();
    return false;
  }

  if (user.id !== ADMIN_UID) {
    await supabase.auth.signOut();
    showLogin();
    message(loginStatus, "Is account ko admin access nahi hai.", "error");
    return false;
  }

  showPanel();
  return true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (busy) return;

  busy = true;
  loginBtn.disabled = true;
  message(loginStatus, "Login ho raha hai...", "info");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;

    if (await requireAdmin()) {
      message(loginStatus);
      await loadVideos();
    }
  } catch (error) {
    message(loginStatus, "Login error: " + errorText(error), "error");
  } finally {
    busy = false;
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await closePreview();

  const { error } = await supabase.auth.signOut();

  if (error) {
    message(globalStatus, errorText(error), "error");
    return;
  }

  allVideos = [];
  showLogin();
});

async function loadVideos() {
  message(globalStatus, "Videos load ho rahe hain...", "info");

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allVideos = data || [];
    currentPage = 1;
    updateStats();
    renderVideos();

    message(globalStatus, `${allVideos.length} videos mil gaye.`, "ok");
  } catch (error) {
    message(globalStatus, "Load error: " + errorText(error), "error");
  }
}

function updateStats() {
  $("statTotal").textContent = formatNumber(allVideos.length);

  $("statPublished").textContent = formatNumber(
    allVideos.filter(isPublished).length
  );

  $("statHidden").textContent = formatNumber(
    allVideos.filter((video) => !isPublished(video)).length
  );

  $("statViews").textContent = formatNumber(
    allVideos.reduce((total, video) => total + Number(video.views || 0), 0)
  );
}

function filteredVideos() {
  const query = $("adminSearch").value.trim().toLowerCase();
  const filter = $("adminFilter").value;

  return allVideos.filter((video) => {
    const searchable = [
      video.title,
      video.category,
      video.description
    ].join(" ").toLowerCase();

    if (query && !searchable.includes(query)) return false;
    if (filter === "published" && !isPublished(video)) return false;
    if (filter === "hidden" && isPublished(video)) return false;

    return true;
  });
}

function renderVideos() {
  const videos = filteredVideos();
  const pageCount = Math.max(1, Math.ceil(videos.length / PER_PAGE));

  if (currentPage > pageCount) currentPage = pageCount;

  const start = (currentPage - 1) * PER_PAGE;
  const pageVideos = videos.slice(start, start + PER_PAGE);

  if (!pageVideos.length) {
    videoList.innerHTML = '<div class="empty">Koi video nahi mili.</div>';
  } else {
    videoList.innerHTML = pageVideos.map((video) => {
      const id = escapeHtml(video.id);
      const title = escapeHtml(video.title || "Untitled");
      const category = escapeHtml(video.category || "Uncategorized");
      const thumbnail = escapeHtml(video.thumbnail_url || "");

      return `
        <article class="video-card">
          <img class="thumb"
               src="${thumbnail}"
               alt="${title}"
               loading="lazy"
               onerror="this.style.visibility='hidden'">

          <div class="card-body">
            <div class="video-title">${title}</div>
            <div class="meta">${category}</div>
            <div class="meta">
              ${isPublished(video) ? "Published" : "Hidden / Pending"}
              · ${formatNumber(video.views)} views
            </div>

            <div class="card-actions">
              <button data-action="preview" data-id="${id}">Preview</button>
              <button class="secondary" data-action="edit" data-id="${id}">Edit</button>
              <button class="success" data-action="toggle" data-id="${id}">
                ${isPublished(video) ? "Hide" : "Publish"}
              </button>
              <button class="danger" data-action="delete" data-id="${id}">Delete</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  renderPagination(pageCount);
}

function renderPagination(pageCount) {
  pagination.innerHTML = "";

  function addButton(label, page, disabled = false, active = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;

    if (active) button.classList.add("active");
    if (label === "Previous" || label === "Next") {
      button.classList.add("secondary");
    }

    button.addEventListener("click", () => {
      currentPage = page;
      renderVideos();
      $("manage").scrollIntoView({ behavior: "smooth" });
    });

    pagination.appendChild(button);
  }

  addButton("Previous", Math.max(1, currentPage - 1), currentPage === 1);

  for (let page = 1; page <= pageCount; page++) {
    addButton(String(page), page, false, page === currentPage);
  }

  addButton("Next", Math.min(pageCount, currentPage + 1),
    currentPage === pageCount);
}

$("adminSearch").addEventListener("input", () => {
  currentPage = 1;
  renderVideos();
});

$("adminFilter").addEventListener("change", () => {
  currentPage = 1;
  renderVideos();
});

videoList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const video = allVideos.find(
    (item) => String(item.id) === button.dataset.id
  );

  if (!video) return;

  switch (button.dataset.action) {
    case "preview":
      await openPreview(video);
      break;
    case "edit":
      openEdit(video);
      break;
    case "toggle":
      await togglePublished(video);
      break;
    case "delete":
      await deleteVideo(video);
      break;
  }
});

async function openPreview(video) {
  const requestId = ++previewRequest;

  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();

  $("previewTitle").textContent = video.title || "Video Preview";
  previewInfo.textContent = "Video load ho rahi hai...";
  previewModal.hidden = false;
  previewModal.style.display = "flex";

  previewVideo.onerror = () => {
    if (requestId !== previewRequest) return;

    previewInfo.textContent =
      "Video play nahi hui. Signed URL expire ho sakta hai, file missing ho sakti hai ya Storage access denied hai.";
  };

  previewVideo.onloadedmetadata = () => {
    if (requestId !== previewRequest) return;

    previewInfo.textContent =
      "Video ready · " +
      (Number.isFinite(previewVideo.duration)
        ? Math.round(previewVideo.duration) + " seconds"
        : "Duration unavailable");
  };

  try {
    const url = await getPlayableUrl(VIDEO_BUCKET, video.video_url);

    if (requestId !== previewRequest) return;

    previewVideo.src = url;
    previewVideo.load();

    previewInfo.textContent =
      "Video URL mil gaya. Play dabayein.";
  } catch (error) {
    if (requestId !== previewRequest) return;

    previewInfo.textContent = "Preview error: " + errorText(error);
  }
}

async function closePreview() {
  previewRequest++;
  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();
  previewVideo.onerror = null;
  previewVideo.onloadedmetadata = null;
  previewModal.hidden = true;
  previewModal.style.display = "none";
}

$("closePreview").addEventListener("click", closePreview);

previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) closePreview();
});

function openEdit(video) {
  $("editId").value = video.id;
  $("editTitle").value = video.title || "";
  $("editCategory").value = video.category || "";
  $("editDescription").value = video.description || "";

  message(editStatus);
  editModal.hidden = false;
  editModal.style.display = "flex";
}

function closeEdit() {
  editModal.hidden = true;
  editModal.style.display = "none";
}

$("closeEdit").addEventListener("click", closeEdit);

editModal.addEventListener("click", (event) => {
  if (event.target === editModal) closeEdit();
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const saveButton = $("saveEditBtn");
  saveButton.disabled = true;

  try {
    const { error } = await supabase
      .from("videos")
      .update({
        title: $("editTitle").value.trim(),
        category: $("editCategory").value.trim(),
        description: $("editDescription").value.trim()
      })
      .eq("id", $("editId").value);

    if (error) throw error;

    message(editStatus, "Details update ho gayi.", "ok");
    await loadVideos();
    setTimeout(closeEdit, 700);
  } catch (error) {
    message(editStatus, "Update error: " + errorText(error), "error");
  } finally {
    saveButton.disabled = false;
  }
});

async function togglePublished(video) {
  const published = !isPublished(video);

  if (!confirm(`Video ko ${published ? "publish" : "hide"} karein?`)) {
    return;
  }

  try {
    const { error } = await supabase
      .from("videos")
      .update({ published })
      .eq("id", video.id);

    if (error) throw error;

    message(globalStatus, "Video status update ho gaya.", "ok");
    await loadVideos();
  } catch (error) {
    message(globalStatus, "Status error: " + errorText(error), "error");
  }
}

async function uploadToStorage(bucket, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined
  });

  if (error) throw error;

  return getPublicUrl(bucket, path);
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (busy) return;

  const title = $("uploadTitle").value.trim();
  const category = $("uploadCategory").value.trim();
  const description = $("uploadDescription").value.trim();
  const videoFile = $("uploadVideo").files[0];
  const thumbFile = $("uploadThumb").files[0];
  const published = $("uploadPublished").checked;

  if (!videoFile || !thumbFile) {
    message(uploadStatus, "Video aur thumbnail select karein.", "error");
    return;
  }

  if (!$("rightsConfirm").checked) {
    message(uploadStatus, "Upload permission confirm karein.", "error");
    return;
  }

  busy = true;
  uploadBtn.disabled = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session?.user?.id !== ADMIN_UID) {
      throw new Error("Admin session nahi hai. Dobara login karein.");
    }

    message(uploadStatus, "Thumbnail upload ho rahi hai...", "info");
    const thumbnailUrl = await uploadToStorage(THUMB_BUCKET, thumbFile);

    message(uploadStatus, "Video upload ho rahi hai...", "info");
    const videoUrl = await uploadToStorage(VIDEO_BUCKET, videoFile);

    const { error } = await supabase.from("videos").insert({
      title,
      category,
      description,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      published,
      views: 0
    });

    if (error) throw error;

    uploadForm.reset();
    $("uploadPublished").checked = true;

    message(uploadStatus, "Video upload ho gayi!", "ok");
    await loadVideos();
  } catch (error) {
    message(uploadStatus, "Upload error: " + errorText(error), "error");
  } finally {
    busy = false;
    uploadBtn.disabled = false;
  }
});

async function removeStorageFile(bucket, storedUrl) {
  const path = storagePathFromUrl(storedUrl, bucket);

  if (!path) return;

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) throw error;
}

async function deleteVideo(video) {
  if (!confirm(
    `"${video.title || "Video"}" ko permanently delete karna hai?`
  )) return;

  try {
    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", video.id);

    if (error) throw error;

    const cleanupErrors = [];

    for (const item of [
      { bucket: VIDEO_BUCKET, url: video.video_url },
      { bucket: THUMB_BUCKET, url: video.thumbnail_url }
    ]) {
      try {
        await removeStorageFile(item.bucket, item.url);
      } catch (error) {
        cleanupErrors.push(errorText(error));
      }
    }

    await loadVideos();

    if (cleanupErrors.length) {
      message(
        globalStatus,
        "Database record delete ho gaya, lekin Storage cleanup mein error: " +
        cleanupErrors.join(" | "),
        "error"
      );
    } else {
      message(globalStatus, "Video delete ho gayi.", "ok");
    }
  } catch (error) {
    message(globalStatus, "Delete error: " + errorText(error), "error");
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    showLogin();
  }
});

(async function init() {
  try {
    if (await requireAdmin()) {
      await loadVideos();
    }
  } catch (error) {
    showLogin();
    message(loginStatus, "Admin check error: " + errorText(error), "error");
  }
})();
