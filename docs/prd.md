# Product Requirements Document: ChartBoard

**Author:** Andrew
**Status:** Draft
**Last updated:** August 2026

---

## Overview

ChartBoard is a web app for our workplace music community to create, organize, and perform from chord charts. It replaces the current practice of copy-pasting misaligned chords and lyrics — and even chart images — into Google Docs, giving the group a single, searchable library of properly formatted charts, tools to build setlists for gigs, and a distraction-free Performance Mode for playing live on stage.

## 1. Problem Statement

Our workplace music community currently manages chord charts by copy-pasting from Ultimate Guitar or Guitarians into Google Docs. This creates recurring problems:

- Chord/lyric alignment breaks during copy-paste, making charts hard to read and play from.
- Some members paste **images** of chord charts instead of text, making the doc unsearchable and un-editable.
- There's no single source of truth — edits happen inconsistently, and it's unclear which version is current.
- Google Docs isn't built for performance use (no clean/distraction-free view for playing live).
- Singers don't know which part they're supposed to sing, so they often have to highlight their parts in different colours manually in Google Docs.

## 2. Goals

- Give the music community a central, organized place to create, store, and manage chord charts.
- Solve the specific pain point of messy, misaligned pastes from external chord sites and images.
- Support setlist building for gigs.
- Provide a clean, distraction-free performance view for live use.
- Allow musicians and singers to annotate chord charts (e.g. highlighting or marking their part) so they can quickly identify what they're supposed to sing or play during a performance.

## 3. Non-Goals

- **Not a real-time collaborative text editor for v1.** Explicitly avoiding a "Google Docs for chords" model — no live multi-cursor co-editing. Edits are async for v1: one person edits and saves, others see the update on next open. Real-time collaborative editing may be reconsidered for a future release once core chart management is validated.
- Not aiming to be a general-purpose music learning tool (tuner add-ons, scale trainers, etc. are out of scope for v1).

## 4. Target Users

- Musicians in a workplace band/community (primary).
- An app admin who manages the group: sends invites, and can moderate content and accounts.
- Potential future expansion to public/other bands once validated internally.

## 5. Competitive Landscape

Researched: Fretlist, SetMate, ChordStage, SongbookPro, Setlist Helper, GiggerLive, SongSheet Pro, Setlists, **Chordly** (closest competitor — web-based, drag-and-drop chord editor, Jam Sessions with synced autoscroll, real-time collaboration, ChordPro import/export, free).

**Identified gaps no competitor fully solves:**
- Smart auto-cleanup of chords/lyrics pasted from external sites (most tools require manual chord placement).
- OCR conversion of pasted **images** of chord charts into editable text/chords.
- Direct import via pasted URL from Ultimate Guitar/Guitarians (competitors mostly support ChordPro file import only).

## 6. Features (v1 Scope)

