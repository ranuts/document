// Presentation editor theme catalog. The upstream build step that generates
// this file (and the theme<N>/theme.bin binaries + thumbnails it lists) did
// not run for this vendor package: only the source .pptx themes ship under
// src/. Without this file the SDK's SetThemesPath fetches themes//themes.js,
// the SPA fallback answers with HTML and every presentation logs
// "Unexpected token '<'". Declare an empty catalog so the load is clean; a
// populated gallery needs the theme.bin files generated first.
window.AscCommon = window.AscCommon || {};
window.AscCommon.g_defaultThemes = [];
