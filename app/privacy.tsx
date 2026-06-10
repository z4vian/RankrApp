/**
 * app/privacy.tsx — Privacy Policy screen.
 *
 * For beta. Real copy needs to be drafted by counsel before public launch.
 * The screen also links out to a hosted version at rankrapp.com/privacy
 * (placeholder URL — update when the marketing site exists).
 */

import { LegalDocument } from '@/components';

export default function PrivacyScreen() {
  return (
    <LegalDocument
      title="Privacy Policy"
      lastUpdated="2026-06-09"
      webUrl="https://rankrapp.com/privacy"
      sections={[
        {
          heading: 'Summary',
          body: 'Rankr collects only the data needed to run the app: your email, the lists and rankings you create, and the social actions you take (follows, likes, comments). We don\'t sell your data. You can export or delete it from Profile > Settings at any time.',
        },
        {
          heading: 'What we collect',
          body: 'Account info you provide (email, username, display name, optional bio + avatar). Content you create (lists, ranked items, posts, comments, notes, photos). Activity (follows, likes, items you save). Device data (push token if you opt in, anonymous crash reports). When you sign in with Google, we receive your name, email, and profile photo from Google.',
        },
        {
          heading: 'How we use it',
          body: 'To show you your data and your friends\' data inside the app, to generate recommendations for you, to send push notifications you have opted in to, and to fix bugs we discover from anonymous crash reports.',
        },
        {
          heading: 'Public content',
          body: 'Lists you mark as Public, posts, comments, and your profile (username, display name, avatar, bio) are visible to anyone using Rankr. Private lists and notes are visible only to you.',
        },
        {
          heading: 'Third parties',
          body: 'We use Supabase to store your data. We call third-party APIs (TMDB, RAWG, iTunes, Google Books) to look up movie/game/music/book metadata when you search — these requests do not include your account info. We use Expo to deliver push notifications.',
        },
        {
          heading: 'Your rights',
          body: 'You can export your data as JSON at any time from Profile > Settings > Export data. You can delete your account from Profile > Settings > Delete account — this permanently removes your profile, lists, items, posts, comments, and likes. We do not retain a copy.',
        },
        {
          heading: 'Children',
          body: 'Rankr is not intended for users under 13. If we learn we have collected data from a child under 13, we will delete it.',
        },
        {
          heading: 'Changes',
          body: 'If we make material changes to this policy, we will notify you in-app before the changes take effect.',
        },
      ]}
    />
  );
}
