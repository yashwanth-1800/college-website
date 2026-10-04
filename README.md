# Campus Emergency Response

A production-oriented campus incident platform for Students, Volunteers, Doctors, and Administrators. The live app uses Firebase Authentication, real-time Cloud Firestore synchronization, Firebase Storage attachments, protected Vercel Functions, Vercel AI Gateway, and an offline-capable browser experience.

## Production upgrade

- Shared Firestore reports synchronized across authorized devices.
- Server-enforced role permissions through `firestore.rules`; new accounts default to Student.
- Administrator role management for trusted responders.
- Append-only per-incident audit history and internal responder notes.
- Atomic volunteer claim/release workflow that prevents conflicting assignments.
- Helper progress, doctor-only medical resolution, administrator timelines, and priority overrides.
- Browser notifications plus optional Firebase Cloud Messaging push delivery.
- SLA escalation function with priority-specific response targets. The included Hobby-compatible Vercel schedule runs daily; use Vercel Pro or an approved external scheduler to call the protected endpoint more frequently.
- Server-side structured AI recommendations through Vercel AI Gateway. Deterministic safety rules remain the fallback and can raise—not lower—an obvious safety priority.
- Optional GPS coordinates, a campus operations map, and protected photo/audio/PDF attachments.
- Firestore multi-tab offline cache with visible online, queued, and synchronized states.
- Category, location, trend, hotspot, resolution-time, map, and SLA analytics.
- Responsive accessible UI, safe DOM rendering, and 320 px support.

## Role permissions

| Action | Student | Volunteer | Doctor | Administrator |
|---|---:|---:|---:|---:|
| Submit and view own reports | Yes | No | No | All reports |
| Claim incident / update helper task | No | Assigned cases | No | No |
| Add internal responder notes | No | Yes | Yes | Yes |
| Resolve medical case | No | No | Yes | Workflow override |
| Change overall workflow or priority | No | No | No | Yes |
| Assign user roles | No | No | No | Yes |

These permissions are validated in both the UI and Firebase Security Rules. Hiding a control is never treated as authorization.

## Local development

```powershell
pnpm install
pnpm test
pnpm build
pnpm dev
```

Do not double-click `index.html`; Firebase authentication requires an HTTP or HTTPS origin. Local QA roles are available only on the loopback host, for example `http://127.0.0.1:5173/?qa-role=Student`.

## Required Firebase setup

1. Enable Google Authentication, Cloud Firestore, and Firebase Storage.
2. Add the production hostname under Firebase Authentication → Settings → Authorized domains.
3. Deploy the included policies:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage
```

4. Create the first administrator out of band in Firebase Console by setting their `users/{uid}.role` to `Administrator`. This one-time bootstrap is intentionally not available through the public web app.
5. Create a Firebase Web Push certificate and set `VITE_FIREBASE_VAPID_KEY` to enable closed-app push alerts.

## Vercel environment variables

Copy `.env.example` and configure these as Vercel project secrets:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: a narrowly scoped Firebase service-account JSON value used only by notification and escalation functions.
- `FIREBASE_PROJECT_ID` and `FIREBASE_STORAGE_BUCKET`.
- `CRON_SECRET`: generated automatically by Vercel for authenticated cron requests, or set to a strong random value.
- `AI_GATEWAY_API_KEY` when Vercel OIDC authentication is not being used.
- `AI_MODEL` optionally overrides the default `openai/gpt-5-mini` model.
- `VITE_FIREBASE_VAPID_KEY` enables Firebase web push in the client build.

Never commit `.env.local` or service-account JSON files.

## Safety design

AI produces a concise summary, suggested priority, rationale, guidance, and confidence score. It does not diagnose, resolve reports, or replace emergency responders. Deterministic rules remain active if the model is unavailable, and an AI recommendation cannot lower a higher rule-based safety classification. All operational decisions remain human-controlled and audited.

## Verification

The incident engine has automated tests for classification, migration, analytics, and production metadata. The production build is type-checked and browser-tested across Student, Volunteer, Doctor, and Administrator flows before deployment.

