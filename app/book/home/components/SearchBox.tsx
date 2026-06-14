"use client";

import { forwardRef, type KeyboardEventHandler } from "react";
import { Search } from "lucide-react";

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** combobox a11y — set when a results listbox is wired up. */
  expanded?: boolean;
  controlsId?: string;
  activeDescendantId?: string;
};

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  function SearchBox(
    {
      value,
      onChange,
      placeholder = "Search books... (press / to focus)",
      onFocus,
      onKeyDown,
      expanded,
      controlsId,
      activeDescendantId,
    },
    ref
  ) {
    return (
      <label className="relative block w-full max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--cf-text-3)" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="cf-input w-full rounded-2xl px-10 py-2.5 text-sm"
          aria-label="Search books"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded ?? false}
          aria-controls={expanded ? controlsId : undefined}
          aria-activedescendant={expanded ? activeDescendantId : undefined}
        />
      </label>
    );
  }
);
