'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { RotateCcw, Save, BedDouble, Zap, Crown, Home, Leaf, Waves } from 'lucide-react';

const TYPE_META: Record<string, { Icon: React.ElementType; color: string }> = {
  STANDARD: { Icon: BedDouble, color: '#6b7280' },
  DELUXE:   { Icon: Zap,       color: '#23766a' },
  SUITE:    { Icon: Crown,     color: '#7846c8' },
  VILLA:    { Icon: Home,      color: '#23766a' },
  COTTAGE:  { Icon: Leaf,      color: '#23766a' },
  BUNGALOW: { Icon: Waves,     color: '#b89040' },
};

export function RoomTypeSettings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['room-type-labels'],
    queryFn: () => tenantApi.getRoomTypeLabels().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const labels: Record<string, string> = data?.data?.labels ?? {};
  const defaults: Record<string, string> = data?.data?.defaults ?? {
    STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite',
    VILLA: 'Villa', COTTAGE: 'Cottage', BUNGALOW: 'Bungalow',
  };

  useEffect(() => {
    if (labels && Object.keys(labels).length > 0) {
      setDraft({ ...labels });
      setDirty(false);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => tenantApi.updateRoomTypeLabels(draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room-type-labels'] });
      setDirty(false);
      toast({ title: 'Room type labels saved' });
    },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  });

  const resetMut = useMutation({
    mutationFn: (type: string) => tenantApi.resetRoomTypeLabel(type),
    onSuccess: (_, type) => {
      qc.invalidateQueries({ queryKey: ['room-type-labels'] });
      setDraft(d => ({ ...d, [type]: defaults[type] }));
      toast({ title: `${type} reset to default` });
    },
  });

  function onChange(type: string, value: string) {
    setDraft(d => ({ ...d, [type]: value }));
    setDirty(true);
  }

  const types = Object.keys(defaults);

  return (
    <div style={{ background: 'var(--rp-surface)', border: '1px solid var(--rp-border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rp-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rp-text)' }}>Room Type Names</div>
          <div style={{ fontSize: 12, color: 'var(--rp-text-muted)', marginTop: 2 }}>Customize how room types appear to staff and guests</div>
        </div>
        <button
          onClick={() => saveMut.mutate()}
          disabled={!dirty || saveMut.isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: dirty ? '#1a6b5e' : 'var(--rp-surface-2)',
            color: dirty ? '#fff' : 'var(--rp-text-muted)',
            border: '1px solid ' + (dirty ? 'transparent' : 'var(--rp-border)'),
            borderRadius: 8, fontWeight: 600, fontSize: 13,
            cursor: dirty ? 'pointer' : 'not-allowed', opacity: saveMut.isPending ? 0.7 : 1,
          }}
        >
          <Save size={14} /> {saveMut.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Rows */}
      {isLoading ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--rp-text-muted)', fontSize: 13 }}>Loading…</div>
      ) : (
        <div>
          {types.map((type, i) => {
            const { Icon, color } = TYPE_META[type] ?? { Icon: BedDouble, color: '#6b7280' };
            const isCustom = draft[type] !== defaults[type];
            return (
              <div
                key={type}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                  borderBottom: i < types.length - 1 ? '1px solid var(--rp-border)' : 'none',
                }}
              >
                {/* Icon + key */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 130, flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--rp-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={color} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', fontFamily: 'monospace' }}>{type}</span>
                </div>

                {/* Input */}
                <input
                  value={draft[type] ?? defaults[type]}
                  onChange={e => onChange(type, e.target.value)}
                  placeholder={defaults[type]}
                  style={{
                    flex: 1, padding: '7px 10px',
                    border: `1px solid ${isCustom ? 'rgba(26,107,94,0.4)' : 'var(--rp-border)'}`,
                    borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)',
                    fontSize: 13, outline: 'none',
                  }}
                />

                {/* Default badge + reset */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 130, flexShrink: 0, justifyContent: 'flex-end' }}>
                  {isCustom ? (
                    <>
                      <span style={{ fontSize: 11, color: '#1a6b5e', fontWeight: 600 }}>Custom</span>
                      <button
                        onClick={() => { resetMut.mutate(type); onChange(type, defaults[type]); }}
                        title={`Reset to "${defaults[type]}"`}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'transparent', border: '1px solid var(--rp-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--rp-text-muted)', fontSize: 11 }}
                      >
                        <RotateCcw size={11} /> Reset
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--rp-text-muted)' }}>Default</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
