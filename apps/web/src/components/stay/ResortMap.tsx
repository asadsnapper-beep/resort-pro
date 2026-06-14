'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface Pin {
  slug:             string;
  name:             string;
  country:          string;
  category:         string;
  shortDescription: string;
  coverImageUrl:    string | null;
  priceFrom:        number | null;
  latitude:         number;
  longitude:        number;
  website:          string | null;
  url:              string;
}

interface Props {
  pins:     Pin[];
  selected: Pin | null;
  onSelect: (pin: Pin) => void;
  onOpen:   (pin: Pin) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  eco: '🌿', agro: '🌾', beach: '🏖️', hill: '⛰️',
  city: '🏙️', heritage: '🏛️', resort: '🏨',
};

const CATEGORY_COLOR: Record<string, string> = {
  eco:      '#16a34a',
  agro:     '#ca8a04',
  beach:    '#0284c7',
  hill:     '#78716c',
  city:     '#475569',
  heritage: '#b45309',
  resort:   '#7c3aed',
};

function makePinHtml(emoji: string, color: string, isSelected: boolean) {
  const size    = isSelected ? 36 : 28;
  const border  = isSelected ? '3px solid white' : '2px solid white';
  const shadow  = isSelected
    ? '0 4px 12px rgba(0,0,0,0.4), 0 0 0 4px rgba(255,255,255,0.5)'
    : '0 2px 6px rgba(0,0,0,0.25)';

  return `
    <div style="position:relative;">
      ${isSelected ? `
        <div style="
          position:absolute;
          top:50%; left:50%;
          transform:translate(-50%,-50%) rotate(45deg);
          width:${size + 16}px; height:${size + 16}px;
          border-radius:50% 50% 50% 0;
          background:${color}33;
          animation:ripple 1.5s ease-out infinite;
        "></div>
      ` : ''}
      <div style="
        background:${color};
        border:${border};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        width:${size}px; height:${size}px;
        box-shadow:${shadow};
        display:flex; align-items:center; justify-content:center;
        transition: all 0.2s ease;
      ">
        <span style="transform:rotate(45deg); font-size:${isSelected ? 15 : 12}px; line-height:1;">${emoji}</span>
      </div>
    </div>
  `;
}

export default function ResortMap({ pins, selected, onSelect, onOpen }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markersRef   = useRef<Map<string, any>>(new Map());

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const L = require('leaflet');
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    const map = L.map(containerRef.current, {
      center:             [23.685, 90.356],
      zoom:               7,
      zoomControl:        true,
      attributionControl: true,
    });

    // Clean map tiles (CartoDB Positron — better looking than OSM default)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains:  'abcd',
      maxZoom:     20,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current    = null;
      markersRef.current.clear();
    };
  }, []);

  // ── Sync markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const L   = require('leaflet');
    const map = mapRef.current;

    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    pins.forEach(pin => {
      const emoji      = CATEGORY_EMOJI[pin.category] ?? '📍';
      const color      = CATEGORY_COLOR[pin.category] ?? '#1a6b5e';
      const isSelected = selected?.slug === pin.slug;

      const icon = L.divIcon({
        className: '',
        html:       makePinHtml(emoji, color, isSelected),
        iconSize:   [isSelected ? 36 : 28, isSelected ? 36 : 28],
        iconAnchor: [isSelected ? 18 : 14, isSelected ? 36 : 28],
        popupAnchor:[0, -34],
      });

      const marker = L.marker([pin.latitude, pin.longitude], { icon, zIndexOffset: isSelected ? 1000 : 0 }).addTo(map);

      const popupHtml = `
        <div style="min-width:210px; font-family:system-ui,sans-serif; padding:2px;">
          ${pin.coverImageUrl ? `
            <div style="margin:-12px -12px 10px -12px; height:80px; overflow:hidden; border-radius:8px 8px 0 0;">
              <img src="${pin.coverImageUrl}" alt="${pin.name}"
                style="width:100%;height:100%;object-fit:cover;" />
            </div>
          ` : ''}
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;">
            <strong style="font-size:13px;color:#111827;line-height:1.3;flex:1;">${pin.name}</strong>
          </div>
          ${pin.shortDescription ? `
            <p style="font-size:11px;color:#6b7280;margin:0 0 6px;line-height:1.4;">${pin.shortDescription}</p>
          ` : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:10px;color:#9ca3af;">${pin.country}</span>
            ${pin.priceFrom ? `<span style="font-size:11px;font-weight:700;color:#1a6b5e;">৳${pin.priceFrom.toLocaleString()}/night</span>` : ''}
          </div>
          <button
            onclick="window.__stayOpenResort && window.__stayOpenResort('${pin.slug}')"
            style="
              width:100%; background:#1a6b5e; color:white; border:none;
              border-radius:8px; padding:7px 12px; font-size:12px;
              font-weight:600; cursor:pointer; letter-spacing:0.01em;
            ">
            View Resort →
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 240, className: 'resort-popup' });
      marker.on('click', () => onSelect(pin));

      markersRef.current.set(pin.slug, marker);
    });

    // Auto-fit bounds
    if (pins.length > 0) {
      try {
        const bounds = (require('leaflet') as any).latLngBounds(
          pins.map(p => [p.latitude, p.longitude])
        );
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 11 });
      } catch { /* ignore */ }
    }
  }, [pins, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan to selected ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected || !mapRef.current) return;
    const marker = markersRef.current.get(selected.slug);
    if (marker) {
      mapRef.current.setView([selected.latitude, selected.longitude], 13, { animate: true });
      setTimeout(() => marker.openPopup(), 300);
    }
  }, [selected]);

  // ── Global popup button handler ───────────────────────────────────────────
  useEffect(() => {
    (window as any).__stayOpenResort = (slug: string) => {
      const pin = pins.find(p => p.slug === slug);
      if (pin) onOpen(pin);
    };
    return () => { delete (window as any).__stayOpenResort; };
  }, [pins, onOpen]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: 400 }} />

      <style>{`
        /* Popup styling */
        .resort-popup .leaflet-popup-content-wrapper {
          border-radius: 14px;
          padding: 12px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          border: 1px solid #f3f4f6;
        }
        .resort-popup .leaflet-popup-content {
          margin: 0;
        }
        .resort-popup .leaflet-popup-tip-container {
          margin-top: -2px;
        }

        /* Ripple animation for selected pin */
        @keyframes ripple {
          0%   { opacity: 0.6; transform: translate(-50%,-50%) rotate(45deg) scale(0.8); }
          100% { opacity: 0;   transform: translate(-50%,-50%) rotate(45deg) scale(1.6); }
        }

        /* Zoom controls */
        .leaflet-control-zoom {
          border-radius: 10px !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          border-radius: 0 !important;
          color: #374151 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f0faf8 !important;
          color: #1a6b5e !important;
        }
      `}</style>
    </>
  );
}
