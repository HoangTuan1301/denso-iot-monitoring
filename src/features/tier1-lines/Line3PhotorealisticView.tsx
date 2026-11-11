/**
 * @file Line3PhotorealisticView.tsx
 * @description Sơ đồ dây chuyền & trạng thái thiết bị Line 3 (LN-ASM-03)
 * Bố cục 4 công đoạn: OP10 (Robot siết bulong), OP20 (Trạm kiểm tra), OP30 (Messi), OP40 (Băng chuyền TestBench)
 * Phong cách thị giác bám sát 100% Line 1 đã duyệt.
 */

import {
  LineGenericPhotorealisticView,
  LINE3_STATION_CONFIGS,
  StationFlowData,
} from './LineGenericPhotorealisticView';

interface Line3PhotorealisticViewProps {
  flowStations: StationFlowData[];
  onSelectMachine: (machineId: string) => void;
  currentLine?: any;
}

export function Line3PhotorealisticView({
  flowStations,
  onSelectMachine,
  currentLine,
}: Line3PhotorealisticViewProps) {
  return (
    <LineGenericPhotorealisticView
      lineId="LN-ASM-03"
      lineCode="LN-ASM-03"
      lineTitle="Sơ đồ dây chuyền & trạng thái thiết bị - LN-ASM-03"
      lineSubtitle="Dây chuyền Assembly – Lắp ráp cụm chi tiết và kiểm tra hoàn thiện"
      bgImageUrl="/images/lines/line3-diagram-body.jpg"
      stationConfigs={LINE3_STATION_CONFIGS}
      flowStations={flowStations}
      onSelectMachine={onSelectMachine}
      currentLine={currentLine}
    />
  );
}
