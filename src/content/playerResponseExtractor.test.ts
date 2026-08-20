import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  extractJsonObject,
  extractPlayerResponseFromText,
} from './playerResponseExtractor';

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)),
    'utf8'
  );

describe('playerResponseExtractor', () => {
  it('extracts a valid player response', () => {
    const response = extractPlayerResponseFromText(
      fixture('valid-player-response.html'),
      'valid-video-id'
    );

    expect(response?.videoDetails).toMatchObject({
      videoId: 'valid-video-id',
      title: 'Przykładowy film',
      author: 'Kanał testowy',
    });
  });

  it('does not finish the object at a brace inside a JSON string', () => {
    const response = extractPlayerResponseFromText(
      fixture('brace-in-string.html'),
      'brace-video-id'
    );

    expect(response?.videoDetails?.title).toBe('Tytuł z } nawiasem');
  });

  it('handles escaped quotes and backslashes in JSON strings', () => {
    const response = extractPlayerResponseFromText(
      fixture('escaped-string.html'),
      'escaped-video-id'
    );

    expect(response?.videoDetails?.title).toBe('Cytat: "tekst" \\ ścieżka');
  });

  it('returns null for an incomplete JSON payload', () => {
    expect(
      extractPlayerResponseFromText(
        fixture('incomplete-player-response.html'),
        'incomplete-video-id'
      )
    ).toBeNull();
  });

  it('ignores a response for another video', () => {
    expect(
      extractPlayerResponseFromText(
        fixture('mismatched-video-id.html'),
        'expected-video-id'
      )
    ).toBeNull();
  });

  it('returns the response when captions are absent', () => {
    const response = extractPlayerResponseFromText(
      fixture('no-captions.html'),
      'no-captions-video-id'
    );

    expect(
      response?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    ).toBeUndefined();
  });

  it('returns null when the object does not close', () => {
    expect(extractJsonObject('{"title":"niezamknięty"', 0)).toBeNull();
  });
});
