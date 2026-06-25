'use client';

import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api';

export const DEFAULT_ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  DELUXE:   'Deluxe',
  SUITE:    'Suite',
  VILLA:    'Villa',
  COTTAGE:  'Cottage',
  BUNGALOW: 'Bungalow',
};

export function useRoomTypeLabels() {
  const { data } = useQuery({
    queryKey: ['room-type-labels'],
    queryFn: () => tenantApi.getRoomTypeLabels().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const labels: Record<string, string> = data?.data?.labels ?? DEFAULT_ROOM_TYPE_LABELS;

  function getLabel(type: string): string {
    return labels[type] ?? DEFAULT_ROOM_TYPE_LABELS[type] ?? type;
  }

  return { labels, getLabel, defaults: DEFAULT_ROOM_TYPE_LABELS };
}
