<img width="200" alt="Maputnik logo" src="https://cdn.jsdelivr.net/gh/maputnik/design/logos/logo-color.png" />

# Maputnik
[![GitHub CI status](https://github.com/maplibre/maputnik/workflows/ci/badge.svg)][github-action-ci]
[![License](https://img.shields.io/badge/license-MIT-blue.svg)][license]

[github-action-ci]: https://github.com/maplibre/maputnik/actions?query=workflow%3Aci
[license]:          https://tldrlegal.com/license/mit-license

A free and open visual editor for the [MapLibre GL styles](https://maplibre.org/maplibre-style-spec/)
targeted at developers and map designers.


## Usage

- :link: Design your maps online at **<https://www.maplibre.org/maputnik/>** (all in local storage)
- :link: Use the [Maputnik CLI](https://github.com/maplibre/maputnik/wiki/Maputnik-CLI) for local style development
- In a Docker, run this command and browse to http://localhost:8888, Ctrl+C to stop the server.

```bash
docker run -it --rm -p 8888:8000 ghcr.io/maplibre/maputnik:main
```

To see the CLI options (for example file watching or style serving) run:
```bash
docker run -it --rm -p 8888:8000 ghcr.io/maplibre/maputnik:main --help
```
You might need to mount a volume (`-v`) to be able to use these options.

## Install this fork as a package

Install a prebuilt archive from a versioned GitHub Release. For example, after
the `npm-v3.1.0-fork.1` package release has been published:

```bash
npm install --save-dev --save-exact "https://github.com/Minin2707/maputnik/releases/download/npm-v3.1.0-fork.1/maputnik-3.1.0-fork.1.tgz"
```

Commit the resulting lock file to retain the URL and integrity. Use the versioned
asset URL rather than a `latest`, source-archive or Git-dependency URL. Installing
the release `.tgz` with ordinary lifecycle scripts enabled does not build the
editor or install its build dependencies. `private: true` prevents registry
publication. The package contains a static browser application and a small Node
resource-export API; it is not a React component library.

Export HTML separately from public files in a build script:

```js
import { exportResources } from "maputnik/resources";

await exportResources({
  htmlFile: "private/maputnik.html",
  publicDir: "public/maputnik",
});
```

Serve the dedicated public directory at `/maputnik/`; that base is preserved in
HTML, CSS, localization imports and the MapLibre worker URL. Serve the separate
HTML file through the application's own route and access checks. Do not expose
the package's entire `dist/` through a static file server.

The API returns resolved absolute `htmlFile` and `publicDir` paths and a `files`
array of copied public paths. It copies all non-HTML build resources, `LICENSE`,
`LICENSES/`, `THIRD_PARTY_NOTICES.md`, `THIRD_PARTY_LICENSES.md` and the generated
`THIRD_PARTY_NOTICES.txt`. Keep these legal files when redistributing the build.
Output locations must not overlap the installed package. HTML inside the public
directory, including through a symlink or junction, is rejected. Existing public
HTML or links within the output tree are also rejected before copying.

Repeated exports overwrite the package's named resources and preserve unrelated
files. The API does not recursively delete directories or prune old hashed
assets; use a fresh dedicated output directory for a clean deployment.

## Release a fork package archive

Use Node.js 24 and npm 11.6.2. The `-fork.N` part of the version identifies a
packaging revision; it does not announce a new upstream stable editor release.

1. Set `package.json` and the root versions in `package-lock.json` to an unused
   version such as `3.1.0-fork.1` (increase `N` for the next packaging release).
2. Run `npm ci`, `npm run lint` and `npm run test:package`. The package check runs
   a real `npm pack`, whose `prepack` builds the editor, then installs the archive
   offline into an empty project with lifecycle scripts enabled. It checks the
   archive contents, absence of runtime dependencies, resource links and export
   API. It does not test the editor's internal UI behavior.
3. Commit and push the reviewed changes manually. Create and push the matching
   tag, for example `npm-v3.1.0-fork.1`, on that commit. Ensure GitHub Actions is
   enabled for the fork. The tag must match the package version exactly.
4. The separate **Release npm browser package** workflow packs and verifies the
   archive before creating a GitHub prerelease. It does not publish to npm,
   create an upstream `v...` tag, mark the package release as latest, or replace
   an existing release. Never reuse a published tag or overwrite its assets;
   use a new packaging version instead.
5. After the workflow succeeds, check the release asset and install its fixed
   HTTPS URL in a clean project. A local `.tgz` check does not verify a future
   release URL before that asset exists.

The archive name is `maputnik-<version>.tgz`, at
`https://github.com/Minin2707/maputnik/releases/download/npm-v<version>/maputnik-<version>.tgz`.
To retain local test archives and logs, set `MAPUTNIK_PACKAGE_DIR` to an output
directory before running `npm run test:package`. Ordinary `npm ci` in this source
repository no longer builds the editor; `prepack` builds it only when packing.

## Documentation

The documentation can be found in the [Wiki](https://github.com/maplibre/maputnik/wiki). You are welcome to collaborate!

- :link: **Study the [Maputnik Wiki](https://github.com/maplibre/maputnik/wiki)**
- :video_camera: Design a map from Scratch https://youtu.be/XoDh0gEnBQo

[![Design Map from Scratch](https://j.gifs.com/g5XMgl.gif)](https://youtu.be/XoDh0gEnBQo)

## Develop

Maputnik is written in typescript and is using [React](https://github.com/facebook/react) and [MapLibre GL JS](https://maplibre.org/projects/maplibre-gl-js/).

We ensure building and developing Maputnik works with the [current active LTS Node.js version and above](https://github.com/nodejs/Release#release-schedule).

Check out our [Internationalization guide](./src/locales/README.md) for UI text related changes.

### Getting Involved
Join the #maplibre or #maputnik slack channel at OSMUS: get an invite at https://slack.openstreetmap.us/ Read the the below guide in order to get familiar with how we do things around here.

Install the deps, start the dev server and open the web browser on `http://localhost:8888/`.

```bash
# install dependencies
npm install
# start dev server
npm run start
```

If you want Maputnik to be accessible externally use the [`--host` option](https://vitejs.dev/config/server-options.html#server-host):

```bash
# start externally accessible dev server
npm run start -- --host 0.0.0.0
```

The build process will watch for changes to the filesystem, rebuild and autoreload the editor.

```
npm run build
```

Lint the JavaScript code.

```
# run linter
npm run lint
npm run lint-css
npm run sort-styles
```

## Tests

### End-to-end tests

For E2E testing we use [Playwright](https://playwright.dev/). The tests live in the [`e2e`](/e2e) directory and drive the app through the `MaputnikDriver` page object.

The first time you run the tests, install the browser:

```
npx playwright install chromium
```

Playwright automatically starts the dev server (`npm run start`) for you, so you can just run:

```
npm run test
```

Some useful options:

```
# see the tests run in a headed browser
npm run test -- --headed

# run a single spec / filter by title
npm run test -- e2e/map.spec.ts
npm run test -- -g "zoom level"

# open the interactive UI mode
npx playwright test --ui
```

Running the E2E tests also produces a code-coverage report in `coverage/` (collected via istanbul instrumentation of the dev server).

### Unit & component tests

Unit tests and component tests run with [Vitest](https://vitest.dev/); component tests (`*.browser.test.tsx`) use Vitest's browser mode with the Playwright provider.

```
npm run test-unit
```

## Upstream desktop release process

The existing desktop release workflow handles stable editor versions. Fork
packaging prerelease versions are excluded and use the separate process above.

1. Review [`CHANGELOG.md`](/CHANGELOG.md)
   - Double-check that all changes included in the release are appropriately documented.
   - To-be-released changes should be under the "main" header.
   - Commit any final changes to the changelog.
2. Run [Create bump version PR](https://github.com/maplibre/maputnik/actions/workflows/create-bump-version-pr.yml) by manual workflow dispatch and set the version number in the input. This will create a PR that changes the changelog and `package.json` file to review and merge.
3. Once merged, an automatic process will kick in and creates a GitHub release and uploads release assets.


## Sponsors

Thanks to the supporters of the **[Kickstarter campaign](https://www.kickstarter.com/projects/174808720/maputnik-visual-map-editor-for-mapbox-gl)**. This project would not be possible without these commercial and individual sponsors.
You can see this file's history for previous sponsors of the original Maputnik repo.
Read more about the MapLibre Sponsorship Program at https://maplibre.org/sponsors/.

## License

Maputnik is [licensed under MIT](LICENSE) and is Copyright (c) Lukas Martinelli and Maplibre contributors.
As contributor please take extra care of not violating any Mapbox trademarks. Do not get inspired by other map studios and make your own decisions for a good style editor.
