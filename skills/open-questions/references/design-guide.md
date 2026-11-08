# Design and usability guide for question pages

How a page of open questions should look and behave. It assumes the `artifact-design` fundamentals (tokens, both themes, gutters, the CDN allowlist) and adds what is specific to a page whose job is to get honest, complete answers from busy people.

The reader of this page is in the middle of other work. They open the link, want to know how much there is, answer what they can, defer what they cannot, and leave. Every decision below serves that.

## Contents

1. Layout of the one-question view
2. The question index
3. Navigation and keyboard
4. Anatomy of the question card
5. Controls and their states
6. Saving and feedback
7. Review screen and handing answers back
8. More than one person answering
9. Mobile
10. Accessibility
11. Copy
12. Mistakes that make these pages look generated
13. Checklist before publishing

## 1. Layout of the one-question view

Show one question at a time. A long scroll of cards (the pattern of a review page) makes the reader skim and answer the easy ones; a single focused question gets read.

Desktop, from top to bottom:

- **Header band**, minimal: the page name and one short line saying what the questions are for. Nothing else (see "One place for each piece of information" below). No hero; the header should be one or two lines tall.
- **Two columns below it**: the question index on the left and the current question on the right.
- **Navigation bar** fixed to the bottom of the viewport: "Anterior", the position and progress ("Pergunta 5 de 12 · 4 respondidas"), the save state, and the primary "Próxima" button.

### Use the whole screen

Do not wrap the page in a fixed `max-width` container (1180px and similar). On today's wide screens that leaves a third of the window empty while the index truncates titles and the context wraps into a narrow column. Let the layout fill the viewport, with the side gutters from `artifact-design`:

- Index column: `clamp(260px, 22vw, 360px)`, so titles get more room on wide screens.
- Question column: `minmax(0, 1fr)`, filling the rest.
- Limit the measure of running text only (question, why, paragraphs) to about 68 to 75 characters. Wide content (before/after pairs, option cards, tables, the review list) uses the full width of the question column.
- On very wide screens (above about 1600px), give the context its own column beside the answer area instead of stretching paragraphs.

### Fixed navigation bar

The bottom bar stays fixed on every width, not only on phones, so the reader never scrolls to find "Próxima" after reading a long context. It spans the question column (or the full width), uses the page background with a top border or a slight elevation so it reads as a separate layer, and the content gets bottom padding equal to the bar's height so the last option or note is never hidden behind it. Add `env(safe-area-inset-bottom, 0px)` to its bottom padding.

### One place for each piece of information

Before adding a line to the page, check where else it already appears. Each fact has one home:

| Information | Home |
|-------------|------|
| Page name and purpose | Header, one line |
| Answered count and blocking pending | Bottom bar (and the filter counts in the index, which are the breakdown) |
| Counts per status and per owner | Index filters |
| Where answers are saved | A short label next to the save state in the bottom bar ("Salvo na página" / "Só neste navegador"), with the full explanation in a tooltip or the review screen |
| Who answers each question | The card eyebrow, and the owner filter |

A header that repeats the counts of the filters, explains the storage mode in a sentence and lists who owns how many questions turns into a block of text the reader skips, and then skips the question too.

Open on the first unanswered blocking question, not on question 1, so that a returning reader lands where work is left. On the very first visit with nothing answered, open on question 1.

## 2. The question index

The index lets the reader see the whole list, jump, and know what is left. Each row: the status mark, the short question title (one line, truncated with an ellipsis and the full text in `title`), and the area as a small label when the list has more than one area.

Status needs to read without color: use a shape plus a word available to screen readers.

| Status | Mark |
|--------|------|
| Pendente | Hollow circle |
| Respondida | Filled circle with a check |
| Pulada | Dashed circle |
| Outra pessoa | Half-filled circle, plus the owner's name in the row |
| Bloqueante pendente | Hollow circle in the warning color, and the row's text in bold |

