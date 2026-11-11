// The print's typefaces: a calligraphic script for place names and a book serif for numbers and era letters.
// Started loading at module load, because the engine draws canvas text once and caches the texture.
import "@fontsource/dancing-script/700.css";
import "@fontsource/eb-garamond/500.css";
import "@fontsource/eb-garamond/700.css";

export const PRINT_SCRIPT = "'Dancing Script', cursive";
export const PRINT_SERIF = "'EB Garamond', serif";

if (typeof document !== "undefined") {
  void document.fonts?.load("700 32px 'Dancing Script'");
  void document.fonts?.load("500 32px 'EB Garamond'");
  void document.fonts?.load("700 32px 'EB Garamond'");
}
