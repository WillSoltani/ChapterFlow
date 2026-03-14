"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extForFormat = extForFormat;
exports.contentTypeFor = contentTypeFor;
exports.replaceExt = replaceExt;
exports.stripExt = stripExt;
exports.isImageOutputFormat = isImageOutputFormat;
function extForFormat(fmt) {
    const map = {
        PNG: "png",
        JPG: "jpg",
        WebP: "webp",
        GIF: "gif",
        TIFF: "tiff",
        AVIF: "avif",
        HEIC: "heic",
        HEIF: "heif",
        BMP: "bmp",
        ICO: "ico",
        SVG: "svg",
        PDF: "pdf",
    };
    return map[fmt];
}
function contentTypeFor(fmt) {
    const map = {
        PNG: "image/png",
        JPG: "image/jpeg",
        WebP: "image/webp",
        GIF: "image/gif",
        TIFF: "image/tiff",
        AVIF: "image/avif",
        HEIC: "image/heic",
        HEIF: "image/heif",
        BMP: "image/bmp",
        ICO: "image/x-icon",
        SVG: "image/svg+xml",
        PDF: "application/pdf",
    };
    return map[fmt];
}
function replaceExt(filename, ext) {
    const dot = filename.lastIndexOf(".");
    return (dot < 0 ? filename : filename.slice(0, dot)) + "." + ext;
}
function stripExt(filename) {
    const dot = filename.lastIndexOf(".");
    return dot < 0 ? filename : filename.slice(0, dot);
}
function isImageOutputFormat(fmt) {
    return fmt !== "PDF";
}
