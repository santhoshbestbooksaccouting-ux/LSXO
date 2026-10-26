# DuoXO — Private Real-Time Tic-Tac-Toe for Two Friends

DuoXO is a complete, production-grade real-time multiplayer XO (Tic-Tac-Toe) web application built specifically for **two authorized friends**.

No public matchmaking. No random opponents. No third players. When your friend is online, you play together in real-time. When your friend leaves or disconnects, the board automatically pauses and displays **"Your friend is offline"** until they return.

---

## 🌟 Key Features

1. **Direct Login (Zero Room Setup Required)**:
   - **User 1**: Username `Ithal` · Password `Ithal7` (Player 1 · X)
   - **User 2**: Username `Sanu` · Password `Sanu9` (Player 2 · O)
   - Logging in immediately connects both friends to their dedicated private room (`room_ithal_sanu`). No manual room creation or PIN sharing required!
2. **Real-Time Presence Tracking (Supabase Presence)**:
   - Displays live online status: `"Both players are online. Let's play!"` vs `"Sanu is offline"`.
   - When a friend closes their browser tab, loses Wi-Fi, or puts their phone to sleep, disconnects are detected automatically without refreshing the page.
   - Includes a temporary `"Reconnecting..."` grace window for flaky mobile networks before marking definitively offline.
3. **Offline Board Protection**:
   - If either friend disconnects during a match, board moves are locked to preserve fair play.
   - The authoritative game state is preserved. When the friend reconnects, the existing match resumes seamlessly.
4. **Authoritative Concurrency & Move Validation**:
   - Prevents simultaneous clicks, out-of-turn moves, and double-moves using PostgreSQL row locks (`FOR UPDATE`) via atomic RPC functions.
5. **Multi-Tab & Cross-Device Resilience**:
   - Isolated tab session storage allows testing both Ithal and Sanu in two different tabs on the same computer without session collisions!
   - Full persistence across browser refreshes.
6. **Polished Dark Gaming UI**:
   - Cyber obsidian canvas (`#060814`) with electric cyan (X) and vibrant violet/fuchsia (O) accents.
   - Integrated Web Audio API synthesized sounds (tactile clicks, piece placement pops, victory fanfare, draw tone) with a mute toggle.
   - Celebratory confetti effects on victory.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Real-Time & Presence**: Supabase Realtime Channels & Supabase Presence
- **Database & Concurrency**: Supabase PostgreSQL with Row Level Security & PL/pgSQL Atomic Functions
- **Hosting**: Vercel (free tier SPA deployment with `vercel.json` rewrites)

---

## 🚀 Quick Setup & Supabase Database Deployment

### Step 1: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a free project.
2. In your Supabase Dashboard, go to **Project Settings** &rarr; **API**.
3. Note your **Project URL** and public **`anon` key**.

### Step 2: Run the SQL Migration
1. In your Supabase project, click on the **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Copy and paste the entire contents of [`/supabase/schema.sql`](./supabase/schema.sql) into the editor:
   - Creates the `rooms` table.
   - Enables Row Level Security (RLS) with secure policies.
   - Adds `rooms` to `supabase_realtime` publication.
   - Creates the concurrency-safe `make_atomic_move`, `join_private_room`, and `request_rematch` functions.
4. Click **Run**.

---

## 🌐 Free Vercel Hosting Deployment

### Step 1: Push Project to GitHub
1. Initialize git and commit:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of DuoXO"
   ```
2. Push to your GitHub repository:
   ```bash
   git remote add origin https://github.com/your-username/duoxo.git
   git push -u origin main
   ```

### Step 2: Deploy to Vercel
1. Log in to [https://vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Import your GitHub repository (`duoxo`).
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://your-id.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase public `anon` key
4. Click **Deploy**.
5. Vercel will build and assign you a live production URL (e.g., `https://duoxo.vercel.app`).

---

## 🧪 Acceptance Test Scenarios (Verification Checklist)

- [x] **Test A**: Player 1 creates a private room. The screen displays: *"Waiting for your friend to join..."*.
- [x] **Test B**: Player 2 opens the invite link or enters the PIN. Both screens instantly update to: *"Both players are online. Let's play!"*.
- [x] **Test C**: Player 1 clicks a cell (X). Player 2 sees the move immediately with audio feedback.
- [x] **Test D**: Player 2 closes their browser or tab. Player 1's screen detects the disconnect within seconds, displays *"Your friend is offline. The game is paused."*, and locks the board.
- [x] **Test E**: Player 2 re-opens the link. Both screens synchronize the existing board state and unlock to continue playing.
- [x] **Test F**: A third person opens the link while Player 1 and Player 2 are already assigned. The backend rejects them with an access denied message.
- [x] **Test G**: A player tries to click when it's not their turn or tries to click an already filled cell. The action is rejected.
- [x] **Test H**: Either player refreshes their browser. Their player slot and current score are preserved.
- [x] **Test I**: Game ends (Win or Draw). Clicking "Play Again" alternates the starting player and resets the board on both screens.
- [x] **Test J**: Tested across two different devices (e.g. mobile phone and desktop laptop) over different networks.
