import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <PageMeta
        title="Privacy Policy"
        description="How Map the Mess collects, uses, and protects your personal data."
      />
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: 20 March 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Who We Are</h2>
          <p>
            Map the Mess is a community platform for reporting and coordinating the collection of
            litter. When we refer to "we", "us", or "our" in this policy, we mean the operators of
            Map the Mess.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What Data We Collect</h2>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">Account Information</h3>
          <p>
            When you register, we collect your full name, email address, and a password. Your
            password is stored in a securely hashed format and is never stored or visible in plain
            text.
          </p>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">Location Data</h3>
          <p>
            When you submit a report, we collect the GPS coordinates of the litter location. This
            may come from your device's location services or be manually placed on the map. We also
            store an optional what3words address if you provide one. We do not continuously track
            your location — it is only captured at the point of report submission.
          </p>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">Photos</h3>
          <p>
            You may upload photos when submitting a report. Photos can contain embedded metadata
            (EXIF data) such as the device model, date taken, and GPS coordinates. Uploaded photos
            may also unintentionally capture identifiable individuals, vehicles, or private
            property. Please be mindful of what is visible in your photos before uploading.
          </p>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">Technical Data</h3>
          <p>
            When you use the platform, our servers may automatically collect technical information
            such as your IP address, browser type, operating system, and pages visited. This data is
            used for security, troubleshooting, and to keep the platform running.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Use Your Data</h2>
          <p>We use your personal data to:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Create and manage your account</li>
            <li>Display litter reports on the public map</li>
            <li>Enable volunteers to find and collect reported litter</li>
            <li>Send you account-related emails (e.g. email verification, password reset)</li>
            <li>Administer and improve the platform</li>
            <li>Prevent abuse and ensure security</li>
          </ul>
          <p className="mt-3">
            We process your data on the basis of your consent (given at registration) and our
            legitimate interest in operating a community litter reporting service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What Is Publicly Visible</h2>
          <p>
            When you submit a report, the following information is visible to all users of the
            platform:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>The litter location (coordinates and map marker)</li>
            <li>Your description of the litter</li>
            <li>Any photos you upload</li>
            <li>The what3words address (if provided)</li>
          </ul>
          <p className="mt-3">Your email address and password are never publicly displayed.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Services</h2>
          <p>We use the following third-party services that may receive some of your data:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>
              <strong>What3Words</strong> — when you search for or enter a what3words address, your
              query is sent to the What3Words API. See their{' '}
              <a
                href="https://what3words.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                privacy policy
              </a>
              .
            </li>
            <li>
              <strong>OpenStreetMap</strong> — map tiles are loaded from OpenStreetMap servers,
              which may log your IP address. See their{' '}
              <a
                href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                privacy policy
              </a>
              .
            </li>
          </ul>
          <p className="mt-3">We do not sell your data to any third party.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies & Local Storage</h2>
          <p>
            We use browser local storage to keep you logged in between sessions by storing an
            authentication token. This is essential for the platform to function and is not used for
            tracking or advertising. We do not use third-party tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. Litter reports
            (including photos, descriptions, and locations) are retained to maintain a historical
            record of community clean-up efforts. If you delete your account, your personal account
            information will be removed, but submitted reports may be retained in an anonymised
            form.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights</h2>
          <p>Under UK data protection law (UK GDPR), you have the right to:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Request a copy of your data in a portable format</li>
            <li>Withdraw your consent at any time</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, please contact us using the details on our{' '}
            <Link to="/contact" className="text-brand hover:underline">
              contact page
            </Link>
            . We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Security</h2>
          <p>
            We take reasonable measures to protect your data, including encrypted passwords, secure
            HTTPS connections, and access controls. However, no system is completely secure and we
            cannot guarantee the absolute security of your information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Children</h2>
          <p>
            This platform is not intended for use by anyone under the age of 16. We do not knowingly
            collect personal data from children under 16. If you believe a child has provided us
            with their data, please contact us and we will delete it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Use at Your Own Risk</h2>
          <p>
            This platform is provided on an "as is" and "as available" basis. While we take
            reasonable steps to keep the platform running and your data secure, we make no
            warranties or guarantees of any kind, whether express or implied. Your use of Map the
            Mess, including any actions you take based on information found on the platform, is
            entirely at your own risk. We accept no liability for any loss, damage, injury, or legal
            consequence arising from your use of the platform. Please also refer to our{' '}
            <Link to="/disclaimer" className="text-brand hover:underline font-medium">
              disclaimer and conditions of use
            </Link>{' '}
            for full details.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. Any changes will be posted on this
            page with an updated revision date. Continued use of the platform after changes
            constitutes acceptance of the revised policy.
          </p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-200">
        <Link to="/" className="text-brand hover:underline font-medium">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  )
}
