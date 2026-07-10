// Entry for the vendored ranui IIFE bundle (public/ranui.iife.js), built by
// vite.ranui-iife.config.ts via bin/build.sh. The static pages under public/
// (zh-CN homepage, /open/*, /convert/*, /vs/*, ...) have no bundler, so they
// <script defer> this bundle to register the same ranui web components the app
// homepage uses — keeping every page on real <r-button>/<r-card>/<r-select>
// instead of hand-styled fallbacks. Keep this list minimal: each import pulls
// its component into the bundle, and satellite pages are SEO entry points where
// payload size matters.
import 'ranui/button';
import 'ranui/card';
import 'ranui/select';
