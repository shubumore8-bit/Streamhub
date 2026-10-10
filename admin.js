
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
let currentPreviewUrl = "";
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

function safeText(value) {
  return String(value ?? "");
}

function escapeHtml(value) {
  return safeText(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function storagePathFromUrl(url, bucket) {
  if (!url) return null;

  try {
    const parsed = new URL(url, SUPABASE_URL);
    const marker = "/storage/v1/object/";
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) return null;

    const rest = parsed.pathname.slice(markerIndex + marker.length);
    const parts = rest.split("/");
    const objectIndex = parts.findIndex((part) =>
      ["public", "sign", "authenticated"].includes(part)
    );

    if (objectIndex === -1) return null;
    if (parts[objectIndex + 1] !== bucket) return null;

    return parts.slice(objectIndex + 2)
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      })
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
  if (!storedUrl) {
    throw new Error("Database mein file URL nahi hai.");
  }

  const path = storagePathFromUrl(storedUrl, bucket);

  if (!path) {
    if (/^https?:\/\//i.test(storedUrl)) {
      return storedUrl;
    }

    throw new Error(
      "Storage path nahi mila. Database ke video_url ko check karein."
    );
  }

  // Private aur public buckets dono ke liye signed URL try karein.
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  // Public bucket ho to public URL bhi try karein.
  const publicUrl = getPublicUrl(bucket, path);

  if (publicUrl) return publicUrl;

  throw new Error(
    "Supabase file access error: " + (error?.message || "URL nahi bana")
  );
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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  busy = true;
  loginBtn.disabled = true;
  message(loginStatus, "Login ho raha hai...", "info");

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const ok = await requireAdmin();

    if (ok) {
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
  message(loginStatus, "Logout ho gaya.", "ok");
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

    message(globalStatus, `Total ${allVideos.length} videos mil gaye.`, "ok");
  } catch (error) {
    message(
      globalStatus,
      "Videos load nahi hue: " + errorText(error),
      "error"
    );
  }
}

function updateStats() {
  $("statTotal").textContent = formatNumber(allVideos.length);

  const published = allVideos.filter(isPublished);
  const hidden = allVideos.filter((video) => !isPublished(video));

  $("statPublished").textContent = formatNumber(published.length);
  $("statHidden").textContent = formatNumber(hidden.length);

  const views = allVideos.reduce(
    (total, video) => total + Number(video.views || 0),
    0
  );

  $("statViews").textContent = formatNumber(views);
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
      const title = escapeHtml(video.title || "Untitled video");
      const category = escapeHtml(video.category || "Uncategorized");
      const thumbnail = escapeHtml(video.thumbnail_url || "");
      const status = isPublished(video) ? "Published" : "Hidden / Pending";
      const views = formatNumber(video.views);

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
            <div class="meta">${status} · ${views} views</div>

            <div class="card-actions">
              <button type="button" data-action="preview" data-id="${id}">
                Preview
              </button>

              <button type="button" class="secondary"
                      data-action="edit" data-id="${id}">
                Edit
              </button>

              <button type="button" class="success"
                      data-action="toggle" data-id="${id}">
                ${isPublished(video) ? "Hide" : "Publish"}
              </button>

              <button type="button" class="danger"
                      data-action="delete" data-id="${id}">
                Delete
              </button>
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

  const addButton = (label, page, disabled = false, active = false) => {
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
  };

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

  if (!video) {
    message(globalStatus, "Video record nahi mila.", "error");
    return;
  }

  const action = button.dataset.action;

  if (action === "preview") await openPreview(video);
  if (action === "edit") openEdit(video);
  if (action === "toggle") await togglePublished(video);
  if (action === "delete") await deleteVideo(video);
});

