# Deploying Gateway LMS to Vercel and Render

The app has three parts, so it goes to three places:

| Part | Where | Why |
|---|---|---|
| Web app (the pages people see) | **Vercel** | Static files, fast worldwide |
| API and live classes | **Render** | Needs a server that stays running for WebSockets. Vercel cannot host that. |
| Database | **MongoDB Atlas** | Free hosted MongoDB |

You will do them in this order: GitHub, Atlas, Render, Vercel, then connect Render and Vercel to each other. Allow about 45 minutes the first time. Commands are for Windows PowerShell and also work on Mac and Linux unless noted. Websites change their buttons now and then, so match by name rather than by position.

> **Vercel's free plan (Hobby) is for personal, non-commercial projects.** An office tool normally needs the paid Pro plan. Check Vercel's terms. If you want a free option for a company, host the web app as a **Static Site on Render** instead (see "Alternative" in step 5).

---

## 1. Run it on your computer first

You need Node.js 20 or newer (`node -v`), Git, and MongoDB (Compass connected to `mongodb://localhost:27017`, or an Atlas address).

```powershell
cd GATEWAY-LMS-main
npm install
copy .env.example apps\api\.env
```

Open `apps\api\.env` and set at least these (see the table in step 4 for what each one means):

```
MONGODB_URI=mongodb://localhost:27017/gateway_lms
JWT_ACCESS_SECRET=<32 or more random characters>
CLIENT_URL=http://localhost:5173
ADMIN_SIGNUP_CODE=<any private word>
```

Make a random secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

```powershell
npm run seed -w @gateway/api     # demo data. Wipes the database it points at.
npm run dev                      # web on http://localhost:5173, API on http://localhost:4000
```

Demo sign-ins (password `Gateway@123`): `arun@gateway.local` (student, at `/auth/student/login`), and `priya@gateway.local` (trainer), `admin@gateway.local`, `super@gateway.local` at `/auth/admin/login`.

Other commands you may need:

| Command | What it does |
|---|---|
| `npm run build` | Builds the web app into `apps/web/dist` |
| `npm run typecheck -w @gateway/web` | Checks the web code for type mistakes. The build does not stop on these, so run it before big releases. |
| `npm run start` | Starts the API the way Render does |
| `npm run test:mobile` | Phone-size checks (needs `npx playwright install chromium` once, and the app running) |
| `npm run create-admin -w @gateway/api -- you@company.com "a strong password" "Your Name"` | Adds a super administrator without deleting anything |
| `npm run seed -w @gateway/api -- --force` | Seeds a hosted (Atlas) database. **Deletes everything in it.** |

To try the app on a phone on the same Wi-Fi, open the **Network** address that `npm run dev` prints.

## 2. Put the code on GitHub

Create an empty repository on github.com (private is fine). Then, in the project folder:

```powershell
npm install                       # refreshes package-lock.json, which Vercel and Render use
git init
git add .
git status                        # check: no ".env" file may appear in this list
git commit -m "Gateway LMS"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/gateway-lms.git
git push -u origin main
```

`.env` files are ignored by `.gitignore`, so your secrets stay on your computer. If `.env` ever shows in `git status`, stop and tell me before you commit.

## 3. MongoDB Atlas (database)

1. Sign up at mongodb.com/atlas and create a **free (M0)** cluster. Pick a region near your users (Mumbai if offered).
2. **Database Access** > Add New Database User. Choose a username and a strong password. Give it "Read and write to any database". Avoid `@ : / ?` in the password, or encode them.
3. **Network Access** > Add IP Address > **Allow access from anywhere** (`0.0.0.0/0`). Render's free servers do not have a fixed address, so a narrower list will lock them out. The password and database user are what protect it.
4. **Database** > Connect > Drivers. Copy the address. It looks like `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`. Put your password in, and add the database name before the `?`:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/gateway_lms?retryWrites=true&w=majority
```

This whole line is your `MONGODB_URI`.

## 4. Render (API and live classes)

**Easiest: Blueprint.** In Render: **New > Blueprint**, connect GitHub, pick the repository. Render reads `render.yaml`. Fill in the values it asks for:

| Variable | Value |
|---|---|
| `MONGODB_URI` | The Atlas line from step 3 |
| `CLIENT_URL` | Your Vercel address. You do not have it yet, so type `https://placeholder.vercel.app` for now and fix it in step 7 |
| `SUPPORT_EMAIL`, `SUPPORT_PHONE`, `SUPPORT_HOURS` | Your real contact details, or leave blank |
| `CODE_RUNNER_URL` | Leave blank for now |

`JWT_ACCESS_SECRET` and `ADMIN_SIGNUP_CODE` are generated for you.

**Or by hand:** New > Web Service > pick the repository, then:

| Setting | Value |
|---|---|
| Runtime | Node |
| Region | Singapore (closest to India) |
| Root Directory | leave blank |
| Build Command | `npm install --workspace=@gateway/api` |
| Start Command | `npm run start --workspace=@gateway/api` |
| Health Check Path | `/health` |
| Environment | `NODE_VERSION=22`, `NODE_ENV=production`, plus the table above and `JWT_ACCESS_SECRET` (a long random value) |

When the deploy finishes, copy the address, for example `https://gateway-lms-api.onrender.com`. Open `https://gateway-lms-api.onrender.com/health`. You should see `"status":"healthy"`.

