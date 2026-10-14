import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MEDIA_FUNCTION = `${SUPABASE_URL}/functions/v1/get-video-media`;
const VAST_TAG_URL = "https://organic-package.com/drm.FdzHd-GnNDvGZFGqUD/qesmy9EuIZiUilXksPTTncO1qMuTEEP3/OrTwMPtaN/zXU/xfMbTScE5bNzwc";
const BANNER_SCRIPT_URL = "https://nervousstroke.com/bXXXV/s.dmGnlk0TYTWBcW/_e/mH9xuAZmU/lHkrPPTtcs1XMLTdEEyqODTzMFt/NMzJUzxsMWTaIe5mNzws";
const videoId = new URLSearchParams(location.search).get("id");
let currentVideo = null;
let visitorId = localStorage.getItem("desivexa_visitor_id");
if (!visitorId) {
  visitorId = crypto.randomUUID();
  localStorage.setItem("desivexa_visitor_id", visitorId);
}
const root = document.getElementById("page") || document.querySelector("main") || document.body;

function esc(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function views(v) { return Number(v || 0).toLocaleString("en-IN"); }
function message(v) { root.innerHTML = `<div style="padding:25px;background:#111;color:white;text-align:center">${esc(v)}</div>`; }
function cats(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  const s = String(v || "").trim();
  if (!s) return [];
  try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(x => String(x).trim()).filter(Boolean); } catch (_) {}
  return s.split(",").map(x => x.trim()).filter(Boolean);
}
async function getMedia(id) {
  const r = await fetch(MEDIA_FUNCTION, {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY,"Authorization":`Bearer ${SUPABASE_ANON_KEY}`},
    body:JSON.stringify({videoId:id,id})
  });
  if (!r.ok) throw new Error(`Media function error: ${r.status}`);
  const d = await r.json();
  return {videoUrl:d.videoUrl || d.signedUrl || d.url || "", thumbnailUrl:d.thumbnailUrl || d.thumbnail_url || d.thumbnail || ""};
}

async function loadVideo() {
  if (!videoId) return message("Video ID nahi mili. Homepage se video open karein.");
  try {
    const {data:v,error} = await supabase.from("videos").select("*").eq("id",videoId).maybeSingle();
    if (error) throw error;
    if (!v) return message("Video nahi mila ya delete ho chuka hai.");
    currentVideo = v;
    let media = {
      videoUrl:/^https?:\/\//i.test(String(v.video_url || "")) ? v.video_url : "",
      thumbnailUrl:/^https?:\/\//i.test(String(v.thumbnail_url || "")) ? v.thumbnail_url : ""
    };
    try {
      const m = await getMedia(v.id);
      media = {videoUrl:m.videoUrl || media.videoUrl, thumbnailUrl:m.thumbnailUrl || media.thumbnailUrl};
    } catch (e) { console.error("Media resolution failed:",e); }
    renderVideo(v,media);
    recordView(v.id); loadLikes(v.id); loadComments(v.id); loadRelatedVideos(v.id,v.category);
  } catch (e) {
    console.error("Video loading error:",e);
    message("Video load nahi ho paaya. Supabase settings aur browser console ka error check karein.");
  }
}

