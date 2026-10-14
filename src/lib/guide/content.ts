import type { Locale } from "@/lib/i18n/translations";

export type GuideLevel = "beginner" | "intermediate" | "advanced";

export interface CellMark {
  index: number;
  value: number; // 0 = empty
  kind: "given" | "solved" | "candidate" | "target" | "eliminate";
  notes?: number[]; // for candidate cells
}

export interface GuideTechnique {
  id: string;
  level: GuideLevel;
  title: { "pt-BR": string; en: string };
  intro: { "pt-BR": string; en: string };
  howItWorks: { "pt-BR": string; en: string };
  steps: { "pt-BR": string[]; en: string[] };
  /** 9x9 illustration, 81 cells. */
  cells: CellMark[];
  legend: Array<{ kind: CellMark["kind"]; label: { "pt-BR": string; en: string } }>;
}

export const GUIDE_LEVELS: { id: GuideLevel; labelKey: "guide.beginner" | "guide.intermediate" | "guide.advanced" }[] = [
  { id: "beginner", labelKey: "guide.beginner" },
  { id: "intermediate", labelKey: "guide.intermediate" },
  { id: "advanced", labelKey: "guide.advanced" },
];

const L = (pt: string, en: string): { "pt-BR": string; en: string } => ({ "pt-BR": pt, en });
const LA = (pt: string[], en: string[]): { "pt-BR": string[]; en: string[] } => ({ "pt-BR": pt, en });

function g(index: number, value: number): CellMark { return { index, value, kind: "given" }; }
function s(index: number, value: number): CellMark { return { index, value, kind: "solved" }; }
function c(index: number, notes: number[]): CellMark { return { index, value: 0, kind: "candidate", notes }; }
function tgt(index: number, value: number): CellMark { return { index, value, kind: "target" }; }
function elim(index: number, notes?: number[]): CellMark { return { index, value: 0, kind: "eliminate", notes }; }

function range9(start: number): number[] {
  return Array.from({ length: 9 }, (_, i) => start + i);
}

