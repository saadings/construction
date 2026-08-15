import { withoutComments } from './source'

// What three guards were each about to spell out for themselves: which of a list of tags a file opens by hand. They differ in the list and in what they do about it, not in how a tag is found -- and the way a tag is found is where every one of them has been wrong at least once.

// The boundary after the name is the whole of it. Without it `<th` takes `<thead`, `<select` takes `<selectable>`, and `<input` takes any component whose name starts the same way; and reading the comments as code turns a file explaining why a tag is wrong into a file using it.

/** Which of `tags` this file opens itself, in the order given. */
export function tagsWrittenIn(written: string, tags: Array<string>): Array<string> {
  const source = withoutComments(written)

  return tags.filter((tag) => new RegExp(`<${tag}[\\s>/]`).test(source))
}
