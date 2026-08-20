export interface CaptionTrack {
  languageCode: string;
  vssId: string;
  baseUrl: string;
}

export interface PlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    thumbnail?: {
      thumbnails?: Array<{ url?: string }>;
    };
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

const PLAYER_RESPONSE_ASSIGNMENT =
  /(?:ytInitialPlayerResponse|window\[['"]ytInitialPlayerResponse['"]\])\s*=\s*\{/g;

/**
 * Returns the complete JSON object beginning at `startIndex`.
 *
 * YouTube's payload can contain braces in strings (for example in titles or
 * captions), so a plain brace counter is insufficient. This scanner keeps
 * track of JSON strings and escaped characters before counting braces.
 */
export function extractJsonObject(
  text: string,
  startIndex: number
): string | null {
  if (text[startIndex] !== '{') return null;

  let depth = 0;
  let isInsideString = false;
  let isEscaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (!isInsideString) {
      if (character === '"') {
        isInsideString = true;
      } else if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(startIndex, index + 1);
      }
    } else if (isEscaped) {
      isEscaped = false;
    } else if (character === '\\') {
      isEscaped = true;
    } else if (character === '"') {
      isInsideString = false;
    }
  }

  return null;
}

/**
 * Extracts a response for the expected video from an inline script or the
 * watch-page HTML. A stale response is ignored, allowing callers to try the
 * next script or source.
 */
export function extractPlayerResponseFromText(
  text: string,
  expectedVideoId: string
): PlayerResponse | null {
  PLAYER_RESPONSE_ASSIGNMENT.lastIndex = 0;

  let assignment = PLAYER_RESPONSE_ASSIGNMENT.exec(text);
  while (assignment) {
    const jsonStart = assignment.index + assignment[0].length - 1;
    const json = extractJsonObject(text, jsonStart);

    if (json) {
      try {
        const response = JSON.parse(json) as PlayerResponse;
        if (response.videoDetails?.videoId === expectedVideoId) return response;
      } catch {
        // The page can contain a partial or non-JSON payload. Try the next one.
      }
    }

    assignment = PLAYER_RESPONSE_ASSIGNMENT.exec(text);
  }

  return null;
}
