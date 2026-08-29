import type { Template } from './types';

/**
 * A small, original one-page "local bakery" template, authored for this
 * assignment (not sourced from a third party — see README "Template source").
 * Kept intentionally small (7 elements) so every required behavior — canvas
 * editing, code editing, viewport overrides, AI scope, and history — stays
 * easy to demonstrate and to test.
 */
export const initialTemplate: Template = {
  id: 'bakery-template',
  name: 'Corner Loaf — one-page bakery site',
  sourceNote: 'Original template authored for this assignment. Not derived from any third-party template or theme.',
  version: 1,
  rootOrder: ['nav', 'hero-heading', 'hero-text', 'hero-cta', 'hero-image', 'feature-text', 'footer-text'],
  elements: {
    nav: {
      id: 'nav',
      type: 'container',
      parentId: null,
      base: { order: 0, visible: true, style: { backgroundColor: '#1c1410', padding: '16px 24px' } },
      overrides: {},
    },
    'hero-heading': {
      id: 'hero-heading',
      type: 'heading',
      parentId: null,
      base: {
        content: 'Fresh sourdough, baked before sunrise.',
        order: 1,
        visible: true,
        style: { color: '#1c1410', fontSize: '40px', fontWeight: '700', textAlign: 'left' },
      },
      overrides: {
        mobile: { style: { fontSize: '28px', textAlign: 'center' } },
      },
    },
    'hero-text': {
      id: 'hero-text',
      type: 'text',
      parentId: null,
      base: {
        content: 'Corner Loaf is a small neighborhood bakery. Stone-milled flour, long ferments, no shortcuts.',
        order: 2,
        visible: true,
        style: { color: '#4a3f36', fontSize: '18px', textAlign: 'left' },
      },
      overrides: {
        mobile: { style: { textAlign: 'center' } },
      },
    },
    'hero-cta': {
      id: 'hero-cta',
      type: 'button',
      parentId: null,
      base: {
        content: 'See this week\u2019s menu',
        order: 3,
        visible: true,
        style: { backgroundColor: '#b5651d', color: '#ffffff', borderRadius: '8px', fontSize: '16px' },
      },
      overrides: {},
    },
    'hero-image': {
      id: 'hero-image',
      type: 'image',
      parentId: null,
      base: {
        src: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
        alt: 'A fresh sourdough loaf cooling on a wire rack',
        order: 4,
        visible: true,
        size: { width: '60%' },
      },
      overrides: {
        mobile: { size: { width: '100%' } },
      },
    },
    'feature-text': {
      id: 'feature-text',
      type: 'text',
      parentId: null,
      base: {
        content: 'Open Tuesday through Sunday, 7am until the shelves are empty (usually around noon).',
        order: 5,
        visible: true,
        style: { color: '#4a3f36', fontSize: '16px', textAlign: 'left' },
      },
      overrides: {},
    },
    'footer-text': {
      id: 'footer-text',
      type: 'text',
      parentId: null,
      base: {
        content: '\u00a9 2026 Corner Loaf Bakery. 14 Miller St.',
        order: 6,
        visible: true,
        style: { color: '#9a8f84', fontSize: '13px', textAlign: 'center' },
      },
      overrides: {},
    },
  },
};
