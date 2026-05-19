# WEM Project Page

This repository contains the static project page for **World-Ego Modeling (WEM)**:

> World-Ego Modeling for Long-Horizon Evolution in Hybrid Embodied Tasks

The page is designed for GitHub Pages and can be served directly from `index.html`.

## Project Summary

WEM studies long-horizon embodied video world modeling. The core idea is to separate future prediction into two complementary roles:

- **World evolution**: persistent, instruction-agnostic scene regularities.
- **Ego dynamics**: robot-centric, instruction-conditioned behavior.

The page presents the paper overview, method, benchmark, quantitative tables, qualitative videos, and citation information.

## Repository Structure

- `index.html` - main project page content and metadata.
- `static/css/` - Bulma, FontAwesome, and local page styles.
- `static/js/` - local page interactions and icon support.
- `static/images/` - WEM figures, preview images, and video posters.
- `static/videos/` - teaser and qualitative result videos.
- `static/pdfs/` - paper and supplementary material.

## Assets To Add

The page currently expects these WEM assets:

- `static/images/teaser.png`
- `static/images/social_preview.png`
- `static/images/framework.png`
- `static/images/model.png`
- `static/images/dataset.png`
- `static/videos/move_basket.mov`
- `static/videos/put_pizza.mov`
- `static/videos/pick_up_candles.mov`
- `static/videos/pick_up_trash_can.mov`
- `static/videos/kitchen.mov`
- `static/videos/get_trash_bin.mov`
- `static/pdfs/paper.pdf`
- `static/pdfs/supplementary_material.pdf`

Update the anonymous author, institution, submission, code, and dataset placeholders in `index.html` when the public information is ready.

## Local Preview

Because this is a static site, opening `index.html` in a browser is enough for a quick preview. For a local HTTP preview:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Provenance

This WEM page is built on top of the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template), which itself was adapted from the [Nerfies](https://nerfies.github.io/) project page. Template-specific demo content, sample media, and unused template components have been removed while the attribution notice is preserved in the page footer.
