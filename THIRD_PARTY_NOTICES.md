# Third-party notices

Maputnik is distributed under the MIT license in `LICENSE`. Licenses for the
JavaScript dependencies included in the browser build are generated in
`dist/THIRD_PARTY_LICENSES.md`. Licenses and notices for dependencies embedded in
the prebuilt MapLibre bundles, including its worker, are also collected in
`dist/THIRD_PARTY_NOTICES.txt`. Additional asset notices follow.

## Roboto fonts

The bundled, unmodified `Roboto-Regular.ttf` and `Roboto-Medium.ttf` identify
their license as Apache-2.0 in their embedded metadata:

- Roboto Regular: Copyright 2011 Google Inc. All Rights Reserved.
- Roboto Medium: Copyright 2015 Google Inc. All Rights Reserved.
- Roboto is a trademark of Google.

The license text is in `LICENSES/Apache-2.0.txt`.

## Maputnik design resources

Logos are taken from [maputnik/design](https://github.com/maputnik/design) at
commit `172b06cb062a82f62bb7239474533a110915ef3e`. That snapshot does not declare
a license. Its README requests that logo colors remain unchanged when used
outside Maputnik. The logos are used here as part of Maputnik.

## Icons

The application uses these icon collections through `react-icons`. The wrapper's
MIT license is included in the generated dependency licenses; the collections
retain their own licenses and attributions:

- [Material Design icons](https://github.com/google/material-design-icons):
  Copyright Google Inc.; Apache-2.0
  (`LICENSES/Apache-2.0.txt`).
- [Bootstrap icons](https://github.com/twbs/icons): MIT
  (`LICENSES/Bootstrap-Icons.txt`).
- [Ionicons](https://github.com/ionic-team/ionicons): MIT
  (`LICENSES/Ionicons.txt`).
- [Phosphor icons](https://github.com/phosphor-icons/core): MIT
  (`LICENSES/Phosphor-Icons.txt`).
- [Tabler icons](https://github.com/tabler/tabler-icons): MIT
  (`LICENSES/Tabler-Icons.txt`).
- [Font Awesome Free 5.15.4](https://fontawesome.com/): Copyright Fonticons, Inc.;
  CC-BY-4.0
  (`LICENSES/Font-Awesome-Free.txt` and `LICENSES/CC-BY-4.0.txt`).

The icons are converted to React components by `react-icons`. The icon license
files preserve the upstream attribution and license terms.
