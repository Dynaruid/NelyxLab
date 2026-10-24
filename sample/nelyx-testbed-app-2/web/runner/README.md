# Web runner

Registers the shared `src/index.ts` application through the Nelyx platform SDK. This runner owns its dependencies, Metro/Babel configuration, and platform build settings.

## Install

From the application root, after supplying archives with `nelyx supply --app . --target web --packages <archive-directory>`:

```powershell
npm --prefix web/runner ci --workspaces=false
```

In NelyxLab, use `npm run build:sdk` and `npm run prepare:sample -- web` from the repository root first. Use Node.js >=24.3.0 <25 and a WebGL2-capable browser.

## Develop and build

From this runner directory:

```powershell
npm run check
npm run dev
```

Open `http://127.0.0.1:8081/`; Ctrl+C stops the development server. `npm run build` writes the static sample output to the application's `.nelyx/web/`.

To produce and serve a CLI-managed package:

```powershell
npx --no-install nelyx build --app ../.. --target web
npx --no-install nelyx run --app ../.. --target web --port 8080
```

Open `http://127.0.0.1:8080/`. CLI `pack` exports the built package. Rendering uses CanvasKit/Ganesh/WebGL2; GPU recovery, physical input, IME, accessibility, and memory qualification remain open.
