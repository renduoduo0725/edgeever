export const DIALOG_DRAG_MIN_VISIBLE = 48;

export const clampDialogPixelPosition = ({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  minVisible = DIALOG_DRAG_MIN_VISIBLE,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  minVisible?: number;
}) => {
  const minX = minVisible - width;
  const maxX = viewportWidth - minVisible;
  const minY = 0;
  const maxY = viewportHeight - minVisible;
  return {
    x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(y, minY), Math.max(minY, maxY)),
  };
};
