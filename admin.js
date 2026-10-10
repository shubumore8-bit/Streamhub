
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sirf isi user ID ko admin access diya jayega.
const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";

const VIDEO_BUCKET = "videos";
const THUMB_BUCKET = "thumbnails";
const PAGE_SIZE = 12;

const $ = (id) => document.getElementById(id);

let videos = [];
let currentPage = 1;
let currentUser = null;
let busy = false;

const loginPanel = $("loginPanel");
const dashboard = $("dashboard");
const loginMessage = $("loginMessage");
const uploadMessage = $("uploadMessage");
const listMessage = $("listMessage");
const editMessage = $("editMessage");
const previewMessage = $("previewMessage");
const previewDialog = $("previewDialog");
const editDialog = $("editDialog");

function message(element, text = "") {
  if (element) element.textContent = text;
}

function setBusy(button, state, busyText = "Please wait…") {
  if (!button) return;
  if (state) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function safeURL(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function fileExtension(file, fallback) {
  const ext = String(file?.name || "").split(".").pop().toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : fallback;
}

function objectPathFromURL(value, bucket) {
  if (!value) return "";

  const raw = String(value).trim();

  // Database mein sirf storage path save ho to usko bhi handle karo.
  if (
    !raw.startsWith("http://") &&
    !raw.startsWith("https://") &&
    !raw.startsWith("/")
  ) {
    return raw.replace(/^\/+/, "");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }

  const pathname = url.pathname;
  const markers = [
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
    `/storage/v1/object/upload/sign/${bucket}/`
  ];

  for (const marker of markers) {
    const index = pathname.indexOf(marker);
    if (index !== -1) {
      const encodedPath = pathname.slice(index + marker.length);
      try {
        return encodedPath.split("/").map(part => decodeURIComponent(part)).join("/");
      } catch {
        return encodedPath;
      }
    }
  }

  return "";
}

async function getPlayableURL(bucket, storedValue) {
  const value = String(storedValue || "").trim();

  if (!value) {
    throw new Error("Database mein video_url khaali hai.");
  }

  // URL ke bajaye storage path stored ho to naya signed URL banao.
  const path = objectPathFromURL(value, bucket);

  if (path) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);

    if (error) {
      throw new Error("Storage URL nahi bana: " + error.message);
    }

    if (!data?.signedUrl) {
      throw new Error("Supabase ne signed URL return nahi kiya.");
    }

    return data.signedUrl;
  }

  // Agar database mein direct external URL hai, use as-is karo.
  const url = safeURL(value);
  if (url) return url;

  throw new Error("Database ka video_url valid HTTP/HTTPS URL nahi hai.");
}

function storagePathForDelete(value, bucket) {
  return objectPathFromURL(value, bucket);
}

function showLogin() {
  loginPanel.classList.remove("hidden");
  dashboard.classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
}

function showDashboard() {
  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
}

async function checkSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    message(loginMessage, error.message);
    showLogin();
    return;
  }

  currentUser = data.session?.user || null;

  if (!currentUser) {
    showLogin();
    return;
  }

  if (currentUser.id !== ADMIN_UID) {
    message(loginMessage, "Is account ko admin access nahi hai.");
    await supabase.auth.signOut();
    currentUser = null;
    showLogin();
    return;
  }

  showDashboard();
  await loadVideos();
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const button = $("loginBtn");
  busy = true;
  setBusy(button, true, "Logging in…");
  message(loginMessage, "");

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (data.user?.id !== ADMIN_UID) {
      await supabase.auth.signOut();
      throw new Error("Is account ko admin access nahi hai.");
    }

    currentUser = data.user;
    showDashboard();
    await loadVideos();
  } catch (error) {
    message(loginMessage, error.message || "Login failed.");
  } finally {
    busy = false;
    setBusy(button, false);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  videos = [];
  showLogin();
  message(loginMessage, "Logout ho gaya.");
});