export const GUIDE_TECHNIQUES: GuideTechnique[] = [
  /* ---------------- BEGINNER ---------------- */
  {
    id: "rules",
    level: "beginner",
    title: L("Regras do Sudoku", "Sudoku Rules"),
    intro: L(
      "O Sudoku é jogado em uma grade 9×9 dividida em nove blocos 3×3. O objetivo é preencher todas as células com números de 1 a 9.",
      "Sudoku is played on a 9×9 grid divided into nine 3×3 boxes. The goal is to fill every cell with digits 1 to 9."
    ),
    howItWorks: L(
      "Cada linha, cada coluna e cada bloco 3×3 deve conter os números de 1 a 9 exatamente uma vez. Nenhum número pode se repetir dentro de uma mesma unidade.",
      "Each row, each column, and each 3×3 box must contain the digits 1 to 9 exactly once. No digit may repeat within a unit."
    ),
    steps: LA(
      ["Observe uma linha, coluna ou bloco qualquer.", "Identifique quais números de 1 a 9 já estão presentes.", "Preencha os ausentes sem repetir nenhum na mesma unidade.", "Repita o processo até preencher toda a grade."],
      ["Look at any row, column, or box.", "Identify which digits 1 to 9 are already present.", "Fill the missing ones without repeating any in that unit.", "Repeat until the whole grid is filled."]
    ),
    cells: [
      ...range9(0).map((i) => ({ index: i, value: [5, 3, 0, 0, 7, 0, 0, 0, 0][i], kind: "given" as const })),
      ...range9(9).map((i) => ({ index: i, value: [6, 0, 0, 1, 9, 5, 0, 0, 0][i - 9], kind: "given" as const })),
      ...range9(18).map((i) => ({ index: i, value: [0, 9, 8, 0, 0, 0, 0, 6, 0][i - 18], kind: "given" as const })),
      ...range9(27).map((i) => ({ index: i, value: [8, 0, 0, 0, 6, 0, 0, 0, 3][i - 27], kind: "given" as const })),
      ...range9(36).map((i) => ({ index: i, value: [4, 0, 0, 8, 0, 3, 0, 0, 1][i - 36], kind: "given" as const })),
      ...range9(45).map((i) => ({ index: i, value: [7, 0, 0, 0, 2, 0, 0, 0, 6][i - 45], kind: "given" as const })),
      ...range9(54).map((i) => ({ index: i, value: [0, 6, 0, 0, 0, 0, 2, 8, 0][i - 54], kind: "given" as const })),
      ...range9(63).map((i) => ({ index: i, value: [0, 0, 0, 4, 1, 9, 0, 0, 5][i - 63], kind: "given" as const })),
      ...range9(72).map((i) => ({ index: i, value: [0, 0, 0, 0, 8, 0, 0, 7, 9][i - 72], kind: "given" as const })),
    ],
    legend: [{ kind: "given", label: L("Dado inicial", "Given clue") }],
  },
  {
    id: "scanning",
    level: "beginner",
    title: L("Varredura", "Scanning"),
    intro: L("A varredura é a técnica mais básica: percorra linhas e colunas para descobrir onde um número deve entrar em um bloco.", "Scanning is the most basic technique: sweep rows and columns to find where a digit must go in a box."),
    howItWorks: L("Escolha um número. Em um bloco 3×3, veja quais linhas e colunas já contêm esse número: as células restantes no bloco são eliminadas, restando apenas uma possibilidade.", "Pick a digit. In a 3×3 box, see which rows and columns already contain that digit: the remaining cells in the box are eliminated, leaving only one possibility."),
    steps: LA(
      ["Escolha um número, por exemplo o 5.", "No bloco superior-esquerdo, veja que as linhas 2 e 3 já têm um 5.", "A coluna 2 também já tem um 5, eliminando outra célula.", "Sobrou apenas uma célula no bloco: ela recebe o 5."],
      ["Pick a digit, for example 5.", "In the top-left box, rows 2 and 3 already have a 5.", "Column 2 also has a 5, eliminating another cell.", "Only one cell remains in the box: it gets the 5."]
    ),
    cells: [g(2, 5), g(11, 5), g(20, 5), g(9, 6), g(27, 8), g(33, 6), g(29, 1), tgt(28, 5)],
    legend: [
      { kind: "given", label: L("Dado / bloqueador", "Given / blocker") },
      { kind: "target", label: L("Única célula possível", "Only possible cell") },
    ],
  },
  {
    id: "naked-singles",
    level: "beginner",
    title: L("Naked Singles", "Naked Singles"),
    intro: L("Quando uma célula vazia tem apenas um candidato possível, esse candidato é a resposta.", "When an empty cell has only one possible candidate, that candidate is the answer."),
    howItWorks: L("Para cada célula vazia, liste os números ausentes na linha, coluna e bloco. Se a interseção deixar apenas um número, ele é o naked single.", "For each empty cell, list the digits missing from its row, column, and box. If the intersection leaves only one digit, it is the naked single."),
    steps: LA(
      ["Observe a célula central destacada.", "Sua linha já contém 1,2,3,4; sua coluna contém 5,6,7,8.", "Seu bloco contém 9. Logo, todos os números de 1 a 9 estão bloqueados — exceto um.", "O único candidato restante é colocado na célula."],
      ["Look at the highlighted center cell.", "Its row already has 1,2,3,4; its column has 5,6,7,8.", "Its box has 9. So every digit 1-9 is blocked — except one.", "The only remaining candidate is placed in the cell."]
    ),
    cells: [g(30, 1), g(31, 2), g(32, 3), g(33, 4), g(21, 5), g(48, 6), g(57, 7), g(66, 8), g(40, 9), tgt(40, 0)],
    legend: [
      { kind: "given", label: L("Dados que bloqueiam", "Blocking givens") },
      { kind: "target", label: L("Célula com 1 candidato", "Cell with 1 candidate") },
    ],
  },
  {
    id: "hidden-singles",
    level: "beginner",
    title: L("Hidden Singles", "Hidden Singles"),
    intro: L("Um hidden single ocorre quando um número tem apenas uma célula possível dentro de uma unidade, mesmo que a célula tenha vários candidatos.", "A hidden single occurs when a digit has only one possible cell within a unit, even if that cell has several candidates."),
    howItWorks: L("Para cada unidade, verifique cada número ausente: se ele só pode ir em uma única célula, ele vai lá — independentemente dos outros candidatos.", "For each unit, check each missing digit: if it can only go in one cell, place it there — regardless of that cell's other candidates."),
    steps: LA(
      ["No bloco destacado, o número 7 está ausente.", "Duas das três células candidatas têm o 7 bloqueado pela linha ou coluna.", "Apenas uma célula no bloco pode receber o 7.", "Coloque o 7 nessa célula (hidden single)."],
      ["In the highlighted box, the digit 7 is missing.", "Two of the three candidate cells have 7 blocked by row or column.", "Only one cell in the box can take the 7.", "Place the 7 in that cell (hidden single)."]
    ),
    cells: [g(0, 1), g(1, 2), g(9, 4), g(10, 5), g(18, 8), g(3, 7), g(12, 7), tgt(11, 7), c(2, [3, 6, 9]), c(19, [3, 6, 9])],
    legend: [
      { kind: "given", label: L("Dados", "Givens") },
      { kind: "candidate", label: L("Candidatos (7 bloqueado)", "Candidates (7 blocked)") },
      { kind: "target", label: L("Hidden single: 7", "Hidden single: 7") },
    ],
  },
  {
    id: "candidate-elimination",
    level: "beginner",
    title: L("Eliminação de Candidatos", "Candidate Elimination"),
    intro: L("Sempre que você coloca um número, ele elimina esse candidato das células da mesma linha, coluna e bloco.", "Whenever you place a digit, it eliminates that candidate from cells in the same row, column, and box."),
    howItWorks: L("Mantenha anotações de candidatos. Ao resolver uma célula, remova esse número das anotações das células relacionadas. Isso revela novos singles.", "Keep candidate notes. When you solve a cell, remove that digit from the notes of all related cells. This reveals new singles."),
    steps: LA(
      ["A célula central resolveu com o 4.", "Remova o 4 das anotações das células da mesma linha, coluna e bloco.", "Uma célula agora ficou com apenas um candidato: vira naked single.", "Continue a cascata de eliminações."],
      ["The center cell was solved with 4.", "Remove 4 from the notes of cells in the same row, column, and box.", "One cell now has a single candidate: it becomes a naked single.", "Continue the elimination cascade."]
    ),
    cells: [s(40, 4), elim(38, [4, 7]), elim(39, [2, 4]), elim(41, [4, 6]), elim(42, [4, 9]), elim(13, [4, 5]), elim(22, [1, 4]), elim(31, [3, 4]), elim(48, [4, 8]), elim(67, [4, 6]), elim(76, [2, 4]), elim(30, [4]), elim(32, [4, 7])],
    legend: [
      { kind: "solved", label: L("Resolvido: 4", "Solved: 4") },
      { kind: "eliminate", label: L("Candidato 4 removido", "Candidate 4 removed") },
    ],
  },

  /* ---------------- INTERMEDIATE ---------------- */
  {
    id: "naked-pairs",
    level: "intermediate",
    title: L("Naked Pairs", "Naked Pairs"),
    intro: L("Duas células na mesma unidade com exatamente os mesmos dois candidatos formam um naked pair.", "Two cells in the same unit with exactly the same two candidates form a naked pair."),
    howItWorks: L("Como o par deve ocupar essas duas células, você pode remover esses dois candidatos das demais células da mesma unidade.", "Since the pair must occupy those two cells, you can remove those two candidates from the other cells of the same unit."),
    steps: LA(
      ["Na linha destacada, duas células têm exatamente os candidatos {2, 5}.", "Isso forma um naked pair: o 2 e o 5 estão reservados para essas células.", "Remova 2 e 5 das outras células da linha.", "Uma dessas células pode ficar com um único candidato."],
      ["In the highlighted row, two cells have exactly candidates {2, 5}.", "This forms a naked pair: 2 and 5 are reserved for those cells.", "Remove 2 and 5 from the other cells in the row.", "One of those cells may be left with a single candidate."]
    ),
    cells: [c(27, [2, 5]), c(29, [2, 5]), elim(28, [2, 5, 8]), elim(30, [2, 5, 9]), elim(33, [1, 2, 5])],
    legend: [
      { kind: "candidate", label: L("Par nu {2,5}", "Naked pair {2,5}") },
      { kind: "eliminate", label: L("Remover 2 e 5", "Remove 2 and 5") },
    ],
  },
  {
    id: "hidden-pairs",
    level: "intermediate",
    title: L("Hidden Pairs", "Hidden Pairs"),
    intro: L("Quando dois números aparecem como candidatos apenas em duas células de uma unidade, eles formam um hidden pair.", "When two digits appear as candidates in only two cells of a unit, they form a hidden pair."),
    howItWorks: L("Reserve essas duas células para o par e remova todos os outros candidatos delas.", "Reserve those two cells for the pair and remove all other candidates from them."),
    steps: LA(
      ["No bloco destacado, os números 3 e 7 aparecem apenas em duas células.", "Essas duas células formam um hidden pair {3, 7}.", "Remova os outros candidatos dessas duas células.", "Agora elas ficam com apenas {3, 7}."],
      ["In the highlighted box, digits 3 and 7 appear only in two cells.", "Those two cells form a hidden pair {3, 7}.", "Remove the other candidates from those two cells.", "Now they only have {3, 7}."]
    ),
    cells: [c(0, [3, 7, 1, 9]), c(2, [3, 7, 4, 6]), elim(1, [3]), elim(8, [3, 7]), g(9, 2), g(11, 5), g(18, 8), g(20, 1)],
    legend: [
      { kind: "candidate", label: L("Par oculto {3,7}", "Hidden pair {3,7}") },
      { kind: "eliminate", label: L("Outros candidatos removidos", "Other candidates removed") },
    ],
  },
  {
    id: "pointing-pairs",
    level: "intermediate",
    title: L("Pointing Pairs", "Pointing Pairs"),
    intro: L("Quando um candidato em um bloco está restrito a uma única linha ou coluna, ele pode ser eliminado das outras células dessa linha/coluna fora do bloco.", "When a candidate in a box is restricted to a single row or column, it can be eliminated from the other cells of that row/column outside the box."),
    howItWorks: L("Se todas as ocorrências de um número em um bloco estão na mesma linha, ele deve estar nesse bloco nessa linha — logo, não pode aparecer em outra posição da mesma linha.", "If all occurrences of a digit in a box lie on the same row, it must be in that box on that row — so it cannot appear elsewhere in that row."),
    steps: LA(
      ["No bloco superior-esquerdo, o candidato 6 aparece apenas na linha 1.", "Logo, o 6 deste bloco está na linha 1.", "Remova o 6 das outras células da linha 1 (fora do bloco).", "Isso pode revelar singles em outros blocos."],
      ["In the top-left box, candidate 6 appears only in row 1.", "So the 6 of this box is in row 1.", "Remove 6 from the other cells of row 1 (outside the box).", "This may reveal singles in other boxes."]
    ),
    cells: [c(3, [6, 9]), c(5, [6, 2]), elim(6, [6, 4]), elim(7, [6, 8]), g(0, 1), g(1, 2), g(9, 4), g(11, 5), g(18, 8), g(20, 1)],
    legend: [
      { kind: "candidate", label: L("Candidato 6 no bloco (linha 1)", "Candidate 6 in box (row 1)") },
      { kind: "eliminate", label: L("Remover 6 da linha 1", "Remove 6 from row 1") },
    ],
  },
  {
    id: "box-line",
    level: "intermediate",
    title: L("Box-Line Reduction", "Box-Line Reduction"),
    intro: L("O inverso do pointing pair: quando um candidato em uma linha/coluna está restrito a um único bloco, remova-o das outras células daquele bloco.", "The reverse of pointing pairs: when a candidate in a row/column is restricted to a single box, remove it from the other cells of that box."),
    howItWorks: L("Se todas as ocorrências de um número em uma linha estão no mesmo bloco, ele deve estar naquele bloco naquela linha — remova-o das outras células do bloco.", "If all occurrences of a digit in a row are in the same box, it must be in that box on that row — remove it from the other cells of the box."),
    steps: LA(
      ["Na linha destacada, o candidato 4 aparece apenas dentro de um bloco.", "Logo, o 4 da linha está naquele bloco.", "Remova o 4 das outras células do bloco (fora da linha).", "Outros candidatos do bloco ficam mais restritos."],
      ["In the highlighted row, candidate 4 appears only inside one box.", "So the 4 of the row is in that box.", "Remove 4 from the other cells of the box (outside the row).", "Other candidates in the box become more restricted."]
    ),
    cells: [c(30, [4, 7]), c(31, [4, 8]), c(32, [4, 9]), elim(21, [4, 6]), elim(22, [4, 1]), elim(23, [4, 3]), g(33, 1), g(34, 2)],
    legend: [
      { kind: "candidate", label: L("Candidato 4 na linha (1 bloco)", "Candidate 4 in row (1 box)") },
      { kind: "eliminate", label: L("Remover 4 do bloco", "Remove 4 from box") },
    ],
  },

  /* ---------------- ADVANCED ---------------- */
  {
    id: "naked-triples",
    level: "advanced",
    title: L("Naked Triples", "Naked Triples"),
    intro: L("Três células na mesma unidade cujos candidatos, combinados, totalizam exatamente três números formam um naked triple.", "Three cells in the same unit whose combined candidates total exactly three digits form a naked triple."),
    howItWorks: L("Os três números devem ocupar essas três células, então remova-os das demais células da unidade.", "The three digits must occupy those three cells, so remove them from the other cells of the unit."),
    steps: LA(
      ["Na coluna destacada, três células têm candidatos que juntos são {1, 4, 7}.", "Esse trio deve ocupar essas três células.", "Remova 1, 4 e 7 das outras células da coluna.", "Outras células podem ficar com um único candidato."],
      ["In the highlighted column, three cells have candidates that together are {1, 4, 7}.", "This trio must occupy those three cells.", "Remove 1, 4, and 7 from the other cells of the column.", "Other cells may be left with a single candidate."]
    ),
    cells: [c(9, [1, 4]), c(18, [4, 7]), c(36, [1, 7]), elim(27, [1, 4, 7, 8]), elim(45, [1, 4, 7, 2]), elim(54, [1, 4, 7, 6])],
    legend: [
      { kind: "candidate", label: L("Trio nu {1,4,7}", "Naked triple {1,4,7}") },
      { kind: "eliminate", label: L("Remover 1,4,7", "Remove 1,4,7") },
    ],
  },
  {
    id: "x-wing",
    level: "advanced",
    title: L("X-Wing", "X-Wing"),
    intro: L("Um X-Wing ocorre quando um candidato aparece em exatamente duas células em duas linhas diferentes, e essas células estão nas mesmas duas colunas.", "An X-Wing occurs when a candidate appears in exactly two cells in two different rows, and those cells lie in the same two columns."),
    howItWorks: L("O candidato deve ocupar duas posições opostas formando um retângulo. Assim, ele pode ser eliminado de todas as outras células dessas duas colunas.", "The candidate must occupy two opposite positions forming a rectangle. Thus it can be eliminated from all other cells of those two columns."),
    steps: LA(
      ["O candidato 5 aparece em exatamente duas células na linha 1 e duas na linha 5.", "Essas quatro células formam um retângulo (X-Wing) nas colunas 3 e 7.", "Remova o 5 das outras células das colunas 3 e 7.", "Isso pode desbloquear singles nessas colunas."],
      ["Candidate 5 appears in exactly two cells in row 1 and two in row 5.", "Those four cells form a rectangle (X-Wing) in columns 3 and 7.", "Remove 5 from the other cells of columns 3 and 7.", "This may unlock singles in those columns."]
    ),
    cells: [c(2, [5, 3]), c(6, [5, 8]), c(38, [5, 4]), c(42, [5, 9]), elim(11, [5, 7]), elim(20, [5, 1]), elim(47, [5, 6]), elim(56, [5, 2])],
    legend: [
      { kind: "candidate", label: L("Candidato 5 (X-Wing)", "Candidate 5 (X-Wing)") },
      { kind: "eliminate", label: L("Remover 5 das colunas 3 e 7", "Remove 5 from cols 3 and 7") },
    ],
  },
  {
    id: "swordfish",
    level: "advanced",
    title: L("Swordfish", "Swordfish"),
    intro: L("O Swordfish generaliza o X-Wing para três linhas e três colunas.", "Swordfish generalizes the X-Wing to three rows and three columns."),
    howItWorks: L("Como o candidato deve ocupar três posições nessas três colunas, ele pode ser eliminado das outras células dessas colunas.", "Since the candidate must occupy three positions in those three columns, it can be eliminated from the other cells of those columns."),
    steps: LA(
      ["O candidato 2 aparece em três linhas, sempre nas mesmas três colunas.", "Forma-se um Swordfish 3×3.", "Remova o 2 das outras células dessas três colunas.", "Outros singles podem surgir."],
      ["Candidate 2 appears in three rows, always in the same three columns.", "A 3×3 Swordfish is formed.", "Remove 2 from the other cells of those three columns.", "Other singles may emerge."]
    ),
    cells: [c(1, [2, 6]), c(4, [2, 9]), c(7, [2, 3]), c(28, [2, 4]), c(31, [2, 8]), c(55, [2, 5]), c(58, [2, 1]), elim(10, [2, 7]), elim(37, [2, 6]), elim(64, [2, 8])],
    legend: [
      { kind: "candidate", label: L("Candidato 2 (Swordfish)", "Candidate 2 (Swordfish)") },
      { kind: "eliminate", label: L("Remover 2 das colunas", "Remove 2 from columns") },
    ],
  },
  {
    id: "xy-wing",
    level: "advanced",
    title: L("XY-Wing", "XY-Wing"),
    intro: L("O XY-Wing usa três células com candidatos {X,Y}, {X,Z} e {Y,Z}. A célula que enxerga as duas últimas não pode ter Z.", "The XY-Wing uses three cells with candidates {X,Y}, {X,Z}, and {Y,Z}. The cell that sees the last two cannot have Z."),
    howItWorks: L("A célula pivô {X,Y} força uma das asas a ter Z. Como não sabemos qual, qualquer célula que enxergue ambas as asas não pode conter Z.", "The pivot cell {X,Y} forces one of the wings to be Z. Since we don't know which, any cell seeing both wings cannot contain Z."),
    steps: LA(
      ["O pivô tem candidatos {3, 5}.", "Uma asa tem {3, 7}, a outra {5, 7}.", "Uma das asas será 7, não sabemos qual.", "A célula que enxerga ambas as asas não pode ser 7: remova o 7."],
      ["The pivot has candidates {3, 5}.", "One wing has {3, 7}, the other {5, 7}.", "One wing will be 7, we don't know which.", "The cell seeing both wings cannot be 7: remove 7."]
    ),
    cells: [c(40, [3, 5]), c(22, [3, 7]), c(58, [5, 7]), elim(31, [7, 4])],
    legend: [
      { kind: "candidate", label: L("Pivô e asas", "Pivot and wings") },
      { kind: "eliminate", label: L("Remover 7", "Remove 7") },
    ],
  },
];

