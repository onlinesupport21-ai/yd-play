export interface ReferralRiskConfig {
  sameDeviceRisk: number;
  sameIpRisk: number;
  ipVelocityRisk: number;
  deviceMultiAccountRisk: number;
  inviterVelocityRisk: number;
}

export interface ReferralRiskSignals {
  selfReferral: boolean;
  sameDevice: boolean;
  sameIp: boolean;
  highIpSignupVelocity: boolean;
  deviceUsedByMultipleAccounts: boolean;
  highInviterVelocity: boolean;
}

export interface RiskFlag {
  ruleCode: string;
  riskPoints: number;
}

export function calculateReferralRisk(
  signals: ReferralRiskSignals,
  config: ReferralRiskConfig
): { score: number; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  if (signals.selfReferral) flags.push({ ruleCode: 'self_referral', riskPoints: 100 });
  if (signals.sameDevice) flags.push({ ruleCode: 'same_device', riskPoints: config.sameDeviceRisk });
  if (signals.sameIp) flags.push({ ruleCode: 'same_ip', riskPoints: config.sameIpRisk });
  if (signals.highIpSignupVelocity) {
    flags.push({ ruleCode: 'ip_signup_velocity', riskPoints: config.ipVelocityRisk });
  }
  if (signals.deviceUsedByMultipleAccounts) {
    flags.push({ ruleCode: 'device_multi_account', riskPoints: config.deviceMultiAccountRisk });
  }
  if (signals.highInviterVelocity) {
    flags.push({ ruleCode: 'inviter_velocity', riskPoints: config.inviterVelocityRisk });
  }

  // Additive risk is intentionally capped. The individual evidence remains visible to admins.
  const score = Math.min(100, flags.reduce((sum, flag) => sum + flag.riskPoints, 0));
  return { score, flags };
}
