/**
 * /app/saved — REMOVIDA em 2026-05-09.
 *
 * A tab "Salvos" do Radar foi descontinuada porque o KAI já tem a Biblioteca
 * (`KaiLibraryTab` / `client_reference_library`) e o Planejamento. As ações
 * "Salvar na biblioteca" + "Criar ideia em planejamento" agora ficam nos
 * cards do dashboard via <CrossAppActions />, eliminando a duplicação.
 *
 * Este arquivo virou stub vazio só pra não quebrar imports legados. Se
 * encontrar referência ainda, é bug — remove o import.
 */
export default function SavedPageDeprecated() {
  return null;
}
