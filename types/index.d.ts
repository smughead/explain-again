export type Flag = boolean

declare module 'claude-code' {
  interface PluginState {
    'explain-again': {
      lastAnswer: string | null
      isRowOffered: boolean
      isChooserOpen: boolean
      picked: string | null
    }
  }
}
