import { useCallback, useMemo, useState } from 'react'
import { AfterFocus } from './AfterFocus'
import { DepartureSheet } from './DepartureSheet'
import { LobbyA } from './LobbyA'
import {
  AFTER_SCENARIOS, LOBBY_SCENARIOS, departureFromLobby, sampleRunningApps, useMockAfter, useMockLobby,
  type AfterScenario, type LobbyScenario
} from './lobbyMock'
import type { LobbyActions } from './lobbyTypes'

// Dev-only previews of the §47 screens with sample data, until the back end supplies them.
//   #/qa/lobby-a-<scenario>  start, partial, choose, selected, yesterday, final, returned, empty
//   #/qa/after-<scenario>    task, complete, partial, short
// or FOCUSQUEST_QA_VIEW=lobby-a-<scenario> / after-<scenario>.

export function lobbyPreviewFromHash(hash: string): LobbyScenario | null {
  const match = /^#\/?qa\/lobby-a-([a-z]+)$/.exec(hash)
  if (!match) return null
  return (LOBBY_SCENARIOS as readonly string[]).includes(match[1]) ? match[1] as LobbyScenario : null
}

export function afterPreviewFromHash(hash: string): AfterScenario | null {
  const match = /^#\/?qa\/after-([a-z]+)$/.exec(hash)
  if (!match) return null
  return (AFTER_SCENARIOS as readonly string[]).includes(match[1]) ? match[1] as AfterScenario : null
}

export function LobbyPreview({ scenario }: { scenario: LobbyScenario }): React.JSX.Element {
  const [model, mockActions] = useMockLobby(scenario)
  const [departing, setDeparting] = useState(false)
  const [notice, setNotice] = useState('')
  const departure = departing ? departureFromLobby(model) : null
  const actions = useMemo<LobbyActions>(() => ({
    ...mockActions,
    primary: () => { if (departureFromLobby(model)) setDeparting(true); else mockActions.primary() }
  }), [mockActions, model])
  return <div className="view-content lobby-a-view">
    <LobbyA
      model={model}
      actions={actions}
      overlay={<>
        {departure && <DepartureSheet
          model={departure}
          loadApps={sampleRunningApps}
          onCancel={() => setDeparting(false)}
          onConfirm={(input) => { setDeparting(false); setNotice(`預覽：這裡會開始專注（最低 ${input.minimumMinutes} 分鐘）`) }}
        />}
        {notice && <p className="la-toast" role="status" onClick={() => setNotice('')}>{notice}</p>}
      </>}
    />
  </div>
}

export function AfterPreview({ scenario }: { scenario: AfterScenario }): React.JSX.Element {
  const [finished, setFinished] = useState(false)
  const onFinish = useCallback(() => setFinished(true), [])
  const [model, actions] = useMockAfter(scenario, onFinish)
  if (finished) return <div className="after-focus-preview"><LobbyPreview scenario={model.resolution === 'complete' ? 'choose' : 'partial'} /></div>
  return <AfterFocus model={model} actions={actions} seed={20260926} coreOwned={false} worldMarks={['tree_traces_seen']} />
}
