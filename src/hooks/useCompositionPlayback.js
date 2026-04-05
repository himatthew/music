import { useCallback, useEffect, useMemo, useState } from "react";
import {
  beginPagePlayback,
  playAllPagesMelody,
  playPageMelody,
  preloadAllNoteBuffers,
  stopAllPlayback,
} from "../audioPlayback.js";

/**
 * 主界面「试听本页」与总谱「试听全曲 / 试听本页」的播放态与互斥
 */
export function useCompositionPlayback({ sceneIndex, states }) {
  const [allMelodyPlaying, setAllMelodyPlaying] = useState(false);
  const [fullSheetPlayingPage, setFullSheetPlayingPage] = useState(null);
  const [pagePreviewPlaying, setPagePreviewPlaying] = useState(false);

  const state = states[sceneIndex];
  const selections = state.selections;

  const pagesSelectionsAll = useMemo(
    () => states.map((st) => st.selections.map((row) => [...row])),
    [states]
  );

  const audioPlaybackBusy =
    pagePreviewPlaying || allMelodyPlaying || fullSheetPlayingPage !== null;

  const stopAllPlaybackAndResetUI = useCallback(() => {
    stopAllPlayback();
    setPagePreviewPlaying(false);
    setAllMelodyPlaying(false);
    setFullSheetPlayingPage(null);
  }, []);

  useEffect(() => {
    stopAllPlayback();
    setPagePreviewPlaying(false);
    setAllMelodyPlaying(false);
    setFullSheetPlayingPage(null);
  }, [sceneIndex]);

  const playCurrentPageMelody = useCallback(async () => {
    if (pagePreviewPlaying) {
      stopAllPlayback();
      setPagePreviewPlaying(false);
      return;
    }
    if (audioPlaybackBusy) return;
    await preloadAllNoteBuffers();
    const token = beginPagePlayback();
    setPagePreviewPlaying(true);
    try {
      await playPageMelody(selections, token);
    } finally {
      setPagePreviewPlaying(false);
    }
  }, [selections, audioPlaybackBusy, pagePreviewPlaying]);

  const playAllMelody = useCallback(async () => {
    if (allMelodyPlaying) {
      stopAllPlayback();
      setAllMelodyPlaying(false);
      return;
    }
    if (audioPlaybackBusy) return;
    await preloadAllNoteBuffers();
    const token = beginPagePlayback();
    setAllMelodyPlaying(true);
    try {
      await playAllPagesMelody(pagesSelectionsAll, token);
    } finally {
      setAllMelodyPlaying(false);
    }
  }, [pagesSelectionsAll, audioPlaybackBusy, allMelodyPlaying]);

  const playFullSheetPageAt = useCallback(
    async (pi) => {
      if (fullSheetPlayingPage === pi) {
        stopAllPlayback();
        setFullSheetPlayingPage(null);
        return;
      }
      if (audioPlaybackBusy) return;
      await preloadAllNoteBuffers();
      const token = beginPagePlayback();
      setFullSheetPlayingPage(pi);
      try {
        await playPageMelody(states[pi].selections, token);
      } finally {
        setFullSheetPlayingPage(null);
      }
    },
    [states, audioPlaybackBusy, fullSheetPlayingPage]
  );

  return {
    pagePreviewPlaying,
    allMelodyPlaying,
    fullSheetPlayingPage,
    audioPlaybackBusy,
    playCurrentPageMelody,
    playAllMelody,
    playFullSheetPageAt,
    stopAllPlaybackAndResetUI,
  };
}
