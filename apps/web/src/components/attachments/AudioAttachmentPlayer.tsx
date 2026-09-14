import { useState, type SyntheticEvent } from "react";
import { pauseOtherMediaPlayers } from "./pause-other-media";

export const AudioAttachmentPlayer = ({
  src,
  label,
  unavailableMessage,
}: {
  src: string;
  label: string;
  unavailableMessage: string;
}) => {
  const [failed, setFailed] = useState(false);

  const handlePlay = (event: SyntheticEvent<HTMLAudioElement>) => {
    pauseOtherMediaPlayers(event.currentTarget);
  };

  if (failed) {
    return (
      <span className="flex min-h-10 items-center px-3 text-sm text-slate-500" role="status">
        {unavailableMessage}
      </span>
    );
  }

  return (
    <audio
      className="h-10 w-full"
      controls
      controlsList="nodownload"
      data-edgeever-audio-player
      preload="metadata"
      src={src}
      aria-label={label}
      onError={() => setFailed(true)}
      onPlay={handlePlay}
    />
  );
};
