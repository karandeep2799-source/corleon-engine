import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        border: 0,
        borderRadius: 12,
        padding: '12px 18px',
        background: '#111827',
        color: 'white',
        fontWeight: 700,
        cursor: 'pointer',
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function Card({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      {...props}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        padding: 24,
        background: 'rgba(255,255,255,0.8)',
        boxShadow: '0 10px 30px rgba(17,24,39,0.06)',
        ...props.style,
      }}
    >
      {children}
    </div>
  );
}
