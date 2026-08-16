import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// Every word this app says to somebody, read off the tree rather than remembered.

// Nauman: "You have used so lame language for the whole app, e.g. an Add button is named Put on list, a delete is Take it off... I asked you make the app simple not dumb."

// A list of these assembled by hand misses twenty, and the twenty it misses are the ones nobody looks at -- which is the same shape as the fix that stayed in one of four files this evening. So the list is generated, and what it covers is printed with it: a table that does not say its own denominator reads as complete while covering a third of the app.

const ROOT = resolve(import.meta.dirname, '..')

// Where words reach a person. `convex/` is included because a refusal thrown there arrives on his screen as a sentence, and `shared/validation` holds the words a form is refused with.
const WHERE_WORDS_ARE = ['frontend/src', 'shared', 'convex']

/** shadcn's own, copied in by their CLI, and the generated route tree. Their words are theirs and nobody here writes them. */
const NOT_OURS = [/\/components\/ui\//, /routeTree\.gen\.ts$/, /\/_generated\//, /node_modules/]

function everySourceFile(from: string): Array<string> {
  return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name)

    if (NOT_OURS.some((skip) => skip.test(path))) return []
    if (entry.isDirectory()) return everySourceFile(path)

    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

// What is code and what is said to somebody. The first version of this rejected anything without a space in it, to drop types and paths -- and dropped `Balance`, `Paid`, `Due` and `Cheque` with them.

// Which is survivable in a list and fatal in a guard built on it: **every word this rename produces is one word**. A sweep blind to single words passes an app relabelled entirely in the new vocabulary and equally passes one where `How much` has quietly come back as `Sum`, and reports the same clean nothing either way.

// So the rejection is by shape rather than by length. A path, an identifier, a file name and an address are code; a capitalised word on its own is a label.
export function worthSaying(said: string): boolean {
  // Nothing to read: an acronym, a constant, a number.
  if (!/[a-z]/.test(said)) return false

  // Code by shape, whatever its length: a path, an address, a file, an identifier.
  if (/[/@_]/.test(said) || /\.(tsx?|css|json|html)$/.test(said)) return false
  if (/^[a-z]+(?:[A-Z][a-z]*)+$/.test(said)) return false

  // A bare lower-case word with no space is a value or a key -- `cheque`, `lumpSum` -- and a label in this app is capitalised.
  if (!/\s/.test(said) && !/^[A-Z]/.test(said)) return false

  return true
}

/** Comments are for whoever reads the code and are not what the app says. Left in, half of what this reports is our own prose about the words rather than the words. */
function withoutComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ')
}

