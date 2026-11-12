# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-12

### Fixed

- `/note` no longer says the board opened where no pane can show (the mobile app). There,
  `/note` and `/note lista` draw the post-it cards in the chat instead, and
  `/note <text>` says where to see them.

## [0.1.0] - 2026-11-12

### Added

- `/note <text>` adds a post-it to a board saved across sessions.
- `/note`, `/note lista`, `/note rm <n>` and `/note ajuda`.
- Post-it pane: colored cards with number, time and project, a `nova` field to add a note and an
  `apagar` button per note.
