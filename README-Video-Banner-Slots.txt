DESIVEXA VIDEO PAGE — BANNER SLOT PATCH
========================================

GitHub write access was denied, so this patch has NOT been installed on your live site.
It contains the exact markup to add two banner ad spaces to video.js.

WHERE TO ADD:
Open Streamhub/video.js on GitHub. Find the template inside root.innerHTML.

SLOT 1 — paste immediately after the closing </div> of the main video player,
before the line that starts: ${!media.videoUrl ? `

<!-- BANNER AD SLOT 1: directly below video player -->
<div id="videoBannerAd" class="dvAdSlot" aria-label="Banner ad below video"
  style="display:flex;align-items:center;justify-content:center;width:100%;
  min-height:100px;margin:16px auto;padding:10px;box-sizing:border-box;
  overflow:hidden;text-align:center;background:#101010;border:1px dashed #444;
  border-radius:8px;color:#777;font-size:11px;">
  Banner Ad Space · Below Video
</div>

SLOT 2 — paste after the closing </section> for #relatedSection (the Related Videos
grid), and before the comment that says COMMENTS BELOW RELATED VIDEOS.

<!-- BANNER AD SLOT 2: directly below related/random videos -->
<div id="randomBannerAd" class="dvAdSlot" aria-label="Banner ad below related videos"
  style="display:flex;align-items:center;justify-content:center;width:100%;
  min-height:100px;margin:18px auto;padding:10px;box-sizing:border-box;
  overflow:hidden;text-align:center;background:#101010;border:1px dashed #444;
  border-radius:8px;color:#777;font-size:11px;">
  Banner Ad Space · Below Random Videos
</div>

IMPORTANT:
- These create visible reserved spaces; they do not automatically show a real ad.
- To display real banners, paste your ad network's banner-specific code inside each
  slot. Pop-under/script-loader codes may not render a banner in that location.
- Keep existing scripts, Supabase code, and video-loading code unchanged.
- Commit changes after saving video.js.
