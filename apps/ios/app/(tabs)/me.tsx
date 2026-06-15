import { Ionicons } from '@expo/vector-icons';
import { type GenderType } from '@moajoa/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, LayoutAnimation, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BirthdaySheet,
  GENDER_LABELS,
  GenderSheet,
  NicknameSheet,
} from '@/components/me/profile-sheets';
import { supabase } from '@/lib/supabase';
import { toYMD } from '@/lib/trip-format';

/**
 * "내 정보" tab. Profile hero card → editable profile fields (닉네임/성별/생일,
 * inline bottom-sheet editing, persisted to the profiles table) → grouped
 * settings/legal menus → logout. Layout follows the MOAJOA design system: tinted
 * scaffold, white rounded cards, brand-blue accents.
 *
 * Sub-screens (설정, 도움말, 약관) don't exist yet — those rows fall through to a
 * "준비 중" placeholder until built.
 */

// Soft ambient card shadow used by the hero card and section cards.
const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
};

type Profile = {
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  gender: GenderType | null;
  birthday: string | null; // 'YYYY-MM-DD'
};

// "1995-03-14" → "1995. 3. 14."
function formatBirthday(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function MenuSection({ header, items }: { header: string; items: MenuItem[] }) {
  return (
    <View className="mb-6">
      <Text className="px-2 mb-2 text-xs font-extrabold tracking-[2px] text-neutral-400">
        {header}
      </Text>
      <View className="bg-white rounded-3xl overflow-hidden" style={cardShadow}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            className="flex-row items-center px-5 py-4 active:bg-brand-50"
          >
            <View className="w-10 h-10 rounded-xl bg-brand-50 items-center justify-center">
              <Ionicons name={item.icon} size={20} color="#2979FF" />
            </View>
            <Text className="flex-1 ml-4 text-base font-bold text-neutral-900">{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// A single editable "내 정보" row: label left, value (or 추가 placeholder) + chevron right.
function FieldRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center px-5 py-4 active:bg-brand-50">
      <Text className="text-base font-bold text-neutral-900">{label}</Text>
      <View className="flex-1" />
      <Text className={`text-base mr-2 ${value ? 'text-neutral-500' : 'text-neutral-300'}`}>
        {value ?? '추가'}
      </Text>
      <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
    </Pressable>
  );
}

export default function MeTab() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<'nickname' | 'gender' | 'birthday' | null>(null);
  const [expanded, setExpanded] = useState(false);

  function toggleExpand() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      setUid(u.id);
      const { data: row } = await supabase
        .from('profiles')
        .select('display_name, email, avatar_url, gender, birthday')
        .eq('id', u.id)
        .single();
      if (row) {
        setProfile({
          display_name: row.display_name,
          email: row.email,
          avatar_url: row.avatar_url,
          gender: (row.gender as GenderType | null) ?? null,
          birthday: row.birthday,
        });
      }
    });
  }, []);

  // Persist a profile patch and reflect it locally. Surfaces failures (RLS, network).
  async function patch(fields: Partial<Profile>) {
    if (!uid) return;
    setEditing(null);
    const { error } = await supabase.from('profiles').update(fields).eq('id', uid);
    if (error) {
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요');
      return;
    }
    setProfile((p) => (p ? { ...p, ...fields } : p));
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/welcome');
  }

  const soon = () => Alert.alert('준비 중', '곧 지원될 기능이에요');

  const genderLabel = profile?.gender ? GENDER_LABELS[profile.gender] : null;
  const birthdayLabel = profile?.birthday ? formatBirthday(profile.birthday) : null;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <ScrollView className="flex-1">
        <View className="px-5 pt-6 pb-24">
          <Text className="px-2 mb-4 text-2xl font-extrabold tracking-tight text-neutral-900">
            내 정보
          </Text>

          {/* Profile hero card — tap the footer to slide the fields open/closed */}
          <View className="bg-white rounded-3xl p-5 mb-4" style={cardShadow}>
            <View className="flex-row items-center">
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="w-20 h-20 rounded-full" />
              ) : (
                <View className="w-20 h-20 rounded-full bg-brand-500 items-center justify-center">
                  <Text className="text-white text-3xl font-bold">
                    {(profile?.display_name?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="flex-1 ml-4">
                <Text className="text-xl font-extrabold text-neutral-900" numberOfLines={1}>
                  {profile?.display_name ?? '...'}
                </Text>
                <Text className="text-sm text-neutral-500 mt-0.5" numberOfLines={1}>
                  {profile?.email ?? ''}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={toggleExpand}
              className="flex-row items-center justify-center mt-4 pt-4 border-t border-neutral-100"
            >
              <Text className="text-sm font-bold text-brand-600 mr-1">
                {expanded ? '닫기' : '프로필 수정'}
              </Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#2563EB" />
            </Pressable>
          </View>

          {/* Editable profile fields — slides open when expanded */}
          {expanded && (
            <View className="mb-6">
              <View className="bg-white rounded-3xl overflow-hidden" style={cardShadow}>
                <FieldRow
                  label="닉네임"
                  value={profile?.display_name ?? null}
                  onPress={() => setEditing('nickname')}
                />
                <View className="h-px bg-neutral-100 ml-5" />
                <FieldRow label="성별" value={genderLabel} onPress={() => setEditing('gender')} />
                <View className="h-px bg-neutral-100 ml-5" />
                <FieldRow
                  label="생일"
                  value={birthdayLabel}
                  onPress={() => setEditing('birthday')}
                />
              </View>
            </View>
          )}

          {/* Settings / support / legal */}
          <MenuSection
            header="설정"
            items={[
              { icon: 'notifications-outline', label: '알림', onPress: soon },
              { icon: 'settings-outline', label: '환경설정', onPress: soon },
            ]}
          />
          <MenuSection
            header="지원"
            items={[{ icon: 'help-circle-outline', label: '도움말', onPress: soon }]}
          />
          <MenuSection
            header="약관"
            items={[
              { icon: 'document-text-outline', label: '이용약관', onPress: soon },
              { icon: 'shield-checkmark-outline', label: '개인정보처리방침', onPress: soon },
            ]}
          />

          {/* Logout */}
          <Pressable
            onPress={() =>
              Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
                { text: '취소', style: 'cancel' },
                { text: '로그아웃', style: 'destructive', onPress: signOut },
              ])
            }
            className="flex-row items-center justify-center py-4 mt-1"
          >
            <Ionicons name="log-out-outline" size={16} color="#EF4444" />
            <Text className="ml-2 text-sm font-extrabold tracking-[2px] text-danger">로그아웃</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit sheets */}
      <NicknameSheet
        visible={editing === 'nickname'}
        initial={profile?.display_name ?? ''}
        onClose={() => setEditing(null)}
        onConfirm={(value) => patch({ display_name: value })}
      />
      <GenderSheet
        visible={editing === 'gender'}
        initial={profile?.gender ?? null}
        onClose={() => setEditing(null)}
        onConfirm={(value) => patch({ gender: value })}
      />
      <BirthdaySheet
        visible={editing === 'birthday'}
        initial={profile?.birthday ?? null}
        todayYMD={toYMD(new Date())}
        onClose={() => setEditing(null)}
        onConfirm={(ymd) => patch({ birthday: ymd })}
      />
    </SafeAreaView>
  );
}
