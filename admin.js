
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";
const $ = (selector) => document.querySelector(selector);

let videos = [];
let previewToken = 0;

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);

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
  return ({ pending: "Pending", published: "Published", hidden: "Hidden" })[status] || status;
}

function normalizePath(value, bucket) {
  let path = String(value || "").trim().replace(/^\/+/, "");

  // Strip the bucket name if it was accidentally saved in video_url.
  if (path.startsWith(bucket + "/")) path = path.slice(bucket.length + 1);

  // Remove known Storage URL prefixes when a path, rather than a full URL, was saved.
  path = path.replace(/^storage\/v1\/object\/(sign|public|authenticated)\//, "");
  if (path.startsWith(bucket + "/")) path = path.slice(bucket.length + 1);

  return path;
}

async function storageUrl(bucket, value) {
  if (!value) throw new Error("Database mein video_url khaali hai.");

  const raw = String(value).trim();

  // Full Supabase Storage URL: extract the object path and create a fresh signed URL.
  if (/^https?:\/\//i.test(raw)) {
    let parsed;

    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("Video URL sahi nahi hai.");
    }

    const marker = "/storage/v1/object/";
    const index = parsed.pathname.indexOf(marker);

    // A normal external URL is not a Supabase Storage URL.
    if (index === -1) return raw;

    let objectPath = parsed.pathname.slice(index + marker.length);
    objectPath = objectPath.replace(/^(sign|public|authenticated)\//, "");

    if (!objectPath.startsWith(bucket + "/")) {
      throw new Error("URL mein bucket galat hai. Expected: " + bucket);
    }

    objectPath = objectPath.slice(bucket.length + 1);

    try {
      objectPath = decodeURIComponent(objectPath);
    } catch {
      // Keep the path unchanged if it has malformed percent encoding.
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 3600);

    if (!error && data?.signedUrl) return data.signedUrl;

    // Public URLs can still work when signing isn't allowed.
    if (parsed.pathname.includes("/object/public/")) return raw;

    throw new Error(
      "Signed URL nahi bana. Storage path/permission check karo. " +
      (error?.message || "")
    );
  }

  let path = normalizePath(raw, bucket);

  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the original path if decoding fails.
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(
      "Storage object nahi mila: " + path +
      ". " + (error?.message || "")
    );
  }

  return data.signedUrl;
}

function showAdmin() {
  if ($("#auth")) $("#auth").hidden = true;
  if ($("#panel")) $("#panel").hidden = false;
}

function showLogin() {
  if ($("#auth")) $("#auth").hidden = false;
  if ($("#panel")) $("#panel").hidden = true;
}

async function login(event) {
  event?.preventDefault();

  const email = $("#email")?.value.trim();
  const password = $("#password")?.value;

  if (!email || !password) {
    notify("Email aur password enter karo.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    notify("Login failed: " + error.message);
    return;
  }

  await boot();
}

async function logout() {
  closePreview();
  await supabase.auth.signOut();
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
    if (manage) manage.textContent = "Load failed: " + error.message;
    throw error;
  }

  videos = data || [];
  renderStats();
  renderVideos();
}

function renderStats() {
  if ($("#statTotal")) $("#statTotal").textContent = videos.length;

  if ($("#statPublished")) {
    $("#statPublished").textContent =
      videos.filter(v => statusOf(v) === "published").length;
  }

  if ($("#statHidden")) {
    $("#statHidden").textContent =
      videos.filter(v => statusOf(v) === "hidden").length;
  }

  if ($("#statViews")) {
    $("#statViews").textContent = videos
      .reduce((sum, v) => sum + (Number(v.views) || 0), 0)
      .toLocaleString();
  }
}

function renderVideos() {
  const manage = $("#manage");
  if (!manage) return;

  const query = ($("#adminSearch")?.value || "").toLowerCase().trim();
  const filter = $("#adminFilter")?.value || "all";

  const filtered = videos.filter(video => {
    const status = statusOf(video);
    const matchesStatus = filter === "all" || filter === status;
    const matchesQuery = [
      video.title, video.category, video.description
    ].some(v => String(v || "").toLowerCase().includes(query));

    return matchesStatus && matchesQuery;
  });

  if (!filtered.length) {
    manage.innerHTML = "<p>Koi video nahi mili.</p>";
    return;
  }

  manage.innerHTML = filtered.map(video => {
    const id = escapeHTML(video.id);
    const status = statusOf(video);
    const title = escapeHTML(video.title || "Untitled video");
    const category = escapeHTML(video.category || "Other");

    let thumb = "";
    if (video.thumbnail_url) {
      const value = String(video.thumbnail_url);
      if (/^https?:\/\//i.test(value)) {
        thumb = value;
      } else {
        thumb = supabase.storage.from("thumbnails")
          .getPublicUrl(normalizePath(value, "thumbnails")).data.publicUrl;
      }
    }

    return `
      <article style="background:#151515;color:white;border:1px solid #333;
        border-radius:12px;padding:12px;margin:12px 0">
        ${thumb ? `<img src="${escapeHTML(thumb)}" alt=""
          style="width:100%;max-height:200px;object-fit:cover;border-radius:8px">` : ""}
        <h3>${title}</h3>
        <p>Category: ${category}</p>
        <p>Status: <b>${statusLabel(status)}</b></p>
        <p>Views: ${Number(video.views) || 0}</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button type="button" data-action="preview" data-id="${id}">▶ Preview</button>
          <button type="button" data-action="publish" data-id="${id}">✓ Approve</button>
          <button type="button" data-action="hide" data-id="${id}">Hide</button>
          <button type="button" data-action="delete" data-id="${id}">Delete</button>
        </div>
      </article>`;
  }).join("");
}

