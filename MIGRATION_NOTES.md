# Memory storage migration

Vivica previously persisted all persona memory under a single `vivica-memory` key in
`localStorage`. Memory data is now stored using scoped keys:

- `vivica-memory-global`
- `vivica-memory-profile-<id>`

On launch the app will clean up the old `vivica-memory` key if it still exists.
All components read and write only from the new scoped keys.

# Conversation storage migration

Chat conversations were previously saved in `localStorage` under the
`vivica-conversations` key. To improve durability and allow larger histories,
conversations are now persisted in the IndexedDB `conversations` store. On
startup any existing `vivica-conversations` data will be imported into
IndexedDB and then removed from `localStorage`.