function renderVideo(v,m) {
  const thumb = m.thumbnailUrl || v.thumbnail_url || v.thumbnail || "";
  root.innerHTML = `
  <div style="background:#080808;color:#fff;min-height:100vh;padding:12px;font-family:Arial,sans-serif">
    <div style="display:flex;justify-content:space-between;margin-bottom:15px"><a href="index.html" style="color:#f33;font-size:24px;font-weight:bold;text-decoration:none">DesiVexa</a><a href="index.html" style="color:white;text-decoration:none">Home</a></div>
    <div style="position:relative;background:#000;border-radius:10px;overflow:hidden">
      <video id="mainVideo" controls playsinline preload="metadata" poster="${esc(thumb)}" style="width:100%;max-height:70vh;min-height:200px;background:#000;display:block">${m.videoUrl?`<source src="${esc(m.videoUrl)}">`:""}Your browser does not support video playback.</video>
      <div id="imaAdContainer" style="display:none;position:absolute;inset:0;z-index:5;background:#000"></div>
    </div>
    <p id="playerLoading" style="display:none;color:#aaa">Video loading…</p><p id="playerError" style="color:#f88;font-size:12px"></p><p id="adStatus" style="display:none;color:#aaa">Advertisement</p>
    <div id="videoBannerAd" style="min-height:90px;margin:18px 0;display:flex;align-items:center;justify-content:center;background:#101010;border:1px dashed #444;color:#888">Advertisement</div>
    ${!m.videoUrl?'<p style="color:#f88">Video URL nahi mili. Supabase media function/storage path check karein.</p>':""}
    <h1 style="font-size:21px">${esc(v.title || "Untitled video")}</h1>
    <p style="color:#aaa">👁 <span id="viewsCount">${views(v.views)}</span> views ${v.category?" · "+esc(cats(v.category).join(" · ")):""}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0">
      <button id="likeButton">❤️ Like <span id="likeCount">0</span></button><button id="commentButton">💬 Comments</button><button id="shareButton">🔗 Share</button>
    </div>
    ${v.description?`<section style="background:#151515;padding:14px;border-radius:9px;white-space:pre-wrap">${esc(v.description)}</section>`:""}
    <section style="margin-top:28px"><h2>Related Videos</h2><div id="randomVideos" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">Loading related videos...</div></section>
    <section id="commentsSection" style="margin-top:35px;scroll-margin-top:70px"><h2>Comments</h2><form id="commentForm"><textarea id="commentInput" required maxlength="2000" placeholder="Apna comment likhein..." style="box-sizing:border-box;width:100%;min-height:90px;background:#171717;color:white;padding:12px"></textarea><button type="submit">Post Comment</button></form><div id="commentsList">Loading comments...</div></section>
    <footer style="text-align:center;color:#777;margin:30px">© ${new Date().getFullYear()} DesiVexa</footer>
  </div>`;
  setupBannerAd();
  document.getElementById("likeButton").onclick=()=>toggleLike(v.id);
  document.getElementById("commentButton").onclick=()=>document.getElementById("commentsSection").scrollIntoView({behavior:"smooth"});
  document.getElementById("shareButton").onclick=shareVideo;
  document.getElementById("commentForm").onsubmit=e=>submitComment(e,v.id);
  const player=document.getElementById("mainVideo");
  player.addEventListener("error",()=>{document.getElementById("playerError").textContent="Video play nahi ho paayi. URL, Storage access aur network check karein.";});
  player.addEventListener("waiting",()=>{document.getElementById("playerLoading").style.display="block";});
  player.addEventListener("playing",()=>{document.getElementById("playerLoading").style.display="none";});
  setupVastPreRoll();
}

function setupBannerAd() {
  const slot=document.getElementById("videoBannerAd");
  if(!slot || slot.dataset.loaded) return;
  slot.dataset.loaded="1"; slot.replaceChildren();
  const s=document.createElement("script"); s.src=BANNER_SCRIPT_URL; s.async=true; s.referrerPolicy="no-referrer-when-downgrade"; slot.appendChild(s);
}