async function previewVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));

  if (!video) return notify("Video record nahi mili.");
  if (!video.video_url) return notify("video_url khaali hai.");

  const modal = $("#videoPreviewModal");
  const player = $("#previewPlayer");
  const errorBox = $("#previewError");

  if (!modal || !player) {
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

  if ($("#previewTitle")) {
    $("#previewTitle").textContent = video.title || "Video Preview";
  }
  if ($("#previewInfo")) {
    $("#previewInfo").textContent =
      `${video.category || "Other"} · ${statusLabel(statusOf(video))}`;
  }

  modal.hidden = false;
  if (errorBox) errorBox.textContent = "Video load ho rahi hai...";

  player.onerror = () => {
    if (token !== previewToken) return;

    const code = player.error?.code;
    const messages = {
      1: "Video loading cancel hui.",
      2: "Network ya Storage se video load nahi hui. URL aur permissions check karo.",
      3: "Video decode nahi ho paayi. MP4 H.264/AAC format try karo.",
      4: "Browser video URL ya format support nahi karta. URL aur MIME type check karo."
    };

    if (errorBox) {
      errorBox.textContent = messages[code] || "Video playback fail hui.";
    }
  };

  player.onloadedmetadata = () => {
    if (token !== previewToken) return;
    if (errorBox) {
      errorBox.textContent = `Video ready: ${player.videoWidth} × ${player.videoHeight}`;
    }
  };

  player.oncanplay = () => {
    if (token === previewToken && errorBox) {
      errorBox.textContent = "Video play karne ke liye ready hai.";
    }
  };

  try {
    const url = await storageUrl("videos", video.video_url);
    if (token !== previewToken) return;

    player.src = url;
    player.controls = true;
    player.preload = "metadata";
    player.load();

    // Mobile browsers may require the user to tap Play.
    player.play().catch(() => {
      if (token === previewToken && errorBox) {
        errorBox.textContent = "Video ready hai. Player par Play dabao.";
      }
    });
  } catch (error) {
    if (token === previewToken && errorBox) {
      errorBox.textContent = "Preview failed: " + error.message;
    }
  }
}

function closePreview() {
  previewToken++;

  const player = $("#previewPlayer");
  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
    player.onerror = null;
    player.onloadedmetadata = null;
    player.oncanplay = null;
  }

  const modal = $("#videoPreviewModal");
  if (modal) modal.hidden = true;
}

async function setVideoStatus(id, newStatus) {
  if (!["pending", "published", "hidden"].includes(newStatus)) {
    throw new Error("Invalid status.");
  }

  const { error } = await supabase.from("videos").update({
    status: newStatus,
    published: newStatus === "published"
  }).eq("id", id);

  if (error) throw error;

  await load();
  notify("Video status update ho gaya.");
}

async function deleteVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));
  if (!video) throw new Error("Video nahi mili.");

  if (!confirm(`"${video.title || "Video"}" ka database record delete karein?`)) {
    return;
  }

  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) throw error;

  await load();
  notify("Database record delete ho gaya. Storage file alag se delete karni hogi.");
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

  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const user = authData.user;
    if (!user) throw new Error("Login dobara karo.");

    const id = crypto.randomUUID();
    const safeName = videoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const videoPath = `${user.id}/${id}/${safeName}`;

    const { data: uploadedVideo, error: uploadError } = await supabase.storage
      .from("videos")
      .upload(videoPath, videoFile, {
        upsert: false,
        contentType: videoFile.type || "video/mp4"
      });

    if (uploadError) throw uploadError;

    let thumbnailPath = null;

    if (thumbnailFile) {
      const safeThumb = thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { data: uploadedThumb, error: thumbError } = await supabase.storage
        .from("thumbnails")
        .upload(`${user.id}/${id}/${safeThumb}`, thumbnailFile, {
          upsert: false,
          contentType: thumbnailFile.type || "image/jpeg"
        });

      if (thumbError) throw thumbError;
      thumbnailPath = uploadedThumb.path;
    }

    const { error: insertError } = await supabase.from("videos").insert({
      id,
      user_id: user.id,
      title,
      category,
      description,
      video_url: uploadedVideo.path,
      thumbnail_url: thumbnailPath,
      views: 0,
      published: false,
      status: "pending"
    });

    if (insertError) throw insertError;

    form.reset();
    await load();
    notify("Video upload ho gayi. Approval ke liye Pending hai.");
  } catch (error) {
    notify("Upload failed: " + error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
}

function attachEvents() {
  $("#loginForm")?.addEventListener("submit", login);
  $("#logout")?.addEventListener("click", logout);
  $("#upload")?.addEventListener("submit", uploadVideo);
  $("#adminSearch")?.addEventListener("input", renderVideos);
  $("#adminFilter")?.addEventListener("change", renderVideos);

  $("#refreshVideos")?.addEventListener("click", () => {
    load().catch(error => notify(error.message));
  });

  $("#manage")?.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
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
    showLogin();
    notify(error.message);
    return;
  }

  const user = data.session?.user;

  if (!user) {
    showLogin();
    return;
  }

  if (user.id !== ADMIN_UID) {
    await supabase.auth.signOut();
    showLogin();
    notify("Is account ko admin access nahi hai.");
    return;
  }

  showAdmin();

  try {
    await load();
  } catch (err) {
    notify("Dashboard load failed: " + err.message);
  }
}

attachEvents();
boot();
