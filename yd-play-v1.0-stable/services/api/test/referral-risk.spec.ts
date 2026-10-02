import { calculateReferralRisk } from '../src/modules/referrals/risk';

const config = {
  sameDeviceRisk: 80,
  sameIpRisk: 20,
  ipVelocityRisk: 35,
  deviceMultiAccountRisk: 60,
  inviterVelocityRisk: 40
};

describe('referral risk', () => {
  it('keeps a same-IP-only case below the default review threshold', () => {
    const result = calculateReferralRisk({
      selfReferral: false,
      sameDevice: false,
      sameIp: true,
      highIpSignupVelocity: false,
      deviceUsedByMultipleAccounts: false,
      highInviterVelocity: false
    }, config);
    expect(result.score).toBe(20);
    expect(result.flags.map((x) => x.ruleCode)).toEqual(['same_ip']);
  });

  it('treats shared device as strong risk', () => {
    const result = calculateReferralRisk({
      selfReferral: false,
      sameDevice: true,
      sameIp: false,
      highIpSignupVelocity: false,
      deviceUsedByMultipleAccounts: false,
      highInviterVelocity: false
    }, config);
    expect(result.score).toBe(80);
  });

  it('caps combined risk at 100', () => {
    const result = calculateReferralRisk({
      selfReferral: true,
      sameDevice: true,
      sameIp: true,
      highIpSignupVelocity: true,
      deviceUsedByMultipleAccounts: true,
      highInviterVelocity: true
    }, config);
    expect(result.score).toBe(100);
    expect(result.flags.length).toBe(6);
  });
});
