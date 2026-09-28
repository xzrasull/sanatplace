import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

// Headings in a post start at H2 (the page title is the H1); links to other
// sites open in a new tab.
// (react-markdown also passes its syntax-tree `node`, which must not reach the DOM)
const components: Components = {
  h1: ({ children, id }) => <h2 id={id}>{children}</h2>,
  a: ({ href, children }) =>
    href && /^https?:\/\//.test(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <a href={href}>{children}</a>
    ),
};

// A post's Markdown text. Raw HTML is dropped and the result sanitised, so the
// text can't carry scripts or styles; pictures belong in the cover, not here.
export function MarkdownBody({ source, className = 'post-body' }: { source: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown skipHtml rehypePlugins={[rehypeSanitize]} components={components} disallowedElements={['img']}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
