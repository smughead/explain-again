import { test, expect, mock } from 'claude-code/testing'

const OLD_REPLY = 'An older reply about something else entirely, with enough words to be long. '.repeat(10)
const INTRO = 'Here is what changed in the renewal numbers this quarter. '.repeat(6)
const ENDING = 'Fixing the invite flow is the cheaper lever, and raising the cap helps fewer accounts. '.repeat(6)
const ANSWER = `${INTRO}\n\n${ENDING}`
const ENGINE = () => ({ type: 'Text', props: {}, children: ['engine drawing'] }) as any
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 140, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as any
const piece = (text: string) => ({ component: 'AssistantMessage', props: { text, isFirstOfReply: false } }) as any
const command = (args: string) =>
  ({ command: 'explain', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 140 } }) as any

// Stands in for the engine beneath the plugin, and records what the plugin sends or cues up.
function world(on: any) {
  const sent: any[] = []
  const filled: string[] = []
  mock.store(on)
  on('ui.render', ENGINE)
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('prompt.submit', ($: any, e: any) => { sent.push(e); return { text: e.text } })
  on('prompt.fill', ($: any, e: any) => { filled.push(e.text); return { isFilled: true, text: e.text } })
  return { sent, filled }
}
const finish = ($: any, answer: string) =>
  $.turn.complete({ answer, durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as any)

test('the first view is just the four formats under the latest long reply, on every surface', async ($, on) => {
  world(on)
  await finish($, ANSWER)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ending = await $.ui.mount({ plugin: 'explain-again', surface, ...piece(ENDING) })
    expect(await ending.find({ type: 'Markdown' })).toBeDefined()
    expect(await ending.find({ type: 'Text', text: /Explain another way/ })).toBeDefined()
    for (const key of ['plain', 'diagram', 'page', 'video']) {
      expect(await ending.find({ key })).toBeDefined()
    }
    const drawn = JSON.stringify(await ending.drawn())
    expect(drawn).not.toContain('✎')
    expect(drawn).not.toContain('Tip')
    expect(await ending.find({ key: 'send-now' })).toBeUndefined()
    const intro = await $.ui.mount({ plugin: 'explain-again', surface, ...piece(INTRO) })
    expect(await intro.find({ key: 'diagram' })).toBeUndefined()
    const older = await $.ui.mount({ plugin: 'explain-again', surface, ...piece(OLD_REPLY) })
    expect(await older.find({ key: 'diagram' })).toBeUndefined()
    await ending.unmount()
    await intro.unmount()
    await older.unmount()
  }
})

test('clicking a format swaps the row to Send now / Edit first; Back returns', async ($, on) => {
  world(on)
  await finish($, ANSWER)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'explain-again', surface, ...piece(ENDING) })
    await ui.press({ key: 'diagram' })
    expect(await ui.find({ type: 'Text', text: /As a diagram:/ })).toBeDefined()
    expect(JSON.stringify(await ui.drawn())).toContain('{"type":"Text","props":{"dimColor":true},"children":["As a diagram",":"]}')
    expect(await ui.find({ key: 'send-now' })).toBeDefined()
    expect(await ui.find({ key: 'edit-first' })).toBeDefined()
    expect(await ui.find({ key: 'plain' })).toBeUndefined()
    await ui.press({ key: 'back' })
    expect(await ui.find({ key: 'plain' })).toBeDefined()
    expect(await ui.find({ key: 'send-now' })).toBeUndefined()
    await ui.unmount()
  }
})

test('Send now sends the request as the person\'s words, then the row resets', async ($, on) => {
  const { sent } = world(on)
  await finish($, ANSWER)
  const ui = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(ENDING) })
  await ui.press({ key: 'diagram' })
  await ui.press({ key: 'send-now' })
  expect(sent[0].text).toBe('Show your last reply as a diagram I can take in at a glance, right here in the chat.')
  expect(sent[0].origin).toMatchObject({ kind: 'plugin', asUser: true })
  expect(await ui.find({ key: 'plain' })).toBeDefined()
  await ui.unmount()
})

test('Edit first cues the request up in the message box without sending', async ($, on) => {
  const { sent, filled } = world(on)
  await finish($, ANSWER)
  const ui = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(ENDING) })
  await ui.press({ key: 'page' })
  await ui.press({ key: 'edit-first' })
  expect(filled[0]).toContain('interactive web page')
  expect(filled[0]).toContain('outside this project')
  expect(sent.length).toBe(0)
  await ui.unmount()
})

test('every request is short and friendly: files stay out of the project, no em dashes', async ($, on) => {
  const { filled } = world(on)
  await finish($, ANSWER)
  const ui = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(ENDING) })
  for (const key of ['plain', 'diagram', 'page', 'video']) {
    await ui.press({ key })
    await ui.press({ key: 'edit-first' })
  }
  expect(filled.length).toBe(4)
  expect(filled[2]).toContain('outside this project')
  expect(filled[3]).toContain('outside this project')
  expect(filled.some(text => text.includes('—'))).toBe(false)
  await ui.unmount()
})

test('a short reply gets no row', async ($, on) => {
  world(on)
  await finish($, 'Done.')
  const ui = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece('Done.') })
  expect(await ui.find({ key: 'plain' })).toBeUndefined()
  await ui.unmount()
})

