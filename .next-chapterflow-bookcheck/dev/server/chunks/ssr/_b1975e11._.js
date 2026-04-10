module.exports = [
"[project]/lib/logout.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "performLogout",
    ()=>performLogout
]);
function performLogout() {
    window.location.assign(`/auth/logout?returnTo=${encodeURIComponent(window.location.origin)}`);
}
}),
"[project]/lib/book-covers.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getBookCoverCandidates",
    ()=>getBookCoverCandidates,
    "getBookCoverPath",
    ()=>getBookCoverPath,
    "resolveBookCoverKey",
    ()=>resolveBookCoverKey
]);
const REAL_BOOK_COVER_PATHS = {
    "crucial-conversations": "/book-covers/crucial-conversations.svg",
    "the-power-of-habit": "/book-covers/the-power-of-habit.svg",
    essentialism: "/book-covers/essentialism.svg",
    "make-time": "/book-covers/make-time.svg",
    "what-every-body-is-saying": "/book-covers/what-every-body-is-saying.svg",
    "deep-work": "/book-covers/deep-work.svg",
    "the-prince": "/book-covers/the-prince.svg",
    "tiny-habits": "/book-covers/tiny-habits.svg",
    "predictably-irrational": "/book-covers/predictably-irrational.svg",
    "the-psychology-of-money": "/book-covers/the-psychology-of-money.svg",
    "thinking-fast-and-slow": "/book-covers/thinking-fast-and-slow.svg",
    "the-almanack-of-naval-ravikant": "/book-covers/the-almanack-of-naval-ravikant.svg",
    "the-laws-of-human-nature": "/book-covers/laws-of-human-nature.svg"
};
const BOOK_COVER_ALIASES = {};
function dedupe(values) {
    return [
        ...new Set(values.filter((value)=>Boolean(value)))
    ];
}
function resolveBookCoverKey(bookId, coverId) {
    const rawKey = coverId || bookId;
    return BOOK_COVER_ALIASES[rawKey] ?? rawKey;
}
function getBookCoverPath(bookId, coverId) {
    const coverKey = resolveBookCoverKey(bookId, coverId);
    return REAL_BOOK_COVER_PATHS[coverKey] ?? `/book-covers/${coverId || bookId}.jpg`;
}
function getBookCoverCandidates(bookId) {
    const coverKey = resolveBookCoverKey(bookId);
    return dedupe([
        REAL_BOOK_COVER_PATHS[coverKey],
        `/book-covers/${bookId}.jpg`,
        `/book-covers/${bookId}.jpeg`,
        `/book-covers/${bookId}.png`,
        `/book-covers/${bookId}.webp`,
        `/book-covers/${bookId}.avif`,
        `/book-covers/${bookId}.svg`,
        coverKey !== bookId ? `/book-covers/${coverKey}.jpg` : undefined,
        coverKey !== bookId ? `/book-covers/${coverKey}.jpeg` : undefined,
        coverKey !== bookId ? `/book-covers/${coverKey}.png` : undefined,
        coverKey !== bookId ? `/book-covers/${coverKey}.webp` : undefined,
        coverKey !== bookId ? `/book-covers/${coverKey}.avif` : undefined,
        coverKey !== bookId ? `/book-covers/${coverKey}.svg` : undefined
    ]);
}
}),
"[project]/app/book/components/BookCover.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BookCover",
    ()=>BookCover
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/book-covers.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function getBookCoverCandidates(bookId, coverImage) {
    const localCandidates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverCandidates"])(bookId);
    if (!coverImage) return localCandidates;
    if (localCandidates.includes(coverImage)) {
        return localCandidates;
    }
    return [
        coverImage,
        ...localCandidates
    ];
}
function isExternalSrc(src) {
    return /^https?:\/\//i.test(src);
}
function externalImageLoader({ src }) {
    return src;
}
function BookCover({ bookId, title, icon, coverImage, className, imageClassName, fallbackClassName, sizes = "120px", interactive = true }) {
    const candidates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>getBookCoverCandidates(bookId, coverImage), [
        bookId,
        coverImage
    ]);
    const [activeIndex, setActiveIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const src = candidates[activeIndex];
    const imageClasses = [
        "object-cover bg-(--cf-surface) transition-transform duration-500 ease-out",
        interactive ? "motion-safe:hover:scale-[1.045]" : "",
        imageClassName
    ].filter(Boolean).join(" ");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: [
            "relative aspect-2/3 overflow-hidden rounded-sm shadow-shadow-book transition duration-300 ease-out",
            interactive ? "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-shadow-elevated" : "",
            className
        ].filter(Boolean).join(" "),
        "aria-hidden": "true",
        children: [
            src ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                src: src,
                alt: `${title} cover`,
                fill: true,
                sizes: sizes,
                loading: "lazy",
                className: imageClasses,
                onError: ()=>{
                    setActiveIndex((prev)=>{
                        if (prev + 1 >= candidates.length) {
                            return candidates.length;
                        }
                        return prev + 1;
                    });
                },
                loader: isExternalSrc(src) ? externalImageLoader : undefined,
                unoptimized: true
            }, src, false, {
                fileName: "[project]/app/book/components/BookCover.tsx",
                lineNumber: 74,
                columnNumber: 9
            }, this) : null,
            interactive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(125deg,transparent_15%,var(--cf-surface-strong)_50%,transparent_80%)] opacity-0 transition duration-500 ease-out motion-safe:hover:opacity-100",
                        "aria-hidden": "true"
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/BookCover.tsx",
                        lineNumber: 97,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-transparent transition duration-300 ease-out motion-safe:hover:ring-(--cf-border-strong)",
                        "aria-hidden": "true"
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/BookCover.tsx",
                        lineNumber: 101,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true) : null,
            !src || activeIndex >= candidates.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: [
                    "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-linear-to-br from-(--cf-surface-strong) to-(--cf-surface-muted) px-2 text-center",
                    fallbackClassName
                ].filter(Boolean).join(" "),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-3xl leading-none",
                        children: icon
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/BookCover.tsx",
                        lineNumber: 117,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "line-clamp-3 text-xs font-semibold leading-tight text-(--cf-text-2)",
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/BookCover.tsx",
                        lineNumber: 118,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/components/BookCover.tsx",
                lineNumber: 109,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/app/book/components/BookCover.tsx",
        lineNumber: 63,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/book/data/bookPackages.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BOOK_PACKAGES",
    ()=>BOOK_PACKAGES,
    "BOOK_PACKAGE_PRESENTATION",
    ()=>BOOK_PACKAGE_PRESENTATION,
    "CRUCIAL_CONVERSATIONS_PACKAGE",
    ()=>CRUCIAL_CONVERSATIONS_PACKAGE,
    "CRUCIAL_CONVERSATIONS_RAW_CHAPTERS",
    ()=>CRUCIAL_CONVERSATIONS_RAW_CHAPTERS,
    "DEEP_WORK_PACKAGE",
    ()=>DEEP_WORK_PACKAGE,
    "DEEP_WORK_RAW_CHAPTERS",
    ()=>DEEP_WORK_RAW_CHAPTERS,
    "ESSENTIALISM_PACKAGE",
    ()=>ESSENTIALISM_PACKAGE,
    "ESSENTIALISM_RAW_CHAPTERS",
    ()=>ESSENTIALISM_RAW_CHAPTERS,
    "MAKE_TIME_PACKAGE",
    ()=>MAKE_TIME_PACKAGE,
    "MAKE_TIME_RAW_CHAPTERS",
    ()=>MAKE_TIME_RAW_CHAPTERS,
    "PREDICTABLY_IRRATIONAL_PACKAGE",
    ()=>PREDICTABLY_IRRATIONAL_PACKAGE,
    "PREDICTABLY_IRRATIONAL_RAW_CHAPTERS",
    ()=>PREDICTABLY_IRRATIONAL_RAW_CHAPTERS,
    "THE_ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE",
    ()=>THE_ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE,
    "THE_ALMANACK_OF_NAVAL_RAVIKANT_RAW_CHAPTERS",
    ()=>THE_ALMANACK_OF_NAVAL_RAVIKANT_RAW_CHAPTERS,
    "THE_LAWS_OF_HUMAN_NATURE_PACKAGE",
    ()=>THE_LAWS_OF_HUMAN_NATURE_PACKAGE,
    "THE_LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS",
    ()=>THE_LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS,
    "THE_POWER_OF_HABIT_PACKAGE",
    ()=>THE_POWER_OF_HABIT_PACKAGE,
    "THE_POWER_OF_HABIT_RAW_CHAPTERS",
    ()=>THE_POWER_OF_HABIT_RAW_CHAPTERS,
    "THE_PRINCE_PACKAGE",
    ()=>THE_PRINCE_PACKAGE,
    "THE_PRINCE_RAW_CHAPTERS",
    ()=>THE_PRINCE_RAW_CHAPTERS,
    "THE_PSYCHOLOGY_OF_MONEY_PACKAGE",
    ()=>THE_PSYCHOLOGY_OF_MONEY_PACKAGE,
    "THE_PSYCHOLOGY_OF_MONEY_RAW_CHAPTERS",
    ()=>THE_PSYCHOLOGY_OF_MONEY_RAW_CHAPTERS,
    "THINKING_FAST_AND_SLOW_PACKAGE",
    ()=>THINKING_FAST_AND_SLOW_PACKAGE,
    "THINKING_FAST_AND_SLOW_RAW_CHAPTERS",
    ()=>THINKING_FAST_AND_SLOW_RAW_CHAPTERS,
    "TINY_HABITS_PACKAGE",
    ()=>TINY_HABITS_PACKAGE,
    "TINY_HABITS_RAW_CHAPTERS",
    ()=>TINY_HABITS_RAW_CHAPTERS,
    "WHAT_EVERY_BODY_IS_SAYING_PACKAGE",
    ()=>WHAT_EVERY_BODY_IS_SAYING_PACKAGE,
    "WHAT_EVERY_BODY_IS_SAYING_RAW_CHAPTERS",
    ()=>WHAT_EVERY_BODY_IS_SAYING_RAW_CHAPTERS,
    "getBookPackageById",
    ()=>getBookPackageById,
    "getBookPackageByIdForTone",
    ()=>getBookPackageByIdForTone,
    "getBookPackagePresentation",
    ()=>getBookPackagePresentation,
    "getCrucialConversationsPackageForTone",
    ()=>getCrucialConversationsPackageForTone,
    "getDeepWorkPackageForTone",
    ()=>getDeepWorkPackageForTone,
    "getEssentialismPackageForTone",
    ()=>getEssentialismPackageForTone,
    "getMakeTimePackageForTone",
    ()=>getMakeTimePackageForTone,
    "getPredictablyIrrationalPackageForTone",
    ()=>getPredictablyIrrationalPackageForTone,
    "getTheAlmanackOfNavalRavikantPackageForTone",
    ()=>getTheAlmanackOfNavalRavikantPackageForTone,
    "getTheLawsOfHumanNaturePackageForTone",
    ()=>getTheLawsOfHumanNaturePackageForTone,
    "getThePowerOfHabitPackageForTone",
    ()=>getThePowerOfHabitPackageForTone,
    "getThePrincePackageForTone",
    ()=>getThePrincePackageForTone,
    "getThePsychologyOfMoneyPackageForTone",
    ()=>getThePsychologyOfMoneyPackageForTone,
    "getThinkingFastAndSlowPackageForTone",
    ()=>getThinkingFastAndSlowPackageForTone,
    "getTinyHabitsPackageForTone",
    ()=>getTinyHabitsPackageForTone,
    "getWhatEveryBodyIsSayingPackageForTone",
    ()=>getWhatEveryBodyIsSayingPackageForTone,
    "isV12BookPackage",
    ()=>isV12BookPackage,
    "resolveTone",
    ()=>resolveTone
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$power$2d$of$2d$habit$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-power-of-habit.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$make$2d$time$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/make-time.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$crucial$2d$conversations$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/crucial-conversations.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$what$2d$every$2d$body$2d$is$2d$saying$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/what-every-body-is-saying.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$prince$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-prince.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$tiny$2d$habits$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/tiny-habits.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$essentialism$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/essentialism.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$deep$2d$work$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/deep-work.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$predictably$2d$irrational$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/predictably-irrational.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$thinking$2d$fast$2d$and$2d$slow$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/thinking-fast-and-slow.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$psychology$2d$of$2d$money$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-psychology-of-money.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$laws$2d$of$2d$human$2d$nature$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-laws-of-human-nature.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$almanack$2d$of$2d$naval$2d$ravikant$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-almanack-of-naval-ravikant.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/book-covers.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function resolveTone(value, tone = "direct") {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
        if (typeof value[tone] === "string") return value[tone];
        for (const k of [
            "direct",
            "gentle",
            "competitive"
        ]){
            if (typeof value[k] === "string") return value[k];
        }
    }
    return "";
}
function isV12BookPackage(bookPackage) {
    return bookPackage?.schemaVersion === "1.1.0";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNstdVariant(v, tone = "direct") {
    const summaryBlocks = [];
    // chapterBreakdown → paragraphs (tone-object format, e.g. 48 Laws)
    const chapterBreakdown = resolveTone(v?.chapterBreakdown, tone);
    if (chapterBreakdown) {
        for (const p of chapterBreakdown.split(/\n\n+/).filter((s)=>s.trim())){
            summaryBlocks.push({
                type: "paragraph",
                text: p.trim()
            });
        }
    }
    // keyTakeaways → bullets + string list
    const keyTakeaways = [];
    if (Array.isArray(v?.keyTakeaways)) {
        for (const kt of v.keyTakeaways){
            const point = typeof kt === "string" ? kt : resolveTone(kt?.point, tone);
            if (!point) continue;
            keyTakeaways.push(point);
            const detail = kt?.moreDetails ? resolveTone(kt.moreDetails, tone) : undefined;
            summaryBlocks.push({
                type: "bullet",
                text: point,
                detail
            });
        }
    }
    // oneMinuteRecap → explicit recap items + legacy practice list
    const oneMinuteRecap = [];
    const practice = [];
    if (v?.oneMinuteRecap) {
        if (typeof v.oneMinuteRecap === "object" && v.oneMinuteRecap.retrieve) {
            const retrieve = resolveTone(v.oneMinuteRecap.retrieve, tone);
            const connect = resolveTone(v.oneMinuteRecap.connect, tone);
            const preview = resolveTone(v.oneMinuteRecap.preview, tone);
            if (retrieve) {
                oneMinuteRecap.push(retrieve);
                practice.push(retrieve);
            }
            if (connect) {
                oneMinuteRecap.push(connect);
                practice.push(connect);
            }
            if (preview) {
                oneMinuteRecap.push(preview);
                practice.push(preview);
            }
        } else {
            const recap = resolveTone(v.oneMinuteRecap, tone);
            if (recap) {
                oneMinuteRecap.push(recap);
                practice.push(recap);
            }
        }
    }
    const activationPrompt = v?.activationPrompt ? resolveTone(v.activationPrompt, tone) : undefined;
    const selfCheckPrompt = v?.selfCheckPrompt ? resolveTone(v.selfCheckPrompt, tone) : undefined;
    const selfCheckPrompts = Array.isArray(v?.selfCheckPrompts) ? v.selfCheckPrompts.map((p)=>resolveTone(p, tone)).filter(Boolean) : undefined;
    const predictionPrompt = v?.predictionPrompt ? resolveTone(v.predictionPrompt, tone) : undefined;
    if (selfCheckPrompt) practice.push(selfCheckPrompt);
    if (Array.isArray(selfCheckPrompts)) {
        for (const prompt of selfCheckPrompts)practice.push(prompt);
    }
    if (predictionPrompt) practice.push(predictionPrompt);
    return {
        chapterBreakdown: chapterBreakdown || undefined,
        importantSummary: chapterBreakdown ? chapterBreakdown.split(/\n\n+/)[0]?.trim() : undefined,
        summaryBullets: keyTakeaways.length > 0 ? keyTakeaways : undefined,
        summaryBlocks,
        keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : undefined,
        practice: practice.length > 0 ? practice : undefined,
        oneMinuteRecap: oneMinuteRecap.length > 0 ? oneMinuteRecap : undefined,
        activationPrompt,
        selfCheckPrompt,
        selfCheckPrompts: selfCheckPrompts && selfCheckPrompts.length > 0 ? selfCheckPrompts : undefined,
        predictionPrompt
    };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNstdPackage(raw, tone = "direct") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chapters = (raw.chapters ?? []).map((ch)=>{
        const contentVariants = {};
        for (const key of [
            "easy",
            "medium",
            "hard"
        ]){
            const v = ch.contentVariants?.[key];
            if (v) contentVariants[key] = normalizeNstdVariant(v, tone);
        }
        return {
            chapterId: ch.chapterId,
            number: ch.number,
            title: ch.title,
            readingTimeMinutes: ch.readingTimeMinutes,
            contentVariants,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            examples: (ch.examples ?? []).map((ex)=>({
                    exampleId: ex.exampleId,
                    title: ex.title,
                    scenario: resolveTone(ex.scenario, tone),
                    whatToDo: Array.isArray(ex.whatToDo) ? ex.whatToDo.map((step)=>resolveTone(step, tone)).filter(Boolean) : [
                        resolveTone(ex.whatToDo, tone)
                    ].filter(Boolean),
                    whyItMatters: resolveTone(ex.whyItMatters, tone),
                    contexts: ex.contexts ?? (ex.category ? [
                        ex.category
                    ] : []),
                    reflectionPrompt: ex.reflectionPrompt ? resolveTone(ex.reflectionPrompt, tone) : undefined
                })),
            quiz: {
                passingScorePercent: ch.quiz?.passingScorePercent ?? 80,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                questions: (ch.quiz?.questions ?? []).map((q)=>({
                        questionId: q.questionId,
                        prompt: q.prompt ?? q.stem,
                        choices: q.choices ?? q.options,
                        correctIndex: q.correctIndex ?? q.correctAnswerIndex,
                        explanation: resolveTone(q.explanation, tone)
                    })),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                retryQuestions: (ch.quiz?.retryQuestions ?? []).map((q)=>({
                        questionId: q.questionId,
                        prompt: q.prompt ?? q.stem,
                        choices: q.choices ?? q.options,
                        correctIndex: q.correctIndex ?? q.correctAnswerIndex,
                        explanation: resolveTone(q.explanation, tone)
                    }))
            },
            implementationPlan: ch.implementationPlan ? {
                coreSkill: resolveTone(ch.implementationPlan.coreSkill, tone),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ifThenPlans: (ch.implementationPlan.ifThenPlans ?? []).map((item)=>({
                        context: item.context ?? "",
                        plan: resolveTone(item.plan, tone)
                    })),
                twentyFourHourChallenge: resolveTone(ch.implementationPlan.twentyFourHourChallenge, tone),
                weeklyPractice: resolveTone(ch.implementationPlan.weeklyPractice, tone)
            } : undefined,
            reviewCards: Array.isArray(ch.reviewCards) ? ch.reviewCards.map((card, index)=>({
                    cardId: card.cardId ?? `rc-${index + 1}`,
                    front: resolveTone(card.front, tone),
                    back: resolveTone(card.back, tone),
                    difficulty: card.difficulty ?? "easy"
                })) : undefined,
            keyTakeawayCard: ch.keyTakeawayCard ? resolveTone(ch.keyTakeawayCard, tone) : undefined
        };
    });
    return {
        schemaVersion: raw.schemaVersion,
        packageId: raw.packageId,
        createdAt: raw.createdAt,
        contentOwner: raw.contentOwner,
        book: raw.book,
        chapters
    };
}
const THE_POWER_OF_HABIT_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$power$2d$of$2d$habit$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const THE_POWER_OF_HABIT_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$power$2d$of$2d$habit$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getThePowerOfHabitPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$power$2d$of$2d$habit$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const MAKE_TIME_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$make$2d$time$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const MAKE_TIME_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$make$2d$time$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getMakeTimePackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$make$2d$time$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const CRUCIAL_CONVERSATIONS_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$crucial$2d$conversations$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const CRUCIAL_CONVERSATIONS_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$crucial$2d$conversations$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getCrucialConversationsPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$crucial$2d$conversations$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const WHAT_EVERY_BODY_IS_SAYING_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$what$2d$every$2d$body$2d$is$2d$saying$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const WHAT_EVERY_BODY_IS_SAYING_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$what$2d$every$2d$body$2d$is$2d$saying$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getWhatEveryBodyIsSayingPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$what$2d$every$2d$body$2d$is$2d$saying$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const THE_PRINCE_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$prince$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const THE_PRINCE_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$prince$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getThePrincePackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$prince$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const TINY_HABITS_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$tiny$2d$habits$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const TINY_HABITS_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$tiny$2d$habits$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getTinyHabitsPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$tiny$2d$habits$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const ESSENTIALISM_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$essentialism$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const ESSENTIALISM_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$essentialism$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getEssentialismPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$essentialism$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const DEEP_WORK_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$deep$2d$work$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const DEEP_WORK_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$deep$2d$work$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getDeepWorkPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$deep$2d$work$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const PREDICTABLY_IRRATIONAL_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$predictably$2d$irrational$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const PREDICTABLY_IRRATIONAL_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$predictably$2d$irrational$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getPredictablyIrrationalPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$predictably$2d$irrational$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const THINKING_FAST_AND_SLOW_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$thinking$2d$fast$2d$and$2d$slow$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const THINKING_FAST_AND_SLOW_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$thinking$2d$fast$2d$and$2d$slow$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getThinkingFastAndSlowPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$thinking$2d$fast$2d$and$2d$slow$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const THE_PSYCHOLOGY_OF_MONEY_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$psychology$2d$of$2d$money$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const THE_PSYCHOLOGY_OF_MONEY_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$psychology$2d$of$2d$money$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getThePsychologyOfMoneyPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$psychology$2d$of$2d$money$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const THE_LAWS_OF_HUMAN_NATURE_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$laws$2d$of$2d$human$2d$nature$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const THE_LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$laws$2d$of$2d$human$2d$nature$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getTheLawsOfHumanNaturePackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$laws$2d$of$2d$human$2d$nature$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const THE_ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE = normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$almanack$2d$of$2d$naval$2d$ravikant$2e$modern$2e$json__$28$json$29$__["default"], "direct");
const THE_ALMANACK_OF_NAVAL_RAVIKANT_RAW_CHAPTERS = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$almanack$2d$of$2d$naval$2d$ravikant$2e$modern$2e$json__$28$json$29$__["default"].chapters ?? [];
function getTheAlmanackOfNavalRavikantPackageForTone(tone) {
    return normalizeNstdPackage(__TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$almanack$2d$of$2d$naval$2d$ravikant$2e$modern$2e$json__$28$json$29$__["default"], tone);
}
const BOOK_PACKAGES = [
    THE_POWER_OF_HABIT_PACKAGE,
    MAKE_TIME_PACKAGE,
    ESSENTIALISM_PACKAGE,
    CRUCIAL_CONVERSATIONS_PACKAGE,
    WHAT_EVERY_BODY_IS_SAYING_PACKAGE,
    THE_PRINCE_PACKAGE,
    TINY_HABITS_PACKAGE,
    DEEP_WORK_PACKAGE,
    PREDICTABLY_IRRATIONAL_PACKAGE,
    THINKING_FAST_AND_SLOW_PACKAGE,
    THE_PSYCHOLOGY_OF_MONEY_PACKAGE,
    THE_LAWS_OF_HUMAN_NATURE_PACKAGE,
    THE_ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE
];
const BOOK_PACKAGE_TONE_GETTERS = {
    "the-power-of-habit": getThePowerOfHabitPackageForTone,
    "make-time": getMakeTimePackageForTone,
    "essentialism": getEssentialismPackageForTone,
    "crucial-conversations": getCrucialConversationsPackageForTone,
    "what-every-body-is-saying": getWhatEveryBodyIsSayingPackageForTone,
    "the-prince": getThePrincePackageForTone,
    "tiny-habits": getTinyHabitsPackageForTone,
    "deep-work": getDeepWorkPackageForTone,
    "predictably-irrational": getPredictablyIrrationalPackageForTone,
    "thinking-fast-and-slow": getThinkingFastAndSlowPackageForTone,
    "the-psychology-of-money": getThePsychologyOfMoneyPackageForTone,
    "the-laws-of-human-nature": getTheLawsOfHumanNaturePackageForTone,
    "the-almanack-of-naval-ravikant": getTheAlmanackOfNavalRavikantPackageForTone
};
const BOOK_PACKAGE_PRESENTATION = {
    "the-power-of-habit": {
        icon: "🧭",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("the-power-of-habit"),
        difficulty: "Medium",
        synopsis: "A modern reading of cues, cravings, willpower, organizational routines, social movements, and the question of responsibility inside automatic behavior.",
        pages: 371
    },
    "make-time": {
        icon: "⏳",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("make-time"),
        difficulty: "Medium",
        synopsis: "A practical guide to reclaiming attention day by day through a clear Highlight, better focus defenses, stronger energy, and a lightweight reflection loop.",
        pages: 304
    },
    "crucial-conversations": {
        icon: "💬",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("crucial-conversations"),
        difficulty: "Medium",
        synopsis: "A practical guide to high-stakes dialogue: spotting crucial conversations early, avoiding silence and force, restoring safety, and turning hard talks into real action.",
        pages: 336
    },
    "what-every-body-is-saying": {
        icon: "👁️",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("what-every-body-is-saying"),
        difficulty: "Medium",
        synopsis: "A practical guide to reading nonverbal behavior with more discipline: noticing comfort, discomfort, confidence, stress, and withdrawal without turning one cue into false certainty."
    },
    "the-prince": {
        icon: "👑",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("the-prince"),
        difficulty: "Hard",
        synopsis: "A modern reading of political founding, power, arms, fortune, reputation, and statecraft across Machiavelli's twenty-six chapters.",
        pages: 176
    },
    "tiny-habits": {
        icon: "🌱",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("tiny-habits"),
        difficulty: "Medium",
        synopsis: "A modern reading of BJ Fogg's behavior design method: matching motivation, making habits tiny, anchoring prompts, using celebration, untangling bad loops, and growing change through shared support."
    },
    essentialism: {
        icon: "🎯",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("essentialism"),
        difficulty: "Medium",
        synopsis: "A modern reading of Greg McKeown's framework for choosing the vital few, cutting the trivial many, and building a life around less but better.",
        pages: 288
    },
    "deep-work": {
        icon: "🧠",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("deep-work"),
        difficulty: "Medium",
        synopsis: "A modern reading of focus, distraction, scheduling, boredom training, tool selection, and shallow-work control for people trying to build a deeper working life.",
        pages: 304
    },
    "predictably-irrational": {
        icon: "🧪",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("predictably-irrational"),
        difficulty: "Medium",
        synopsis: "A modern reading of Dan Ariely's thirteen chapters on relativity, anchoring, zero price, norms, expectations, dishonesty, and practical design fixes for predictable decision errors."
    },
    "thinking-fast-and-slow": {
        icon: "🧠",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("thinking-fast-and-slow"),
        difficulty: "Hard",
        synopsis: "A modern reading of Kahneman's thirty-eight chapters on System 1 and System 2, heuristics, bias, prospect theory, overconfidence, and the limits of judgment under uncertainty.",
        pages: 499
    },
    "the-psychology-of-money": {
        icon: "💸",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("the-psychology-of-money"),
        difficulty: "Medium",
        synopsis: "A modern reading of Morgan Housel's twenty-two chapters on luck, risk, enoughness, compounding, saving, freedom, pessimism, and the historical forces shaping consumer expectations.",
        pages: 256
    },
    "the-laws-of-human-nature": {
        icon: "🧠",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("the-laws-of-human-nature"),
        difficulty: "Hard",
        synopsis: "A modern reading of Robert Greene's nineteen chapters on irrationality, narcissism, role-playing, envy, conformity, aggression, historical mood, and mortality across everyday human behavior.",
        pages: 624
    },
    "the-almanack-of-naval-ravikant": {
        icon: "🧭",
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])("the-almanack-of-naval-ravikant"),
        difficulty: "Medium",
        synopsis: "A modern reading of Naval Ravikant's six-part guide to wealth, judgment, happiness, self-governance, philosophy, and the reading life behind those ideas."
    }
};
function getBookPackageById(bookId) {
    return BOOK_PACKAGES.find((pkg)=>pkg.book.bookId === bookId);
}
function getBookPackageByIdForTone(bookId, tone = "direct") {
    const getter = BOOK_PACKAGE_TONE_GETTERS[bookId];
    return getter ? getter(tone) : getBookPackageById(bookId);
}
function formatSynopsisTopics(topics) {
    if (topics.length === 0) return "practical thinking and real world decision making";
    if (topics.length === 1) return topics[0];
    if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
    return `${topics.slice(0, -1).join(", ")}, and ${topics[topics.length - 1]}`;
}
function hashText(value) {
    let hash = 0;
    for(let i = 0; i < value.length; i += 1){
        hash = (hash << 5) - hash + value.charCodeAt(i) | 0;
    }
    return Math.abs(hash);
}
function inferPresentationIcon(bookPackage) {
    const categories = Array.isArray(bookPackage.book.categories) ? bookPackage.book.categories.filter(Boolean) : [];
    const tags = Array.isArray(bookPackage.book.tags) ? bookPackage.book.tags.filter(Boolean) : [];
    const source = [
        bookPackage.book.title,
        ...categories,
        ...tags
    ].join(" ").toLowerCase();
    const normalized = source.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const tokenSet = new Set(normalized.split(" ").filter(Boolean));
    const hasAny = (...terms)=>{
        return terms.some((term)=>{
            const cleanTerm = term.toLowerCase().trim();
            if (!cleanTerm) return false;
            if (cleanTerm.includes(" ")) return normalized.includes(cleanTerm);
            return tokenSet.has(cleanTerm);
        });
    };
    if (hasAny("black swan", "swan")) return "🦢";
    if (hasAny("checklist")) return "✅";
    if (hasAny("forecast", "superforecasting")) return "🔮";
    if (hasAny("mental model", "mental models")) return "🧩";
    if (hasAny("denial of death", "death")) return "🕯️";
    if (hasAny("gift of fear", "fear")) return "🚨";
    if (hasAny("ultralearning")) return "📚";
    if (hasAny("innovators dilemma", "innovation")) return "💡";
    if (hasAny("noise")) return "📉";
    if (hasAny("peak")) return "🏔️";
    if (hasAny("war")) return "⚔️";
    if (hasAny("money", "wealth", "finance")) return "💰";
    const strategyPool = [
        "♟️",
        "🧠",
        "🧭",
        "🎯",
        "⚖️"
    ];
    const productivityPool = [
        "⏱️",
        "📌",
        "🗂️",
        "✅",
        "🎯"
    ];
    const learningPool = [
        "📘",
        "🧠",
        "📚",
        "🧪",
        "🛠️"
    ];
    const communicationPool = [
        "💬",
        "🗣️",
        "🤝",
        "🎤",
        "📣"
    ];
    const philosophyPool = [
        "🏛️",
        "🕯️",
        "📜",
        "🧭",
        "⚖️"
    ];
    const businessPool = [
        "📈",
        "🏢",
        "💼",
        "📊",
        "🚀"
    ];
    const psychologyPool = [
        "🧠",
        "🫀",
        "🧭",
        "🧩",
        "👁️"
    ];
    const generalPool = [
        "📘",
        "📗",
        "📙",
        "📕",
        "📓"
    ];
    let pool = generalPool;
    if (source.includes("strategy")) pool = strategyPool;
    else if (source.includes("productivity")) pool = productivityPool;
    else if (source.includes("learning") || source.includes("skill")) pool = learningPool;
    else if (source.includes("communication") || source.includes("negotiation")) pool = communicationPool;
    else if (source.includes("philosophy") || source.includes("meaning")) pool = philosophyPool;
    else if (source.includes("business") || source.includes("startup")) pool = businessPool;
    else if (source.includes("psychology") || source.includes("behavior")) pool = psychologyPool;
    return pool[hashText(bookPackage.book.bookId) % pool.length];
}
function inferPresentationDifficulty(categories) {
    const source = categories.join(" ").toLowerCase();
    if (source.includes("strategy") || source.includes("philosophy") || source.includes("decision making")) {
        return "Hard";
    }
    if (source.includes("productivity") || source.includes("learning") || source.includes("communication")) {
        return "Medium";
    }
    return "Medium";
}
function inferFallbackPresentation(bookId) {
    const bookPackage = getBookPackageById(bookId);
    if (!bookPackage) {
        return {
            icon: "📘",
            coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])(bookId),
            difficulty: "Medium",
            synopsis: "A focused, chapter-based learning experience with examples, quizzes, and measurable progress."
        };
    }
    const categories = Array.isArray(bookPackage.book.categories) ? bookPackage.book.categories.filter(Boolean) : [];
    const tags = Array.isArray(bookPackage.book.tags) ? bookPackage.book.tags.filter(Boolean) : [];
    const topics = [
        ...new Set([
            ...tags,
            ...categories
        ].map((item)=>item.toLowerCase()))
    ].slice(0, 5);
    const totalMinutes = bookPackage.chapters.reduce((sum, chapter)=>sum + Math.max(chapter.readingTimeMinutes, 1), 0);
    return {
        icon: inferPresentationIcon(bookPackage),
        coverImage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverPath"])(bookId),
        difficulty: inferPresentationDifficulty(categories),
        synopsis: `A modern reading of ${formatSynopsisTopics(topics)} with concise summaries, scenarios, quizzes, and gated chapter progression.`,
        pages: Math.max(160, Math.round(totalMinutes * 3.2))
    };
}
function getBookPackagePresentation(bookId) {
    return BOOK_PACKAGE_PRESENTATION[bookId] ?? inferFallbackPresentation(bookId);
}
}),
"[project]/app/book/data/booksCatalog.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BOOKS_CATALOG",
    ()=>BOOKS_CATALOG,
    "getBookById",
    ()=>getBookById,
    "getBookCoverCandidates",
    ()=>getBookCoverCandidates,
    "getBookSynopsis",
    ()=>getBookSynopsis
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$bookPackages$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/data/bookPackages.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/book-covers.ts [app-ssr] (ecmascript)");
;
;
function totalReadingMinutes(chapters) {
    return chapters.reduce((sum, chapter)=>sum + Math.max(chapter.readingTimeMinutes, 1), 0);
}
const BOOKS_CATALOG = __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$bookPackages$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["BOOK_PACKAGES"].map((pkg)=>{
    const presentation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$bookPackages$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookPackagePresentation"])(pkg.book.bookId);
    return {
        id: pkg.book.bookId,
        icon: presentation.icon,
        coverImage: presentation.coverImage,
        title: pkg.book.title,
        author: pkg.book.author,
        category: pkg.book.categories[0] ?? "General",
        categories: pkg.book.categories,
        difficulty: presentation.difficulty,
        estimatedMinutes: totalReadingMinutes(pkg.chapters)
    };
});
function getBookById(bookId) {
    return BOOKS_CATALOG.find((book)=>book.id === bookId);
}
const PREFER_GENERATED_COVER_IDS = new Set([]);
function getBookCoverCandidates(book) {
    const realFirstCandidates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$book$2d$covers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookCoverCandidates"])(book.id);
    const generatedFirstCandidates = [
        `/book-covers/${book.id}.svg`,
        ...realFirstCandidates.filter((candidate)=>candidate !== `/book-covers/${book.id}.svg`)
    ];
    const localCandidates = PREFER_GENERATED_COVER_IDS.has(book.id) ? generatedFirstCandidates : realFirstCandidates;
    if (!book.coverImage) return localCandidates;
    if (localCandidates.includes(book.coverImage)) return localCandidates;
    return [
        book.coverImage,
        ...localCandidates
    ];
}
function getBookSynopsis(bookId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$bookPackages$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getBookPackagePresentation"])(bookId).synopsis;
}
}),
];

//# sourceMappingURL=_b1975e11._.js.map