export function techniqueTitle(t: GuideTechnique, locale: Locale): string {
  return t.title[locale];
}

/**
 * Convert a technique's CellMark illustration into a playable puzzle + solution + notes.
 *
 * - `given` + `solved` + `target` cells become givens (locked).
 * - `candidate` + `eliminate` cells start empty; candidate notes are seeded.
 * - The solution is derived by running the engine solver on the givens. If the
 *   illustration isn't a solvable puzzle (partial diagrams), returns null.
 */
import { solve as solveBoard } from "@/lib/sudoku/engine";
import { emptyBoard } from "@/lib/sudoku/types";

export function techniqueToPractice(t: GuideTechnique): {
  puzzle: number[];
  solution: number[];
  notes: number[][];
} | null {
  const puzzle = emptyBoard();
  const notes: number[][] = Array.from({ length: 81 }, () => []);
  for (const m of t.cells) {
    if (m.kind === "given" || m.kind === "solved" || m.kind === "target") {
      puzzle[m.index] = m.value;
    } else if (m.kind === "candidate" || m.kind === "eliminate") {
      if (m.notes && m.notes.length > 0) {
        notes[m.index] = m.notes.slice();
      }
    }
  }
  const solution = solveBoard(puzzle);
  if (!solution) return null;
  return { puzzle: puzzle.slice(), solution: solution.slice(), notes };
}
