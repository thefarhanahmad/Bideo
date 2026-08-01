import InfoPage, { Section } from '../components/InfoPage';

const AccountDeletion = () => {
  return (
    <InfoPage
      title="Bideo Account & Data Deletion Policy"
      subtitle="Step-by-step instructions and policy details for requesting account deletion on Bideo."
      updated="August 1, 2026"
    >
      {/* App & Developer Info Banner */}
      <div className="rounded-2xl border border-brand/20 bg-brand-50/50 p-6 text-ink">
        <h3 className="font-display text-lg font-bold text-brand">App & Developer Information</h3>
        <p className="mt-1 text-sm text-muted">
          App Name: <strong className="text-ink">Bideo — Video Platform & Short Videos</strong> | Developer: <strong className="text-ink">Bideo Team</strong>
        </p>
        <p className="mt-2 text-sm text-muted">
          In compliance with Google Play Store User Data policies, Bideo provides users with the ability to request permanent deletion of their account and all associated personal data directly from within the Bideo Android application.
        </p>
      </div>

      {/* Section 1: In-App Deletion Instructions */}
      <Section heading="How to Request Account & Data Deletion">
        <p>You can request permanent deletion of your Bideo account and data directly inside the mobile app by following these steps:</p>
        <ol className="mt-4 space-y-3.5 pl-1">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">1</span>
            <span>Open the <strong>Bideo app</strong> on your Android device and log in to your account.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">2</span>
            <span>Navigate to the <strong>Library</strong> tab on the bottom menu bar.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">3</span>
            <span>Tap the <strong>Settings</strong> icon (gear icon) in the top-right corner.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">4</span>
            <span>Under the <em>Account Actions</em> section, select <strong>Delete Profile</strong>.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">5</span>
            <span>Provide a reason and your password, tap <strong>Delete Profile</strong>, and confirm the confirmation modal.</span>
          </li>
        </ol>
      </Section>

      {/* Section 2: Data Deletion Breakdown & Retention Period */}
      <Section heading="Data Deletion & 5-Day Grace Period">
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface/50 p-5">
            <h4 className="font-bold text-ink text-base">⏳ 5-Day Grace Period (120 Hours)</h4>
            <p className="mt-1.5 text-sm text-muted">
              When a deletion request is initiated, your account enters a <strong>5-day grace period</strong>. During these 5 days, your profile is immediately locked and hidden from public view. If you change your mind, you may submit an Account Recovery request. After 5 days, all associated data is permanently and irreversibly destroyed.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface/80 text-xs font-bold uppercase tracking-wider text-ink">
                <tr>
                  <th className="p-3.5">Data Category</th>
                  <th className="p-3.5">Associated Data Types</th>
                  <th className="p-3.5">Action Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-muted text-xs sm:text-sm">
                <tr>
                  <td className="p-3.5 font-semibold text-ink">Account Profile</td>
                  <td className="p-3.5">Full Name, Phone Number, Email, Channel Bio, Avatar & Cover Image</td>
                  <td className="p-3.5 text-red-600 font-semibold">Permanently Deleted</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-ink">User Content</td>
                  <td className="p-3.5">Uploaded Videos, Short Videos, Thumbnails & Community Posts</td>
                  <td className="p-3.5 text-red-600 font-semibold">Permanently Deleted</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-ink">Activity Data</td>
                  <td className="p-3.5">Watch History, Liked Videos, Search History, Comments & Playlists</td>
                  <td className="p-3.5 text-red-600 font-semibold">Permanently Deleted</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-ink">Social Graph</td>
                  <td className="p-3.5">Followers, Following Channels & Subscriptions</td>
                  <td className="p-3.5 text-red-600 font-semibold">Permanently Deleted</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Section 3: Contact Details */}
      <Section heading="Contact Us for Deletion Assistance">
        <p>
          If you have questions about our account deletion policy or require assistance, please contact our support team at:
        </p>
        <p className="mt-2 font-medium text-ink">
          Email: <a className="font-semibold text-brand hover:underline" href="mailto:bideoapps@gmail.com">bideoapps@gmail.com</a>
        </p>
      </Section>
    </InfoPage>
  );
};

export default AccountDeletion;