**Create your first login.** Render's free plan has no shell, so do this from your own computer, pointing at Atlas. Do **not** use the seed command on a live database.

```powershell
$env:MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/gateway_lms?retryWrites=true&w=majority"
npm run create-admin -w @gateway/api -- you@company.com "A strong password" "Your Name"
```

(In the older Command Prompt, use `set MONGODB_URI=...&& npm run create-admin ...` with no space before `&&`.) Sign in with that account at `/auth/admin/login`, then add trainers, students and courses from inside the app.

## 5. Vercel (web app)

1. vercel.com > **Add New > Project** > import the GitHub repository.
2. Set:

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| **Root Directory** | `apps/web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment Variable | `VITE_API_URL` = your Render address, with no slash at the end |

3. Deploy. Copy the address Vercel gives you, for example `https://gateway-lms.vercel.app`.

`apps/web/vercel.json` already makes page refreshes and direct links work, and adds basic security headers.

**With the command line instead:**

```powershell
npm install -g vercel
cd apps\web
vercel login
vercel                                   # first run: answer the questions, accept the detected Vite settings
vercel env add VITE_API_URL production   # paste your Render address
vercel --prod
```

**Alternative: web app on Render's free Static Site.** New > Static Site > same repository. Build Command: `npm install && npm run build --workspace=@gateway/web`. Publish Directory: `apps/web/dist`. Environment: `VITE_API_URL` as above. Under Redirects/Rewrites add a **Rewrite** from `/*` to `/index.html`.

## 6. Connect the two

1. **Render** > your service > Environment > set `CLIENT_URL` to the Vercel address, for example `https://gateway-lms.vercel.app` (no slash at the end). To allow several addresses, separate them with commas, for example your custom domain and the Vercel one. Save. Render redeploys.
2. **Vercel** > Settings > Environment Variables > check `VITE_API_URL`, then **Redeploy**. The value is baked in when the app is built, so changing it needs a new build.

## 7. Check that it works

- Open the Vercel address and sign in with the account from step 4.
- Open **Students**, add a student, then **Courses**, create a course, add a lesson, enrol the student and press Publish.
- Schedule a class, press Go live, and open it from another browser or phone as the student. The code should appear live.
- If something fails, press F12, open the Console, and see the troubleshooting table below.

## 8. Things to know about the free plans

- **Render's free service goes to sleep** after about 15 minutes with no visitors. The next visit waits roughly a minute while it wakes, and open live classes disconnect when it sleeps. For real classes, use a paid instance so it never sleeps.
- Live classes keep their state in the memory of one server. Run one instance, not several.
- Atlas M0 is small and shared. Turn on backups or upgrade before storing important records.
- Java, C++, Go and the other server-run languages need a code runner (`CODE_RUNNER_URL`). JavaScript, Python and HTML run in the browser without one.
- Live video is a Jitsi link, not built in.
- Change `ADMIN_SIGNUP_CODE` if it ever leaks, and keep your `.env` files and the `MONGODB_URI` private.

## 9. Updating the live site

```powershell
git add .
git commit -m "Describe what changed"
git push
```

Render and Vercel rebuild by themselves after each push. Changing an environment variable needs a redeploy (Render does it automatically; on Vercel press Redeploy). To go back, use Rollback / "Redeploy" on an earlier deployment in either dashboard.

## 10. Custom domain (optional)

Add the domain in Vercel (Settings > Domains) and follow its DNS instructions. Then add it to `CLIENT_URL` on Render, for example `https://learn.yourcompany.com,https://gateway-lms.vercel.app`. You can also give the API its own address in Render (Settings > Custom Domains). If you do, update `VITE_API_URL` and redeploy the web app.

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| Sign-in page says "We could not reach the server" | `VITE_API_URL` is empty or wrong, or the API is asleep. Fix it on Vercel and redeploy, or wait a minute and try again. |
| Console shows a **CORS** error | `CLIENT_URL` on Render does not exactly match the address in the browser. No slash at the end, and `https`. Save and wait for the redeploy. |
| Pages work but refreshing gives 404 | The rewrite is missing. Root Directory must be `apps/web` so `vercel.json` is used. |
| "Could not connect to the live room" | API asleep, or `CLIENT_URL` mismatch. Open `/health` on the API first. |
| Render logs: `MONGODB_URI is not set` | Add it under Environment. |
| Render logs: `JWT_ACCESS_SECRET must be set...` | Needs 32 or more characters. |
| Render logs: `bad auth` or `ECONNREFUSED` or "not allowed" | Wrong Atlas username or password, password has special characters that need encoding, or Network Access does not allow `0.0.0.0/0`. |
| Render build fails on `npm install` | Run `npm install` locally, commit the new `package-lock.json`, and push. |
| Seed says "looks like a hosted database" | That is a safety stop. Use `create-admin` instead, or add `-- --force` only if you really want to wipe the database. |
| Students cannot see a course | It is still a Draft, or they are not enrolled. Open the course and press Publish, then add them under Students. |

## Every command in one place

```powershell
# local
npm install
copy .env.example apps\api\.env
npm run seed -w @gateway/api
npm run dev
npm run build
npm run start
npm run test:mobile
npm run create-admin -w @gateway/api -- you@company.com "a strong password" "Your Name"

# git and deploy
git init
git add .
git commit -m "message"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/gateway-lms.git
git push -u origin main

# optional Vercel command line
npm install -g vercel
vercel login
vercel --prod
```
