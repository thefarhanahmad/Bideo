import InfoPage, { Section } from "../components/InfoPage";

const AccountDeletion = () => (
  <InfoPage
    title="Account Deletion Policy"
    subtitle="How to request deletion of your Bideo account."
    updated="July 4, 2026"
  >
    <Section heading="Request account deletion">
      <p>
        You may request deletion of your Bideo account by contacting support from
        the email or phone number associated with your account, or by using any
        account deletion option available in the app.
      </p>
      <p>
        Email requests to{" "}
        <a className="font-medium text-brand hover:underline" href="mailto:bideoapps@gmail.com">
          bideoapps@gmail.com
        </a>
        .
      </p>
    </Section>
    <Section heading="What may be deleted">
      <p>
        Account profile data and user-uploaded content may be deleted or
        deactivated as part of the request, subject to verification and technical
        limitations.
      </p>
    </Section>
    <Section heading="What may be retained">
      <p>
        Some records may be retained when required for security, fraud prevention,
        legal compliance, dispute resolution, policy enforcement, or abuse
        investigations.
      </p>
    </Section>
    <Section heading="Processing time">
      <p>
        We aim to process verified deletion requests within a reasonable period.
        Additional verification may be required to protect account security.
      </p>
    </Section>
  </InfoPage>
);

export default AccountDeletion;
