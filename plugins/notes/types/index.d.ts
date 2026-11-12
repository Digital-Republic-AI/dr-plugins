// One post-it on the board.
export type Note = {
  id: number
  text: string
  createdAt: number
  // Index into the board's palette, so a note keeps its color.
  color: number
  // Folder name of the project the note was written in.
  project: string
}

export type BoardView = { isComposing: boolean }

declare module 'claude-code' {
  interface PluginState {
    notes: { board: Shaped<Note[]>; view: BoardView }
  }
}
