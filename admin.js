
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";
const VIDEO_BUCKET = "videos";
const THUMB_BUCKET = "thumbnails";
const PAGE_SIZE = 12;

const $ = (id) => document.getElementById(id);

let videos = [];
let currentPage = 1;
let currentUser = null;
let busy = false;
let sessionCheckStarted = false;

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
    if (!button.disabled) {
      button.dataset.originalText = button.textContent;
    }
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

  const markers = [
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
    `/storage/v1/object/upload/sign/${bucket}/`
  ];

  for (const marker of markers) {
    const index = url.pathname.indexOf(marker);

    if (index !== -1) {
      const encodedPath = url.pathname.slice(index + marker.length);

      try {
        return encodedPath
          .split("/")
          .map((part) => decodeURIComponent(part))
          .join("/");
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

  const path = objectPathFromURL(value, bucket);

  if (path) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);

    if (error) throw new Error("Video URL nahi bana: " + error.message);
    if (!data?.signedUrl) throw new Error("Signed URL return nahi hua.");

    return data.signedUrl;
  }

  const url = safeURL(value);
  if (url) return url;

  throw new Error("Video URL valid nahi hai.");
}

function storagePathForDelete(value, bucket) {
  return objectPathFromURL(value, bucket);
}

function showLogin() {
  loginPanel?.classList.remove("hidden");
  dashboard?.classList.add("hidden");
  $("logoutBtn")?.classList.add("hidden");
}

function showDashboard() {
  loginPanel?.classList.add("hidden");
  dashboard?.classList.remove("hidden");
  $("logoutBtn")?.classList.remove("hidden");
}

function isAdmin(user) {
  return Boolean(user && user.id === ADMIN_UID);
}

async function checkSession() {
  if (sessionCheckStarted) return;
  sessionCheckStarted = true;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const user = data.session?.user || null;

    if (!user) {
      currentUser = null;
      showLogin();
      return;
    }

    if (!isAdmin(user)) {
      currentUser = null;
      showLogin();
      message(loginMessage, "Is account ko admin access nahi hai.");
      await supabase.auth.signOut();
      return;
    }

    currentUser = user;
    showDashboard();
    await loadVideos();
  } catch (error) {
    currentUser = null;
    showLogin();
    message(loginMessage, "Session error: " + error.message);
  }
}

// LOGIN
$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const button = $("loginBtn");
  busy = true;
  setBusy(button, true, "Logging in…");
  message(loginMessage, "");

  try {
    const email = $("email")?.value.trim();
    const password = $("password")?.value;

    if (!email || !password) {
      throw new Error("Email aur password dono bharo.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (!isAdmin(data.user)) {
      await supabase.auth.signOut();
      throw new Error("Is account ko Admin access nahi hai.");
    }

    currentUser = data.user;
    showDashboard();
    await loadVideos();
  } catch (error) {
    message(loginMessage, "Login error: " + error.message);
  } finally {
    busy = false;
    setBusy(button, false);
  }
});

// LOGOUT
$("logoutBtn")?.addEventListener("click", async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    currentUser = null;
    videos = [];
    showLogin();
    message(loginMessage, "Logout ho gaya.");
  } catch (error) {
    message(loginMessage, "Logout error: " + error.message);
  }
});

// LOAD VIDEOS
async function loadVideos() {
  if (!isAdmin(currentUser)) return;

  message(listMessage, "Videos load ho rahe hain…");
  if ($("videoList")) $("videoList").innerHTML = "";
  if ($("pager")) $("pager").innerHTML = "";

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    videos = data || [];
    const pages = Math.max(1, Math.ceil(filteredVideos().length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pages);

    updateStats();
    renderVideos();

    message(
      listMessage,
      videos.length ? `${videos.length} videos loaded.` : "Abhi koi video nahi mila."
    );
  } catch (error) {
    message(listMessage, "Videos load nahi hue: " + error.message);
  }
}

