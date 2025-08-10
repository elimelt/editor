import React from 'react';

type Props = { kind: 'info' | 'success' | 'error'; text: string };

export function StatusBar({ kind, text }: Props): JSX.Element {
  return <div className={`status ${kind}`}>{text}</div>;
}


