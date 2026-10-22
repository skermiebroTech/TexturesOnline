// Media queries of the texture pack editor's layout (keep them in step with view.css).

/**
 * Phone layout (one panel at a time, bottom tab bar): narrow screens, and touch screens held in
 * landscape (short and wide), where two columns would leave the panels a strip of height.
 * A mouse or trackpad never matches the second part, so desktops and laptops keep their layout.
 */
export const PHONE_MQ = '(max-width: 760px), (max-height: 560px) and (min-width: 600px) and (pointer: coarse)';
/** A touch screen held in landscape (short and wide): the second part of PHONE_MQ */
export const LANDSCAPE_MQ = PHONE_MQ.split(', ')[1];
/** Tablet layout: the canvas and one tabbed side column */
export const TABLET_MQ = '(max-width: 1180px)';
/** A finger is the main pointer: bigger targets, "Tap" instead of "Click", no keyboard hints */
export const TOUCH_MQ = '(pointer: coarse)';

export const isTouch = (): boolean => typeof matchMedia === 'function' && matchMedia(TOUCH_MQ).matches;
export const isLandscapePhone = (): boolean => typeof matchMedia === 'function' && matchMedia(LANDSCAPE_MQ).matches;

/** `touch` on touch screens, else `mouse` (read when the text is shown, so it follows the language). */
export const byPointer = (mouse: string, touch: string): string => (isTouch() ? touch : mouse);
