# SYNTHBOARD

SYNTHBOARD is a browser-based modular synthesizer and ambient studio powered by the Web Audio API and built with Vite and vanilla JavaScript. It combines a zoomable freeform Studio workspace with a dedicated virtual Eurorack mode.

## Live Demo
 -> live

## Key Features

- **35 Modular Studio Units**: Control, clock, logic, sequencing, synthesis, physical modeling, drum/percussion, and master effect modules (`src/modules/`).
- **Zoomable Freeform & Auto-Layout Workspace**: Pan and zoom across the Studio canvas with 3-level LOD rendering, offscreen culling, and background tab sleep.
- **Interactive Cable Patching**: Color-coded signal routing (`clock`, `gate`, `pitch`, `mod`, `audio`) with per-cable modulation depth control.
- **Performance Snapshots & Focus Dock**: 5-slot preset morphing (`Direct`, `Glide`, `Slow Morph`), 5-slot Live-Controls Focus Dock (`Shift+Click` on knobs), and cable-triggered `Snapshot Controller`.
- **Multi-Mode Audio Visualizer**: Triggered 3D-ribbon waveform, logarithmic multi-band FFT, stereo XY Lissajous, 3D spectral waterfall, and radial 3D vortex.
- **Built-in Eurorack View**: Dedicated self-contained Eurorack cabinet (`Distant Lights`) with macro controls and automation lanes.
- **Safe JSON Patch Import/Export**: Validated JSON import (2 MiB limit, schema/range/jack checks, prototype-pollution and XSS-safe handling).

## Quick Start (First Sound)

1. Open SYNTHBOARD in your browser. On first visit, the **Start Here** 4-module patch (`master_clock`, `slope_generator`, `drone`, `reverb`) is loaded automatically.
2. Click anywhere on the page or click the **AN / AUS** power button in the top-left header to start the Web Audio `AudioContext` (browsers require a user gesture before playing audio).
3. Use the **MASTER** knob in the top-right header to adjust overall output volume.
4. Click the **AN / AUS** power button again to suspend/pause audio.

### Included Highlight Presets

- **Start Here – Erster Ton** (`start_here`): 4-module learning patch. You hear a warm fifths drone modulated by a looping/triggered slope envelope into reverb. Worth tweaking: `Slope Generator` (`Rise` / `Fall`) and `Drone` (`Tone`).
- **Solar 42 Drone Desk** (`solar`): Slow evolving ambient drone with FM and filter motion. Worth tweaking: `Slow Random` (`Rate`) and `Drone` (`Detune` / `Tone`).
- **Felt Piano & Melodic Ambient** (`felt_piano_ambient`): Mellow felt piano melody driven by `Random Walk` and `Quantizer` with bass and subtle drone backing. Worth tweaking: `Felt Piano` (`Felt` / `Decay`) and `Reverb` (`Mix`).
- **Generatives Modular-System (Showcase)** (`generative`): Self-evolving generative patch with Euclidean rhythms, probability gates, and melodic voices. Worth tweaking: `Euclidean` (`Hits` / `Steps`) and `Probability Gate` (`Prob`).
- **Hypnotic Live Beat & Ambient Rack** (`scenes`): Multi-voice rhythmic performance setup combining drums, hybrid percussion, bass, and melodic textures. Worth tweaking: `Master Clock` (`Tempo`) and `Filter` (`Cutoff`).

## Local Installation

Requirements:
- Node.js 20+ (tested on Node.js `v22.17.0` and npm `10.9.2`)

```bash
git clone https://github.com/Terclean/SYNTHBOARD.git
cd SYNTHBOARD
npm ci
npm run dev
```

## Build & Tests

```bash
# Run all automated unit and regression tests
npm test

# Build production bundle (configured for /SYNTHBOARD/ base path)
npm run build

# Preview production build locally
npm run preview
```

## Patch Import & Export

- **Export**: Use **Datei > Exportieren (JSON)** in the top menu to download the active Studio board (`version: 2`, modules, cables, and snapshots) as `.synthboard.json`.
- **Import**: Use **Datei > Importieren (JSON)...**. Files are limited to **2 MiB**, validated against known module types, unique IDs, finite parameter ranges, valid module jacks, and maximum counts (`64` modules, `256` cables, `5` snapshot slots) before modifying the active rack. Invalid files leave the current rack intact.

## Keyboard Shortcuts

- `1`–`5`: Trigger Performance Snapshot Slot 1–5 (`Shift+1`–`5` saves current state to slot)
- `6`–`8`: Set Snapshot Morph Speed (`6`: Direct, `7`: Glide, `8`: Slow)
- `Cmd/Ctrl + S`: Save current board
- `Cmd/Ctrl + N`: Create new board
- `Cmd/Ctrl + 0`: Reset workspace zoom
- `+` / `-`: Zoom in / zoom out
- `B`: Toggle module library sidebar
- `P`: Toggle performance sidebar
- `F` or `O`: Fit all modules in view ("Alles im Blick")
- `C`: Toggle cable visibility
- `Z`: Switch between Free and Auto layout mode
- `E`: Export JSON
- `H` or `?`: Open Studio Manual
- `T`: Open Tutorials
- `I`: Toggle info tooltips
- `Escape`: Close open modals

## Known Limitations & Browser Support

- **Web Audio API & User Gesture**: Audio remains suspended until a user interaction (`pointerdown` or clicking the power button).
- **External Fonts**: `index.html` loads `Inter`, `JetBrains Mono`, and `Chakra Petch` from Google Fonts; offline environments fall back to system fonts.
- **Browser Testing**: Verified in Chromium/Chrome via automated browser inspection. Safari and Firefox have not been exhaustively cross-browser tested in this release.

## GitHub Pages Deployment Setup

The repository includes `.github/workflows/deploy.yml` and `vite.config.js` (`base: '/SYNTHBOARD/'` for production builds). To enable deployment on GitHub:
1. Push to the `main` branch.
2. In your GitHub repository, open **Settings > Pages**.
3. Set **Build and deployment > Source** to **GitHub Actions**.

## Contributing & License

- See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and preset guidelines.
- Licensed under the [MIT License](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for external font and dependency notices.
- Detailed German technical and user documentation is available in [HANDBUCH.md](HANDBUCH.md) and inside the in-app manual (`H`).
