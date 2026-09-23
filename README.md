# Campus Emergency Response

A responsive front-end emergency-response prototype for students, volunteers, doctors, and administrators. Google sign-in is provided by Firebase Authentication, while incident data and workflow changes are persisted in the browser with `localStorage`.

## Upgraded incident workflow

- Four-step mobile reporting flow with emergency type, structured campus location, description, and review/submit.
- Deterministic smart priority classification: Critical, High, Medium, or Low.
- Factual incident summaries generated only from the submitted description.
- Incident timeline: Reported → Acknowledged → Responding → Resolved.
- Volunteer task progress and doctor-only medical resolution controls.
- Administrator priority overrides, workflow progression, analytics, seven-day trends, and recurring-location hotspot detection.
- Student report tracking by report ID.
- Automatic migration of previously saved reports without changing their IDs.
- Accessible keyboard focus, live feedback, responsive cards, and a 320px-friendly layout.

This is a demonstration application. The role selector and browser storage are not a substitute for production authentication, server-side authorization, a secure database, audit logs, and appropriate privacy controls.

## Run locally

Do **not** open `index.html` by double-clicking it. Firebase modules require an HTTP or HTTPS origin rather than a `file:///` URL.

For the no-build local server, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local-server.ps1
```

Then open [http://localhost:8080](http://localhost:8080). To use a different port:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local-server.ps1 -Port 8081
```

For Vite development:

```powershell
npm install
npm run dev
```

## Test and build

```powershell
npm test
npm run build
npm run preview
```

The production output is created in `dist`. Asset URLs are relative, so the build works on Vercel and when hosted below a repository subpath.

## Firebase and deployment

Google sign-in requires every deployed hostname to be added under **Firebase Console → Authentication → Settings → Authorized domains**. Never automate or bypass the Google account chooser in production.

For Vercel, import this directory as the project root and use:

- Build command: `npm run build`
- Output directory: `dist`

The included `vercel.json` keeps the Firebase authentication helper route available on the deployment domain.

## Persistence

Incident data uses the `campusEmergencyReports` localStorage key. Missing or malformed data falls back safely to an empty report list, and legacy report records are migrated when loaded.
