import InfoPage, { Section } from "../components/InfoPage";

const About = () => (
  <InfoPage
    title="About Bideo"
    subtitle="A mobile-first video platform for viewers and creators."
  >
    <Section heading="Our mission">
      <p>
        Bideo is a video sharing platform built for people who want to watch,
        create, and discover original content from their phone. Our goal is to
        provide a simple, reliable, and respectful place for creators and viewers.
      </p>
    </Section>
    <Section heading="What Bideo offers">
      <p>
        Users can watch videos and shorts, create channels, upload content,
        follow creators, build playlists, and interact with content through
        platform features such as likes, comments, and reports.
      </p>
    </Section>
    <Section heading="Creator growth">
      <p>
        Bideo provides tools for creators to publish original videos and build an
        audience over time. We do not guarantee views, followers, income, rewards,
        or monetization. Any future monetization features may be available only to
        eligible creators under separate program terms.
      </p>
    </Section>
    <Section heading="Safety and responsibility">
      <p>
        Bideo is a user-generated content platform. Users are responsible for the
        content they upload, and content must follow our Community Guidelines,
        copyright rules, and applicable laws. Reports and moderation tools help us
        keep the platform safer for viewers, creators, advertisers, and partners.
      </p>
    </Section>
  </InfoPage>
);

export default About;