// Four ways a word reaches a person, and they are asked for separately because the answer differs by shape. A control's own text is what he taps; a field's label is what he is asked; a placeholder is what an empty box says; a thrown message is what he is told when something is refused.
const HOW_IT_IS_SAID: Array<{ how: string; found: RegExp }> = [
  { how: 'label', found: /\b(?:label|saying|placeholder|aria-label|said|title|what|hint)=["']([^"'{}]{2,60})["']/g },
  { how: 'said', found: /\b(?:said|label|message|say|title):\s*["']([^"'{}]{2,80})["']/g },
  // Ending at a `{` as well as at a `<`, because a sentence often runs into an interpolation: `This has not gone in yet — it will as soon as the phone has signal.{' '}` is the sentence a send shows, and a pattern that wanted a tag next could not see it at all.

  // Across lines and long, because prose wraps: "A house put away comes off the list. What was spent on it is still there…" is one sentence in four lines of source, and a pattern that stopped at a newline could not see any of the paragraphs this app explains itself with.
  { how: 'drawn', found: />\s*([A-Z][^<>{}]{1,240}?)\s*[<{]/g },
  { how: 'thrown', found: /(?:ConvexError|Error)\(\s*["'`]([^"'`]{4,120})["'`]/g },

  // Everything else somebody wrote in quotes, because the three above all want a word in a naming position and a refusal is never in one.

  // `SAY_PAYMENT = { paidTo: 'Say who was paid.' }` is a value under a key named after the field, and `{keeps ? 'What you have typed is kept, even if this closes.' : 'Keep this screen open until it does.'}` is a branch of a ternary. Between them that is every refusal in `shared/validation`, which is where the register is worst -- and the second clause of the sentence a send shows, which is the clause carrying the promise.

  // Capitalised and quoted is the whole rule; `worthSaying` throws out the paths, identifiers and class lists that come with it.
  { how: 'quoted', found: /["']([A-Z][^"'`\n]{3,200})["']/g },
]

// Tests are counted apart rather than dropped. A label a guard names is a second place the word lives, and renaming it without them is a red suite -- but a word only a test says is not something the app says, and counting those together inflates every number in the table.

/** A word this app says, everywhere it says it, and everywhere a test names it. */
export type Said = { said: string; how: Set<string>; drawn: Set<string>; asserted: Set<string> }

export function everythingItSays(): Map<string, Said> {
  const found = new Map<string, Said>()

  for (const where of WHERE_WORDS_ARE) {
    for (const path of everySourceFile(join(ROOT, where))) {
      const source = withoutComments(readFileSync(path, 'utf8'))

      for (const { how, found: pattern } of HOW_IT_IS_SAID) {
        for (const [, said] of source.matchAll(pattern)) {
          // Collapsed, because source wraps a sentence at eighty columns and the app draws it as one line. Left as it is, the same sentence reads as a different string depending on where the formatter broke it.
          const words = said.replaceAll(/\s+/g, ' ').trim()

          if (!worthSaying(words)) continue

          const already = found.get(words) ?? {
            said: words,
            how: new Set<string>(),
            drawn: new Set<string>(),
            asserted: new Set<string>(),
          }

          already.how.add(how)
          const at = relative(ROOT, path)
          if (/\.test\.tsx?$/.test(at)) already.asserted.add(at)
          else already.drawn.add(at)
          found.set(words, already)
        }
      }
    }
  }

  // A word only a test says is a fixture, not something the app says to anybody.
  for (const [words, one] of found) if (one.drawn.size === 0) found.delete(words)

  return found
}

// A label names a thing and should be the word the trade already has. A sentence is one person telling another what happened, and there is no standard vocabulary for that because nobody else writes it.

// `Amount` instead of `How much` is a label getting shorter. `Offline` instead of "This has not gone in yet -- it will as soon as the phone has signal" is a promise getting deleted.

// So the two are counted apart, and the third bucket is the honest one: this cannot always tell them apart, and a guard that approximates here would either flatten the copy or excuse the labels.
export type Kind = 'label' | 'sentence' | 'unsure'

export function whatKind(said: string): Kind {
  const words = said.trim().split(/\s+/).length

  // Ends like a sentence and reads like one: something is being told to somebody.
  if (/[.!?]$/.test(said) && words > 3) return 'sentence'
  if (words > 8) return 'sentence'

  // A control or a field: short, no terminal punctuation.
  if (words <= 4 && !/[.!?]$/.test(said)) return 'label'

  return 'unsure'
}

function main(): void {
  const everything = [...everythingItSays().values()].sort((one, other) => other.drawn.size - one.drawn.size)

  const counted = { label: 0, sentence: 0, unsure: 0 }
  for (const one of everything) counted[whatKind(one.said)] += 1

  console.log(`${String(everything.length)} distinct things this app says to somebody.`)
  console.log(
    `  ${String(counted.label)} read as labels, ${String(counted.sentence)} as sentences, ${String(counted.unsure)} this cannot tell apart.`
  )
  console.log(`  Read from ${WHERE_WORDS_ARE.join(', ')}, without shadcn's own or anything generated.\n`)

  // The floor, and it is here because this exact blindness shipped once: a sweep that stops seeing one-word labels reports the same clean nothing as an app with none in it, and every word the rename produces is one word.
  const oneWord = everything.filter((one) => !/\s/.test(one.said)).length

  if (oneWord < 20) {
    throw new Error(
      `Only ${String(oneWord)} one-word labels were found, which is too few to have looked -- \`Balance\`, \`Paid\`, \`Due\` and \`Cheque\` are all one word, and so is every word this rename produces.`
    )
  }

  console.log(`  ${String(oneWord)} of them are a single word, which is what most of them are becoming.`)

  const asserted = everything.filter((one) => one.asserted.size > 0).length
  console.log(
    `  ${String(asserted)} of them are also named by a test, which is a second place each rename has to reach.\n`
  )

  console.log('said\tkind\tdrawn\tasserted\twhere')
  for (const one of everything) {
    console.log(
      `${one.said}\t${whatKind(one.said)}\t${String(one.drawn.size)}\t${String(one.asserted.size)}\t${[...one.drawn, ...one.asserted].join(' ')}`
    )
  }
}

// Run directly rather than imported by a test: this is a dump for somebody to read, and the guard that holds the app to it is a separate thing written after the words are decided.
if (process.argv[1]?.endsWith('whatItCallsThings.ts')) {
  main()
}
