'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { SearchResult } from '@/types';

const TABS = ['All records', 'Images', 'Videos'];

export default function ManagePage() {
  const [records, setRecords] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [filter, setFilter] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [bulkCount, setBulkCount] = useState(1);
  const [tagInput, setTagInput] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listFiles();
      setRecords(res.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r => {
    const typeOk = activeTab === 0 ? true : activeTab === 1 ? r.file_type === 'image' : r.file_type === 'video';
    if (!typeOk) return false;
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    const tagStr = Object.keys(r.tags ?? {}).join(' ').toLowerCase();
    return r.file_id.toLowerCase().includes(q) || tagStr.includes(q);
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.file_id)));
  };

  const selectedUrls = () =>
    filtered.filter(r => selected.has(r.file_id)).map(r => r.url);

  const applyTagRecords = (items: { file_id: string; tags: Record<string, number> }[]) => {
    if (!items.length) return;
    setRecords(prev =>
      prev.map(r => {
        const hit = items.find(x => x.file_id === r.file_id);
        return hit ? { ...r, tags: hit.tags } : r;
      }),
    );
  };

  const modifyTags = async (urls: string[], tags: string[], operation: 0 | 1) => {
    if (urls.length === 0 || tags.length === 0) return;
    setTagging(true);
    setError(null);
    try {
      const res = await api.modifyTags({ urls, tags, operation });
      if (res.records?.length) applyTagRecords(res.records);
      if (operation === 1) setBulkTag('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tag update failed');
    } finally {
      setTagging(false);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const urls = selectedUrls();
    setDeleting(true);
    try {
      await api.deleteFiles({ urls });
      setRecords(prev => prev.filter(r => !urls.includes(r.url)));
      setSelected(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // Parse a single per-row tag entry. Supports "name:N" syntax to add N copies
  // in one go (e.g. "helo:3" → ["helo","helo","helo"], which the backend sums
  // into count 3). Plain "name" → ["name"] (count 1, today's behaviour).
  const parseTagEntry = (raw: string): { tag: string; count: number } | null => {
    const s = raw.trim();
    if (!s) return null;
    const m = s.match(/^(.+?):(\d+)$/);
    if (m) {
      const n = parseInt(m[2], 10);
      if (n >= 1 && n <= 99) return { tag: m[1].trim(), count: n };
    }
    return { tag: s, count: 1 };
  };

  const addTag = async (record: SearchResult, raw: string) => {
    const parsed = parseTagEntry(raw);
    if (!parsed) return;
    const tags = Array(parsed.count).fill(parsed.tag);
    await modifyTags([record.url], tags, 1);
    setTagInput(prev => ({ ...prev, [record.file_id]: '' }));
  };

  const removeTag = async (record: SearchResult, tag: string) => {
    await modifyTags([record.url], [tag], 0);
  };

  const bulkAddTag = () => {
    const tag = bulkTag.trim();
    if (!tag) return;
    const n = Math.max(1, Math.min(99, bulkCount || 1));
    modifyTags(selectedUrls(), Array(n).fill(tag), 1);
  };
  const bulkRemoveTag = () => modifyTags(selectedUrls(), [bulkTag.trim()], 0);

  const topTag = (r: SearchResult) => Object.entries(r.tags ?? {}).sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title">Manage detections</div>
          <div className="page-sub">Shared observatory — tag and delete any record</div>
        </div>
        <div className="topbar-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" strokeLinecap="round"/></svg>
          <input placeholder="Filter records…" value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <Link href="/upload" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          New upload
        </Link>
      </header>

      <div className="page">
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--clay-soft)', color: 'var(--clay)', fontSize: '14px', marginBottom: '16px' }}>{error}</div>
        )}

        <div className="mng-tabs">
          {TABS.map((tab, i) => (
            <div key={tab} className={`mng-tab${activeTab === i ? ' on' : ''}`} onClick={() => setActiveTab(i)}>
              {tab} <span style={{ color: activeTab === i ? 'var(--ochre)' : 'var(--ink-ghost)', marginLeft: '4px' }}>{i === 0 ? records.length : records.filter(r => r.file_type === (i === 1 ? 'image' : 'video')).length}</span>
            </div>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="bulkbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13.5px', color: 'var(--ink-soft)' }}><b style={{ color: 'var(--ink)' }}>{selected.size}</b> selected</span>
            <input
              type="text"
              placeholder="Tag name"
              value={bulkTag}
              onChange={e => setBulkTag(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '6px 10px', color: 'var(--ink)', minWidth: '140px' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ink-soft)' }}>
              ×
              <input
                type="number"
                min={1}
                max={99}
                value={bulkCount}
                onChange={e => setBulkCount(parseInt(e.target.value, 10) || 1)}
                title="How many times to add this tag (count in the tags map)"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '6px 8px', color: 'var(--ink)', width: '64px' }}
              />
            </label>
            <button className="btn btn-ghost btn-sm" onClick={bulkAddTag} disabled={tagging || !bulkTag.trim()}>
              {tagging ? 'Saving…' : `Add tag${bulkCount > 1 ? ` ×${bulkCount}` : ''}`}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={bulkRemoveTag} disabled={tagging || !bulkTag.trim()}>
              Remove tag
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '9px' }}>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--clay)', borderColor: 'var(--clay-soft)' }} onClick={deleteSelected} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete selected'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--line)', borderTopColor: 'var(--ochre)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-faint)', fontSize: '15px' }}>
            No records yet. <Link href="/upload" style={{ color: 'var(--ochre)' }}>Upload some wildlife media →</Link>
          </div>
        ) : (
          <div className="tbl-wrap scroll-x" style={{ marginTop: '16px' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: '38px' }}><input className="cb" type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                  <th>Detection</th>
                  <th>Top species</th>
                  <th>Confidence</th>
                  <th>Type</th>
                  <th>Tags</th>
                  <th style={{ width: '90px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const [species, conf] = topTag(r) ?? ['Unknown', 0];
                  return (
                    <tr key={r.file_id}>
                      <td><input className="cb" type="checkbox" checked={selected.has(r.file_id)} onChange={() => toggleSelect(r.file_id)} /></td>
                      <td>
                        <div className="sp-row">
                          <div className="sp-thumb">
                            {r.thumbnail_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={r.thumbnail_url} alt={species} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : null}
                          </div>
                          <div>
                            <div className="sp-name">{species}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '2px' }}>{r.file_id.slice(0, 16)}…</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '13.5px' }}>{species}</td>
                      <td>
                        <span className="conf">
                          <span className="conf-bar"><span className="conf-fill" style={{ width: `${Math.min(conf * 10, 100)}%`, background: 'var(--ochre)' }} /></span>
                          <span className="conf-val">{conf}×</span>
                        </span>
                      </td>
                      <td><span className={`badge ${r.file_type === 'video' ? 'badge-sky' : 'badge-mute'}`}>{r.file_type}</span></td>
                      <td>
                        {Object.entries(r.tags ?? {}).map(([t, count]) => (
                          <button
                            key={t}
                            type="button"
                            className="tag"
                            title="Click to remove tag"
                            onClick={() => removeTag(r, t)}
                            style={{ marginRight: '4px', marginBottom: '4px', cursor: 'pointer', border: 'none' }}
                          >
                            {t}{count > 1 ? ` ${count}×` : ''} ×
                          </button>
                        ))}
                        <input
                          type="text"
                          placeholder="+ tag or tag:N"
                          title="Add a tag — use 'name:N' to add N copies (e.g. helo:3 → count 3)"
                          value={tagInput[r.file_id] ?? ''}
                          onChange={e => setTagInput(prev => ({ ...prev, [r.file_id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addTag(r, tagInput[r.file_id] ?? '')}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'transparent', border: '1px dashed var(--ochre-soft)', borderRadius: '999px', padding: '2px 8px', color: 'var(--ochre)', width: '92px', outline: 'none' }}
                        />
                      </td>
                      <td>
                        <div className="row-act">
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="ibtn" title="View">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                          </a>
                          <button className="ibtn danger" title="Delete" onClick={async () => { try { await api.deleteFiles({ urls: [r.url] }); setRecords(prev => prev.filter(x => x.url !== r.url)); } catch { setError('Delete failed'); } }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h18M8 7V5h8v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', marginTop: '18px', color: 'var(--ink-faint)', fontSize: '13px' }}>
          <span>Showing {filtered.length} of {records.length}</span>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
          </div>
        </div>
      </div>
    </>
  );
}
