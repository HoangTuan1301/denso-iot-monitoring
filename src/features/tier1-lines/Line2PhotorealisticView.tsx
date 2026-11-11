/**
 * @file Line2PhotorealisticView.tsx
 * @description Sơ đồ dây chuyền & trạng thái thiết bị Line 2 (LN-PNT-02)
 * Bố cục 4 công đoạn: OP10 (Lò sấy Kawasumi), OP20 (Trạm sấy), OP30 (Trạm sơn), OP40 (Robot Yaskawa EPX)
 * Phong cách thị giác bám sát 100% Line 1 đã duyệt.
 */

import {
  LineGenericPhotorealisticView,
  LINE2_STATION_CONFIGS,
  StationFlowData,
} from './LineGenericPhotorealisticView';

interface Line2PhotorealisticViewProps {
  flowStations: StationFlowData[];
  onSelectMachine: (machineId: string) => void;
  currentLine?: any;
}

export function Line2PhotorealisticView({
  flowStations,
  onSelectMachine,
  currentLine,
}: Line2PhotorealisticViewProps) {
  return (
    <LineGenericPhotorealisticView
      lineId="LN-PNT-02"
      lineCode="LN-PNT-02"
      lineTitle="Sơ đồ dây chuyền & trạng thái thiết bị - LN-PNT-02"
      lineSubtitle="Dây chuyền Paint – Xử lý bề mặt và sơn phủ công nghiệp"
      bgImageUrl="/images/lines/line2-diagram-body.jpg"
      stationConfigs={LINE2_STATION_CONFIGS}
      flowStations={flowStations}
      onSelectMachine={onSelectMachine}
      currentLine={currentLine}
    />
  );
}
