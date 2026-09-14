import { useState, type SyntheticEvent } from "react";
import { pauseOtherMediaPlayers } from "./pause-other-media";

export const VideoAttachmentPlayer = ({
  src,
  label,
  unavailableMessage,
}: {
  src: string;
  label: string;
  unavailableMessage: string;
}) => {
  const [failed, setFailed] = useState(false);

  const handlePlay = (event: SyntheticEvent<HTMLVideoElement>) => {
    pauseOtherMediaPlayers(event.currentTarget);
  };

  if (failed) {
    return (
      <span className="flex min-h-10 items-center px-3 py-2 text-sm text-slate-500" role="status">
        {unavailableMessage}
      </span>
    );
  }

  return (
    <video
      className="aspect-video w-full bg-slate-950 object-contain"
      controls
      controlsList="nodownload"
      data-edgeever-video-player
      playsInline
      preload="metadata"
      src={src}
      aria-label={label}
      onError={() => setFailed(true)}
      onPlay={handlePlay}
    />
  );
};