### 6.1 Chord Chart Management
- Create new chord charts (manual entry, ChordPro-based editor via ChordSheetJS)
- Search / view existing chord charts
- Edit a chord chart (only the chart's owner can edit it directly; other users create a new version instead)
- Delete a chord chart (only the chart's owner, or an app admin, can delete it)
- Paste raw text copied from Ultimate Guitar/Guitarians into the chart editor, then manually correct chord placement and lyrics
- Transpose a chart to any key
- Maintain version history when a chart is created or edited, so the community can view and choose between different versions of the same song
- Annotate or highlight parts of a chart (e.g. to mark a singer's part); annotations are private to the user who created them

### 6.2 Setlists
- Build setlists by searching and adding existing chord charts; private to the creator by default
- Remove charts from a setlist
- Reorder songs within a setlist for gig planning
- Delete a setlist (only the setlist's creator, or an app admin, can delete it)
- Share a setlist with band members so the group can view and use it for a gig

### 6.3 Performance Mode
- Distraction-free view: minimal UI, large readable text
- Toggle chords on/off, so singers can view lyrics-only if preferred
- Quick-access key adjustment (same transpose capability as §6.1, without leaving Performance Mode)
- Auto-scroll through a single chart or a setlist at an adjustable speed, hands-free
- Built for live use on stage (phone/tablet/laptop)

### 6.4 Access & Sharing
- Users must have an account and be logged in to use the app
- Workplace/community group model: invite band members via an email containing a link (may open to the public in a future release)
- Chart library is visible to any logged-in user of the app (not restricted to a single group); initial release is limited to the invited workplace/community group
- Admin capabilities: trigger invite emails to prospective members, delete any chord chart or setlist (regardless of owner), and lock out user accounts

## 7. User Stories / Flows

- **As an invited musician, I want to create an account and log in so that I can access the app's chord chart library.**
  - Acceptance criteria:
    - User can create an account (e.g. via an invite link)
    - User must log in to view, create, edit, or search charts
    - Logged-out users cannot access chart or setlist content

- **As a band member, I want to manually type raw text into the editor so that I can create a new chord chart from scratch.**
  - Acceptance criteria:
    - User can start a new blank chart
    - User can type lyrics and add chords directly within the editor
    - User can save the new chart to the public library

- **As a band member, I want to paste raw text copied from Ultimate Guitar/Guitarians or other music websites into the editor so that I can manually fix chord placement and lyrics in one place instead of a messy Google Doc.**
  - Acceptance criteria:
    - User can paste raw text into the chart editor
    - Pasted content appears as editable text within the chart
    - User can manually reposition chords above lyrics and edit lyric text
    - Saved chart persists the corrected chord/lyric layout

- **As a band member, I want to search the chord chart library so that I can quickly find and open a song for rehearsal.**
  - Acceptance criteria:
    - User can enter a search term (e.g. song title or artist)
    - Matching charts from the library are returned
    - User can open a chart directly from search results

- **As a band leader, I want to build a setlist by adding existing charts in a specific order so that the band has a ready run-sheet for the show.**
  - Acceptance criteria:
    - User can create a new setlist
    - User can add existing charts to the setlist via search
    - User can remove charts from the setlist
    - User can reorder charts within the setlist
    - Setlist is private to the creator by default, until explicitly shared

- **As a band leader who created a setlist, I want to delete it so that outdated or unused setlists don't clutter the library.**
  - Acceptance criteria:
    - User can select a setlist they created and delete it
    - Only the setlist's creator, or an app admin, can delete it
    - Deleted setlist is no longer accessible to anyone it was shared with

- **As a band leader, I want to share a setlist with band members so that the group can view and use it for a gig.**
  - Acceptance criteria:
    - User can share a setlist with the group
    - Band members can view the shared setlist
    - Band members can open the setlist in Performance Mode

- **As a performer on stage, I want to open Performance Mode so that I see a clean, distraction-free view of the chart while playing.**
  - Acceptance criteria:
    - User can enter Performance Mode from a chart or setlist
    - Performance Mode displays minimal UI with large, readable text
    - User can navigate between songs in a setlist while in Performance Mode

- **As a singer, I want to toggle chords off in Performance Mode so that I only see the lyrics.**
  - Acceptance criteria:
    - User can toggle chords on/off while in Performance Mode
    - When toggled off, only lyrics are displayed
    - Toggle state applies within the current Performance Mode session

- **As a musician, I want to quickly adjust a chart's key while in Performance Mode so that I can respond to a singer's vocal range without leaving the performance view.**
  - Acceptance criteria:
    - User can change the key from within Performance Mode, without navigating away from it
    - Chords update immediately to reflect the new key
    - Lyrics and layout remain unchanged
    - This is a quick-access shortcut to the same transpose capability described below, available directly from Performance Mode

- **As a performer on stage, I want to auto-scroll through a chart or setlist so that I don't need to touch my device while playing.**
  - Acceptance criteria:
    - User can start/stop auto-scroll from Performance Mode
    - User can adjust the auto-scroll speed
    - Auto-scroll works for both a single chart and a full setlist

- **As a singer, I want to annotate or highlight my part on a chord chart so that I know exactly what I'm supposed to sing without relying on manual colour-coding in Google Docs.**
  - Acceptance criteria:
    - User can mark or highlight specific lines/sections of a chart as their part
    - Annotations are visibly distinct from the rest of the chart
    - Annotations persist when the chart is reopened
    - Annotations are private to the user who created them; other users cannot see them

- **As a band member who owns a chart, I want to edit it directly so that my corrections are saved to the same chart.**
  - Acceptance criteria:
    - User can search for and open a chart they own
    - User can modify chords and/or lyrics and save changes directly to that chart
    - Other users see the updated chart the next time they open it

- **As a band member who owns a chart, I want to delete it so that outdated or unwanted charts don't clutter the library.**
  - Acceptance criteria:
    - User can select a chart they own and delete it
    - Only the chart's owner, or an app admin, can delete it
    - Deleted chart is removed from any setlists that referenced it

- **As a band member who does not own a chart, I want to create a new version of it so that the community can choose between different versions of the same song.**
  - Acceptance criteria:
    - User can search for and open a chart they do not own
    - User can modify chords and/or lyrics and save the changes as a new version, without overwriting the original
    - Users can view and select which version of the chart to open

- **As a musician, I want to transpose a chart to a different key so that I can play it comfortably on my instrument or match a singer's vocal range.**
  - Acceptance criteria:
    - User can select a target key for a chart
    - All chords in the chart update to reflect the new key, including slash chords
    - Transposition does not alter the underlying lyrics or chart structure

- **As an app admin, I want to trigger an invite email to a prospective member so that they can join the group.**
  - Acceptance criteria:
    - Admin can enter a prospective member's email and send an invite
    - Invite email contains a link for the recipient to create an account
    - Admin can see the status of sent invites (e.g. pending, accepted)

- **As an app admin, I want to delete any chord chart, regardless of who owns it, so that I can remove inappropriate or duplicate content.**
  - Acceptance criteria:
    - Admin can search for and delete any chart in the library
    - Deleted chart is removed from any setlists that referenced it
    - Action is restricted to admin accounts only

- **As an app admin, I want to delete any setlist, regardless of who created it, so that I can keep the library organized.**
  - Acceptance criteria:
    - Admin can view and delete any setlist, including private ones
    - Action is restricted to admin accounts only

- **As an app admin, I want to lock out a user account so that I can restrict access if needed (e.g. someone leaves the group).**
  - Acceptance criteria:
    - Admin can lock a user account
    - Locked-out user cannot log in or access the app
    - Admin can unlock a previously locked account

## 8. Out of Scope for v1 (Future Considerations)
- Smart auto-cleanup: auto-detect and realign chord/lyric lines on paste
- OCR import: convert pasted/uploaded images of chord charts into editable text
- Real-time co-editing / Jam Sessions
- Audio playback / backing tracks
- Bluetooth pedal / hands-free navigation

## 9. Technical Notes

- **Stack:** Next.js (App Router), Supabase (DB + Auth via `@supabase/ssr`), deployed on Vercel
- **Chart engine:** ChordSheetJS — ChordPro parsing, chords-over-lyrics rendering, transposition (incl. slash chords)
- Launch plan: small group of friends/bandmates first, possibly open to public later

## 10. Open Questions
- Exact design of the smart cleanup/auto-align algorithm — rule-based or AI-assisted? (future phase)
- Exact design of the OCR import flow (future phase)

## 11. Success Criteria
- Our workplace music community fully replaces Google Docs with the app for chart management
- Reduction in "messy chart" complaints/corrections during rehearsals
- Setlists successfully used at a live gig via Performance Mode

## 12. Change History

| Date | Changed by | Summary |
|------|-----------|---------|
| Aug 2026 | Andrew | Initial draft: Problem Statement, Goals, Non-Goals, Target Users, Competitive Landscape, Features, Out of Scope, Technical Notes, Open Questions, Success Criteria |
| Aug 2026 | Andrew | Added User Stories / Flows with acceptance criteria; added Overview section; added account/login, ownership & versioning rules, setlist privacy/sharing, auto-scroll, and chord/key toggle in Performance Mode |
| Aug 2026 | Andrew | Removed "workplace/community group access model" and "version history/attribution" from Competitive Landscape gaps; clarified singers' pain point occurs "in Google Docs" |
| Aug 2026 | Andrew | Added remove-chart-from-setlist and private annotation capability (with acceptance criteria and matching §6 features); added App Admin role (§4, §6.4) with invite, delete-any-chart, delete-any-setlist, and account lockout user stories |
| Aug 2026 | Andrew | Fixed chart/setlist delete ownership wording (§6.1, §6.2) to account for admin exception; added missing user story for a chart owner deleting their own chart |