Above the index, filters as a segmented row with counts: "Todas 12", "Pendentes 8", "Bloqueantes 2", and an owner filter when items have owners ("Minhas", "Produto"). Each filter group must fit on one line of the index column: a single pill wrapping alone to a second line looks broken. Use a joined segmented control with short labels, or a compact select for the owner filter when there are more than three owners. Group rows under area headings only when there are three or more areas; otherwise the headings are noise.

The current question is marked in the index by a background tint and `aria-current="step"`, not by a colored stripe on the side.

## 3. Navigation and keyboard

- "Próxima" goes to the next item in the current filter, not in the whole list, so "Pendentes" works as a queue.
- Do not auto-advance when the reader picks an option. They may want to add a note, and a jump right after a click feels like losing control. After a choice, make "Próxima" the visually primary action.
- Route on the hash: `#q-<id>` for each question and `#revisao` for the review screen, so a link can point at one question ("olha a pergunta sobre arredondamento") and the browser back button works.
- When the view changes, move focus to the question heading (`tabindex="-1"`), so keyboard and screen reader users start at the top of the new question.
- Shortcuts, active only when focus is not in a text field: `J` / `K` or the arrow keys for next and previous, `1` to `5` to pick an option, `Enter` on a focused option to select it. Show them once, in small text near the navigation ("Atalhos: ← → navegam, 1 a 4 escolhem").

## 4. Anatomy of the question card

The order is fixed, because it is the order in which a person decides:

1. **Eyebrow**: type in words ("Decisão", "Confirmar suposição", "Aprovar mudança", "Informação", "Prioridade"), area, and, when they apply, "Bloqueante" and "Responde: Produto". Plain small text separated by a middle dot. Not pills glued to the heading.
2. **The question** as the heading, a real question with a question mark, at the page's largest text size inside the card. It is the most important line on the screen.
3. **Why it matters**, one or two sentences right below, in the body color (not muted, it is not a footnote).
4. **Context**: what Claude found. Use the shape the content has: a before/after pair side by side for a change (stacked on mobile), a short list for facts, a small table for values. Keep it to what is needed to answer; extra detail goes in a closed `<details>` named "Mais contexto".
5. **Evidence**: file paths and symbols in the monospace face, links as real links. Small, after the context, so it supports instead of competing.
6. **Options or the input**, then Claude's recommendation (see below).
7. **Note field**.
8. **Secondary actions** ("Pular por enquanto", "Outra pessoa responde") and the save state.

Claude's recommendation sits next to the option it recommends: the word "Recomendado" in the accent color inside that option card, plus one line with the reason below the options ("Recomendo B porque mantém os relatórios atuais iguais"). Never preselect it. A preselected answer gets accepted without being read, which defeats the point of asking.

When an item is answered, keep the card fully readable and show a one-line summary at the top of the controls ("Respondida por você há 3 min: Opção B"). Changing the answer is always possible.

### Separate the regions with contrast

The common failure is a page where background, index, card, context boxes and options all sit on near-identical light greys separated only by hairlines, so the screen reads as one undifferentiated block. The reader cannot tell at a glance where the question ends and the answer starts. Build the contrast deliberately:

- **Three surface levels, clearly apart**: page background, the index panel, and the question card. The card must differ from the page background by an obvious step in lightness (in light mode a white or near-white card on a visibly tinted background; in dark mode a lighter card on a darker page), not by a 1px border on two almost equal tones.
- **Two regions inside the card**: "the question" (eyebrow, question, why, context, evidence) and "your answer" (options, recommendation, note, secondary actions). Give the answer region its own tinted surface or a strong divider and a small heading ("Sua resposta"), so the eye jumps straight to what must be done.
- **Context blocks** (before/after, ledgers, facts) use one tint shared by all of them, different from both the card and the answer region. Before and after use the same surface and differ by their label, not by competing colors.
- **Text in three levels only**: primary (question, option labels, body), secondary (consequence lines, why, meta), and tertiary (evidence, hints). Secondary text must still pass WCAG AA against its own surface; muted grey on a tinted grey is the usual reason a page looks washed out.
- **Option cards** need a border that is visible at rest (at least 3:1 against the surface, as WCAG requires for component boundaries), so they read as controls before hover.
- **Weight and size carry the hierarchy**: the question is clearly the largest and heaviest text on the screen; area labels, counters and meta stay small. If everything is medium weight, nothing stands out.

