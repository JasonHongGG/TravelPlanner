import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (confirming) {
      const timer = setTimeout(() => setConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirming) {
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${confirming
        ? 'bg-red-50 text-red-600 ring-1 ring-red-200 px-3'
        : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
        }`}
      title={confirming ? t('dashboard.confirm_delete_tooltip') : t('dashboard.delete_trip')}
    >
      <Trash2 className="w-4 h-4" />
      {confirming && <span className="text-[10px] font-bold">{t('dashboard.confirm_delete_text')}</span>}
    </button>
  );
}
