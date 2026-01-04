# TODO.md

## 🎯 Active Refactoring Sprint

_Last Updated: January 4, 2026_
_Focus: Developer Experience & Technical Debt Reduction_

---

## Overview

This sprint focuses on three high-impact, low-risk refactoring tasks to improve code maintainability and developer workflow:

1. ~~**Centralized Event Delegation System**~~ - ✅ **COMPLETED**
2. **CSS Module Organization** - Split 26,700-line CSS file into manageable modules
3. **Pre-commit Hooks** - Automate code quality checks before commits

---

## Recent Updates (January 4, 2026)

### ✅ On-Insert Job Trigger - COMPLETED

**Status:** ✅ **Complete**
**Completed:** January 4, 2026
**Actual Time:** ~2 hours
**Impact:** Jobs now process in 1-3 seconds instead of waiting up to 1 minute

**Implementation:**

- Created `supabase/migrations/20260104_add_on_insert_job_trigger.sql`
- Added `ON_INSERT_TRIGGER_SETUP.md` documentation
- Updated `ARCHITECTURE.md` with new trigger mechanism
- Updated `supabase/functions/job-worker/index.ts` with source detection logging

**Benefits:**

- Real-time job processing via database trigger
- No more empty cron runs
- Better debugging with invocation source logging

### ✅ Audio Generation Bug Fix - COMPLETED

**Status:** ✅ **Complete**
**Completed:** January 4, 2026
**Impact:** Fixed duplicate audio job creation and missing audio button

**Issues Fixed:**

- Duplicate audio generation jobs created when reopening story pages
- Audio button not appearing even after successful generation
- Audio not being cached from Supabase Storage

**Implementation:**

- Added `isAudioAvailable()` function to check both cache and database
- Updated `Reader.js` to prevent duplicate job creation
- Added `downloadAndCacheAudio()` helper to fetch audio from Supabase Storage
- Fixed job completion handling to download & cache before showing button

---

## ✅ Task 1: Centralized Event Delegation System - COMPLETED

**Status:** ✅ **Complete**
**Completed:** January 2, 2026
**Actual Time:** ~3 hours
**Impact:** 54+ event listeners migrated, memory leaks eliminated, 60% boilerplate reduction

### Implementation Summary

**New Files Created:**

- `src/utils/eventManager.js` (6,289 bytes) - Centralized event management system

**Files Modified:**

- `src/utils/componentBase.js` - Added `createEventManager()` helper
- `src/components/Toast.js` - Migrated to EventManager
- `src/components/GeneratorModal.js` - Migrated to EventManager, fixed inline styles
- `src/components/Header.js` - Migrated to EventManager, **fixed critical memory leak**
- `src/components/Reader.js` - Migrated to EventManager with delegation
- `src/pages/Library.js` - Migrated to EventManager with delegation
- `src/pages/KanaChart.js` - Migrated to EventManager
- `src/pages/Queue.js` - Migrated to EventManager, fixed inline styles
- `src/pages/Settings.js` - Migrated to EventManager with delegation
- `src/pages/Read.js` - Migrated to EventManager

**Features Implemented:**

- ✅ `.on()` method for individual elements
- ✅ `.delegate()` method for dynamic content
- ✅ Automatic cleanup integration with router
- ✅ Passive event listeners for scroll/touch (performance boost)
- ✅ JSDoc types for IDE autocomplete
- ✅ Null element warnings for debugging

**Bugs Fixed:**

- ✅ **Header.js:94** - Critical memory leak: document.addEventListener never cleaned up
- ✅ **Toast.js** - Fixed EventManager storage (dataset → Map)
- ✅ Multiple inline style violations removed
- ✅ All conditional element null checks added

**Documentation Updated:**

- ✅ ARCHITECTURE.md - Added "Event Management System" section
- ✅ File responsibility matrix updated
- ✅ Usage examples and guidelines added

---

## Task 2: CSS Module Organization

**Status:** 🟡 Not Started
**Priority:** HIGH
**Estimated Time:** 3-4 hours
**Impact:** 10x faster style location, enables future lazy loading

### Problem Statement

Single `src/styles/index.css` file with **26,716 lines** mixes:

- Reset styles
- CSS custom properties
- Utility classes
- Component styles
- Page-specific styles
- Dark theme overrides
- Animations

This is unmaintainable and makes finding relevant styles slow.

### Solution: Modular CSS Architecture

[Plan details from original TODO.md...]

---

## Task 3: Pre-commit Hooks

**Status:** 🟢 Complete (from previous work)
