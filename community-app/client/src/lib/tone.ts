/** id를 1~5 중 하나의 고정 톤 인덱스로 매핑한다. 같은 id는 항상 같은 색을 받는다. */
export function toneClass(id: number): string {
  return `tone-${(Math.abs(id) % 5) + 1}`;
}
