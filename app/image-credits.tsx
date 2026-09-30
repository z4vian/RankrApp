import { Link } from 'expo-router';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import media from '../lib/marketing-media.json';
import { colors } from '../lib/theme';
export default function ImageCredits() {
  return <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.page}>
    <Link href="/landing" style={styles.link}>Back to Rankr</Link>
    <Text accessibilityRole="header" style={styles.title}>Image credits</Text>
    <Text style={styles.body}>Real works, illustrative rankings. These images were selected from Wikimedia Commons for a US launch. Most are marked public domain; the 0 A.D. screenshot is copyrighted and available under a Creative Commons license. These permissions apply to the specific images, not every image or edition of a title. No endorsement is implied.</Text>
    {media.map(item => <View key={item.title} style={styles.item}>
      <Text accessibilityRole="header" style={styles.heading}>{item.title}</Text>
      <Text style={styles.body}>{item.creator} · {item.license}</Text>
      <Text style={styles.body}>{item.changes}</Text>
      <Link href={item.source as any} style={styles.link}>Image source and rights statement</Link>
      {item.licenseUrl ? <Link href={item.licenseUrl as any} style={styles.link}>Read the license</Link> : null}
    </View>)}
    <Text style={styles.body}>Source statements checked September 29, 2026. Public-domain status can differ outside the United States. Downloaded source metadata is retained in the repository. Adaptations of the 0 A.D. image remain available under CC BY-SA 3.0.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: 24, gap: 24 }, title: { color: colors.text, fontSize: 30, fontWeight: '700' }, heading: { color: colors.text, fontSize: 20, fontWeight: '600' }, body: { color: colors.textSecondary, fontSize: 16, lineHeight: 25 }, link: { color: colors.purpleLight, fontSize: 16, paddingVertical: 8 }, item: { gap: 8, paddingVertical: 16 } });
