# Nihongo Monogatari

> Learn Japanese through AI-generated stories with text-to-speech and interactive reading tools.

## What is Nihongo Monogatari?

**Nihongo Monogatari** (Japanese Stories) is a web application that helps you learn Japanese through personalized AI-generated stories. Each story includes:

- 📖 **Furigana annotations** - Read kanji with pronunciation guides
- 🔊 **Text-to-speech audio** - Listen to natural Japanese pronunciation
- 📚 **Vocabulary notes** - Learn new words in context
- 🎯 **Comprehension questions** - Test your understanding
- 🖼️ **AI-generated illustrations** - Visual context for each story

## Features

### AI Story Generation

- Choose your JLPT level (N1-N5)
- Enter any topic you're interested in
- Get a complete Japanese story with English translation
- Adjust story length (short/medium/long)

### Interactive Reader

- Side-by-side Japanese/English view
- Toggle furigana, English, and images
- Vocabulary tooltips on hover/tap
- Progress tracking (auto-saves reading position)
- Sentence-by-sentence audio playback

### Background Job System

- Generate stories and audio in the background
- Close your browser and come back later
- Real-time job queue with status updates
- Retry failed jobs with one click

### Library Management

- Search and filter your story collection
- Export/import stories (JSON format)
- Sync across devices with Supabase cloud storage
- Dark mode theme support

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture, core systems, and data flow
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Environment setup and troubleshooting

## Tech Stack

- **Frontend**: Vanilla JavaScript + Vite (no frameworks)
- **Backend**: Supabase (PostgreSQL + Edge Functions + Storage)
- **AI**: Google Gemini 2.5 Flash (text & TTS)
- **Styling**: Custom CSS Design System

## Project Status

- ✅ **Story generation** - Background jobs (close browser during generation)
- ✅ **Audio generation** - Background jobs with Supabase Storage
- ✅ **Image generation** - Client-side (lower priority)
- ✅ **Job queue system** - Real-time status updates
- ✅ **Cloud sync** - Supabase authentication and storage
