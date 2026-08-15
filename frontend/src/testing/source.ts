// A guard that reads source has to read the code and not the prose about it. Two of them have now been tripped by a comment explaining why the thing they forbid is wrong -- and a guard that punishes explanation teaches people to stop explaining, which in this repository costs more than the guard is worth.
export function withoutComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ')
}
