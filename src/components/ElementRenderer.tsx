import React from 'react';
import type { PropertyValues, TemplateElement } from '../types';

interface Props {
  element: TemplateElement;
  resolved: PropertyValues;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  elRef: (node: HTMLDivElement | null) => void;
}

export default function ElementRenderer({ element, resolved, selected, onSelect, onKeyDown, elRef }: Props) {
  if (resolved.visible === false) {
    return (
      <div
        ref={elRef}
        role="option"
        aria-selected={selected}
        tabIndex={0}
        data-el-id={element.id}
        data-selected={selected}
        data-label={`${element.id} (hidden on this view)`}
        className="el-block"
        style={{ padding: '6px 10px', color: '#b0a89b', fontSize: 12, fontStyle: 'italic', border: '1px dashed #d8d0c2' }}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        {element.id} — hidden on this viewport
      </div>
    );
  }

  const style: React.CSSProperties = {
    color: resolved.style?.color,
    backgroundColor: resolved.style?.backgroundColor,
    fontSize: resolved.style?.fontSize,
    fontWeight: resolved.style?.fontWeight as any,
    textAlign: resolved.style?.textAlign,
    padding: resolved.style?.padding ?? '10px 4px',
    borderRadius: resolved.style?.borderRadius,
    width: resolved.size?.width,
    height: resolved.size?.height,
  };

  const common = {
    ref: elRef,
    role: 'option' as const,
    'aria-selected': selected,
    tabIndex: 0,
    'data-el-id': element.id,
    'data-selected': selected,
    'data-label': `${element.id} \u00b7 ${element.type}`,
    className: 'el-block',
    onClick: onSelect,
    onKeyDown,
    style,
  };

  switch (element.type) {
    case 'heading':
      return <h2 {...common}>{resolved.content}</h2>;
    case 'text':
      return <p {...common}>{resolved.content}</p>;
    case 'button':
      return (
        <div {...common}>
          <span
            style={{
              display: 'inline-block',
              padding: '10px 18px',
              backgroundColor: resolved.style?.backgroundColor ?? '#333',
              color: resolved.style?.color ?? '#fff',
              borderRadius: resolved.style?.borderRadius ?? '6px',
              fontSize: resolved.style?.fontSize,
              fontWeight: 600,
            }}
          >
            {resolved.content}
          </span>
        </div>
      );
    case 'image':
      return (
        <div {...common}>
          <img
            src={resolved.src}
            alt={resolved.alt ?? ''}
            style={{ width: resolved.size?.width ?? '100%', height: resolved.size?.height, display: 'block', borderRadius: 4 }}
          />
        </div>
      );
    case 'container':
      return (
        <div {...common} style={{ ...style, minHeight: 20 }}>
          <span style={{ fontSize: 11, opacity: 0.6, color: resolved.style?.color ?? '#fff' }}>{element.id}</span>
        </div>
      );
    default:
      return null;
  }
}
