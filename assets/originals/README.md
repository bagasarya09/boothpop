# Original image assets

PNG originals are kept here before WebP conversion, with their original dimensions and transparency. This directory is outside `public`, so Vite does not include these backups in the deployed website.

The live assets are WebP files in `public/`. To publish a new revision, export the design with a new filename to `public/frames/`, register it in `templates.json`, and run `npm run optimize:images`. Conversion stops if a WebP or backup with the same name already exists, so previous designs are not overwritten accidentally.