function setupVastPreRoll() {
  const video=document.getElementById("mainVideo"), box=document.getElementById("imaAdContainer"), status=document.getElementById("adStatus");
  if(!video || !box || !window.google?.ima) { console.warn("Google IMA SDK unavailable; skipping VAST ad."); return; }
  let requested=false, adPlaying=false, shouldResume=false, manager=null, timer=null;
  function resume() {
    if(timer) clearTimeout(timer);
    adPlaying=false; box.style.display="none"; box.style.opacity="0"; box.style.pointerEvents="none";
    status.style.display="none";
    if(shouldResume) video.play().catch(()=>{});
  }
  function fail(reason,e) { if(adPlaying)return; console.warn("[VAST]",reason,e||""); resume(); }
  function request() {
    if(requested)return; requested=true;
    try {
      box.style.display="block"; box.style.opacity="0"; box.style.pointerEvents="none";
      const display=new google.ima.AdDisplayContainer(box,video); display.initialize();
      const loader=new google.ima.AdsLoader(display);
      loader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,event=>{
        try {
          manager=event.getAdsManager(video);
          manager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR,e=>fail("Ad manager error",e));
          manager.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,resume);
          manager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED,resume);
          manager.addEventListener(google.ima.AdEvent.Type.STARTED,()=>{adPlaying=true;if(timer)clearTimeout(timer);box.style.opacity="1";box.style.pointerEvents="auto";status.style.display="block";});
          manager.init(Math.max(1,video.clientWidth),Math.max(1,video.clientHeight),google.ima.ViewMode.NORMAL); manager.start();
        } catch(e){fail("Could not start ad",e);}
      },false);
      loader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR,e=>fail("VAST request failed",e),false);
      const req=new google.ima.AdsRequest(); req.adTagUrl=VAST_TAG_URL;
      req.linearAdSlotWidth=Math.max(1,video.clientWidth||640); req.linearAdSlotHeight=Math.max(1,video.clientHeight||360);
      req.nonLinearAdSlotWidth=req.linearAdSlotWidth; req.nonLinearAdSlotHeight=Math.max(50,Math.round(req.linearAdSlotHeight/3));
      req.setAdWillAutoPlay(false); req.setAdWillPlayMuted(false); loader.requestAds(req);
      timer=setTimeout(()=>fail("Ad timed out; continuing video"),8000);
    } catch(e){fail("IMA setup failed",e);}
  }
  video.addEventListener("play",function firstPlay(){if(requested)return;shouldResume=true;video.pause();request();});
  window.addEventListener("resize",()=>{if(manager&&adPlaying)try{manager.resize(Math.max(1,video.clientWidth),Math.max(1,video.clientHeight),google.ima.ViewMode.NORMAL);}catch(e){console.warn(e);}});
}

