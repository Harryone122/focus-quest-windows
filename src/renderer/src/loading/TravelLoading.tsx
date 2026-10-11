import { travelLoadingDrawing } from './travelLoadingDrawing'

export function TravelLoading({ paused = false }: { paused?: boolean }): React.JSX.Element {
  return <div className="travel-loading" role="status" aria-label="旅人正在準備下一段路" data-paused={paused}
    dangerouslySetInnerHTML={{ __html: travelLoadingDrawing }} />
}