function updateStats() {
  if ($("totalCount")) {
    $("totalCount").textContent = videos.length;
  }

  if ($("publishedCount")) {
    $("publishedCount").textContent =
      videos.filter((v) => v.published === true).length;
  }

  if ($("hiddenCount")) {
    $("hiddenCount").textContent =
      videos.filter((v) => v.published !== true).length;
  }

  if ($("viewsCount")) {
    $("viewsCount").textContent = videos.reduce(
      (sum, v) => sum + (Number(v.views) || 0),
      0
    );
  }
}

function getApprovalStatus(video) {
  const status = String(video.approval_status || "").toLowerCase();

  if (status === "rejected") return "rejected";
  if (video.published === true) return "approved";
  if (status === "approved") return "approved";

  return "pending";
}

function filteredVideos() {
  const query = ($("searchInput")?.value || "").trim().toLowerCase();
  const filter = $("filterSelect")?.value || "all";

  return videos.filter((video) => {
    const matchesText =
      String(video.title || "").toLowerCase().includes(query) ||
      String(video.category || "").toLowerCase().includes(query);

    const status = getApprovalStatus(video);

    const matchesStatus =
      filter === "all" ||
      (filter === "published" && video.published === true) ||
      (filter === "pending" &&
        video.published !== true &&
        status !== "rejected") ||
      (filter === "rejected" && status === "rejected") ||
      (filter === "unpublished" && video.published !== true);

    return matchesText && matchesStatus;
  });
}

