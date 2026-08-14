import type { Rule } from 'eslint'
import type { Comment } from 'estree'

const DIRECTIVE =
  /(eslint-disable|eslint-enable|@ts-expect-error|@ts-ignore|prettier-ignore|shellcheck|<reference|@vitest-environment)/

/** Reports any comment longer than one line, or sitting directly under another. */
export const singleLineComments: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'A comment is one line, never two. See .agents/rules/general/comments.md' },
    schema: [],
    messages: {
      block: 'A block comment spans several lines. Write one `//` line, or move it to a test or the commit message.',
      stacked: 'This comment continues the one above it. A comment is one line — see .agents/rules/general/comments.md',
    },
  },
  create(context) {
    return {
      Program() {
        // A `#!` line arrives here as a comment whose runtime type is absent from estree's own union, so it is found by position.
        const hashbanged = context.sourceCode.getText().startsWith('#!')
        const isHashbang = (comment: Comment) => hashbanged && comment.range?.[0] === 0

        const comments = context.sourceCode
          .getAllComments()
          .filter((comment: Comment) => !isHashbang(comment) && !DIRECTIVE.test(comment.value))

        comments.forEach((comment, index) => {
          const { loc } = comment
          if (!loc) return

          if (loc.start.line !== loc.end.line) {
            context.report({ loc, messageId: 'block' })
            return
          }

          const previous = comments[index - 1]?.loc
          if (previous && previous.end.line === loc.start.line - 1) context.report({ loc, messageId: 'stacked' })
        })
      },
    }
  },
}
