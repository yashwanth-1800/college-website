# ProjectMatch — SRM Kattankulathur

ProjectMatch is a campus-first team formation platform for SRM University students. Students can create profiles, publish project ideas, set dated availability, apply for open roles, join project discussions, and send private messages to other students.

## Run locally

1. Copy `.env.example` to `.env.local` and add the Firebase web configuration.
2. Install dependencies with `npm install` or `pnpm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Main features

- Google authentication through Firebase
- SRM student onboarding and engineering-stream filters
- 2026 availability calendar
- Student-created projects and applications
- Saved project discussions
- Private student-to-student messaging
- Firestore synchronization with local persistence fallback

The background photograph is stored in `public/images/projectmatch-office.jpg`.
