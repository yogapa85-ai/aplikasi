import React, { useState } from 'react';
import { getInitials } from '../utils/format';

interface CollectorAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CollectorAvatar: React.FC<CollectorAvatarProps> = ({ name, size = 'md' }) => {
  const [failed, setFailed] = useState(false);

  const sizeClass =
    size === 'lg'
      ? 'w-16 h-16 text-lg'
      : size === 'sm'
      ? 'w-9 h-9 text-xs'
      : 'w-11 h-11 text-sm';

  const photoUrl = `/api/ops/photo/${encodeURIComponent(name.trim())}`;

  if (failed || !name.trim()) {
    return (
      <div
        aria-hidden="true"
        className={`${sizeClass} rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-display font-bold flex items-center justify-center shrink-0 border border-slate-300/70 dark:border-slate-700`}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={`Foto ${name}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-xl object-cover bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700`}
    />
  );
};