// RENDER VIDEO CARDS
function renderVideos() {
  const list = $("videoList");
  const pager = $("pager");
  if (!list || !pager) return;

  const filtered = filteredVideos();
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  currentPage = Math.max(1, Math.min(currentPage, pages));

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
    const status = getApprovalStatus(video);
    const id = escapeHTML(video.id);
    const statusLabel = {
      approved: "Approved",
      pending: "Pending approval",
      rejected: "Rejected"
    }[status];

    const statusClass = {
      approved: "live",
      pending: "pending",
      rejected: "rejected"
    }[status];

    return `
      <article class="video-card">
        ${
          thumbnail
            ? `<img class="thumb" src="${escapeHTML(thumbnail)}" alt="Thumbnail" loading="lazy">`
            : `<div class="thumb"></div>`
        }

        <div class="card-body">
          <div class="video-title">${escapeHTML(video.title || "Untitled")}</div>
          <div class="meta">Category: ${escapeHTML(video.category || "Uncategorized")}</div>
          <div class="meta">Views: ${Number(video.views) || 0}</div>
          <div class="meta">ID: ${escapeHTML(video.id || "")}</div>
          <div class="meta">Created: ${escapeHTML(video.created_at || "Unknown")}</div>

          <span class="status ${statusClass}">${statusLabel}</span>
          <div class="meta">Website status: ${published ? "Published" : "Not published"}</div>

          <div class="actions">
            <button type="button" data-action="preview" data-id="${id}">Preview</button>
            <button type="button" class="secondary" data-action="edit" data-id="${id}">Edit</button>
            <button type="button" class="approve" data-action="approve" data-id="${id}">Approve</button>
            <button type="button" class="danger" data-action="reject" data-id="${id}">Reject</button>
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

// VIDEO BUTTONS
$("videoList")?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || busy) return;

  const video = videos.find((v) => String(v.id) === button.dataset.id);
  if (!video) return;

  switch (button.dataset.action) {
    case "preview":
      await openPreview(video);
      break;
    case "edit":
      openEdit(video);
      break;
    case "approve":
      await setApprovalStatus(video, "approved", button);
      break;
    case "reject":
      await setApprovalStatus(video, "rejected", button);
      break;
    case "toggle":
      await togglePublished(video, button);
      break;
    case "delete":
      await deleteVideo(video, button);
      break;
  }
});

$("pager")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;

  currentPage = Number(button.dataset.page);
  renderVideos();
});

$("searchInput")?.addEventListener("input", () => {
  currentPage = 1;
  renderVideos();
});

$("filterSelect")?.addEventListener("change", () => {
  currentPage = 1;
  renderVideos();
});

$("refreshBtn")?.addEventListener("click", () => loadVideos());

// VIDEO PREVIEW
async function openPreview(video) {
  const player = $("previewVideo");
  if (!player || !previewDialog) return;

  player.pause();
  player.removeAttribute("src");
  player.load();

  $("previewTitle").textContent = video.title || "Video preview";
  message(previewMessage, "Video URL taiyar ho raha hai…");
  previewDialog.showModal();

  try {
    const playableURL = await getPlayableURL(VIDEO_BUCKET, video.video_url);

    player.onerror = () => {
      message(
        previewMessage,
        "Video play nahi hui. Storage access, file format aur URL check karo."
      );
    };

    player.src = playableURL;
    player.load();
    message(previewMessage, "Play button dabakar video dekho.");
  } catch (error) {
    message(previewMessage, "Preview error: " + error.message);
  }
}

function stopPreview() {
  const player = $("previewVideo");

  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
  }
}

$("closePreviewBtn")?.addEventListener("click", () => {
  stopPreview();
  previewDialog?.close();
});

previewDialog?.addEventListener("close", stopPreview);

// EDIT VIDEO
function openEdit(video) {
  if (!editDialog) return;

  $("editId").value = video.id;
  $("editTitle").value = video.title || "";
  $("editCategory").value = video.category || "";
  $("editDescription").value = video.description || "";

  message(editMessage, "");
  editDialog.showModal();
}

$("cancelEditBtn")?.addEventListener("click", () => editDialog?.close());

$("editForm")?.addEventListener("submit", async (event) => {
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

    const { data, error } = await supabase
      .from("videos")
      .update(changes)
      .eq("id", id)
      .select("id");

    if (error) throw error;
    if (!data?.length) {
      throw new Error("Video update nahi hui. Permissions check karo.");
    }

    editDialog.close();
    await loadVideos();
  } catch (error) {
    message(editMessage, "Save error: " + error.message);
  } finally {
    busy = false;
    setBusy(button, false);
  }
});

// APPROVE / REJECT
async function setApprovalStatus(video, status, button) {
  if (busy || !isAdmin(currentUser)) return;

  if (status === "rejected") {
    const confirmed = confirm(
      `"${video.title || "Video"}" ko reject karna hai? Video publish nahi rahegi.`
    );
    if (!confirmed) return;
  }

  busy = true;
  setBusy(button, true, "Saving…");

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (!isAdmin(sessionData.session?.user)) {
      throw new Error("Admin session valid nahi hai. Dobara login karo.");
    }

    const updates = {
      approval_status: status,
      published: status === "approved"
    };

    const { data, error } = await supabase
      .from("videos")
      .update(updates)
      .eq("id", video.id)
      .select("id, published, approval_status");

    if (error) throw error;
    if (!data?.length) {
      throw new Error(
        "Status save nahi hua. Supabase UPDATE policy check karo."
      );
    }

    const saved = data[0];

    if (
      saved.approval_status !== status ||
      saved.published !== (status === "approved")
    ) {
      throw new Error("Database mein status expected value se match nahi hua.");
    }

    await loadVideos();

    alert(
      status === "approved"
        ? "Video approve aur publish ho gayi!"
        : "Video reject ho gayi aur unpublished hai."
    );
  } catch (error) {
    console.error("Approval status error:", error);
    alert("Status error: " + error.message);
  } finally {
    busy = false;
    setBusy(button, false);
  }
}

// PUBLISH / UNPUBLISH
async function togglePublished(video, button) {
  if (busy || !isAdmin(currentUser)) return;

  const nextPublished = video.published !== true;

  if (
    nextPublished &&
    getApprovalStatus(video) === "rejected"
  ) {
    alert("Rejected video ko pehle Approve karo.");
    return;
  }

  busy = true;
  setBusy(button, true, "Updating…");

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (!isAdmin(sessionData.session?.user)) {
      throw new Error("Admin session valid nahi hai. Dobara login karo.");
    }

    const updates = {
      published: nextPublished,
      approval_status: nextPublished ? "approved" : "pending"
    };

    const { data, error } = await supabase
      .from("videos")
      .update(updates)
      .eq("id", video.id)
      .select("id, published, approval_status");

    if (error) throw error;
    if (!data?.length) {
      throw new Error("Update save nahi hua. Permissions check karo.");
    }

    await loadVideos();

    alert(nextPublished
      ? "Video successfully published!"
      : "Video unpublished ho gayi.");
  } catch (error) {
    alert("Publish error: " + error.message);
  } finally {
    busy = false;
    setBusy(button, false);
  }
}

// DELETE VIDEO
async function deleteVideo(video, button) {
  if (busy || !isAdmin(currentUser)) return;

  if (!confirm(
    `"${video.title || "is video"}" ko permanently delete karna hai? Ye action undo nahi hoga.`
  )) return;

  busy = true;
  setBusy(button, true, "Deleting…");

  try {
    const { data, error } = await supabase
      .from("videos")
      .delete()
      .eq("id", video.id)
      .select("id");

    if (error) throw error;
    if (!data?.length) {
      throw new Error("Video delete nahi hui. Permissions check karo.");
    }

    const videoPath = storagePathForDelete(video.video_url, VIDEO_BUCKET);

    if (videoPath) {
      const { error: storageError } = await supabase.storage
        .from(VIDEO_BUCKET)
        .remove([videoPath]);

      if (storageError) {
        console.warn("Video file remove nahi hui:", storageError.message);
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
    alert("Video database se delete ho gayi.");
  } catch (error) {
    alert("Delete error: " + error.message);
  } finally {
    busy = false;
    setBusy(button, false);
  }
}

// STORAGE UPLOAD
async function uploadToBucket(bucket, file, folder) {
  const fallback = bucket === VIDEO_BUCKET ? "mp4" : "jpg";
  const ext = fileExtension(file, fallback);
  const path = `${folder}/${crypto.randomUUID()}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined
    });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    path,
    publicUrl: data?.publicUrl || ""
  };
}

