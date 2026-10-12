/** Format clip metadata in the system timezone at capture, without changing partial times. */
export const clipDateTimeText = (value: string): string => {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!parts) return value;
  // Missing timezone and RFC 3339 -00:00 are unknown, so retain the wall clock.
  if (!parts[3] || parts[3] === "-00:00") return `${parts[1]} ${parts[2]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
