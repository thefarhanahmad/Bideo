import InfoPage, { Section } from "../components/InfoPage";

const Terms = () => (
  <InfoPage
    title="Terms and Conditions"
    subtitle="The rules for using Bideo."
    updated="July 4, 2026"
  >
    <Section heading="1. Acceptance of terms">
      <p>
        By accessing or using Bideo, you agree to these Terms and Conditions and
        any policies referenced here, including our Community Guidelines, Privacy
        Policy, and Copyright Policy. If you do not agree, do not use Bideo.
      </p>
    </Section>
    <Section heading="2. Accounts and eligibility">
      <p>
        You are responsible for your account and all activity under it. You must
        provide accurate information and keep your login credentials secure. Users
        must meet the minimum age required by applicable law to create an account.
      </p>
    </Section>
    <Section heading="3. User content">
      <p>
        You retain ownership of content you upload. By uploading content, you
        grant Bideo a worldwide, non-exclusive, royalty-free license to host,
        store, process, display, distribute, and promote that content for the
        purpose of operating and improving the service.
      </p>
      <p>
        You are solely responsible for your content and must have all rights,
        permissions, and licenses needed to upload it.
      </p>
    </Section>
    <Section heading="4. Prohibited content and conduct">
      <p>
        You may not upload or share content involving nudity or sexual content,
        graphic violence, hate speech, harassment, threats, scams, spam,
        impersonation, illegal activity, child safety violations, or copyrighted
        material you do not have permission to use.
      </p>
    </Section>
    <Section heading="5. Moderation and enforcement">
      <p>
        We may review, restrict, remove, or reduce distribution of content that
        violates our policies or creates legal, safety, or advertiser-suitability
        risk. Repeat or severe violations may result in account suspension or
        termination.
      </p>
    </Section>
    <Section heading="6. Monetization">
      <p>
        Bideo does not guarantee income, rewards, payouts, views, followers, or
        audience growth. Creator monetization features are planned for eligible
        creators in the future and may depend on eligibility, location, policy
        compliance, advertiser suitability, review status, and separate program
        terms.
      </p>
    </Section>
    <Section heading="7. Service changes">
      <p>
        We may update, suspend, limit, or discontinue features at any time. We
        may also update these Terms. Continued use of Bideo after updates means
        you accept the revised terms.
      </p>
    </Section>
    <Section heading="8. Contact">
      <p>
        Questions about these terms can be sent to{" "}
        <a className="font-medium text-brand hover:underline" href="mailto:bideoapps@gmail.com">
          bideoapps@gmail.com
        </a>
        .
      </p>
    </Section>
  </InfoPage>
);

export default Terms;
