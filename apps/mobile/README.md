# Soulfables, the app

The reader's Soulfables on a phone: the Library, stories, narrations with a
sleep timer, and the reader's account. Built with Expo (React Native,
TypeScript) against the same Supabase project and the same website API as
soulfables.co. Premium and books are bought on the website; the app opens
what the reader owns.

## How it talks to the House

- **Database and sign-in:** the Supabase project, with the anon key, under the
  same row-level security as the site. The session is kept in the phone's
  storage.
- **The website's API:** every route that accepts a session cookie also accepts
  `Authorization: Bearer <access token>`, so the app calls `/api/me`,
  `/api/story/[slug]/audio?json=1`, `/api/push/register` and, later, the
  Librarian, exactly as the web pages do.
- **Emailed links** (confirm, reset) land on soulfables.co/auth/confirm. With
  the app installed and universal links configured, the phone opens them in
  the app.

## Running it

```
cd apps/mobile
npm install
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the anon key> npx expo start
```

Scan the QR code with Expo Go on a phone, or press `a` / `i` for an emulator.
The anon key is the same public key the website ships in its pages; it is
read from `EXPO_PUBLIC_SUPABASE_ANON_KEY` or from `extra.supabaseAnonKey` in
`app.json`. Point at a different site with `EXPO_PUBLIC_SITE_URL`.

`npm run typecheck` type-checks without a device.

## Building for the stores

1. Apple Developer account (US$99 a year, company) and Google Play developer
   account (US$25 once). Both in the business's name.
2. `npx eas init` links the project to an Expo account; the id lands in
   `app.json` under `extra.eas.projectId`.
3. `npx eas build --platform all` builds in Expo's cloud, no Mac needed.
4. Universal links: set `APP_IOS_TEAM_ID`, `APP_IOS_BUNDLE_ID`,
   `APP_ANDROID_PACKAGE` and `APP_ANDROID_SHA256` in the website's Parameter
   Store and redeploy the site; it then serves the two well-known files.
5. `npx eas submit` sends the builds to App Store Connect and the Play
   Console. Store listing text, screenshots and privacy answers are done
   there.

## Layout

```
app/              screens, by route (expo-router)
  onboarding      the welcome, shown once
  signin          the door (Sign In / Sign Up / reset)
  (tabs)/         Home, Library, Journal, Residents, Account
  mood            your mood today and the stories for it
  story/[slug]    story details: Read Now, Listen Instead, keep, share
  read/[slug]     the reading view, with Aa and progress
  community/[id]  one post with its reactions and replies
  questions       the Drawer of Quiet Questions
  librarian       the Librarian (from Home)
lib/              supabase client, site API, session, content, journal,
                  community, account, push, prefs
components/       the player, Markdown renderer, shared UI, story row,
                  mood strip, compose sheet, screen header, error boundary
constants/        the House's palette
```

## What is in v1 and what is not

Everything in the app reads what the website already has; nothing was
added on the web side for it. In: the welcome and the door; Home with
the greeting, the House's moods, the story of the day (the site's home
hero slot), the affirmation, Continue, the latest Weekly Letter and the
Librarian; the Library with search, kinds, the shelves and sorting;
story details with Read Now and Listen Instead, keep and share; the
reading view with text size and progress; the Journal with today's
question, moods, entries, the thirty-day strip, saved stories, the
prompt pool and the deck; Residents with the wall, the House's prompt,
challenges, posting (named or anonymous), reactions and replies; the
Account with standing, owned books and downloads.

Not in the app, by design or because the web has no such feature yet:
buying (the stores take a cut), social sign-in, mood check-ins without
an entry, photos and voice notes, reply-to-reply, blocking, reader
notifications, offline reading.
