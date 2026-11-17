import {AlertTriangle, HelpCircle, ShieldCheck} from 'lucide-react';
import type {Classification} from '../types';

export function ClassificationLabel({classification}: {classification: Classification | string}) {
  const norm = classification.toUpperCase();
  if (norm === 'AUTHORISED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Authorised</span>
      </span>
    );
  }
  if (norm === 'SUSPICIOUS') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Suspicious</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 whitespace-nowrap">
      <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Unknown</span>
    </span>
  );
}

export function AlertStatusLabel({status}: {status: string}) {
  if (status === 'Resolved') {
    return <span className="text-xs font-medium text-emerald-400 whitespace-nowrap">Resolved</span>;
  }
  if (status === 'Reviewed') {
    return <span className="text-xs font-medium text-amber-400 whitespace-nowrap">Reviewed</span>;
  }
  return <span className="text-xs font-semibold text-rose-400 whitespace-nowrap">Open</span>;
}
