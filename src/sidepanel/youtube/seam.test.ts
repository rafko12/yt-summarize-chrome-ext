import { describe, expect, it } from 'vitest';

import defaultCreateYoutube, {
  createChromeYoutubeAdapter,
  createYoutube,
  createYoutubePage,
} from './index';

describe('YouTube Module public seam (src/sidepanel/youtube)', () => {
  it('exposes YouTube integration factory and default export', () => {
    expect(createYoutube).toBeDefined();
    expect(typeof createYoutube).toBe('function');
    expect(defaultCreateYoutube).toBe(createYoutube);
  });

  it('exposes Chrome YouTube adapter factory', () => {
    expect(createChromeYoutubeAdapter).toBeDefined();
    expect(typeof createChromeYoutubeAdapter).toBe('function');
  });

  it('exposes backward compatibility aliases', () => {
    expect(createYoutubePage).toBeDefined();
    expect(createYoutubePage).toBe(createYoutube);
  });

  it('hides active tab, messaging and fallback metadata behind the public interface', () => {
    const youtube = createYoutube();
    expect(youtube.readActiveVideo).toBeDefined();
    expect(typeof youtube.readActiveVideo).toBe('function');
    expect(youtube.fetchActiveTranscript).toBeDefined();
    expect(typeof youtube.fetchActiveTranscript).toBe('function');
    expect(youtube.seekToTimestamp).toBeDefined();
    expect(typeof youtube.seekToTimestamp).toBe('function');
  });
});
