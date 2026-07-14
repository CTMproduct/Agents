import { eloToTier } from './ranked.service';

describe('eloToTier (ELO -> tier emocional)', () => {
  it('mapea sub-tiers con divisiones IV..I', () => {
    expect(eloToTier(1000)).toEqual({ tier: 'IRON', division: 4 });
    expect(eloToTier(1199)).toEqual({ tier: 'IRON', division: 1 });
    expect(eloToTier(1200)).toEqual({ tier: 'BRONZE', division: 4 });
    expect(eloToTier(1500)).toEqual({ tier: 'SILVER', division: 2 });
    expect(eloToTier(1600)).toEqual({ tier: 'GOLD', division: 4 });
    expect(eloToTier(2000)).toEqual({ tier: 'DIAMOND', division: 4 });
    expect(eloToTier(2199)).toEqual({ tier: 'DIAMOND', division: 1 });
  });

  it('mapea apex sin division y respeta el piso', () => {
    expect(eloToTier(2200).tier).toBe('MASTER');
    expect(eloToTier(2600).tier).toBe('GRANDMASTER');
    expect(eloToTier(2800).tier).toBe('CHALLENGER');
    expect(eloToTier(300)).toEqual({ tier: 'IRON', division: 4 }); // por debajo del piso
  });
});
