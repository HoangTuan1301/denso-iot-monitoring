/**
 * @file ai.ts
 * @description Định nghĩa các kiểu dữ liệu cốt lõi cho Phân hệ AI Giám sát & Dự đoán (DENSO AI Intelligence)
 */

export type AITabType = 'overview' | 'anomaly' | 'predictive' | 'assistant';

export type AIScenarioId =
  | 'normal'
  | 'high_temp'
  | 'abnormal_vibration'
  | 'multiple_anomalies'
  | 'recovery';

export type AIRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AIEquipmentStatus = 'NORMAL' | 'WARNING' | 'ANOMALOUS';

export interface AIScenario {
  id: AIScenarioId;
  name: string;
  description: string;
  targetMachineId: string;
  targetMachineName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
  rootCause: string;
}

export interface HealthScoreFactors {
  base: number;
  tempPenalty: number;
  vibrationPenalty: number;
  pressurePenalty: number;
  currentPenalty: number;
  agePenalty: number;
  explanation: string;
}

export interface EquipmentHealthItem {
  machineId: string;
  machineCode: string;
  machineName: string;
  lineId: string;
  lineName: string;
  type: string;
  healthScore: number; // 0 - 100
  riskLevel: AIRiskLevel;
  status: AIEquipmentStatus;
  factors: HealthScoreFactors;
  activeAnomaliesCount: number;
  trendDirection: 'up' | 'down' | 'stable';
  lastEvaluated: string;
  keyMetricCode: string;
  keyMetricName: string;
  keyMetricValue: number;
  keyMetricUnit: string;
}

export type AnomalyDetectionRule =
  | 'THRESHOLD_BREACH'
  | 'SUDDEN_SPIKE'
  | 'PERSISTENT_DRIFT';

export interface AIAnomalyEvent {
  id: string;
  timestamp: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  lineName: string;
  metricCode: string;
  metricName: string;
  category: string;
  value: number;
  unit: string;
  warningThreshold: number;
  criticalThreshold: number;
  severity: 'WARNING' | 'CRITICAL';
  detectionRule: AnomalyDetectionRule;
  ruleExplanation: string;
  deviationPercent: number;
  isAcknowledged?: boolean;
}

export type MaintenancePriority =
  | 'P1_CRITICAL'
  | 'P2_HIGH'
  | 'P3_MEDIUM'
  | 'P4_ROUTINE';

export interface AIPredictiveOrder {
  id: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  lineName: string;
  priority: MaintenancePriority;
  healthScore: number;
  confidence?: number;
  component: string;
  symptom: string;
  rootCause: string;
  recommendedAction: string;
  assignee?: string;
  dueDate?: string;
  imageUrl?: string;
  estimatedTimeToDegrade: string; // Có gắn nhãn Demo / Giả lập
  estimatedWorkHours: number;
  suggestedTools: string[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PLANNED';
}

export interface AITrendPoint {
  timestamp: string;
  value: number;
  unit: string;
  warningMin?: number;
  warningMax: number;
  criticalMin?: number;
  criticalMax: number;
  isAnomaly: boolean;
  anomalyType?: AnomalyDetectionRule;
  note?: string;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  highlightCard?: {
    title: string;
    subtitle: string;
    score?: number;
    badge?: string;
    badgeColor?: 'emerald' | 'amber' | 'rose' | 'blue';
  };
  suggestedPrompts?: string[];
}
