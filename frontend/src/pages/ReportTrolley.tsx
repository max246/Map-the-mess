import PageMeta from '../components/PageMeta'

export default function ReportTrolley() {
  return (
    <div className="h-full">
      <PageMeta
        title="Report Trolley"
        description="Report an abandoned shopping trolley in your area."
      />
      <iframe
        src="https://green-hill-09d312703.4.azurestaticapps.net/createreport"
        title="Report Trolley"
        className="w-full h-full border-0"
      />
    </div>
  )
}
