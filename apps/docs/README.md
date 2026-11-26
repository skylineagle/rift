# Rift docs

The user and developer manuals, built with [Fumadocs](https://fumadocs.dev) and exported as a static site.

```sh
bun install
bun run dev      # http://localhost:3000
bun run build    # static site in out/
```

Pages live in `content/docs/`. Screenshots live in `public/screenshots/`.

`.github/workflows/docs.yml` builds the site on pull requests and deploys it to GitHub Pages on pushes to `main`.
