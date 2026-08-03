"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { CelebrationEvent } from "@/app/book/settings/types/settings";
import { generateSwipeDeck, getTopPicks } from "../data/recommendations";
import { useOnboarding } from "./useOnboarding";
import {
  MAX_STARTER_SHELF_PICKS,
  advanceStarterShelfSelection,
  buildStarterShelf,
  createStarterShelfSelection,
  getStarterShelfFillerPicks,
  type StarterShelfSwipeDirection,
} from "./starter-shelf-selection-core";

interface UseStarterShelfSelectionOptions {
  onNext: () => void;
}

export function useStarterShelfSelection({ onNext }: UseStarterShelfSelectionOptions) {
  const { motivation, interests, setStarterShelf } = useOnboarding();
  const reducedMotion = useReducedMotion();
  const deck = useMemo(
    () => generateSwipeDeck(interests, motivation),
    [interests, motivation],
  );
  const [selection, setSelection] = useState(createStarterShelfSelection);
  const [celebEvent, setCelebEvent] = useState<CelebrationEvent | null>(null);
  const [likeCount, setLikeCount] = useState(0);

  // Set synchronously by the mounted swipe card so buttons and keyboard input
  // always call the current animation controller and share its busy guard.
  const buttonSwipeRef = useRef<
    ((direction: StarterShelfSwipeDirection) => void) | null
  >(null);

  const { currentIndex, selectedBooks, rejectedIds, isComplete } = selection;
  const frontBook = currentIndex < deck.length ? deck[currentIndex] : null;

  const handleSwipe = useCallback(
    (direction: StarterShelfSwipeDirection) => {
      if (!frontBook) return;

      const nextSelection = advanceStarterShelfSelection(
        selection,
        frontBook,
        direction,
      );

      if (direction === "right") {
        setCelebEvent("profile-selected");
        setLikeCount((count) => count + 1);
      }

      setSelection(nextSelection);
      if (nextSelection.isComplete) {
        setStarterShelf(nextSelection.selectedBooks);
      }
    },
    [frontBook, selection, setStarterShelf],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isComplete || !frontBook) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        buttonSwipeRef.current?.("right");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        buttonSwipeRef.current?.("left");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isComplete, frontBook]);

  const backBooks = deck.slice(currentIndex + 1, currentIndex + 3);
  const selectedCount = selectedBooks.length;
  const deckEmpty = !frontBook && selectedCount < MAX_STARTER_SHELF_PICKS;

  const fillerPicks = useMemo(() => {
    if (!deckEmpty) return [];

    const remainingSlots = MAX_STARTER_SHELF_PICKS - selectedCount;
    const recommendations = getTopPicks(
      interests,
      motivation,
      [...selectedBooks.map(({ id }) => id), ...rejectedIds],
      remainingSlots,
    );

    return getStarterShelfFillerPicks(
      recommendations,
      selectedBooks,
      rejectedIds,
      remainingSlots,
    );
  }, [deckEmpty, interests, motivation, rejectedIds, selectedBooks, selectedCount]);

  const handleContinueWithPicks = useCallback(() => {
    const finalShelf = buildStarterShelf(selectedBooks, fillerPicks);
    setStarterShelf(finalShelf);
    onNext();
  }, [selectedBooks, fillerPicks, setStarterShelf, onNext]);

  const handleComplete = useCallback(() => {
    onNext();
  }, [onNext]);

  return {
    backBooks,
    buttonSwipeRef,
    celebEvent,
    currentIndex,
    deck,
    deckEmpty,
    fillerPicks,
    frontBook,
    handleComplete,
    handleContinueWithPicks,
    handleSwipe,
    isComplete,
    likeCount,
    reducedMotion,
    selectedBooks,
    selectedCount,
  };
}
