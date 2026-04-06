import PageMeta from '../components/PageMeta'

export default function Contact() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 md:py-24">
      <PageMeta
        title="Contact Us"
        description="Have questions, feedback, or want to get involved? Get in touch with the Map the Mess team."
      />
      <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
      <p className="text-lg text-gray-600 max-w-xl mb-8">
        Have questions, feedback, or want to get involved? Send us an email and we'll get back to
        you.
      </p>

      <a
        href="mailto:info@mapthemess.uk"
        className="bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-lg text-lg transition"
      >
        info@mapthemess.uk
      </a>

      <p className="text-lg text-gray-600 max-w-xl mb-8 mt-8">
        Having any issues? Send us an email and we'll get back to you.
      </p>

      <a
        href="mailto:support@mapthemess.uk"
        className="bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-lg text-lg transition"
      >
        support@mapthemess.uk
      </a>

      <div className="mt-12 text-gray-500">
        <p className="mb-2">You can also find us on:</p>
        <div className="flex flex-col gap-3 items-center">
          <a
            href="https://github.com/max246/Map-the-mess"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline font-medium"
          >
            github.com/max246/Map-the-mess
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=61577665256083"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline font-medium"
          >
            Facebook
          </a>
        </div>
      </div>
    </div>
  )
}
