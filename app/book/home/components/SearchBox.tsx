"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
};

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  function SearchBox(
    {
      value,
      onChange,
      placeholder = "Search books... (press / to focus)",
      onFocus,
    },
    ref
  ) {
    return (
      <label className="relative block w-full max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/12 bg-white/6 px-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
          aria-label="Search books"
        />
      </label>
    );
  }
);
