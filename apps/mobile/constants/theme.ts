/**
 * The House's palette, as the website has it.
 *
 * Night is the default. The reader may choose day or sepia on the site;
 * the app follows in a later version. Numbers are the site's tokens.
 */
export const colors = {
  ink: '#0f0e0c',
  inkRaised: '#171512',
  rule: '#2a2622',
  ivory: '#f3ede2',
  grey: '#b8b0a3',
  greyMuted: '#7d766b',
  gold: '#c9a961',
  goldSoft: '#dcc07f',
  danger: '#b3423a',
};

export const type = {
  display: 'Georgia',
  reading: 'Georgia',
  ui: undefined as string | undefined, // the platform's own sans
};

export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 36 };
