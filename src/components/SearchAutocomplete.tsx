import React, { useState, useEffect, useRef } from 'react';

type Item = { id: string; name: string; short_description?: string; combined_score?: number };

export default function SearchAutocomplete({
  placeholder = 'Rechercher des produits...',
  onSelect,
}: {
  placeholder?: string;
  onSelect?: (item: Item) => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!q || q.trim().length < 1) {
      setItems([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&perPage=7`);
        const j = await res.json();
        setItems(j.data || []);
        setOpen(true);
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q]);

  function highlight(text: string, q: string) {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <span>
        {text.slice(0, idx)}
        <strong style={{ background: 'yellow' }}>{text.slice(idx, idx + q.length)}</strong>
        {text.slice(idx + q.length)}
      </span>
    );
  }

  return (
    <div style={{ position: 'relative', width: 320 }}>
      <input
        aria-label="Recherche"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (items.length) setOpen(true); }}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }}
      />
      {open && (
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, background: 'white', border: '1px solid #eee', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 40 }}>
          {loading && <div style={{ padding: 8 }}>Chargement...</div>}
          {!loading && items.length === 0 && <div style={{ padding: 8 }}>Aucun résultat</div>}
          {!loading && items.map((it) => (
            <div key={it.id} onClick={() => { onSelect?.(it); setOpen(false); setQ(it.name); }} style={{ padding: 8, borderBottom: '1px solid #f6f6f6', cursor: 'pointer' }}>
              <div>{highlight(it.name, q)}</div>
              {it.short_description && <div style={{ fontSize: 12, color: '#666' }}>{highlight(it.short_description, q)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
