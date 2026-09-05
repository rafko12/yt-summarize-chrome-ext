import { describe, expect, test } from 'vitest';

import {
  isBackgroundMessage,
  isContentMessage,
  isErrorResponse,
  isPanelNotification,
} from './messages';

describe('directional message contracts', () => {
  test('recognizes valid content messages and rejects invalid shapes', () => {
    expect(isContentMessage({ type: 'GET_VIDEO_DATA' })).toBe(true);
    expect(isContentMessage({ type: 'GET_VIDEO_DATA', extra: true })).toBe(
      false
    );
    expect(
      isContentMessage({
        type: 'GET_TRANSCRIPT',
        videoId: 'film',
        targetLang: 'pl',
      })
    ).toBe(true);
    expect(isContentMessage({ type: 'GET_TRANSCRIPT', videoId: 'film' })).toBe(
      false
    );
    expect(isContentMessage({ type: 'SEEK_TO', seconds: 20 })).toBe(true);
    expect(isContentMessage({ type: 'SEEK_TO', seconds: '20' })).toBe(false);
    expect(isContentMessage(null)).toBe(false);
    expect(isContentMessage(undefined)).toBe(false);
    expect(isContentMessage('invalid')).toBe(false);
    expect(isContentMessage({ type: 'UNKNOWN' })).toBe(false);
    expect(isContentMessage({ type: 'PANEL_INIT', tabId: 2 })).toBe(false);
  });

  test('recognizes background requests and strictly rejects panel notifications', () => {
    expect(isBackgroundMessage({ type: 'PANEL_INIT', tabId: 2 })).toBe(true);
    expect(
      isBackgroundMessage({ type: 'PIN_GLOBAL', tabId: 2, windowId: 3 })
    ).toBe(true);
    expect(isBackgroundMessage({ type: 'GET_PIN_STATE' })).toBe(true);

    expect(isBackgroundMessage({ type: 'PANEL_INIT' })).toBe(false);
    expect(isBackgroundMessage({ type: 'PIN_GLOBAL', tabId: 2 })).toBe(false);
    expect(isBackgroundMessage({ type: 'UNKNOWN' })).toBe(false);
    expect(isBackgroundMessage(null)).toBe(false);
    expect(isBackgroundMessage(undefined)).toBe(false);
    expect(isBackgroundMessage('invalid')).toBe(false);

    // YOUTUBE_URL_UPDATED is a panel notification, NOT a background request!
    expect(
      isBackgroundMessage({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: 2,
        url: 'https://youtube.com/watch?v=film',
      })
    ).toBe(false);
  });

  test('recognizes panel notifications and rejects other messages', () => {
    expect(
      isPanelNotification({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: 2,
        url: 'https://youtube.com/watch?v=film',
      })
    ).toBe(true);

    expect(
      isPanelNotification({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: '2',
        url: 'https://youtube.com/watch?v=film',
      })
    ).toBe(false);
    expect(
      isPanelNotification({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: 2,
      })
    ).toBe(false);
    expect(isPanelNotification({ type: 'PANEL_INIT', tabId: 2 })).toBe(false);
    expect(isPanelNotification({ type: 'GET_VIDEO_DATA' })).toBe(false);
    expect(isPanelNotification(null)).toBe(false);
    expect(isPanelNotification(undefined)).toBe(false);
    expect(isPanelNotification({})).toBe(false);
  });

  test('recognizes error responses correctly', () => {
    expect(isErrorResponse({ error: 'problem' })).toBe(true);
    expect(isErrorResponse({ error: 10 })).toBe(false);
    expect(isErrorResponse({ success: true })).toBe(false);
    expect(isErrorResponse(null)).toBe(false);
    expect(isErrorResponse(undefined)).toBe(false);
    expect(isErrorResponse({})).toBe(false);
  });
});
