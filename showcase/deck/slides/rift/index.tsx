import type { DesignSystem, Page, SlideMeta } from '@open-slide/core';
import { ClosingPage } from './pages/ClosingPage';
import { DesktopPage } from './pages/DesktopPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { InjectPage } from './pages/InjectPage';
import { InspectorPage } from './pages/InspectorPage';
import { InstallPage } from './pages/InstallPage';
import { PipePage } from './pages/PipePage';
import { ProblemPage } from './pages/ProblemPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { TitlePage } from './pages/TitlePage';
import { morphTransition, riseTransition } from './lib/transitions';

export const design: DesignSystem = {
  palette: { bg: '#000000', text: '#f4f4f5', accent: '#f59e0b' },
  fonts: {
    display: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  typeScale: { hero: 200, body: 32 },
  radius: 8,
};

export const transition = riseTransition;

ProblemPage.transition = morphTransition;
TitlePage.transition = morphTransition;

export const meta: SlideMeta = {
  title: 'rift',
  createdAt: '2026-11-17T14:44:05Z',
};

export const notes: (string | undefined)[] = [
  'rift bridges TCP, UDP and serial endpoints. Bytes in one side come out the other. The particles are the two directions: amber A to B, cyan B to A.',
  'A sensor speaks UART, a tool wants a TCP socket, a service sends UDP. Today that means glue code per pair, and no visibility.',
  'rift pipe takes two endpoint URIs. Run it, and any TCP client now sees the serial device. The second command forwards UDP datagrams to a remote TCP service.',
  'Four endpoint types share one URI syntax. Options go in the query string.',
  'Every chunk is logged with direction and size. Click a row for the hex dump. Amber is A to B, cyan is B to A.',
  'Inject text, hex, binary or a file into either side or both, live. In the CLI the same thing is a line on stdin.',
  'Profiles live in one rift.toml. rift run by name, or --all. The desktop app reads the same file.',
  'The desktop app wraps the same engine: profiles, live traffic, injection, and it updates itself.',
  'Installers for Linux, macOS and Windows, CLI archives, a Docker image, or cargo install.',
  'github.com/skylineagle/rift',
];

export default [
  TitlePage,
  ProblemPage,
  PipePage,
  EndpointsPage,
  InspectorPage,
  InjectPage,
  ProfilesPage,
  DesktopPage,
  InstallPage,
  ClosingPage,
] satisfies Page[];
