# Nghiên cứu kiến trúc nền tảng chia sẻ audio / truyện (Meago)

> Trạng thái: RESEARCH-ONLY — chưa code, theo yêu cầu. Dùng làm định hướng khi phát triển tính năng.

## Pipeline chuẩn: Upload → Storage → Transcode → CDN
1. **Upload**: client upload **trực tiếp lên S3-compatible storage** (S3/MinIO/Cloudflare R2) bằng **presigned URL** do NestJS cấp — file lớn không đi qua API server.
2. **Transcode queue**: sau upload, enqueue job **BullMQ** (Redis); worker chạy **ffmpeg**: gốc WAV/FLAC/MP3 → AAC nhiều bitrate (64/128/256kbps), chuẩn hóa loudness, sinh duration/waveform.
3. **Phân phối**: CDN (CloudFront/Cloudflare) trước bucket; kiểm soát truy cập bằng **presigned/signed URL TTL ngắn** do API cấp sau khi check quyền.

## HLS vs progressive MP3/AAC
- **HLS** (`.m3u8` + segments): adaptive bitrate, seek nhanh, khó leech, chuẩn ngành (SoundCloud đã chuyển hẳn sang AAC HLS). ffmpeg sinh HLS trực tiếp.
- **Progressive AAC/MP3 + HTTP Range requests**: đơn giản hơn nhiều — `<audio>` tag + S3/CDN hỗ trợ Range sẵn, đủ để seek. Nhược: không adaptive, dễ bị tải nguyên file.
- **Khuyến nghị giai đoạn đầu**: progressive AAC/MP3 qua CDN + Range requests; thiết kế sẵn đường nâng cấp HLS khi cần chống leech/adaptive.

## Data model truyện/chương
```
stories(id, title, slug, description, author_id, cover_url, status, tags)
chapters(id, story_id, index, title, duration_sec, status[processing|ready|failed])
audio_assets(id, chapter_id, format, bitrate, storage_key, size)
listening_progress(user_id, chapter_id, position_sec)   -- resume playback
```
Tách `audio_assets` khỏi `chapters` để một chương có nhiều rendition (bitrate/format).

## Search
- Bắt đầu: **PostgreSQL full-text search** (`tsvector` + GIN index) — không thêm service.
- Nâng cấp: **Meilisearch** khi cần typo-tolerance/instant search; Postgres vẫn là source of truth.

## Modular monolith
- **Modular monolith trước, microservices chỉ khi đau thật.**
- Module theo **feature/domain**: auth, users, stories, media, notifications — mỗi module đủ controller/service/entity/DTO.
- Module giao tiếp qua public service interface hoặc event, **không import entity chéo**.
- BullMQ worker chạy cùng process ban đầu, tách process sau — media/transcoding là ứng viên tách service đầu tiên.

## Nguồn tham khảo
- https://techholding.co/casestudy/audio-streaming-ingestion-pipeline
- https://fastpix.com/blog/system-design-and-site-architecture-for-an-audio-streaming-app-like-spotify
- https://developers.soundcloud.com/blog/api-streaming-urls/
- https://audioutils.com/blog/what-is-hls-audio
- https://www.red5.net/blog/what-is-hls-streaming/
- https://www.bytescale.com/audio-cdn
- https://www.meilisearch.com/comparisons/meilisearch-vs-postgresql
- https://supabase.com/blog/postgres-full-text-search-vs-the-rest
- https://medium.com/@simbatmotsi/postgres-full-text-search-vs-meilisearch-vs-elasticsearch-choosing-a-search-stack-that-scales-fcf17ef40a1b
- https://dev.to/geampiere/modular-monolith-vs-microservices-in-nestjs-223g
- https://encore.dev/articles/nestjs-project-structure-best-practices
- https://levelup.gitconnected.com/nest-js-and-modular-architecture-principles-and-best-practices-806c2cb008d5
- https://medium.com/@priyansu011/from-small-steps-to-scalable-systems-building-a-modular-monolith-with-nestjs-000ff0f5bab3