async function loadVideos() {
  if (!currentUser || currentUser.id !== ADMIN_UID) return;

  message(listMessage, "Videos load ho rahe hain…");
  $("videoList").innerHTML = "";
  $("pager").innerHTML = "";

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    videos = data || [];
    currentPage = 1;
    updateStats();
    renderVideos();
    message(listMessage, videos.length ? "" : "Abhi koi video nahi mila.");
  } catch (error) {
    message(listMessage, "Videos load nahi hue: " + error.message);
  }
}

function updateStats() {
  $("totalCount").textContent = videos.length;
  $("publishedCount").textContent =
    videos.filter(v => v.published === true).length;
  $("hiddenCount").textContent =
    videos.filter(v => v.published !== true).length;
  $("viewsCount").textContent = videos.reduce(
    (sum, v) => sum + (Number(v.views) || 0), 0
  );
}

function filteredVideos() {
  const query = $("searchInput").value.trim().toLowerCase();
  const filter = $("filterSelect").value;

  return videos.filter((video) => {
    const matchesText =
      String(video.title || "").toLowerCase().includes(query) ||
      String(video.category || "").toLowerCase().includes(query);

    const matchesStatus =
      filter === "all" ||
      (filter === "published" && video.published === true) ||
      (filter === "unpublished" && video.published !== true);

    return matchesText && matchesStatus;
  });
}

function renderVideos() {
  const list = $("videoList");
  const pager = $("pager");
  const filtered = filteredVideos();

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageVideos = filtered.slice(start, start + PAGE_SIZE);

  if (!pageVideos.length) {
    list.innerHTML = "";
    message(listMessage, "Is search/filter mein koi video nahi mila.");
  } else {
    message(listMessage, `${filtered.length} videos mile.`);
  }

  list.innerHTML = pageVideos.map((video) => {
    const thumbnail = safeURL(video.thumbnail_url);
    const published = video.published === true;
    const id = escapeHTML(video.id);

    return `
      <article class="video-card">
        ${
          thumbnail
            ? `<img class="thumb" src="${escapeHTML(thumbnail)}" alt="Thumbnail" loading="lazy">`
            : `<div class="thumb"></div>`
        }
        <div class="card-body">
          <div class="video-title">${escapeHTML(video.title || "Untitled")}</div>
          <div class="meta">${escapeHTML(video.category || "Uncategorized")}</div>
          <div class="meta">Views: ${Number(video.views) || 0}</div>
          <div class="meta">${escapeHTML(video.id || "")}</div>
          <span class="status ${published ? "live" : "off"}">
            ${published ? "Published" : "Unpublished"}
          </span>
          <div class="actions">
            <button type="button" data-action="preview" data-id="${id}">Preview</button>
            <button type="button" class="secondary" data-action="edit" data-id="${id}">Edit</button>
            <button type="button" class="secondary" data-action="toggle" data-id="${id}">
              ${published ? "Unpublish" : "Publish"}
            </button>
            <button type="button" class="danger" data-action="delete" data-id="${id}">Delete</button>
          </div>
        </div>
      </article>`;
  }).join("");

  pager.innerHTML = `
    <button class="secondary" type="button" data-page="${currentPage - 1}"
      ${currentPage <= 1 ? "disabled" : ""}>Previous</button>
    <span>Page ${currentPage} / ${pages}</span>
    <button class="secondary" type="button" data-page="${currentPage + 1}"
      ${currentPage >= pages ? "disabled" : ""}>Next</button>
  `;
}

$("videoList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const video = videos.find(v => String(v.id) === button.dataset.id);
  if (!video) return;

  const action = button.dataset.action;

  if (action === "preview") await openPreview(video);
  if (action === "edit") openEdit(video);
  if (action === "toggle") await togglePublished(video, button);
  if (action === "delete") await deleteVideo(video, button);
});

$("pager").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  renderVideos();
});

$("searchInput").addEventListener("input", () => {
  currentPage = 1;
  renderVideos();
});

