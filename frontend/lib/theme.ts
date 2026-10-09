/**
 * localStorage key for the creator's light / dark choice.
 *
 * Lives in a plain module (no "use client") because the root layout, a server component,
 * needs the actual string to build its inline script. A value imported from a client
 * module arrives on the server as a reference, not as the string.
 */
export const THEME_KEY = "theme";
