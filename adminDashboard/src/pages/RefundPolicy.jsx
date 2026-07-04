import InfoPage, { Section } from "../components/InfoPage";

const RefundPolicy = () => (
  <InfoPage
    title="Refund Policy"
    subtitle="Current status of payments and refunds on Bideo."
    updated="July 4, 2026"
  >
    <Section heading="Current payment status">
      <p>
        Bideo currently does not offer paid subscriptions, paid downloads, or
        paid digital goods through this website. If paid features are introduced,
        applicable pricing and refund terms will be provided before purchase.
      </p>
    </Section>
    <Section heading="Future paid features">
      <p>
        Future creator, membership, advertising, or digital product features may
        have separate payment, cancellation, and refund terms. Those terms will
        apply only when the feature is available and accepted by the user.
      </p>
    </Section>
    <Section heading="Contact">
      <p>
        For billing questions, contact{" "}
        <a className="font-medium text-brand hover:underline" href="mailto:bideoapps@gmail.com">
          bideoapps@gmail.com
        </a>
        .
      </p>
    </Section>
  </InfoPage>
);

export default RefundPolicy;