$("filterSelect").addEventListener("change", () => {
  currentPage = 1;
  renderVideos();
});

$("refreshBtn").addEventListener("click", loadVideos);

async function openPreview(video) {
  const player = $("previewVideo");
  player.pause();
  player.removeAttribute("src");
  player.load();

  $("previewTitle").textContent = video.title || "Video preview";
  message(previewMessage, "Video URL taiyar ho raha hai…");
  previewDialog.showModal();

  try {
    const playableURL = await getPlayableURL(VIDEO_BUCKET, video.video_url);

    player.src = playableURL;
    player.load();

    message(previewMessage, "Agar video na chale, neeche aane wala error check karein.");

    player.onerror = () => {
      const mediaError = player.error;
      const details = mediaError
        ? `Media error code: ${mediaError.code}`
        : "Browser video load nahi kar saka.";
      message(previewMessage, details + ". File format, storage access aur URL check karein.");
    };

    try {
      await player.play();
    } catch {
      // Mobile browsers can block autoplay; user can press Play manually.
    }
  } catch (error) {
    message(previewMessage, "Preview error: " + (error.message || "Unknown error"));
  }
}

$("closePreviewBtn").addEventListener("click", () => {
  const player = $("previewVideo");
  player.pause();
  player.removeAttribute("src");
  player.load();
  previewDialog.close();
});

previewDialog.addEventListener("close", () => {
  const player = $("previewVideo");
  player.pause();
  player.removeAttribute("src");
  player.load();
});

function openEdit(video) {
  $("editId").value = video.id;
  $("editTitle").value = video.title || "";
  $("editCategory").value = video.category || "";
  $("editDescription").value = video.description || "";
  message(editMessage, "");
  editDialog.showModal();
}

$("cancelEditBtn").addEventListener("click", () => editDialog.close());

$("editForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const button = $("saveEditBtn");
  busy = true;
  setBusy(button, true, "Saving…");
  message(editMessage, "");

  try {
    const id = $("editId").value;
    const changes = {
      title: $("editTitle").value.trim(),
      category: $("editCategory").value.trim(),
      description: $("editDescription").value.trim()
    };

    if (!changes.title || !changes.category) {
      throw new Error("Title aur category bharna zaroori hai.");
    }

    const { error } = await supabase
      .from("videos")
      .update(changes)
      .eq("id", id);

    if (error) throw error;

    editDialog.close();
    await loadVideos();
  } catch (error) {
    message(editMessage, "Save error: " + error.message);
  } finally {
    busy = false;
    setBusy(button, false);
  }
});


async function togglePublished(video, button) {
  if (busy) return;

  busy = true;
  setBusy(button, true, "Publishing…");

  try {
    const nextPublished = video.published !== true;

    const updates = {
      published: nextPublished
    };

    // Approval column available ho to usko bhi update karo.
     updates.approval_status = nextPublished
  ? "approved"
  : "pending";
  }

    const { data, error } = await supabase
      .from("videos")
      .update(updates)
      .eq("id", video.id)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(
        "Video update nahi hui. Supabase RLS policy aur admin login check karo."
      );
    }

    await loadVideos();

    alert(
      nextPublished
        ? "Video publish ho gayi!"
        : "Video unpublish ho gayi."
    );
  } catch (error) {
    alert("Publish error: " + error.message);
  } finally {
    busy = false;
    setBusy(button, false);
  }
}


