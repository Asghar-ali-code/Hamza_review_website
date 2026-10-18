# Mehmaan Nawazi — Hamza's Guestbook

A single-page guestbook for friends who visit Hamza's flat. Guests leave a name, a star rating, and a short note. New notes stay **pending** until you approve them. Only approved notes are public.

The page is hosted on GitHub Pages. The reviews live in Cloud Firestore, on Firebase's free Spark plan.

## Put it on GitHub Pages

1. Create a new empty repository on GitHub.
2. In this folder, commit the files and push them to that repository's `main` branch.
3. On GitHub, open **Settings → Pages → Build and deployment**, and set **Source** to **GitHub Actions**.
4. The next push runs `.github/workflows/pages.yml` and publishes the site.
5. The address will look like `https://USERNAME.github.io/REPOSITORY/`.

If you would rather deploy from the branch instead of Actions, delete `.github/workflows/pages.yml` first, then set Pages to deploy from `main` and the `/` (root) folder. Use one method, not both.

Open `?preview=1` on the site if you want to see sample notes. Those samples are labelled and are not saved reviews. Remove `?preview=1` before you print the QR code.

## Connect Firebase

Do this before you share the site. Until `firebase-config.js` has your project settings, the page will say that reviews cannot be saved.

1. Create a project at [Firebase](https://console.firebase.google.com/).
2. Add a **Web app** and copy its `firebaseConfig`.
3. Replace the placeholder object in `firebase-config.js` with that config. These values are public by design. Never commit a service-account JSON file or a private key.
4. In the Firebase console, create a **Cloud Firestore** database. If it asks about rules, start in production mode.
5. Open the Firestore **Rules** tab, paste the contents of `firestore.rules`, and publish.
6. Open the Firestore **Indexes** tab and add a composite index:
   - Collection ID: `reviews`
   - Field `status`, ascending
   - Field `createdAt`, descending
   - Query scope: Collection

   The same index is described in `firestore.indexes.json`. You can also deploy rules and indexes with the Firebase CLI:

   ```bash
   npx firebase-tools deploy --only firestore
   ```

7. Commit the updated `firebase-config.js` and push. GitHub Pages will publish it.
8. Optional: set `removalEmail` in `firebase-config.js` if guests should be able to email you about taking a review down. Leave it blank to ask them to speak to Hamza.

If you later restrict the Firebase API key by website, allow your GitHub Pages address.

## Approve a review

1. A guest submits the form. The page tells them the note is waiting.
2. In Firebase, open **Firestore → reviews** and find the new document. `status` will be `pending`.
3. Change `status` to `approved`. The note then appears on the site, newest first.
4. To reject it, delete the document or set `status` to `rejected`. Anything other than `approved` stays hidden.

Check this once before printing the QR card:

- A new review does not appear until you approve it.
- Changing `status` to `approved` makes it appear.
- The browser console cannot edit or delete a review. The rules refuse updates and deletes.

## Print the card

After the public GitHub Pages address is working, open that address, scroll to **A card for the tea table**, and print it. The QR code uses the address of the page you are on, with `?preview=1` removed. Do not print it from a file on your computer, or the code will not open the public site.

## What guests can and cannot do

Firestore rules allow a visitor to create one pending review with a name, a rating from 1 to 5, a message, and a server timestamp. Visitors can read documents whose status is `approved`. They cannot approve, edit, or delete reviews. The form also checks the name, rating, message length, and a privacy confirmation before sending.
