# DesiVexa — real upload/public-view starter

## Flow
1. Create a Supabase project.
2. Run `schema.sql` in Supabase SQL Editor.
3. Create public Storage buckets named `videos` and `thumbnails`.
4. Create an admin user under Authentication → Users.
5. Put your Supabase URL and anon key into `config.js`.
6. Host these static files on a provider that permits your intended lawful content.
7. Open `admin.html`, sign in, upload a rights-cleared video, and publish it.
8. Visitors see published records on `index.html` and stream them from Storage.

## Security warning
This starter demonstrates the mechanics, but the SQL storage policies are intentionally simple. Before a public launch, use a server-side admin role/claims, upload limits, MIME/type validation, malware scanning, moderation, rate limiting, takedown handling, audit logs and signed/private playback where appropriate.

Do not publish sexual content involving minors, non-consensual intimate material, exploitation/trafficking material, or other unlawful content. Only publish content for which you have the necessary rights and documented consent.

## Video hosting reality
Large video files can quickly exceed free storage/bandwidth quotas. For a real site with many public videos, use a video-storage/streaming provider whose current terms explicitly permit the intended adult-content use case, rather than assuming a free web-hosting plan will cover it.
