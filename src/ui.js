import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export const C = { g: '#1a5c2a', g2: '#e3f1e6', ink: '#16241a', mut: '#5b6b60', line: '#d6e0d8', bg: '#f4f8f4',
  ok: '#1a7a35', okbg: '#dff3e4', bad: '#b3261e', badbg: '#fbe4e2', warn: '#b8860b', wbg: '#fbf1d3' };

export const Screen = ({ children, pad = true }) => (
  <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: pad ? 16 : 0, paddingBottom: 32 }}>{children}</ScrollView>
);
export const H1 = ({ children }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }) => <Text style={s.h2}>{children}</Text>;
export const P = ({ children, style }) => <Text style={[s.p, style]}>{children}</Text>;
export const Card = ({ children, style, onPress }) => {
  const W = onPress ? TouchableOpacity : View;
  return <W onPress={onPress} style={[s.card, style]}>{children}</W>;
};
export const Row = ({ children, style }) => <View style={[s.row, style]}>{children}</View>;
export const Tag = ({ text, kind = 'ok' }) => {
  const m = { ok: [C.okbg, C.ok], bad: [C.badbg, C.bad], warn: [C.wbg, C.warn] }[kind];
  return <Text style={[s.tag, { backgroundColor: m[0], color: m[1] }]}>{text}</Text>;
};
export const Btn = ({ title, onPress, outline, disabled, danger, style }) => (
  <TouchableOpacity disabled={disabled} onPress={onPress}
    style={[s.btn, outline && s.btnO, danger && { borderColor: C.bad }, disabled && { opacity: 0.45 }, style]}>
    <Text style={[s.btnT, outline && { color: danger ? C.bad : C.g }]}>{title}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', color: C.ink, marginBottom: 6 },
  h2: { fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 16, marginBottom: 8 },
  p: { fontSize: 13, color: C.mut, lineHeight: 19 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginBottom: 9 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tag: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' },
  btn: { backgroundColor: C.g, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10, borderWidth: 1.5, borderColor: C.g },
  btnO: { backgroundColor: 'transparent' },
  btnT: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
