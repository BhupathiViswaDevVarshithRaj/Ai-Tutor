# AI Tutor Dashboard — Database Design

Status: **Phase 0 draft — awaiting approval**
Engine: PostgreSQL 16 + pgvector · ORM: SQLAlchemy 2.0 (async) · Migrations: Alembic

## Conventions

- Primary keys: `UUID` (`gen_random_uuid()`), so IDs cannot be guessed in URLs.
- Every table has `created_at timestamptz default now()`. Mutable tables also have `updated_at`.
- **User isolation:** every user-owned table has `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` plus an index starting with `user_id`. Repositories always filter by `user_id`, and tests assert cross-user access returns 404. (Postgres RLS is planned as hardening in Phase 14.)
- Languages are BCP-47 codes (`en`, `hi`, `te`, `ta`, `pa`, `bn`). Levels: enum `beginner | intermediate | advanced`.
- Flexible AI output (plans, graphs, specs) is stored as `JSONB` and validated by Pydantic before it is written.

## Entity overview

```
users ─┬─ user_preferences (1:1)
       ├─ refresh_tokens, password_reset_tokens
       ├─ lessons ─┬─ conversations ── messages
       │           ├─ mind_maps
       │           ├─ diagrams
       │           ├─ quizzes ── quiz_questions
       │           │      └─ quiz_submissions ── quiz_answers
       │           └─ video_jobs ── media_assets
       ├─ learning_resources ── document_chunks ── embeddings
       ├─ topic_mastery
       └─ learning_sessions
```

## Tables

### users
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| email | citext unique not null | |
| password_hash | text not null | argon2id |
| full_name | text | |
| is_active | bool default true | |
| email_verified_at | timestamptz null | |
| last_login_at | timestamptz null | |
| created_at, updated_at | timestamptz | |

### user_preferences (1:1 with users)
`user_id pk/fk`, `preferred_language varchar(10) default 'en'`, `learning_level level_enum default 'beginner'`, `interests text[] default '{}'`, `tts_voice text null`, `tts_speed numeric(3,2) default 1.0`, `theme varchar(10) default 'system'`, `daily_goal_minutes int default 30`, `updated_at`.

### refresh_tokens
`id`, `user_id fk`, `token_hash text unique`, `expires_at`, `revoked_at null`, `replaced_by uuid null`, `user_agent text`, `created_at`. Index `(user_id)`. Rotation on every refresh. Reuse of a revoked token revokes the whole family.

### password_reset_tokens
`id`, `user_id fk`, `token_hash unique`, `expires_at`, `used_at null`, `created_at`.

### lessons
A learning track on a topic.
`id`, `user_id fk`, `topic text not null`, `level level_enum`, `language varchar(10)`, `plan jsonb` (modules → sections → objectives), `status enum(active, completed, archived)`, `current_section int default 0`, `completed_sections int[]`, `summary text null`, `created_at`, `updated_at`.
Indexes: `(user_id, updated_at desc)`, `(user_id, status)`.

### conversations
`id`, `user_id fk`, `lesson_id fk null` (free chat allowed), `title text`, `mode enum(text, voice)`, `language`, `level`, `created_at`, `updated_at`. Index `(user_id, updated_at desc)`.

### messages
`id`, `conversation_id fk cascade`, `user_id fk` (denormalised for isolation checks), `role enum(user, assistant, system)`, `content text`, `language`, `input_mode enum(text, voice)`, `audio_asset_id fk null`, `model text null`, `input_tokens int null`, `output_tokens int null`, `meta jsonb` (citations, understanding-check results), `created_at`.
Index `(conversation_id, created_at)`.

### learning_resources
Uploaded or saved material used for RAG.
`id`, `user_id fk`, `lesson_id fk null`, `title`, `source_type enum(upload, url, text, generated)`, `mime_type`, `storage_key text null`, `status enum(pending, processing, ready, failed)`, `error text null`, `created_at`.

### document_chunks
`id`, `resource_id fk cascade`, `user_id fk`, `chunk_index int`, `content text`, `token_count int`, `language`, `meta jsonb` (page, heading). Unique `(resource_id, chunk_index)`.

### embeddings
Kept separate from chunks so the embedding model can change without rewriting chunks.
`id`, `chunk_id fk cascade`, `user_id fk`, `model text`, `dim int`, `embedding vector(768)`, `created_at`.
Unique `(chunk_id, model)`. **HNSW index** `USING hnsw (embedding vector_cosine_ops)`. Index `(user_id, model)`. Queries always filter on `user_id`.
(If a model with a different dimension is adopted, a new column or table is added by migration. The `dim` column records which applies.)

### mind_maps (built in Phase 10)
`id`, `user_id fk`, `lesson_id fk null`, `topic`, `language`, `level`, `graph jsonb` (validated `MindMap`), `layout jsonb null` (user-moved node positions, collapsed state), `version int default 1`, `created_at`, `updated_at`. Index `(user_id, created_at desc)`.

### diagrams (built in Phase 11)
`id`, `user_id fk`, `lesson_id fk null`, `title`, `diagram_type enum(flowchart, block, timeline, graph_fn, process, freehand)`, `spec jsonb` (validated `DiagramSpec`), `canvas_strokes jsonb null` (freehand layer), `created_at`, `updated_at`.

