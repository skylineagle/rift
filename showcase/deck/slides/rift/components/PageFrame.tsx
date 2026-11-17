import { MorphElement } from '@open-slide/core';
import type { FC, ReactNode } from 'react';
import mark from '@assets/mark.svg';
import { color, fill, font } from '../lib/theme';

export type PageFrameProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  morphMark?: boolean;
};

export const MARK_LEFT = 120;
export const MARK_TOP = 64;
export const MARK_SIZE = 64;

const markStyle = {
  position: 'absolute',
  left: MARK_LEFT,
  top: MARK_TOP,
  width: MARK_SIZE,
  height: MARK_SIZE,
} as const;

export const PageFrame: FC<PageFrameProps> = ({ eyebrow, title, children, morphMark = false }) => (
  <div style={{ ...fill, padding: '0 120px 80px' }}>
    {morphMark ? (
      <MorphElement id="mark">
        <img src={mark} alt="" style={markStyle} />
      </MorphElement>
    ) : (
      <img src={mark} alt="" style={markStyle} />
    )}
    <div
      style={{
        position: 'absolute',
        left: MARK_LEFT + MARK_SIZE + 16,
        top: MARK_TOP,
        height: MARK_SIZE,
        display: 'flex',
        alignItems: 'center',
        fontFamily: font.mono,
        fontSize: 24,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: color.amber,
      }}
    >
      {eyebrow}
    </div>
    <h2
      style={{
        position: 'absolute',
        left: 120,
        top: 160,
        margin: 0,
        fontSize: 72,
        lineHeight: 1.1,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}
    >
      {title}
    </h2>
    <div style={{ position: 'absolute', left: 120, right: 120, top: 290, bottom: 80 }}>{children}</div>
  </div>
);
