'use client';

import { useState } from 'react';
import type { ResolvedPlace } from '@moajoa/core';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button } from './button';
import { Input } from './input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { useToast } from './toast';

/**
 * AddContentTabs — 링크 붙여넣기 / 장소 검색 2탭 (D-11).
 * 온보딩 step 4와 지도탭 추가 시트(24-07)가 공유하는 컴포넌트. 스테이징/추가 로직은
 * 부모가 콜백으로 소유한다 — 이 컴포넌트는 유효 URL 검증(new URL)과 resolve-place EF
 * 검색만 담당하고 DB에 직접 쓰지 않는다.
 */

export interface PickedPlace {
  id: string;
  name: string;
  address: string | null;
}

export interface AddContentTabsProps {
  /** 유효 URL만 전달됨(new URL 통과). */
  onAddLink: (url: string) => void | Promise<void>;
  onPickPlace: (place: PickedPlace) => void | Promise<void>;
  busy?: boolean;
}

export function AddContentTabs({ onAddLink, onPickPlace, busy }: AddContentTabsProps) {
  const { toast } = useToast();

  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResolvedPlace[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  function submitLink() {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast('올바른 링크가 아니에요', { variant: 'error' });
      return;
    }
    void onAddLink(trimmed);
    setUrl('');
  }

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const { data, error } = await getSupabaseBrowser().functions.invoke('resolve-place', {
        body: { query: q, language: 'ko' },
      });
      if (error) throw error;
      const places = (data?.places ?? []) as ResolvedPlace[];
      setResults(places);
      setSearched(true);
    } catch (err) {
      console.error(err);
      toast('장소를 검색하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    } finally {
      setSearching(false);
    }
  }

  return (
    <Tabs defaultValue="link" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="link">링크 붙여넣기</TabsTrigger>
        <TabsTrigger value="search">장소 검색</TabsTrigger>
      </TabsList>

      <TabsContent value="link" className="flex flex-col gap-3 pt-3">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitLink();
          }}
          placeholder="유튜브·블로그 링크를 붙여넣어 주세요"
          inputMode="url"
        />
        <Button className="w-full" disabled={busy || url.trim().length === 0} onClick={submitLink}>
          링크 추가하기
        </Button>
      </TabsContent>

      <TabsContent value="search" className="flex flex-col gap-3 pt-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch();
            }}
            placeholder="장소 이름을 검색해 보세요"
          />
          <Button
            variant="outline"
            disabled={searching || query.trim().length === 0}
            onClick={() => void runSearch()}
          >
            검색
          </Button>
        </div>

        {searched && results.length === 0 && !searching && (
          <p className="py-2 text-sm text-neutral-500">
            검색 결과가 없어요. 다른 이름으로 찾아보세요
          </p>
        )}

        {results.length > 0 && (
          <ul className="flex flex-col divide-y divide-neutral-200">
            {results.map((p) => (
              <li key={p.google_place_id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void onPickPlace({
                      id: p.google_place_id,
                      name: p.displayName,
                      address: p.formattedAddress,
                    })
                  }
                  className="flex min-h-[44px] w-full flex-col justify-center py-2 text-left disabled:opacity-50"
                >
                  <span className="text-base text-neutral-900">{p.displayName}</span>
                  {p.formattedAddress && (
                    <span className="text-xs text-neutral-500">{p.formattedAddress}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
