export type ClusterId = 'arcade' | 'toolbench' | 'opensource' | 'pocket';

export interface Cluster {
  id: ClusterId;
  label: string;
  color: string; // hex used by both CSS and the three.js scene
  blurb: string;
}

export interface Project {
  slug: string;
  title: string;
  cluster: ClusterId;
  blurb: string;
  tags: string[];
  url?: string;
  /** App Store listing — fill in when the app ships (e.g. https://apps.apple.com/app/id…) */
  appStore?: string;
}

export const clusters: Cluster[] = [
  {
    id: 'arcade',
    label: 'Arcade',
    color: '#ffb454',
    blurb: 'Browser games for small hands and loud laughs.',
  },
  {
    id: 'toolbench',
    label: 'Toolbench',
    color: '#6fd8e0',
    blurb: 'Utilities that do their work and mind their business.',
  },
  {
    id: 'opensource',
    label: 'Open Source',
    color: '#9ee493',
    blurb: 'Pieces of the lab, released into the wild.',
  },
  {
    id: 'pocket',
    label: 'Pocket',
    color: '#f2889b',
    blurb: 'Small iOS apps that work offline and keep quiet.',
  },
];

export const projects: Project[] = [
  // ── Arcade ──────────────────────────────────────────────
  {
    slug: 'neon-tide',
    title: 'Neon Tide',
    cluster: 'arcade',
    blurb:
      'A co-op survival driving game — grab a room code, pick up your friends, and outrun a neon flood together.',
    tags: ['Babylon.js', 'XState', 'multiplayer'],
    url: 'https://neontide.playminiarcade.com',
  },
  {
    slug: 'mini-arcade',
    title: 'Mini Arcade',
    cluster: 'arcade',
    blurb:
      'A tiny arcade of browser games for kids — no ads, no accounts, no downloads. Just press play.',
    tags: ['games', 'kids', 'web'],
    url: 'https://playminiarcade.com',
  },
  {
    slug: 'candy-snake',
    title: 'Candy Snake',
    cluster: 'arcade',
    blurb:
      'The classic snake, rebuilt in candy colors and kid-tested by the toughest critics available.',
    tags: ['canvas', 'arcade classic'],
  },
  // ── Toolbench ───────────────────────────────────────────
  {
    slug: 'devutils',
    title: 'DevUtils',
    cluster: 'toolbench',
    blurb:
      'A toolbox of developer utilities — encoders, formatters, converters — that run entirely in your browser tab.',
    tags: ['dev tools', 'local-first'],
    url: 'https://devutils.handykit.one',
  },
  {
    slug: 'handykit',
    title: 'HandyKit',
    cluster: 'toolbench',
    blurb:
      'A growing constellation of small, handy web tools, each living quietly on its own subdomain.',
    tags: ['tools', 'web'],
    url: 'https://handykit.one',
  },
  {
    slug: 'privacy-blur',
    title: 'Privacy Blur',
    cluster: 'toolbench',
    blurb:
      'Blur faces and sensitive details in photos before you share them — processed on-device, never uploaded.',
    tags: ['privacy', 'on-device'],
  },
  // ── Open Source ─────────────────────────────────────────
  {
    slug: 'littalk',
    title: 'LitTalk',
    cluster: 'opensource',
    blurb:
      'A lightweight GitHub-powered comment system that drops into any JavaScript framework, built with Lit.',
    tags: ['Lit', 'web components', 'MIT'],
    url: 'https://github.com/quiet-build/litTalk',
  },
  {
    slug: 'manuscript-ui',
    title: 'Manuscript UI',
    cluster: 'opensource',
    blurb:
      'The design system behind everything here — themes, components, and recipes, shipped as @quietbuildlab/ui on npm.',
    tags: ['design system', 'React', 'npm'],
    url: 'https://quiet-build.github.io/ui/',
  },
  {
    slug: 'feedback-form',
    title: 'Feedback Form',
    cluster: 'opensource',
    blurb:
      'A drop-in contact form: one web component on the front, one worker on the back, zero servers to babysit.',
    tags: ['Lit', 'Cloudflare Workers'],
  },
  // ── Pocket ──────────────────────────────────────────────
  {
    slug: 'bedtime-stories',
    title: 'Bedtime Stories',
    cluster: 'pocket',
    blurb:
      'An iOS storyteller that spins gentle, personalized bedtime tales — a new story every night.',
    tags: ['SwiftUI', 'iOS'],
  },
  {
    slug: 'slipstream',
    title: 'Slipstream',
    cluster: 'pocket',
    blurb:
      'An iOS chat app experimenting with on-device language models — fast, private, and fully offline.',
    tags: ['SwiftUI', 'MLX', 'on-device AI'],
  },
  {
    slug: 'little-utilities',
    title: 'Little Utilities',
    cluster: 'pocket',
    blurb:
      'A trio of tiny iOS apps for remembering when you last did a thing, nagging you to do the next one, and taming the bills.',
    tags: ['SwiftUI', 'iOS', 'utilities'],
  },
];

export const clusterById = Object.fromEntries(clusters.map((c) => [c.id, c])) as Record<
  ClusterId,
  Cluster
>;
