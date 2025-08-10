import React from 'react';

type Props = {
  show: boolean;
  showToggleFiles: boolean;
  showTogglePreview: boolean;
};

export function ShortcutHints({ show, showToggleFiles, showTogglePreview }: Props): JSX.Element | null {
  if (!show) return null;
  return (
    <div className="shortcut-hints show">
      <div className="row">
        <span>Save</span>
        <span className="kbd">Cmd/Ctrl</span>
        <span className="kbd">S</span>
      </div>
      <div className="row">
        <span>Command palette</span>
        <span className="kbd">Cmd/Ctrl</span>
        <span className="kbd">K</span>
        <span className="muted">or</span>
        <span className="kbd">P</span>
      </div>
      {showToggleFiles && (
        <div className="row">
          <span>Toggle files</span>
          <span className="kbd">Cmd/Ctrl</span>
          <span className="kbd">B</span>
        </div>
      )}
      {showTogglePreview && (
        <div className="row">
          <span>Toggle preview</span>
          <span className="kbd">Cmd/Ctrl</span>
          <span className="kbd">Alt</span>
          <span className="kbd">P</span>
          <span className="muted">or</span>
          <span className="kbd">Cmd/Ctrl</span>
          <span className="kbd">Shift</span>
          <span className="kbd">V</span>
        </div>
      )}
      <div className="row">
        <span>Settings</span>
        <span className="kbd">Cmd/Ctrl</span>
        <span className="kbd">,</span>
      </div>
    </div>
  );
}