### video_jobs
`id`, `user_id fk`, `lesson_id fk null`, `topic`, `language`, `level`, `target_seconds int check (30..120)`, `status enum(queued, scripting, rendering, narrating, compositing, completed, failed, cancelled)`, `progress smallint 0..100`, `stage_detail text`, `script jsonb`, `storyboard jsonb`, `error text null`, `video_asset_id fk null`, `subtitle_asset_id fk null`, `started_at`, `finished_at`, `created_at`.
Indexes: `(user_id, created_at desc)`, `(status)` for worker housekeeping.

### media_assets
`id`, `user_id fk`, `kind enum(audio, video, subtitle, image, document)`, `mime_type`, `storage_key text unique`, `size_bytes bigint`, `duration_ms int null`, `language null`, `meta jsonb`, `created_at`. Served only through authenticated routes or short-lived signed URLs.

### quizzes
`id`, `user_id fk`, `lesson_id fk null`, `topic`, `language`, `level`, `title`, `question_count int`, `created_at`.

### quiz_questions
`id`, `quiz_id fk cascade`, `position int`, `qtype enum(mcq, short_answer)`, `prompt text`, `options jsonb null` (MCQ), `correct_answer text`, `explanation text`, `concept text` (used for weak-topic detection), `difficulty smallint`. Unique `(quiz_id, position)`.

### quiz_submissions
`id`, `quiz_id fk`, `user_id fk`, `score numeric(5,2)`, `max_score numeric(5,2)`, `duration_seconds int`, `feedback jsonb` (per-concept breakdown, recommendations), `submitted_at`. Index `(user_id, submitted_at desc)`.

### quiz_answers
`id`, `submission_id fk cascade`, `question_id fk`, `answer text`, `is_correct bool`, `score numeric(4,2)`, `grader_feedback text`.

### topic_mastery (the "learning progress" table)
Per user and concept.
`id`, `user_id fk`, `topic text` (normalised lowercase), `concept text`, `mastery numeric(4,3) 0..1` (exponential moving average of evidence), `evidence_count int`, `last_assessed_at`, `next_review_at` (spaced-repetition hint), `updated_at`.
Unique `(user_id, topic, concept)`. Index `(user_id, mastery)` for weak-topic queries.

### learning_sessions
Time tracking.
`id`, `user_id fk`, `lesson_id fk null`, `activity enum(chat, voice, video, mindmap, diagram, quiz)`, `started_at`, `ended_at`, `duration_seconds int`. Index `(user_id, started_at desc)`.
Total learning time and streaks are aggregated from this table.

### language_enrollments (Phase 9)
A learner's world-language course and CEFR level.
`id`, `user_id fk cascade`, `language varchar(10)` (de, fr, es, ja, ko, zh, it, pt), `level cefr_level enum(A1..C2)`, `created_at`, `updated_at`. Unique `(user_id, language)`.

### vocab_items (Phase 9)
Words in a learner's deck, scheduled with SM-2 spaced repetition.
`id`, `user_id fk cascade`, `language`, `word varchar(200)`, `reading null` (romaji / romanisation / pinyin), `meaning`, `example null`, `example_translation null`, `level cefr_level`, `topic null`, `ease float default 2.5`, `interval_days int`, `repetitions int`, `lapses int`, `due_at timestamptz`, `last_reviewed_at null`, `created_at`. Unique `(user_id, language, word)`; index `(user_id, language, due_at)`.

### practice_sessions (Phase 9)
One generated exercise set (grammar, listening, reading, writing, speaking) or a role-play.
`id`, `user_id fk cascade`, `language`, `level cefr_level`, `skill practice_skill enum`, `topic null`, `content jsonb` (validated generated material; answers are withheld from the API until submission), `answers jsonb null`, `result jsonb null` (per-item marks or writing feedback), `score float null (0..1)`, `conversation_id fk conversations set null` (role-plays), `created_at`, `completed_at null`. Index `(user_id, language, created_at desc)`.
Course progress (words learned/mastered/due, per-skill averages, streak) is computed from these tables.

## Derived analytics (queries, not tables)
- Completed lessons: `lessons.status = 'completed'`.
- Total time: `sum(learning_sessions.duration_seconds)`.
- Strong and weak topics: `topic_mastery` ordered by `mastery`, with a threshold of 0.75 / 0.5.
- Revision due: `topic_mastery.next_review_at <= now()`.
- Score trend: `quiz_submissions` over time.

## Migration plan
1. `0001_extensions`: `CREATE EXTENSION vector, citext, pgcrypto`.
2. `0002_auth`: users, user_preferences, refresh_tokens, password_reset_tokens.
3. `0003_learning`: lessons, conversations, messages.
4. `0004_language_courses` (Phase 9, built): language_enrollments, vocab_items, practice_sessions.
5. `0005_mind_maps` (Phase 10, built): mind_maps.
6. `0006_diagrams` (Phase 11, built): diagrams.
7. `0007_media_video`: media_assets, video_jobs.
8. `0008_assessment`: quizzes, quiz_questions, quiz_submissions, quiz_answers.
9. `0009_progress`: topic_mastery, learning_sessions.
10. `0010_rag` (later): learning_resources, document_chunks, embeddings + HNSW. (RAG was deferred from Phase 4, so its migration moves after the others.)

Each migration ships with the phase that needs it, so we do not run unused schema ahead of time.
