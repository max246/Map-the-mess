import ReactMarkdown from 'react-markdown'

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-bold mt-3 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-semibold mt-2 mb-1">{children}</h3>,
        p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        a: ({ href, children }) => (
          <a href={href} className="text-brand underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="bg-gray-100 rounded px-1 py-0.5 text-sm">{children}</code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600 mb-2">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
