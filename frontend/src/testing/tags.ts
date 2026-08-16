import { withoutComments } from './source'

// What three guards were each about to spell out for themselves: which of a list of tags a file opens by hand. They differ in the list and in what they do about it, not in how a tag is found -- and the way a tag is found is where every one of them has been wrong at least once.

// The boundary after the name is the whole of it. Without it `<th` takes `<thead`, `<select` takes `<selectable>`, and `<input` takes any component whose name starts the same way; and reading the comments as code turns a file explaining why a tag is wrong into a file using it.

/** Which of `tags` this file opens itself, in the order given. */
export function tagsWrittenIn(written: string, tags: Array<string>): Array<string> {
  const source = withoutComments(written)

  return tags.filter((tag) => new RegExp(`<${tag}[\\s>/]`).test(source))
}

// The other half of the same rule, and it cannot be asked as a tag. A date picker is not written `<input>` on any screen here -- it is `<Line type="date" />`, and `Line` hands the attribute to an input two files away. So the browser-drawn control is named by its `type` wherever that attribute is written, on whatever element.

// Which is why the tag-shaped guard missed eleven of them across eight screens: it was looking for the two elements he had complained about rather than for the property they share.

/** Which of `types` this file asks for by attribute, in the order given. */
export function inputTypesWrittenIn(written: string, types: Array<string>): Array<string> {
  const source = withoutComments(written)

  // Quoted either way, and the closing quote is the whole of the boundary: without it `type="date"` would be found inside `type="datetime-local"`, and a guard naming one would go quiet the day somebody wrote the other.
  return types.filter((type) => new RegExp(`type=["']${type}["']`).test(source))
}