Check the result by squinting at a screenshot (or blurring it): the index, the question and the answer area should stand out as three distinct shapes.

## 5. Controls and their states

- **Option cards** (choice, multi): full-width rows, each with the label in medium weight and the consequence in regular weight on the next line. The whole card is the target, at least 44px tall, built as a real `<input type="radio">` or `checkbox` with its `<label>` wrapping the card, so keyboard and screen readers work for free.
- **Selected state** changes three things at once: border in the accent, a filled check or dot, and the label weight. Color alone is not a state.
- **Confirm and review buttons** use the semantic colors only on the selected state (good, warning, change), and stay neutral before selection. Three bright buttons at rest read as a traffic light, not a question.
- **Required note**: when "Corrigir", "Alterar" or "Outra resposta" is picked, the note field becomes required, its label changes to say what to write ("O que está errado?"), and focus moves into it. If the reader leaves it empty and moves on, mark the item as incomplete in the index instead of blocking navigation.
- **Textarea**: a visible label above it (never placeholder-only), the placeholder as an example of a good answer, auto-grow from 3 lines, no fixed max height that hides text.
- **Suggestion chips** (open type): clicking one fills the textarea, it does not submit. The reader often edits the suggestion.
- **Scale**: steps as a segmented control with words ("Baixa", "Média", "Alta", "Crítica"); numbers alone make people guess the direction.
- **Hover, focus and disabled states** on every control. A visible focus ring in the accent with offset, never removed.

## 6. Saving and feedback

Answers save as they happen: option clicks immediately, notes after a short pause in typing (about 800 ms). There is no "Salvar" button; having one invites lost answers.

Show the state next to the controls, in small text, with `aria-live="polite"`: "Salvando…", "Salvo", or an error that says what happened and what is safe ("Não foi possível salvar (sem permissão). A resposta ficou neste navegador."). Keep a browser-storage draft in all cases so a failed save loses nothing.

The bottom bar also says, in a short label next to the save state, where answers go: "Salvo na página" or "Só neste navegador". The reader needs to know whether closing the tab is safe. The full sentence ("Respostas salvas nesta página e visíveis para quem tem acesso a ela" or "use Copiar respostas ao terminar") goes in the label's tooltip and on the review screen, not in the header.

While answers load from the store, render the questions at once (they are in the page) and show "Carregando respostas…" in that label; after 10 seconds without data, say the store is not answering and keep working locally.

## 7. Review screen and handing answers back

After the last question, and from a "Revisar respostas" link in the header, show a review screen:

- Blocking items still pending first, then the rest pending, then answered, then skipped and delegated. Each row: the question, the answer in words, the note, who answered, and a link back to the question.
- A primary "Concluir" that records a `meta/status` document (`{ done: true, by, at }`) and replaces the screen with a short message: what happens next ("Volte ao terminal e diga que terminou; o Claude lê as respostas daqui").
- "Copiar respostas" that copies a plain-text block meant to be pasted into the terminal: one line per item with id, question, answer, note and status. Use `navigator.clipboard.writeText` inside the click handler and, if it fails, show the text selected in a textarea.

Never claim the answers were "enviadas" to Claude: the page saves them; Claude reads them when asked.

## 8. More than one person answering

- Show each answer's author by resolving `answeredBy` through `user.profiles()` at render time ("Respondida por Marina, 14:32"). Store only ids.
- The owner filter matters more than anything else here: a product manager opening the link should see "Suas perguntas: 3" and get only those.
- "Outra pessoa responde" asks for a name or role in a small inline field (no modal), sets the item to delegated, and shows it in the index with that name.
- When someone changes an answer written by another person, show the previous one under it ("Antes: Opção A, por Thiago") instead of silently replacing it. Disagreement is information Claude needs.
- Comments on the artifact still work for discussion; the page itself is for answers.