test('the row steps away while Claude works, then moves to the new reply', async ($, on) => {
  world(on)
  await finish($, ANSWER)
  const ending = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(ENDING) })
  await ending.press({ key: 'video' })
  await $.turn.start({ text: 'next question', turnId: 't2' } as any)
  expect(await ending.find({ key: 'plain' })).toBeUndefined()
  expect(await ending.find({ key: 'send-now' })).toBeUndefined()
  await finish($, OLD_REPLY)
  const newest = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(OLD_REPLY) })
  expect(await newest.find({ key: 'plain' })).toBeDefined()
  expect(await newest.find({ key: 'send-now' })).toBeUndefined()
  await ending.unmount()
  await newest.unmount()
})

test('/explain opens the chooser with the same two-step choice; Dismiss closes it', async ($, on) => {
  const { sent } = world(on)
  expect((await $.command.run(command(''))).text).toContain('Nothing to explain yet')
  await finish($, ANSWER)
  const band = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...BAND })
  expect(await band.find({ key: 'plain' })).toBeUndefined()
  expect((await $.command.run(command(''))).text).toContain('above the message box')
  expect(await band.find({ type: 'Text', text: /Here is what changed/ })).toBeDefined()
  await band.press({ key: 'plain' })
  await band.press({ key: 'send-now' })
  expect(sent[0].text).toContain('plain, simple English')
  expect(await band.find({ key: 'plain' })).toBeUndefined()
  expect((await $.command.run(command(''))).text).toContain('above the message box')
  await band.press({ key: 'dismiss' })
  expect(await band.find({ key: 'plain' })).toBeUndefined()
  await band.unmount()
})

test('/explain diagram sends at once; an unknown format says what to type', async ($, on) => {
  const { sent } = world(on)
  const clock = mock.clock(on)
  await finish($, ANSWER)
  expect((await $.command.run(command('diagram'))).text).toContain('as a diagram')
  expect((await $.command.run(command('web'))).text).toContain('as a web page')
  expect((await $.command.run(command('sculpture'))).text).toContain('Try plain, diagram, page, video or off')
  await clock.advance(1)
  expect(sent[0].text).toContain('diagram')
  expect(sent[1].text).toContain('web page')
})

test('the plain format reads naturally as a button and as the heading after a click', async ($, on) => {
  world(on)
  await finish($, ANSWER)
  const ui = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(ENDING) })
  expect(JSON.stringify(await ui.drawn())).toContain('"label":"In plain English"')
  await ui.press({ key: 'plain' })
  expect(await ui.find({ type: 'Text', text: /In plain English:/ })).toBeDefined()
  await ui.unmount()
})

// A message the person typed and sent themselves.
const type = ($: any, text: string) => $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false } as any)
const note = (e: any) => (e.context ?? []).join('\n')

test('Send now keeps the format on: later messages ask for it, the row shows it with Stop', async ($, on) => {
  const { sent } = world(on)
  await finish($, ANSWER)
  const ui = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(ENDING) })
  await ui.press({ key: 'video' })
  await ui.press({ key: 'send-now' })
  expect(note(sent[0])).toBe('')
  await type($, 'How does the renewal flow work?')
  expect(note(sent[1])).toContain('explainer video')
  expect(note(sent[1])).toContain('about 100 words or more')
  expect(note(sent[1])).not.toContain('—')
  await finish($, OLD_REPLY)
  const newest = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(OLD_REPLY) })
  expect(await newest.find({ type: 'Text', text: /Explaining as a video/ })).toBeDefined()
  expect(await newest.find({ key: 'stop' })).toBeDefined()
  expect(await newest.find({ key: 'video' })).toBeUndefined()
  for (const key of ['plain', 'diagram', 'page']) {
    expect(await newest.find({ key })).toBeDefined()
  }
  await newest.press({ key: 'stop' })
  expect(await newest.find({ key: 'video' })).toBeDefined()
  expect(await newest.find({ key: 'stop' })).toBeUndefined()
  await type($, 'And the next step?')
  expect(note(sent[2])).toBe('')
  await ui.unmount()
  await newest.unmount()
})

test('picking another format while one is on switches to it', async ($, on) => {
  const { sent } = world(on)
  await finish($, ANSWER)
  const ui = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(ENDING) })
  await ui.press({ key: 'video' })
  await ui.press({ key: 'send-now' })
  await finish($, ANSWER)
  await ui.press({ key: 'diagram' })
  await ui.press({ key: 'send-now' })
  await type($, 'Next question')
  expect(note(sent[2])).toContain('diagram')
  expect(note(sent[2])).not.toContain('video')
  await ui.unmount()
})

test('Edit first turns the format on once the draft is sent, if it still asks for that format', async ($, on) => {
  const { sent } = world(on)
  await finish($, ANSWER)
  const ui = await $.ui.mount({ plugin: 'explain-again', surface: 'desktop', ...piece(ENDING) })
  await ui.press({ key: 'diagram' })
  await ui.press({ key: 'edit-first' })
  await type($, 'Never mind, what time is it?')
  await type($, 'Another question')
  expect(note(sent[1])).toBe('')
  await finish($, ANSWER)
  await ui.press({ key: 'diagram' })
  await ui.press({ key: 'edit-first' })
  await type($, 'Show your last reply as a simple diagram with three boxes.')
  await type($, 'Another question')
  expect(note(sent[3])).toContain('diagram')
  await ui.unmount()
})

test('/explain video turns the format on; /explain off stops it', async ($, on) => {
  const { sent } = world(on)
  const clock = mock.clock(on)
  expect((await $.command.run(command('off'))).text).toContain('No format is on')
  await finish($, ANSWER)
  await $.command.run(command('video'))
  await clock.advance(1)
  await type($, 'Next question')
  expect(note(sent[1])).toContain('explainer video')
  expect((await $.command.run(command('off'))).text).toContain('Stopped explaining as a video')
  await type($, 'Another question')
  expect(note(sent[2])).toBe('')
})
