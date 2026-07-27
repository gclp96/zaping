import { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({
  children,
  className = '',
}: CardProps) {
  return (
    <div
      className={`
        bg-white
        rounded-xl
        shadow
        p-6
        ${className}
      `}
    >
      {children}
    </div>
  );
}