async function deleteVideo(video, button) {
  if (busy) return;

  const confirmed = confirm(
    `Kya tum "${video.title || "is video"}" ko delete karna chahte ho? Ye action undo nahi hoga.`
  );
  if (!confirmed) return;

  busy = true;
  setBusy(button, true, "Deleting…");

  try {
    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", video.id);

    if (error) throw error;

    const videoPath = storagePathForDelete(video.video_url, VIDEO_BUCKET);
    if (videoPath) {
      const { error: storageError } = await supabase.storage
        .from(VIDEO_BUCKET)
        .remove([videoPath]);

      if (storageError) {
        console.warn("Video storage file remove nahi hui:", storageError.message);
      }
    }

    const thumbPath = storagePathForDelete(video.thumbnail_url, THUMB_BUCKET);
    if (thumbPath) {
      const { error: thumbError } = await supabase.storage
        .from(THUMB_BUCKET)
        .remove([thumbPath]);

      if (thumbError) {
        console.warn("Thumbnail remove nahi hui:", thumbError.message);
      }
    }

    await loadVideos();
  } catch (error) {
    alert("Delete error: " + error.message);
  } finally {
    busy = false;
    setBusy(button, false);
  }
}

async function uploadToBucket(bucket, file, folder) {
  const ext = fileExtension(file, bucket === VIDEO_BUCKET ? "mp4" : "jpg");
  const path = `${folder}/${crypto.randomUUID()}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined
    });

  if (uploadError) throw uploadError;

  // Public bucket URL will work indefinitely for a public bucket.
  // Private buckets require a fresh signed URL when playing.
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data?.publicUrl || "" };
}

$("uploadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const button = $("uploadBtn");
  const videoFile = $("videoFile").files[0];
  const thumbnailFile = $("thumbnailFile").files[0];

  if (!videoFile) {
    message(uploadMessage, "Pehle video file select karo.");
    return;
  }

  busy = true;
  setBusy(button, true, "Uploading…");
  message(uploadMessage, "Upload shuru ho raha hai…");

  let uploadedVideoPath = "";
  let uploadedThumbPath = "";

  try {
    const title = $("videoTitle").value.trim();
    const category = $("videoCategory").value.trim();
    const description = $("videoDescription").value.trim();
    const published = $("publishNow").checked;

    if (!title || !category) {
      throw new Error("Title aur category zaroori hain.");
    }

    message(uploadMessage, "Video file upload ho rahi hai…");
    const uploadedVideo = await uploadToBucket(VIDEO_BUCKET, videoFile, "uploads");
    uploadedVideoPath = uploadedVideo.path;

    let thumbnailURL = null;

    if (thumbnailFile) {
      message(uploadMessage, "Thumbnail upload ho raha hai…");
      const uploadedThumb = await uploadToBucket(THUMB_BUCKET, thumbnailFile, "uploads");
      uploadedThumbPath = uploadedThumb.path;
      thumbnailURL = uploadedThumb.publicUrl || uploadedThumb.path;
    }

    // Save a fresh signed URL for private video buckets.
    // It expires; the admin preview can renew it from its storage path.
    const { data: signedData, error: signedError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(uploadedVideoPath, 60 * 60 * 24 * 7);

    if (signedError) throw signedError;

    const videoURL = signedData?.signedUrl;
    if (!videoURL) throw new Error("Video URL create nahi hua.");

    const row = {
      title,
      category,
      description,
      video_url: videoURL,
      thumbnail_url: thumbnailURL,
      published,
      views: 0
    };

    const { error: insertError } = await supabase
      .from("videos")
      .insert(row);

    if (insertError) throw insertError;

    $("uploadForm").reset();
    message(uploadMessage, "Video successfully upload ho gaya.");
    await loadVideos();
  } catch (error) {
    message(uploadMessage, "Upload error: " + (error.message || "Unknown error"));

    // Clean up files if the database insert failed.
    if (uploadedVideoPath) {
      await supabase.storage.from(VIDEO_BUCKET).remove([uploadedVideoPath]);
    }
    if (uploadedThumbPath) {
      await supabase.storage.from(THUMB_BUCKET).remove([uploadedThumbPath]);
    }
  } finally {
    busy = false;
    setBusy(button, false);
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;

  if (!currentUser) {
    showLogin();
  } else if (currentUser.id === ADMIN_UID) {
    showDashboard();
  } else {
    showLogin();
  }
});

checkSession();