async function recordView(id) {
  try {
    const {data,error}=await supabase.rpc("increment_video_views_v2",{p_video_id:id});
    if(error){console.error("View count RPC failed:",error);return;}
    if(data!==null && data!==undefined){const el=document.getElementById("viewsCount");if(el)el.textContent=views(data);}
  } catch(e){console.error("View count error:",e);}
}
async function loadLikes(id) {
  try {
    const {count,error}=await supabase.from("video_likes").select("*",{count:"exact",head:true}).eq("video_id",id);
    if(error)throw error;
    document.getElementById("likeCount").textContent=views(count||0);
    const {data}=await supabase.from("video_likes").select("id").eq("video_id",id).eq("visitor_id",visitorId).maybeSingle();
    if(data)document.getElementById("likeButton").style.color="#f44";
  } catch(e){console.error("Likes load error:",e);}
}
async function toggleLike(id) {
  const b=document.getElementById("likeButton");b.disabled=true;
  try {
    const {data:old,error}=await supabase.from("video_likes").select("id").eq("video_id",id).eq("visitor_id",visitorId).maybeSingle();
    if(error)throw error;
    if(old){const r=await supabase.from("video_likes").delete().eq("id",old.id);if(r.error)throw r.error;b.style.color="";}
    else{const r=await supabase.from("video_likes").insert({video_id:id,visitor_id:visitorId});if(r.error)throw r.error;b.style.color="#f44";}
    await loadLikes(id);
  } catch(e){console.error("Like error:",e);alert("Like update nahi hua. Supabase video_likes table/policies check karein.");}
  finally{b.disabled=false;}
}
async function loadComments(id) {
  const list=document.getElementById("commentsList");
  try {
    const {data,error}=await supabase.from("video_comments").select("*").eq("video_id",id).order("created_at",{ascending:false}).limit(100);
    if(error)throw error;
    if(!data?.length){list.innerHTML='<p style="color:#888">Abhi koi comment nahi hai. Pehla comment karein!</p>';return;}
    list.innerHTML=data.map(c=>`<article style="background:#151515;padding:12px;margin:10px 0;border-radius:8px"><small style="color:#f66">${esc(c.created_at?new Date(c.created_at).toLocaleString("en-IN"):"")}</small><p style="white-space:pre-wrap">${esc(c.body??c.comment??"")}</p></article>`).join("");
  } catch(e){console.error("Comments error:",e);list.innerHTML='<p style="color:#f88">Comments load nahi hue. Table aur RLS policies check karein.</p>';}
}
async function submitComment(e,id) {
  e.preventDefault();const input=document.getElementById("commentInput"),b=document.querySelector("#commentForm button"),body=input.value.trim();
  if(!body)return alert("Pehle comment likhein.");
  b.disabled=true;b.textContent="Posting...";
  try{const {error}=await supabase.from("video_comments").insert({video_id:id,visitor_id:visitorId,body});if(error)throw error;input.value="";await loadComments(id);}
  catch(err){console.error("Comment submit error:",err);alert("Comment post nahi hua. Supabase columns/policies check karein.");}
  finally{b.disabled=false;b.textContent="Post Comment";}
}
async function loadRelatedVideos(id,category) {
  const box=document.getElementById("randomVideos");
  try {
    const {data,error}=await supabase.from("videos").select("id,title,category,thumbnail_url,thumbnail,views,created_at").eq("published",true).neq("id",id).order("created_at",{ascending:false}).limit(60);
    if(error)throw error;
    const wanted=cats(category).map(x=>x.toLowerCase());
    const match=(data||[]).filter(v=>cats(v.category).some(c=>wanted.includes(c.toLowerCase())));
    const list=[...match,...(data||[]).filter(v=>!match.some(m=>m.id===v.id))].slice(0,20);
    if(!list.length){box.textContent="Abhi koi related video available nahi hai.";return;}
    const placeholder=`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="#202020"/><text x="50%" y="50%" fill="#ff4444" font-size="22" text-anchor="middle">DesiVexa</text></svg>')}`;
    box.innerHTML=list.map(v=>{
      const t=/^https?:\/\//i.test(String(v.thumbnail_url||v.thumbnail||""))?(v.thumbnail_url||v.thumbnail):placeholder;
      return `<a href="video.html?id=${encodeURIComponent(v.id)}" style="color:white;text-decoration:none;background:#151515;border-radius:8px;overflow:hidden"><img src="${esc(t)}" alt="${esc(v.title||"Video")}" loading="lazy" style="width:100%;aspect-ratio:16/10;object-fit:cover;display:block"><div style="padding:9px;font-size:13px;font-weight:bold">${esc(v.title||"Untitled video")}<p style="color:#999;font-size:11px">👁 ${views(v.views)} views</p></div></a>`;
    }).join("");
    list.filter(v=>!/^https?:\/\//i.test(String(v.thumbnail_url||v.thumbnail||""))).forEach(async v=>{try{const m=await getMedia(v.id);if(m.thumbnailUrl){const a=[...box.querySelectorAll("a")].find(a=>a.href.includes(encodeURIComponent(v.id)));if(a)a.querySelector("img").src=m.thumbnailUrl;}}catch(e){console.warn("Thumbnail resolution failed",e);}});
  } catch(e){console.error("Related videos error:",e);box.innerHTML='<p style="color:#f88">Related videos load nahi hue. Videos table/published column check karein.</p>';}
}
async function shareVideo() {
  const d={title:currentVideo?.title||"DesiVexa",text:currentVideo?.title||"Watch on DesiVexa",url:location.href};
  try{if(navigator.share)await navigator.share(d);else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(location.href);alert("Video link copy ho gaya!");}else prompt("Video link copy karein:",location.href);}
  catch(e){if(e.name!=="AbortError")console.error("Share error:",e);}
}
loadVideo();
