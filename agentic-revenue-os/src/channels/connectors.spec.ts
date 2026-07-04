import { WebchatConnector } from './webchat.connector';
import { WhatsAppConnector } from './whatsapp.connector';

describe('WebchatConnector.normalize', () => {
  const c = new WebchatConnector();
  it('normaliza un payload valido', () => {
    const e = c.normalize({ sessionId: 's-1', name: 'Ana', message: 'Hola' });
    expect(e.externalId).toBe('s-1');
    expect(e.body).toBe('Hola');
    expect(e.channel).toBe('WEBCHAT');
  });
  it('rechaza payload sin message', () => {
    expect(() => c.normalize({ sessionId: 's-1' })).toThrow();
  });
});

describe('WhatsAppConnector.normalize (formato Cloud API)', () => {
  const c = new WhatsAppConnector();
  it('normaliza un webhook real de WhatsApp', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            contacts: [{ profile: { name: 'Carlos' }, wa_id: '57300...' }],
            messages: [{ id: 'wamid.X', from: '573001112233', text: { body: 'Quiero cotizar Cancun' } }],
          },
        }],
      }],
    };
    const e = c.normalize(payload);
    expect(e.externalId).toBe('573001112233');
    expect(e.displayName).toBe('Carlos');
    expect(e.body).toContain('Cancun');
  });
  it('rechaza webhooks sin mensaje de texto', () => {
    expect(() => c.normalize({ entry: [] })).toThrow();
  });
});
