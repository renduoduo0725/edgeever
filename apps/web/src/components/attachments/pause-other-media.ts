const MEDIA_PLAYER_SELECTOR = "audio[data-edgeever-audio-player], video[data-edgeever-video-player]";

export const pauseOtherMediaPlayers = (activePlayer: HTMLMediaElement) => {
  activePlayer.ownerDocument
    .querySelectorAll<HTMLMediaElement>(MEDIA_PLAYER_SELECTOR)
    .forEach((player) => {
      if (player !== activePlayer) player.pause();
    });
};
