# Fede Training

Fede Training is a personal fitness and training Progressive Web App (PWA) designed to make structured training easier to follow, record, and review.

## Features

- 🏋️ Structured workout plans with exercise-level set, reps, weight, and completion tracking
- 📈 Training history and progression tracking
- 🤸 Calisthenics Lab for skill-focused training and progression
- 🎥 Exercise instructions, images, and video resources
- 🧠 AI Coach for working with the training plan
- 🍽️ Nutrition and calorie tracking
- 💧 Water tracking
- 📊 Progress and body-metric tracking
- 📱 Installable PWA experience with offline-friendly app assets

## Privacy & Data

This public repository contains the application code and public assets only.

Personal workout history, logs, progress data, nutrition entries, and other user data are stored locally in the user's browser/device by the application. They are not included in this public repository.

## Technology

Fede Training is a lightweight client-side web app built with HTML, CSS, and JavaScript, with PWA support through a web app manifest and Service Worker.

## Project status

This repository contains the reviewed public release of Fede Training.

The project prioritizes data safety, stable exercise identifiers, non-destructive migrations, and preservation of existing workout history when the application evolves.

## License

No open-source license has been applied to this repository. The code and assets remain the author's property unless otherwise stated.

## Hosting

Static site, no build step. Relative paths throughout, so it moves between
hosts unchanged.

- **Cloudflare Pages** — build command: *(empty)* · build output directory: `/`
- Per-branch preview deployments are enabled, so `restyle-v8` gets its own URL.
- `_headers` keeps `sw.js` and `manifest.json` out of the edge cache; without it a
  published update can sit on an installed phone until the worker is revalidated.
