import InfoPage, { Section } from "../components/InfoPage";

const ModerationPolicy = () => (
  <InfoPage
    title="Content Moderation Policy"
    subtitle="How Bideo reviews reports and enforces platform rules."
    updated="July 4, 2026"
  >
    <Section heading="Our approach">
      <p>
        Bideo uses user reports, policy reviews, and platform checks to identify
        content that may violate our rules or create safety, legal, or
        advertiser-suitability concerns.
      </p>
    </Section>
    <Section heading="What may be moderated">
      <p>
        Videos, shorts, thumbnails, titles, descriptions, comments, profiles,
        channel names, and other user-generated content may be reviewed.
      </p>
    </Section>
    <Section heading="Possible actions">
      <p>
        Depending on the issue, we may remove content, restrict visibility,
        disable features, issue warnings, suspend accounts, terminate accounts,
        or preserve information when needed for safety or legal reasons.
      </p>
    </Section>
    <Section heading="Reports">
      <p>
        Users can report content in the app. Reports should include accurate
        details and should not be used to harass creators or abuse the moderation
        process.
      </p>
    </Section>
    <Section heading="Appeals">
      <p>
        If you believe an enforcement action was made in error, contact support
        with relevant account and content details. Appeals are reviewed at
        Bideo's discretion.
      </p>
    </Section>
  </InfoPage>
);

export default ModerationPolicy;
