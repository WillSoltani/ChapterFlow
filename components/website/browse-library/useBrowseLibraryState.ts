"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  ALL_BOOKS,
  filterAndSortBooks,
  getCategoriesWithCounts,
  type SortOption,
} from "./browse-library-core";

export function useBrowseLibraryState() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [requestTitle, setRequestTitle] = useState("");
  const requestSectionRef = useRef<HTMLDivElement>(null);
  const seededFromUrl = useRef(false);

  const categories = useMemo(() => getCategoriesWithCounts(ALL_BOOKS), []);

  // Prefill the request form with the searched title and scroll to it. Used by
  // the zero-results states so the "Request this book" affordance is real.
  const handleRequestBook = useCallback((title: string) => {
    setRequestTitle(title.trim());
    track("book_request_prefill", { source: "browse_zero_results", title: title.trim() });
    requestAnimationFrame(() => {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      requestSectionRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    });
  }, []);

  // Seed the search from a ?q= URL param (deep links from JSON-LD / the
  // WebSite SearchAction, e.g. /books?q=Deep%20Work). Client-only read, guarded
  // so it seeds state exactly once (never re-fires setState on a later render
  // or a StrictMode/fast-refresh remount).
  useEffect(() => {
    if (seededFromUrl.current) return;
    seededFromUrl.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      // One-time seed from the client-only URL query on mount. A lazy useState
      // initializer would read window during SSR (hydration mismatch) and
      // useSearchParams() would force a Suspense boundary on this client page,
      // so a ref-guarded mount effect is the correct pattern here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery(q);
      setDebouncedQuery(q);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filteredBooks = useMemo(
    () => filterAndSortBooks(ALL_BOOKS, { category: activeCategory, query: debouncedQuery, sort: sortBy }),
    [activeCategory, debouncedQuery, sortBy],
  );

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat);
    track("library_category_filter", { category: cat });
  }, []);

  const handleSortChange = useCallback((s: SortOption) => {
    setSortBy(s);
    track("library_sort_change", { sort: s });
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setActiveCategory("All");
  }, []);

  return {
    activeCategory,
    categories,
    debouncedQuery,
    filteredBooks,
    handleCategoryChange,
    handleClearSearch,
    handleRequestBook,
    handleSortChange,
    isAllView: activeCategory === "All" && !debouncedQuery.trim(),
    requestSectionRef,
    requestTitle,
    searchQuery,
    setSearchQuery,
    sortBy,
  };
}
