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
app/            screens, by route (expo-router)
  (tabs)/       Library and Account
  story/[slug]  a story, with the player
  signin        the door
lib/            supabase client, API calls, session, content, push
components/     the narration player
constants/      the House's palette
```

## What is not here yet

Journal, reflection deck, community, offline downloads, the reader's theme,
the Librarian. Each has a website route or table ready to use; they are the
next screens, in that order.