// ADMIN VIDEO UPLOAD
$("uploadForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  if (!isAdmin(currentUser)) {
    message(uploadMessage, "Pehle admin login karo.");
    return;
  }

  const button = $("uploadBtn");
  const videoFile = $("videoFile")?.files?.[0];
  const thumbnailFile = $("thumbnailFile")?.files?.[0];

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

    const uploadedVideo = await uploadToBucket(
      VIDEO_BUCKET,
      videoFile,
      "uploads"
    );

    uploadedVideoPath = uploadedVideo.path;

    let thumbnailURL = null;

    if (thumbnailFile) {
      message(uploadMessage, "Thumbnail upload ho raha hai…");

      const uploadedThumb = await uploadToBucket(
        THUMB_BUCKET,
        thumbnailFile,
        "uploads"
      );

      uploadedThumbPath = uploadedThumb.path;
      thumbnailURL = uploadedThumb.publicUrl || uploadedThumb.path;
    }

    if (!uploadedVideo.publicUrl) {
      throw new Error("Video public URL create nahi hua.");
    }

    const row = {
      user_id: currentUser.id,
      title,
      category,
      description,
      video_url: uploadedVideo.publicUrl,
      thumbnail_url: thumbnailURL,
      published,
      approval_status: published ? "approved" : "pending",
      views: 0
    };

    const { error } = await supabase.from("videos").insert(row);
    if (error) throw error;

    $("uploadForm").reset();

    message(
      uploadMessage,
      published
        ? "Video upload aur publish ho gayi."
        : "Video upload ho gayi; approval pending hai."
    );

    await loadVideos();
  } catch (error) {
    message(uploadMessage, "Upload error: " + error.message);

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

// AUTH STATE
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "INITIAL_SESSION") return;

  const user = session?.user || null;

  if (!user) {
    currentUser = null;
    videos = [];
    showLogin();
    return;
  }

  if (!isAdmin(user)) {
    currentUser = null;
    showLogin();
    return;
  }

  currentUser = user;
  showDashboard();

  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    loadVideos();
  }
});

// INITIAL SESSION CHECK
checkSession();
