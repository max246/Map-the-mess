import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'

export default function Disclaimer() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <PageMeta
        title="Disclaimer"
        description="Disclaimer and conditions of use for Map the Mess."
      />
      <h1 className="text-3xl font-bold mb-8">Disclaimer & Conditions of Use</h1>

      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-8">
        <p className="text-amber-900 font-semibold">
          Use of this platform and any actions taken based on information found here are entirely at
          your own risk. Map the Mess and its operators accept no responsibility or liability for
          any injury, loss, damage, or legal consequence arising from your use of this service.
        </p>
      </div>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What This Platform Is For</h2>
          <p>
            Map the Mess is a community platform for reporting <strong>small-scale litter</strong>{' '}
            that is suitable for collection by volunteer litter pickers — for example, scattered
            cans, bottles, wrappers, or small bags of rubbish.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Fly-Tipping & Large Dumping</h2>
          <p>
            This platform is <strong>not</strong> intended for reporting fly-tipping, large-scale
            illegal dumping, hazardous waste, or any waste that requires specialist equipment or
            vehicles to remove. If you encounter fly-tipping or large-scale dumping, please report
            it directly to your <strong>local council</strong> who have the legal powers and
            resources to deal with it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Personal Safety</h2>
          <p>
            Map the Mess and its operators accept <strong>no responsibility or liability</strong>{' '}
            for any injury, harm, loss, or damage sustained by any person who chooses to visit a
            reported location or attempt to collect litter. Volunteering to pick up litter is done
            entirely at your own risk. You should always:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Assess the area for hazards before picking up any litter</li>
            <li>
              Wear appropriate protective equipment (gloves, high-visibility clothing, sturdy
              footwear)
            </li>
            <li>Never pick up needles, syringes, broken glass, or any hazardous materials</li>
            <li>Avoid working near busy roads, waterways, or unstable ground</li>
            <li>Let someone know where you are going and when you expect to return</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Private Land & Permission</h2>
          <p>
            Some reported litter may be located on <strong>private land</strong>. You must obtain
            permission from the landowner before entering any private property to collect litter.
            Map the Mess accepts no responsibility for any trespass or legal consequences arising
            from entering private land without proper authorisation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Map the Mess, its operators, contributors, and
            volunteers shall not be held liable for any direct, indirect, incidental, or
            consequential damages, claims, or legal actions arising from:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>The use of information or locations provided on this platform</li>
            <li>Any injury or harm sustained while collecting litter</li>
            <li>Entering private or restricted land</li>
            <li>The accuracy or completeness of any report submitted by users</li>
            <li>Any interaction between users, volunteers, or third parties</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Accuracy of Reports</h2>
          <p>
            Reports are submitted by members of the public and have not been independently verified.
            Map the Mess makes no guarantees about the accuracy, completeness, or current status of
            any report. Litter may have already been collected or conditions at the reported
            location may have changed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">By Using This Platform</h2>
          <p>
            By submitting a report or using information from this platform, you acknowledge that you
            have read and understood these conditions and agree to act at your own risk and
            responsibility.
          </p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-200">
        <Link to="/report" className="text-brand hover:underline font-medium">
          &larr; Back to Report Litter
        </Link>
      </div>
    </div>
  )
}