## 9. Mobile

- One column. The index becomes a disclosure at the top ("Todas as perguntas · 4 de 12") that opens over the question as an inline panel, not a modal.
- The navigation bar stays fixed to the bottom, as on desktop, with `padding-bottom: env(safe-area-inset-bottom, 0px)` plus the side gutters, and "Anterior" and "Próxima" as large targets.
- Before/after pairs stack, with "Como é" and "Como fica" labels kept.
- Keyboard shortcuts are irrelevant on touch; do not show their hint below 700px.

## 10. Accessibility

- Options are real radio or checkbox inputs in a `fieldset` with the question as `legend` (or `role="radiogroup"` with `aria-labelledby` pointing at the heading).
- Status in the index is announced in words (visually hidden text "Respondida", "Pendente").
- Contrast meets WCAG AA in both themes, including the muted text and the selected states.
- Motion is limited to short opacity or transform transitions when switching questions, removed under `prefers-reduced-motion`.
- Everything works with the keyboard alone, and the focus order follows the card order in section 4.

## 11. Copy

- Write in the reader's language and terms; questions as questions, options as outcomes ("Arredondar cada item", not "Opção A" alone).
- Buttons say what they do: "Próxima", "Pular por enquanto", "Copiar respostas", "Concluir". Not "Enviar", which promises a delivery that does not happen.
- No preamble on the page explaining the tool. One line in the header is enough: "12 pontos da migração do billing que precisam de uma decisão antes da implementação. As respostas ficam salvas aqui."
- No emojis, no exclamation marks, no "Ótima escolha!" after a click.

## 12. Mistakes that make these pages look generated

- Every block in an identical rounded card with the same shadow. Only the current question card is a card; the index is a panel with its own tint but no shadow, and the header is a plain band.
- A colored stripe on the side of cards, gradient headers, big centered hero.
- Badge pills stuck to the question heading. The eyebrow carries type and area as text.
- Purple or blue default accent with Inter. Pick a palette and faces from the subject (a billing review can borrow ledger tones and a tabular face; a design review can be lighter and more spacious).
- Numbering like "01 / 02 / 03" as decoration. "Pergunta 5 de 12" is real information; big decorative numerals are not.
- Toasts as the only feedback, which disappear before the reader sees them.
- A modal for delegation, confirmation or the index.
- All options looking selected or all looking disabled until hover.
- A fixed `max-width` container that leaves the sides of a wide screen empty.
- Every region on almost the same grey, separated only by hairlines.
- A header that repeats counts, owners and the storage mode already shown elsewhere.
- Filter pills wrapping one by one onto a second line.

## 13. Checklist before publishing

- One question visible at a time, with index, filters with counts, and progress in words.
- The layout fills the viewport (no fixed `max-width` container); only running text has a capped measure.
- The header has only the page name and one line of purpose; each count or status appears in one place.
- Page, index and question card are distinct surfaces; the answer area is its own region; secondary text passes AA.
- The navigation bar is fixed to the bottom on every width and never covers content.
- Opens on the first unanswered blocking item; hash routing works for each question and for the review screen.
- Each card follows the order: eyebrow, question, why, context, evidence, controls, recommendation, note, secondary actions.
- Controls match the item type; the recommendation is labeled, never preselected.
- Required notes for corrections; save state visible and announced; draft kept in browser storage.
- The bottom bar says where answers are saved; review screen with "Concluir" and "Copiar respostas".
- Author shown on each answer when `user` is available; owner filter when items have owners.
- Works at 400px wide; both themes legible; focus visible; no emojis.

## Change History

- Created: 2026-11-08
- Updated: 2026-11-08 - Full-width layout, fixed bottom bar on every width, minimal header with one home per fact, contrast between regions, filters on one line
