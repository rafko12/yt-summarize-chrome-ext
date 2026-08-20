// eslint-disable-next-line import/prefer-default-export
export const parseTimestamp = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  const hasValidNumbers = parts.every(
    (part) => Number.isInteger(part) && part >= 0
  );

  if (!hasValidNumbers) return 0;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return seconds < 60 ? minutes * 60 + seconds : 0;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return minutes < 60 && seconds < 60
      ? hours * 3600 + minutes * 60 + seconds
      : 0;
  }

  return 0;
};
