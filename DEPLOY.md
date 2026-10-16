# Deploy Online Drafts to Netlify

## 1. Database
Run `schema.sql` (and `fix-users.sql` if needed) in Neon SQL Editor.

## 2. Push repo to GitHub / GitLab / Bitbucket

## 3. Netlify
1. New site → Import from Git
2. Build command: `npm run build` (from netlify.toml)
3. Install plugin: `@netlify/plugin-nextjs` (listed in netlify.toml)

## 4. Environment variables (Site settings → Environment variables)

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | your Neon connection string |
| `SESSION_SECRET` | long random string (32+ chars) |
| `NEXT_PUBLIC_PUSHER_KEY` | de2ZYOo4oykhBT6Qj26kaQ |
| `PUSHER_SECRET` | lG8pvOxbqirCxz8EZ4GM |
| `PUSHER_APP_ID` | from Pusher dashboard |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | mt1 (or your cluster) |

## 5. Deploy
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

## Notes
- `requirements.txt` is a note only — this is Node/Next, not Python. Dependencies live in `package.json`.
- Bot/demo mode works without Pusher.
- Multiplayer moves use the same engine, pink pieces, and Web Audio sounds as the bot game.
