import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register } from 'claude-code'

// Replies shorter than this (characters) don't get the row: "Done", yes/no, etc.
const MIN_ANSWER_LENGTH = 600

// The Markdown element draws at most this many characters; a longer reply keeps the engine's own drawing.
const MAX_MARKDOWN_LENGTH = 10000

// How much of the reply the /explain chooser quotes so the person can see which reply it means.
const QUOTE_LENGTH = 80

// The main conversation's latest answer, whether the row is offered under it, whether /explain opened
// the chooser, and which format was clicked (its Send now / Edit first choice is showing).
const lastAnswer = atom({ plugin: 'explain-again', key: 'lastAnswer' } as const, null)
const isRowOffered = atom({ plugin: 'explain-again', key: 'isRowOffered' } as const, false)
const isChooserOpen = atom({ plugin: 'explain-again', key: 'isChooserOpen' } as const, false)
const picked = atom({ plugin: 'explain-again', key: 'picked' } as const, null)

// One entry per format in Karpathy's post, in his "but even better" order. Each request reads like
// something the person would type, so it is easy to edit; anything saved goes outside the project.
const FORMATS = [
  {
    key: 'plain',
    label: 'In plain English',
    request:
      'Explain your last reply again in plain, simple English: short sentences, one idea each, everyday words (ASD-STE100 style, about 80% strict).',
  },
  {
    key: 'diagram',
    label: 'As a diagram',
    request: 'Show your last reply as a diagram I can take in at a glance, right here in the chat.',
  },
  {
    key: 'page',
    label: 'As a web page',
    request:
      'Turn your last reply into an interactive web page that explains it. Save it outside this project (a temporary folder is fine) and open it for me.',
  },
  {
    key: 'video',
    label: 'As a video',
    request:
      'Make a short 3Blue1Brown-style explainer video of your last reply. Save it outside this project, prefer free local tools and a free local voice, and tell me your plan and how long it will take before starting anything slow or installing anything.',
  },
] as const

type Format = (typeof FORMATS)[number]
type Shared = Pick<Elements['desktop'], 'Box' | 'Button' | 'Text'>

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

// `/explain diagram`, `/explain web`, `/explain plainer`...: a format's key or any word of its label.
function formatFor(args: string): Format | undefined {
  const word = args.trim().toLowerCase()

  if (word.length < 3) {
    return undefined
  }

  return FORMATS.find(format => format.key === word || format.label.toLowerCase().split(' ').includes(word))
}

function actionsFor($: EngineInterface) {
  const reset = async () => {
    await update($, picked, () => null)
    await update($, isChooserOpen, () => false)
  }

  return {
    reset,
    pick: (format: Format) => update($, picked, () => format.key),
    back: () => update($, picked, () => null),
    // Sent as the person's own words: they chose it. The transcript still names the plugin.
    send: async (format: Format) => {
      await reset()
      await $.prompt.submit({ text: format.request, asUser: true })
    },
    // Cues the request up in the message box to edit before sending.
    edit: async (format: Format) => {
      await reset()
      await $.prompt.fill({ text: format.request })
    },
  }
}

// The choices, in one row that swaps in place: first the four formats; after a click, that format's
// Send now / Edit first. Same height, spacing and gray lead in both states, so the swap stays calm.
function choiceRow({ Box, Button, Text }: Shared, actions: ReturnType<typeof actionsFor>, pickedKey: string | null, lead?: string) {
  const chosen = FORMATS.find(format => format.key === pickedKey)

  if (chosen !== undefined) {
    return (
      <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
        <Text dimColor>{chosen.label}:</Text>
        <Button key="send-now" label="Send now" variant="primary" onPress={() => actions.send(chosen)} />
        <Button key="edit-first" label="Edit first" onPress={() => actions.edit(chosen)} />
        <Button key="back" label="Back" plain dimColor onPress={actions.back} />
      </Box>
    )
  }

  return (
    <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
      {lead !== undefined && <Text dimColor>{lead}</Text>}
      {FORMATS.map(format => (
        <Button key={format.key} label={format.label} onPress={() => actions.pick(format)} />
      ))}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'explain',
      description: 'Explain your last reply another way',
      argumentHint: '[plain | diagram | page | video]',
    })

    return next(e)
  })

  // While Claude works on something new, the row steps away from the previous reply.
  on('turn.start', async ($, e, next) => {
    await update($, isRowOffered, () => false)
    await update($, picked, () => null)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const isMainAnswer = e.agentId === undefined && e.reason === 'answer' && e.answer.trim() !== ''

    if (isMainAnswer) {
      await update($, lastAnswer, () => e.answer)
      await update($, isRowOffered, () => e.answer.trim().length >= MIN_ANSWER_LENGTH)
      await update($, isChooserOpen, () => false)
      await update($, picked, () => null)
    }

    return next(e)
  })

  // `/explain` opens the chooser above the message box; `/explain diagram` (or plain, page, video) sends at once.
  on('command.run', { command: 'explain' }, async ($, e) => {
    if ((await read($, lastAnswer)) === null) {
      return { text: 'Nothing to explain yet. Ask Claude something first.' }
    }

    const format = formatFor(e.args)

    if (format !== undefined) {
      // On a timer so the request outlives this command's own run, then starts once the session is idle.
      $.clock.after(0, () => void $.prompt.submit({ text: format.request, asUser: true }))

      return { text: `Explaining your last reply: ${format.label.toLowerCase()}.` }
    }

    if (e.args.trim() !== '') {
      return { text: `Unknown format "${e.args.trim()}". Try plain, diagram, page or video.` }
    }

    await update($, picked, () => null)
    await update($, isChooserOpen, () => true)

    return { text: 'Pick a format above the message box.' }
  })

  // The row: under the last piece of the latest long reply only. Every other reply keeps the
  // engine's own drawing, and the row moves on as soon as Claude starts something new.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const answer = await read($, lastAnswer)
    const isOffered = await read($, isRowOffered)
    const { text } = e.props
    const piece = normalize(text)
    const isLatestEnding = isOffered && answer !== null && piece !== '' && normalize(answer).endsWith(piece)

    if (!isLatestEnding || text.length > MAX_MARKDOWN_LENGTH) {
      return next(e)
    }

    const elements = $.ui.resolve(e)
    const { Box, Markdown } = elements

    return (
      <Box flexDirection="column">
        <Markdown text={text} />
        <Box marginTop={1}>{choiceRow(elements, actionsFor($), await read($, picked), 'Explain another way')}</Box>
      </Box>
    )
  })

  // The chooser /explain opens above the message box, for the latest reply.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const answer = await read($, lastAnswer)
    const isOpen = await read($, isChooserOpen)

    if (e.props.hasSurvey || e.props.isWorking || !isOpen || answer === null) {
      return next(e)
    }

    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const actions = actionsFor($)
    const flat = normalize(answer)
    const opening = flat.length > QUOTE_LENGTH ? `${flat.slice(0, QUOTE_LENGTH)}…` : flat

    // Heading and Dismiss share the top line so Dismiss can never be pushed out of view.
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
          <Box flexDirection="row" gap={1} flexShrink={1}>
            <Box flexShrink={0}>
              <Text bold>Explain your last reply another way</Text>
            </Box>
            <Text dimColor wrap="truncate">“{opening}”</Text>
          </Box>
          <Button key="dismiss" label="Dismiss" role="dismiss" plain dimColor onPress={actions.reset} />
        </Box>
        {choiceRow(elements, actions, await read($, picked))}
      </Box>
    )
  })
}