async function openPreview(video) {
  const requestId = ++previewRequest;

  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();

  currentPreviewUrl = "";
  $("previewTitle").textContent = video.title || "Video Preview";
  previewInfo.textContent = "Video URL mil rahi hai...";
  previewModal.hidden = false;
  previewModal.style.display = "flex";

  previewVideo.onerror = () => {
    if (requestId !== previewRequest) return;

    previewInfo.textContent =
      "Video play nahi hui. Storage file, permissions, URL aur video format check karein.";
  };

  previewVideo.onloadedmetadata = () => {
    if (requestId !== previewRequest) return;

    const duration = Number.isFinite(previewVideo.duration)
      ? Math.round(previewVideo.duration) + " seconds"
      : "Duration unavailable";

    previewInfo.textContent = "Video ready · " + duration;
  };

  try {
    const url = await getPlayableUrl(VIDEO_BUCKET, video.video_url);

    if (requestId !== previewRequest) return;

    currentPreviewUrl = url;
    previewVideo.src = url;
    previewVideo.load();
    previewInfo.textContent =
      "URL mil gaya. Play button dabayein; agar error aaye to neeche message dekhein.";
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
  currentPreviewUrl = "";
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

  const id = $("editId").value;
  const title = $("editTitle").value.trim();
  const category = $("editCategory").value.trim();
  const description = $("editDescription").value.trim();
  const saveButton = $("saveEditBtn");

  saveButton.disabled = true;
  message(editStatus, "Save ho raha hai...", "info");

  try {
    const { error } = await supabase
      .from("videos")
      .update({ title, category, description })
      .eq("id", id);

    if (error) throw error;

    message(editStatus, "Video details update ho gayi.", "ok");
    await loadVideos();
    setTimeout(closeEdit, 700);
  } catch (error) {
    message(editStatus, "Update error: " + errorText(error), "error");
  } finally {
    saveButton.disabled = false;
  }
});

async function togglePublished(video) {
  const newValue = !isPublished(video);
  const action = newValue ? "publish" : "hide";

  if (!confirm(`Kya aap is video ko ${action} karna chahte hain?`)) {
    return;
  }

  message(globalStatus, "Video status update ho raha hai...", "info");

  try {
    const { error } = await supabase
      .from("videos")
      .update({ published: newValue })
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

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
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
    message(uploadStatus, "Video aur thumbnail dono select karein.", "error");
    return;
  }

  if (!$("rightsConfirm").checked) {
    message(uploadStatus, "Pehle upload permission confirm karein.", "error");
    return;
  }

  busy = true;
  uploadBtn.disabled = true;
  message(uploadStatus, "Files upload ho rahi hain. Page band na karein...", "info");

  try {
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session?.user?.id !== ADMIN_UID) {
      throw new Error("Admin session nahi hai. Dobara login karein.");
    }

    const thumbnailUrl = await uploadToStorage(THUMB_BUCKET, thumbFile);
    message(uploadStatus, "Thumbnail upload ho gayi. Video upload ho rahi hai...", "info");

    const videoUrl = await uploadToStorage(VIDEO_BUCKET, videoFile);

    const { error } = await supabase
      .from("videos")
      .insert({
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

    message(uploadStatus, "Video successfully upload ho gayi!", "ok");
    await loadVideos();
  } catch (error) {
    message(
      uploadStatus,
      "Upload error: " + errorText(error) +
      "\nSupabase table columns, Storage buckets aur policies check karein.",
      "error"
    );
  } finally {
    busy = false;
    uploadBtn.disabled = false;
  }
});

async function removeStorageFile(bucket, storedUrl) {
  const path = storagePathFromUrl(storedUrl, bucket);

  if (!path) return;

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw new Error(`${bucket} file delete error: ${error.message}`);
  }
}

async function deleteVideo(video) {
  const confirmed = confirm(
    `Kya aap "${video.title || "this video"}" ko permanently delete karna chahte hain?\n\nDatabase record aur Storage files delete ho sakti hain.`
  );

  if (!confirmed) return;

  message(globalStatus, "Delete ho raha hai...", "info");

  try {
    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", video.id);

    if (error) throw error;

    message(globalStatus, "Database record delete ho gaya. Storage cleanup ho rahi hai...", "info");

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
        "Video record delete ho gaya, lekin kuch Storage files delete nahi hui:\n" +
        cleanupErrors.join("\n"),
        "error"
      );
    } else {
      message(globalStatus, "Video aur Storage files delete ho gayi.", "ok");
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
    const isAdmin = await requireAdmin();

    if (isAdmin) {
      await loadVideos();
    }
  } catch (error) {
    showLogin();
    message(loginStatus, "Admin check error: " + errorText(error), "error");
  }
})();
