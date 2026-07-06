# The Family Cup — World Cup 2026 Bracket Tracker

A self-hosted version of the family bracket app: brackets, live leaderboard,
max-points-possible, champion flags, and match results — shared in real time
across everyone's phones via Firebase.

**What's different from the Claude-hosted version:** the AI features (photo
scanning and auto-syncing live scores from the web) have been removed, since
those relied on Claude's API running inside Claude's own environment. In this
version, results are entered manually by tapping the winning team on the
Results tab — updates appear instantly on everyone else's screen thanks to
Firebase's realtime sync, no refresh needed. Brackets are also entered
manually, same as before.

---

## 1. Create a free Firebase project (~10 minutes)

1. Go to **[firebase.google.com](https://firebase.google.com)** → click **Go to console** → **Add project**.
2. Name it anything (e.g. `wc26-family-bracket`). You can skip Google Analytics.
3. Once created, in the left sidebar go to **Build → Realtime Database → Create Database**.
   - Choose any region.
   - Start in **test mode** for now (see the security rules note at the bottom —
     worth tightening once everyone's set up, optional for a private family game).
4. Click the **gear icon** (top left) → **Project settings**.
5. Scroll to **"Your apps"** → click the **`</>`** (web) icon → give it a nickname
   (e.g. "family-bracket-web") → **Register app**.
6. You'll see a `firebaseConfig` object like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "wc26-family-bracket.firebaseapp.com",
     databaseURL: "https://wc26-family-bracket-default-rtdb.firebaseio.com",
     projectId: "wc26-family-bracket",
     storageBucket: "wc26-family-bracket.appspot.com",
     messagingSenderId: "...",
     appId: "...",
   };
   ```
   Copy these values into **`src/firebase.js`** in this project, replacing the
   `"REPLACE_ME"` placeholders.

That's the only setup step — no billing, no credit card required at this scale.

---

## 2. Push this project to GitHub (~5 minutes)

1. Create a free account at **[github.com](https://github.com)** if you don't have one.
2. Click **New repository** (top right → the `+` icon) → name it e.g. `family-world-cup` → **Create repository**.
3. On the empty repo page, click **"uploading an existing file"** and drag in
   every file/folder from this project (or use `git` from a terminal if you're
   comfortable with it — see below).

   Using git from a terminal instead:
   ```bash
   cd wc26-app
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/family-world-cup.git
   git push -u origin main
   ```

---

## 3. Deploy on Vercel (~5 minutes)

1. Go to **[vercel.com](https://vercel.com)** → **Sign up** using your GitHub account (free, no card).
2. Click **Add New… → Project** → select your `family-world-cup` repo → **Import**.
3. Vercel auto-detects this is a Vite project. Leave the defaults → click **Deploy**.
4. In a minute or two you'll get a live URL like `family-world-cup.vercel.app`.

That's it — the app is live and shared storage works via Firebase.

---

## 4. Point your own domain (optional, ~10 minutes)

1. In your Vercel project → **Settings → Domains** → enter your domain
   (e.g. `worldcup.yourfamily.com`).
2. Vercel shows you a DNS record to add (usually a `CNAME`).
3. Add that record in your domain registrar's DNS settings (GoDaddy,
   Namecheap, Google Domains, etc.).
4. Propagates within minutes to a few hours. Vercel issues HTTPS automatically.

---

## Updating the app later

Any time you want to make changes (add a player, tweak scoring, restyle
something), edit the files and either:
- push to GitHub again (`git add . && git commit -m "..." && git push`) —
  Vercel auto-redeploys on every push, or
- drag-and-drop updated files into the GitHub web UI if you're not using git
  locally.

## Local development (optional)

If you want to preview changes before deploying:
```bash
npm install
npm run dev
```
Then open the local URL it prints (usually `http://localhost:5173`).

---

## Recommended: tighten Firebase security rules

Test mode leaves the database open to anyone with your config (not just your
family) for 30 days, then locks automatically. For a family app this is
usually fine short-term, but if you want it open indefinitely with a small
amount of protection, go to **Realtime Database → Rules** and use:

```json
{
  "rules": {
    "leagues": {
      "wc26": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

This keeps the game open to anyone with the link (matching how the Claude
version worked) without leaving your entire Firebase project world-writable.
For real per-user auth (so only invited family members can edit), Firebase
Authentication with an allow-list is the next step up — ask me if you want
that added.

---

## Bringing back AI features later

If you'd like live score syncing back (auto-pulling results from the web)
you'll need your own Anthropic API key on a small serverless function — never
exposed in the browser. Vercel Functions or Cloudflare Pages Functions both
support this on their free tier; the function would hold your key and proxy
requests to `api.anthropic.com`. This is a follow-up step, not required to run
the app.
